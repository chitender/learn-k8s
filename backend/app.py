import base64
import boto3
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.request
import urllib.error
import uuid
from exam_blueprints import BLUEPRINTS, public_tasks

ddb = boto3.client("dynamodb")
sm = boto3.client("secretsmanager")
ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")

ENTITLEMENTS_TABLE = os.environ["ENTITLEMENTS_TABLE"]
PAYMENTS_TABLE = os.environ["PAYMENTS_TABLE"]
SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
RAZORPAY_SECRET_ARN = os.environ["RAZORPAY_SECRET_ARN"]
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
PRODUCTS = json.loads(os.environ.get("PRODUCTS_JSON", "{}"))
PAID_EXAMS_ENABLED = os.environ.get("PAID_EXAMS_ENABLED", "false").lower() == "true"
ENABLE_LIVE_LABS = os.environ.get("ENABLE_LIVE_LABS", "false").lower() == "true"
LAB_SUBNET_ID = os.environ.get("LAB_SUBNET_ID", "")
LAB_SECURITY_GROUP_ID = os.environ.get("LAB_SECURITY_GROUP_ID", "")
LAB_INSTANCE_PROFILE = os.environ.get("LAB_INSTANCE_PROFILE", "")
LAB_WORKER_AMI = os.environ.get("LAB_WORKER_AMI", "")
LAB_INSTANCE_TYPE = os.environ.get("LAB_INSTANCE_TYPE", "t3a.medium")
LAB_GATEWAY_INSTANCE_ID = os.environ.get("LAB_GATEWAY_INSTANCE_ID", "")
LAB_BASE_URL = os.environ.get("LAB_BASE_URL", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")

_secret_cache = None

def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization,content-type,x-razorpay-signature",
            "access-control-allow-methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, separators=(",", ":")),
    }

def body_json(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return json.loads(raw), raw

def user_id(event):
    claims = (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    return claims.get("sub")

def secrets_value():
    global _secret_cache
    if _secret_cache is None:
        value = sm.get_secret_value(SecretId=RAZORPAY_SECRET_ARN).get("SecretString", "{}")
        _secret_cache = json.loads(value)
    return _secret_cache

def razorpay(method, path, payload=None):
    secret = secrets_value().get("key_secret", "")
    if not RAZORPAY_KEY_ID or not secret:
        raise RuntimeError("Razorpay is not configured.")
    token = base64.b64encode(f"{RAZORPAY_KEY_ID}:{secret}".encode()).decode()
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.razorpay.com" + path,
        data=data,
        method=method,
        headers={"authorization": f"Basic {token}", "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        raise RuntimeError(f"Razorpay API failed ({e.code}): {detail[:300]}")

def payment_item(order_id):
    out = ddb.get_item(TableName=PAYMENTS_TABLE, Key={"order_id":{"S":order_id}}, ConsistentRead=True)
    return out.get("Item")

def product_from_payment(item):
    return item.get("product_id", {}).get("S") if item else None

def create_order(event):
    if not PAID_EXAMS_ENABLED:
        return response(503, {"message":"Paid exam checkout is not enabled yet."})
    uid = user_id(event)
    data, _ = body_json(event)
    product_id = data.get("product_id")
    product = PRODUCTS.get(product_id)
    if not product:
        return response(400, {"message":"Unknown product."})
    receipt = f"lk8s-{uuid.uuid4().hex[:18]}"
    order = razorpay("POST", "/v1/orders", {
        "amount": int(product["amount"]),
        "currency": product.get("currency","INR"),
        "receipt": receipt,
        "notes": {"user_id": uid, "product_id": product_id},
    })
    now = int(time.time())
    ddb.put_item(TableName=PAYMENTS_TABLE, Item={
        "order_id":{"S":order["id"]},
        "user_id":{"S":uid},
        "product_id":{"S":product_id},
        "amount":{"N":str(product["amount"])},
        "status":{"S":"created"},
        "created_at":{"N":str(now)},
    })
    return response(200, {
        "order_id":order["id"],
        "amount":order["amount"],
        "currency":order["currency"],
        "product_name":product["name"],
        "key_id":RAZORPAY_KEY_ID,
    })

def grant_order(order_id, payment_id):
    item = payment_item(order_id)
    if not item:
        raise RuntimeError("Unknown order.")
    product_id = product_from_payment(item)
    product = PRODUCTS.get(product_id)
    if not product:
        raise RuntimeError("Unknown order product.")
    credit_field = product["credit_field"]
    uid = item["user_id"]["S"]
    now = int(time.time())
    try:
        ddb.transact_write_items(TransactItems=[
            {"Update":{"TableName":PAYMENTS_TABLE,"Key":{"order_id":{"S":order_id}},
                "UpdateExpression":"SET #s=:paid, payment_id=:pid, granted_at=:ts",
                "ConditionExpression":"attribute_not_exists(granted_at)",
                "ExpressionAttributeNames":{"#s":"status"},
                "ExpressionAttributeValues":{":paid":{"S":"paid"},":pid":{"S":payment_id},":ts":{"N":str(now)}}}},
            {"Update":{"TableName":ENTITLEMENTS_TABLE,"Key":{"user_id":{"S":uid}},
                "UpdateExpression":f"ADD {credit_field} :one SET updated_at=:ts",
                "ExpressionAttributeValues":{":one":{"N":"1"},":ts":{"N":str(now)}}}},
        ])
        return True
    except ddb.exceptions.TransactionCanceledException:
        return False

def verify_payment(event):
    uid = user_id(event)
    data, _ = body_json(event)
    order_id = data.get("razorpay_order_id","")
    payment_id = data.get("razorpay_payment_id","")
    signature = data.get("razorpay_signature","")
    item = payment_item(order_id)
    if not item or item["user_id"]["S"] != uid:
        return response(404, {"message":"Order not found."})
    secret = secrets_value().get("key_secret","")
    expected = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return response(400, {"message":"Payment signature verification failed."})
    payment = razorpay("GET", f"/v1/payments/{payment_id}")
    order = razorpay("GET", f"/v1/orders/{order_id}")
    if payment.get("status") != "captured" or order.get("status") != "paid":
        return response(409, {"message":"Payment is not captured/paid yet."})
    granted = grant_order(order_id, payment_id)
    return response(200, {"verified":True, "credit_granted":granted})

def webhook(event):
    data, raw = body_json(event)
    signature = ((event.get("headers") or {}).get("x-razorpay-signature")
                 or (event.get("headers") or {}).get("X-Razorpay-Signature") or "")
    secret = secrets_value().get("webhook_secret","")
    expected = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not secret or not hmac.compare_digest(expected, signature):
        return response(401, {"message":"Invalid webhook signature."})
    evt = data.get("event","")
    if evt in ("order.paid","payment.captured"):
        payment = (((data.get("payload") or {}).get("payment") or {}).get("entity") or {})
        order = (((data.get("payload") or {}).get("order") or {}).get("entity") or {})
        order_id = order.get("id") or payment.get("order_id")
        payment_id = payment.get("id","webhook")
        if order_id:
            try: grant_order(order_id, payment_id)
            except RuntimeError: pass
    return response(200, {"ok":True})

def entitlements(event):
    uid = user_id(event)
    item = ddb.get_item(TableName=ENTITLEMENTS_TABLE, Key={"user_id":{"S":uid}}, ConsistentRead=True).get("Item",{})
    return response(200,{
        "ckad_credits":int(item.get("ckad_credits",{}).get("N","0")),
        "cks_credits":int(item.get("cks_credits",{}).get("N","0")),
    })

def worker_user_data(session_id, exam_type, password):
    return f"""#!/bin/bash
set -euxo pipefail
dnf install -y docker curl
systemctl enable --now docker
useradd -m -s /bin/bash candidate || true
usermod -aG docker candidate
echo 'candidate ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/candidate
curl -L -o /usr/local/bin/kubectl https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubectl
chmod +x /usr/local/bin/kubectl
curl -L -o /usr/local/bin/kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
chmod +x /usr/local/bin/kind
curl -L -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64
chmod +x /usr/local/bin/ttyd
sudo -iu candidate kind create cluster --name exam --wait 180s\nsudo -iu candidate kubectl create namespace exam
cat >/etc/systemd/system/ttyd.service <<'EOF'
[Unit]
After=network-online.target docker.service
[Service]
User=candidate
Environment=HOME=/home/candidate
WorkingDirectory=/home/candidate
ExecStart=/usr/local/bin/ttyd -W -p 7681 -i 0.0.0.0 -c candidate:{password} /bin/bash -l
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now ttyd
echo '{session_id} {exam_type}' >/etc/learn-k8s-session
"""

def launch_worker(session_id, exam_type, password):
    if not ENABLE_LIVE_LABS:
        return None
    params = {
        "ImageId":LAB_WORKER_AMI,
        "InstanceType":LAB_INSTANCE_TYPE,
        "MinCount":1,"MaxCount":1,
        "SubnetId":LAB_SUBNET_ID,
        "SecurityGroupIds":[LAB_SECURITY_GROUP_ID],
        "IamInstanceProfile":{"Name":LAB_INSTANCE_PROFILE},
        "UserData":base64.b64encode(worker_user_data(session_id,exam_type,password).encode()).decode(),
        "TagSpecifications":[{"ResourceType":"instance","Tags":[
            {"Key":"Name","Value":f"learn-k8s-{session_id[:8]}"},
            {"Key":"LearnK8sSession","Value":session_id},
            {"Key":"AutoTerminate","Value":"true"},
        ]}],
    }
    result = ec2.run_instances(**params)
    return result["Instances"][0]["InstanceId"]

def consume_credit(uid, exam_type, session_id, expires_at, password):
    field = "ckad_credits" if exam_type == "CKAD" else "cks_credits"
    ddb.transact_write_items(TransactItems=[
        {"Update":{"TableName":ENTITLEMENTS_TABLE,"Key":{"user_id":{"S":uid}},
          "UpdateExpression":f"ADD {field} :minus",
          "ConditionExpression":f"attribute_exists({field}) AND {field} >= :one",
          "ExpressionAttributeValues":{":minus":{"N":"-1"},":one":{"N":"1"}}}},
        {"Put":{"TableName":SESSIONS_TABLE,"Item":{
          "session_id":{"S":session_id},"user_id":{"S":uid},"exam_type":{"S":exam_type},
          "status":{"S":"provisioning"},"started_at":{"N":str(int(time.time()))},
          "expires_at":{"N":str(expires_at)},"terminal_password":{"S":password}}}},
    ])

def start_exam(event):
    uid = user_id(event)
    data,_ = body_json(event)
    exam_type = str(data.get("exam_type","")).upper()
    if exam_type not in BLUEPRINTS:
        return response(400, {"message":"Exam type must be CKAD or CKS."})
    session_id = str(uuid.uuid4())
    expires_at = int(time.time()) + 2*60*60
    password = secrets.token_urlsafe(12)
    try:
        consume_credit(uid, exam_type, session_id, expires_at, password)
    except ddb.exceptions.TransactionCanceledException:
        return response(402, {"message":f"No {exam_type} exam credits available."})
    try:
        instance_id = launch_worker(session_id, exam_type, password)
        if instance_id:
            ddb.update_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":session_id}},
              UpdateExpression="SET instance_id=:i",ExpressionAttributeValues={":i":{"S":instance_id}})
    except Exception as exc:
        field = "ckad_credits" if exam_type == "CKAD" else "cks_credits"
        ddb.update_item(TableName=ENTITLEMENTS_TABLE,Key={"user_id":{"S":uid}},
          UpdateExpression=f"ADD {field} :one",ExpressionAttributeValues={":one":{"N":"1"}})
        ddb.update_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":session_id}},
          UpdateExpression="SET #s=:f, failure_reason=:r",ExpressionAttributeNames={"#s":"status"},
          ExpressionAttributeValues={":f":{"S":"failed"},":r":{"S":str(exc)[:500]}})
        return response(500, {"message":"Could not provision exam lab. Credit was restored."})
    return response(200, session_payload(session_id, uid))

def session_payload(session_id, uid):
    item = ddb.get_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":session_id}},ConsistentRead=True).get("Item")
    if not item or item.get("user_id",{}).get("S") != uid:
        return {"message":"Session not found.","statusCode":404}
    exam_type = item["exam_type"]["S"]
    status = item["status"]["S"]
    terminal_url = item.get("terminal_url",{}).get("S")
    return {
        "session_id":session_id,"exam_type":exam_type,"status":status,
        "expires_at":int(item["expires_at"]["N"]),
        "tasks":public_tasks(exam_type),
        "terminal_url":terminal_url,
        "terminal_username":"candidate" if terminal_url else None,
        "terminal_password":item.get("terminal_password",{}).get("S") if terminal_url else None,
    }

def worker_terminal_ready(instance_id):
    try:
        sent = ssm.send_command(
            InstanceIds=[instance_id],
            DocumentName="AWS-RunShellScript",
            Parameters={"commands":["curl -fsS --max-time 2 http://localhost:7681/ >/dev/null"]},
            TimeoutSeconds=10,
        )
        command_id = sent["Command"]["CommandId"]
        for _ in range(5):
            time.sleep(1)
            try:
                inv = ssm.get_command_invocation(CommandId=command_id, InstanceId=instance_id)
                if inv.get("Status") == "Success":
                    return True
                if inv.get("Status") in ("Failed","TimedOut","Cancelled"):
                    return False
            except ssm.exceptions.InvocationDoesNotExist:
                pass
    except Exception:
        return False
    return False

def maybe_activate_session(item):
    if item.get("status",{}).get("S") != "provisioning" or not ENABLE_LIVE_LABS:
        return
    instance_id = item.get("instance_id",{}).get("S")
    if not instance_id: return
    inst = ec2.describe_instances(InstanceIds=[instance_id])["Reservations"][0]["Instances"][0]
    if inst["State"]["Name"] != "running": return
    ip = inst.get("PrivateIpAddress")
    sid = item["session_id"]["S"]
    if not ip or not LAB_GATEWAY_INSTANCE_ID: return
    conf = f"""location /session/{sid}/ {{
  proxy_pass http://{ip}:7681/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 7200s;
}}"""
    encoded = base64.b64encode(conf.encode()).decode()
    command = f"echo {encoded} | base64 -d >/etc/nginx/lab-routes/{sid}.conf && nginx -t && systemctl reload nginx"
    ssm.send_command(InstanceIds=[LAB_GATEWAY_INSTANCE_ID],DocumentName="AWS-RunShellScript",
                     Parameters={"commands":[command]})
    url = f"{LAB_BASE_URL.rstrip('/')}/session/{sid}/"
    ddb.update_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":sid}},
      UpdateExpression="SET #s=:r, terminal_url=:u",ExpressionAttributeNames={"#s":"status"},
      ExpressionAttributeValues={":r":{"S":"ready"},":u":{"S":url}})

def get_session(event, session_id):
    uid = user_id(event)
    item = ddb.get_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":session_id}},ConsistentRead=True).get("Item")
    if not item or item.get("user_id",{}).get("S") != uid:
        return response(404,{"message":"Session not found."})
    try: maybe_activate_session(item)
    except Exception: pass
    payload = session_payload(session_id, uid)
    if payload.get("statusCode"): return response(payload["statusCode"],{"message":payload["message"]})
    return response(200,payload)

def submit_exam(event, session_id):
    uid = user_id(event)
    item = ddb.get_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":session_id}},ConsistentRead=True).get("Item")
    if not item or item.get("user_id",{}).get("S") != uid:
        return response(404,{"message":"Session not found."})
    if item.get("status",{}).get("S") != "ready":
        return response(409,{"message":"Session is not ready for grading."})

    instance_id = item.get("instance_id",{}).get("S")
    exam_type = item["exam_type"]["S"]
    if not instance_id:
        return response(409,{"message":"No live worker is attached to this session."})

    lines = []
    for task in BLUEPRINTS[exam_type]:
        verify = task["verify"].replace("'", "'\\''")
        lines.append(f"if bash -lc '{verify}'; then echo '{task['id']}|1'; else echo '{task['id']}|0'; fi")
    command = "\n".join(lines)

    sent = ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands":[command]},
        TimeoutSeconds=20,
    )
    command_id = sent["Command"]["CommandId"]
    output = ""
    for _ in range(12):
        time.sleep(1)
        try:
            inv = ssm.get_command_invocation(CommandId=command_id, InstanceId=instance_id)
            if inv.get("Status") in ("Success","Failed","TimedOut","Cancelled"):
                output = inv.get("StandardOutputContent","")
                break
        except ssm.exceptions.InvocationDoesNotExist:
            pass

    results = {}
    for line in output.splitlines():
        if "|" in line:
            task_id, ok = line.strip().split("|",1)
            results[task_id] = ok == "1"

    score = sum(task["weight"] for task in BLUEPRINTS[exam_type] if results.get(task["id"]))
    now = int(time.time())
    ddb.update_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id":{"S":session_id}},
        UpdateExpression="SET #s=:done, score=:score, completed_at=:ts",
        ExpressionAttributeNames={"#s":"status"},
        ExpressionAttributeValues={":done":{"S":"completed"},":score":{"N":str(score)},":ts":{"N":str(now)}},
    )

    try:
        ec2.terminate_instances(InstanceIds=[instance_id])
    except Exception:
        pass
    if LAB_GATEWAY_INSTANCE_ID:
        try:
            ssm.send_command(
                InstanceIds=[LAB_GATEWAY_INSTANCE_ID],
                DocumentName="AWS-RunShellScript",
                Parameters={"commands":[f"rm -f /etc/nginx/lab-routes/{session_id}.conf; nginx -t && systemctl reload nginx"]},
            )
        except Exception:
            pass

    return response(200,{
        "session_id":session_id,
        "exam_type":exam_type,
        "score":score,
        "max_score":100,
        "results":[{"id":task["id"],"title":task["title"],"weight":task["weight"],"passed":bool(results.get(task["id"]))} for task in BLUEPRINTS[exam_type]],
    })

def cleanup():
    now = int(time.time())
    scan = ddb.scan(TableName=SESSIONS_TABLE,FilterExpression="expires_at < :now",
                    ExpressionAttributeValues={":now":{"N":str(now)}})
    for item in scan.get("Items",[]):
        if item.get("status",{}).get("S") in ("expired","completed"): continue
        iid = item.get("instance_id",{}).get("S")
        sid = item["session_id"]["S"]
        if iid:
            try: ec2.terminate_instances(InstanceIds=[iid])
            except Exception: pass
        if LAB_GATEWAY_INSTANCE_ID:
            try:
                ssm.send_command(InstanceIds=[LAB_GATEWAY_INSTANCE_ID],DocumentName="AWS-RunShellScript",
                  Parameters={"commands":[f"rm -f /etc/nginx/lab-routes/{sid}.conf; nginx -t && systemctl reload nginx"]})
            except Exception: pass
        ddb.update_item(TableName=SESSIONS_TABLE,Key={"session_id":{"S":sid}},
          UpdateExpression="SET #s=:e",ExpressionAttributeNames={"#s":"status"},
          ExpressionAttributeValues={":e":{"S":"expired"}})

def handler(event, context):
    if event.get("source") == "learn-k8s.cleanup":
        cleanup()
        return {"ok":True}
    route = event.get("routeKey","")
    if route == "OPTIONS /{proxy+}": return response(204,{})
    if route == "GET /health":
        return response(200,{"ok":True,"paid_exams_enabled":PAID_EXAMS_ENABLED,"live_labs_enabled":ENABLE_LIVE_LABS})
    if route == "POST /payments/webhook": return webhook(event)
    if not user_id(event): return response(401,{"message":"Authentication required."})
    if route == "GET /me/entitlements": return entitlements(event)
    if route == "POST /payments/order": return create_order(event)
    if route == "POST /payments/verify": return verify_payment(event)
    if route == "POST /exams/start": return start_exam(event)
    if route.startswith("GET /exams/session/"):
        return get_session(event, route.split("/")[-1])
    return response(404,{"message":"Not found."})
