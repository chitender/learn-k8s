import base64
import boto3
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.request
import uuid

from exam_catalog import (
    CATALOGS,
    EXAM_BASELINE,
    catalog_list,
    catalog_tasks,
    public_tasks,
)

ddb = boto3.client("dynamodb")
sm = boto3.client("secretsmanager")
ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")

ENTITLEMENTS_TABLE = os.environ["ENTITLEMENTS_TABLE"]
PAYMENTS_TABLE = os.environ["PAYMENTS_TABLE"]
SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
APP_SECRET_ARN = os.environ["APP_SECRET_ARN"]

LAB_SUBNET_ID = os.environ.get("LAB_SUBNET_ID", "")
LAB_SECURITY_GROUP_ID = os.environ.get("LAB_SECURITY_GROUP_ID", "")
LAB_INSTANCE_PROFILE = os.environ.get("LAB_INSTANCE_PROFILE", "")
LAB_GATEWAY_INSTANCE_ID = os.environ.get("LAB_GATEWAY_INSTANCE_ID", "")
LAB_BASE_URL = os.environ.get("LAB_BASE_URL", "")
LAB_INSTANCE_TYPE = os.environ.get("LAB_INSTANCE_TYPE", "t3a.medium")
LAB_WORKER_AMI = os.environ.get("LAB_WORKER_AMI", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")

_config_cache = {"value": None, "expires": 0}


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
    claims = (
        (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {})
        .get("claims")
        or {}
    )
    return claims.get("sub")


def app_config():
    now = time.time()
    if _config_cache["value"] is None or now >= _config_cache["expires"]:
        value = sm.get_secret_value(SecretId=APP_SECRET_ARN).get("SecretString", "{}")
        _config_cache["value"] = json.loads(value)
        _config_cache["expires"] = now + 60
    return _config_cache["value"]


def enabled(name):
    return str(app_config().get(name, "false")).lower() == "true"


def plans():
    return app_config().get("plans") or {}


def razorpay_key_id():
    return app_config().get("razorpay_key_id", "")


def razorpay(method, path, payload=None):
    cfg = app_config()
    key_id = cfg.get("razorpay_key_id", "")
    key_secret = cfg.get("razorpay_key_secret", "")
    if not key_id or not key_secret:
        raise RuntimeError("Razorpay is not configured.")

    token = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        "https://api.razorpay.com" + path,
        data=data,
        method=method,
        headers={
            "authorization": f"Basic {token}",
            "content-type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as result:
            return json.loads(result.read().decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise RuntimeError(f"Razorpay API failed ({error.code}): {detail[:300]}")


def ensure_entitlements(uid):
    try:
        ddb.put_item(
            TableName=ENTITLEMENTS_TABLE,
            Item={
                "user_id": {"S": uid},
                "exam_credits": {"N": "2"},
                "plan": {"S": "free"},
                "free_trial_granted": {"BOOL": True},
                "created_at": {"N": str(int(time.time()))},
            },
            ConditionExpression="attribute_not_exists(user_id)",
        )
    except ddb.exceptions.ConditionalCheckFailedException:
        pass

    return ddb.get_item(
        TableName=ENTITLEMENTS_TABLE,
        Key={"user_id": {"S": uid}},
        ConsistentRead=True,
    ).get("Item", {})


def entitlement_payload(item):
    return {
        "exam_credits": int(item.get("exam_credits", {}).get("N", "0")),
        "plan": item.get("plan", {}).get("S", "free"),
        "free_trial_granted": item.get("free_trial_granted", {}).get("BOOL", False),
    }


def plan_payloads():
    output = [
        {
            "id": "free",
            "name": "Free",
            "credits": 2,
            "amount": 0,
            "currency": "INR",
            "price_display": "Free",
            "purchasable": False,
        }
    ]
    for plan_id in ("bronze", "silver", "gold"):
        plan = plans().get(plan_id)
        if not plan:
            continue
        amount = int(plan["amount"])
        output.append(
            {
                "id": plan_id,
                "name": plan.get("name", plan_id.title()),
                "credits": int(plan["credits"]),
                "amount": amount,
                "currency": plan.get("currency", "INR"),
                "price_display": f"₹{amount // 100:,}",
                "purchasable": enabled("paid_exams_enabled"),
            }
        )
    return output


def payment_item(order_id):
    return ddb.get_item(
        TableName=PAYMENTS_TABLE,
        Key={"order_id": {"S": order_id}},
        ConsistentRead=True,
    ).get("Item")


def create_order(event):
    if not enabled("paid_exams_enabled"):
        return response(503, {"message": "Paid exam checkout is not enabled yet."})

    uid = user_id(event)
    ensure_entitlements(uid)
    data, _ = body_json(event)
    product_id = data.get("product_id")
    product = plans().get(product_id)

    if product_id not in ("bronze", "silver", "gold") or not product:
        return response(400, {"message": "Unknown plan."})

    receipt = f"lk8s-{uuid.uuid4().hex[:18]}"
    order = razorpay(
        "POST",
        "/v1/orders",
        {
            "amount": int(product["amount"]),
            "currency": product.get("currency", "INR"),
            "receipt": receipt,
            "notes": {"user_id": uid, "product_id": product_id},
        },
    )

    ddb.put_item(
        TableName=PAYMENTS_TABLE,
        Item={
            "order_id": {"S": order["id"]},
            "user_id": {"S": uid},
            "product_id": {"S": product_id},
            "credits": {"N": str(int(product["credits"]))},
            "amount": {"N": str(int(product["amount"]))},
            "status": {"S": "created"},
            "created_at": {"N": str(int(time.time()))},
        },
    )

    return response(
        200,
        {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "product_name": product.get("name", product_id.title()),
            "credits": int(product["credits"]),
            "key_id": razorpay_key_id(),
        },
    )


def grant_order(order_id, payment_id):
    item = payment_item(order_id)
    if not item:
        raise RuntimeError("Unknown order.")

    product_id = item["product_id"]["S"]
    product = plans().get(product_id)
    if not product:
        raise RuntimeError("Unknown order product.")

    uid = item["user_id"]["S"]
    credits = int(product["credits"])
    now = int(time.time())

    try:
        ddb.transact_write_items(
            TransactItems=[
                {
                    "Update": {
                        "TableName": PAYMENTS_TABLE,
                        "Key": {"order_id": {"S": order_id}},
                        "UpdateExpression": "SET #s=:paid, payment_id=:pid, granted_at=:ts",
                        "ConditionExpression": "attribute_not_exists(granted_at)",
                        "ExpressionAttributeNames": {"#s": "status"},
                        "ExpressionAttributeValues": {
                            ":paid": {"S": "paid"},
                            ":pid": {"S": payment_id},
                            ":ts": {"N": str(now)},
                        },
                    }
                },
                {
                    "Update": {
                        "TableName": ENTITLEMENTS_TABLE,
                        "Key": {"user_id": {"S": uid}},
                        "UpdateExpression": "ADD exam_credits :credits SET #plan=:plan, updated_at=:ts",
                        "ExpressionAttributeNames": {"#plan": "plan"},
                        "ExpressionAttributeValues": {
                            ":credits": {"N": str(credits)},
                            ":plan": {"S": product_id},
                            ":ts": {"N": str(now)},
                        },
                    }
                },
            ]
        )
        return True
    except ddb.exceptions.TransactionCanceledException:
        return False


def verify_payment(event):
    uid = user_id(event)
    data, _ = body_json(event)
    order_id = data.get("razorpay_order_id", "")
    payment_id = data.get("razorpay_payment_id", "")
    signature = data.get("razorpay_signature", "")
    item = payment_item(order_id)

    if not item or item["user_id"]["S"] != uid:
        return response(404, {"message": "Order not found."})

    key_secret = app_config().get("razorpay_key_secret", "")
    expected = hmac.new(
        key_secret.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not key_secret or not hmac.compare_digest(expected, signature):
        return response(400, {"message": "Payment signature verification failed."})

    payment = razorpay("GET", f"/v1/payments/{payment_id}")
    order = razorpay("GET", f"/v1/orders/{order_id}")

    if payment.get("status") != "captured" or order.get("status") != "paid":
        return response(409, {"message": "Payment is not captured/paid yet."})

    granted = grant_order(order_id, payment_id)
    return response(200, {"verified": True, "credit_granted": granted})


def webhook(event):
    data, raw = body_json(event)
    headers = event.get("headers") or {}
    signature = headers.get("x-razorpay-signature") or headers.get("X-Razorpay-Signature") or ""
    webhook_secret = app_config().get("razorpay_webhook_secret", "")

    expected = hmac.new(
        webhook_secret.encode(),
        raw.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not webhook_secret or not hmac.compare_digest(expected, signature):
        return response(401, {"message": "Invalid webhook signature."})

    event_name = data.get("event", "")
    if event_name in ("order.paid", "payment.captured"):
        payment = (((data.get("payload") or {}).get("payment") or {}).get("entity") or {})
        order = (((data.get("payload") or {}).get("order") or {}).get("entity") or {})
        order_id = order.get("id") or payment.get("order_id")
        payment_id = payment.get("id", "webhook")

        if order_id:
            try:
                grant_order(order_id, payment_id)
            except RuntimeError:
                pass

    return response(200, {"ok": True})


def entitlements(event):
    uid = user_id(event)
    return response(200, entitlement_payload(ensure_entitlements(uid)))


def catalog_for(exam_type, catalog_id):
    candidates = CATALOGS.get(exam_type) or []
    if catalog_id:
        for catalog in candidates:
            if catalog["id"] == catalog_id:
                return catalog
        return None
    return candidates[int.from_bytes(os.urandom(2), "big") % len(candidates)] if candidates else None


def worker_setup_script():
    return r"""
mkdir -p /home/candidate/image /home/candidate/charts/demo/templates
mkdir -p /home/candidate/kustomize/base /home/candidate/kustomize/overlays/prod
mkdir -p /home/candidate/legacy /home/candidate/supply /home/candidate/answers
mkdir -p /opt/exam/fixtures
chown -R candidate:candidate /home/candidate

cat >/home/candidate/image/Dockerfile <<'EOF'
FROM nginx:1.27
EOF

cat >/home/candidate/charts/demo/Chart.yaml <<'EOF'
apiVersion: v2
name: demo
version: 0.1.0
EOF
cat >/home/candidate/charts/demo/values.yaml <<'EOF'
replicaCount: 1
EOF
cat >/home/candidate/charts/demo/templates/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-demo
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}-demo
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}-demo
    spec:
      containers:
      - name: web
        image: nginx:1.27
EOF

cat >/home/candidate/kustomize/base/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kustom-app
  namespace: exam
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kustom-app
  template:
    metadata:
      labels:
        app: kustom-app
    spec:
      containers:
      - name: web
        image: nginx:1.27
EOF
cat >/home/candidate/kustomize/base/kustomization.yaml <<'EOF'
resources:
- deployment.yaml
EOF
cat >/home/candidate/kustomize/overlays/prod/kustomization.yaml <<'EOF'
resources:
- ../../base
namePrefix: prod-
EOF

cat >/home/candidate/legacy/deployment.yaml <<'EOF'
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: legacy-fixed
  namespace: exam
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: legacy-fixed
    spec:
      containers:
      - name: web
        image: nginx:1.27
EOF

cat >/home/candidate/supply/Dockerfile <<'EOF'
FROM ubuntu:24.04
EOF
cat >/home/candidate/supply/insecure-pod.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: insecure
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sleep","3600"]
    securityContext:
      privileged: true
EOF

cat >/opt/exam/fixtures/kube-bench.txt <<'EOF'
[FAIL] 1.2.1 Ensure that the --anonymous-auth argument is set to false
[PASS] 1.2.2 Ensure that the --token-auth-file parameter is not set
[FAIL] 4.2.6 Ensure that the --protect-kernel-defaults argument is set to true
EOF
cat >/opt/exam/fixtures/version-advisory.txt <<'EOF'
Current: v1.33.0
Required target: v1.35.0
EOF
cat >/opt/exam/fixtures/sbom.txt <<'EOF'
Package: openssl Version: 3.0.12
Package: libcurl Version: 8.5.0
EOF
cat >/opt/exam/fixtures/falco.log <<'EOF'
Warning Terminal_shell_in_container user=root container=api pod=payments-7f44
EOF
cat >/opt/exam/fixtures/network-events.log <<'EOF'
10.244.0.12 -> 10.96.0.1:443 ALLOW
10.244.0.12 -> 203.0.113.77:4444 SUSPICIOUS
EOF
cat >/opt/exam/fixtures/audit.log <<'EOF'
verb=delete resource=secrets namespace=secure user=system:serviceaccount:secure:compromised code=200
EOF

printf 'training-kubelet-binary\n' >/opt/exam/fixtures/kubelet.bin
sha256sum /opt/exam/fixtures/kubelet.bin >/opt/exam/fixtures/kubelet.sha256

openssl req -x509 -newkey rsa:2048 -nodes -subj '/CN=secure.example.test' -days 1 \
  -keyout /opt/exam/fixtures/tls.key -out /opt/exam/fixtures/tls.crt >/dev/null 2>&1

printf 'signed training artifact\n' >/opt/exam/fixtures/artifact.txt
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/artifact.key >/dev/null 2>&1
openssl rsa -pubout -in /tmp/artifact.key -out /opt/exam/fixtures/artifact.pub >/dev/null 2>&1
openssl dgst -sha256 -sign /tmp/artifact.key -out /opt/exam/fixtures/artifact.sig /opt/exam/fixtures/artifact.txt

cat >/etc/systemd/system/legacy-debug.service <<'EOF'
[Unit]
Description=Training legacy debug service
[Service]
ExecStart=/usr/bin/sleep infinity
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now legacy-debug.service

useradd -m app-user || true
echo 'app-user ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/app-user

sudo -iu candidate kubectl create namespace exam
sudo -iu candidate kubectl create namespace secure
sudo -iu candidate kubectl create namespace quota-exam
sudo -iu candidate kubectl create namespace security-exam
sudo -iu candidate kubectl create namespace restricted-apps
sudo -iu candidate kubectl create namespace tenant-a

sudo -iu candidate kubectl -n exam create deployment rollout-demo --image=nginx:1.26
sudo -iu candidate kubectl -n exam create deployment probe-demo --image=nginx:1.27
sudo -iu candidate kubectl -n exam create deployment monitor-demo --image=nginx:1.27 --replicas=2
sudo -iu candidate kubectl -n exam create deployment debug-me --image=nginx:no-such-tag
sudo -iu candidate kubectl -n exam create deployment config-demo --image=nginx:1.27
sudo -iu candidate kubectl -n exam create deployment resource-demo --image=nginx:1.27
sudo -iu candidate kubectl -n exam create deployment secret-demo --image=nginx:1.27
sudo -iu candidate kubectl -n exam create deployment sa-demo --image=nginx:1.27
sudo -iu candidate kubectl -n exam create deployment backend --image=nginx:1.27
sudo -iu candidate kubectl -n exam label deployment backend app=backend
sudo -iu candidate kubectl -n exam create service clusterip backend-svc --tcp=80:80
sudo -iu candidate kubectl -n exam patch service backend-svc -p '{"spec":{"selector":{"app":"wrong"}}}'
sudo -iu candidate kubectl -n exam run log-demo --image=busybox:1.36 --restart=Never -- sh -c 'echo INFO_start; echo ERROR_code=DB_TIMEOUT; sleep 3600'

cat >/tmp/peerauth-crd.yaml <<'EOF'
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: peerauthentications.security.istio.io
spec:
  group: security.istio.io
  scope: Namespaced
  names:
    plural: peerauthentications
    singular: peerauthentication
    kind: PeerAuthentication
  versions:
  - name: v1beta1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        x-kubernetes-preserve-unknown-fields: true
EOF
sudo -iu candidate kubectl apply -f /tmp/peerauth-crd.yaml
"""


def worker_user_data(session_id, exam_type, catalog_id, password):
    setup = worker_setup_script()
    return f"""#!/bin/bash
set -euxo pipefail

dnf install -y docker curl jq openssl iptables
systemctl enable --now docker

useradd -m -s /bin/bash candidate || true
usermod -aG docker candidate
echo 'candidate ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/candidate

curl -L -o /usr/local/bin/kubectl https://dl.k8s.io/release/v1.35.5/bin/linux/amd64/kubectl
chmod +x /usr/local/bin/kubectl

curl -L -o /usr/local/bin/kind https://kind.sigs.k8s.io/dl/v0.32.0/kind-linux-amd64
chmod +x /usr/local/bin/kind

curl -L https://get.helm.sh/helm-v3.18.6-linux-amd64.tar.gz | tar -xz -C /tmp
mv /tmp/linux-amd64/helm /usr/local/bin/helm
chmod +x /usr/local/bin/helm

curl -L -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64
chmod +x /usr/local/bin/ttyd

sudo -iu candidate kind create cluster \
  --name exam \
  --image kindest/node:v1.35.5@sha256:ce977ae6d65918d0b58a5f8b5e940429c2ce42fa3a5619ec2bbc60b949c0ac95 \
  --wait 240s

{setup}

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
echo '{session_id} {exam_type} {catalog_id}' >/etc/learn-k8s-session
"""


def worker_ami():
    if LAB_WORKER_AMI:
        return LAB_WORKER_AMI
    return ssm.get_parameter(
        Name="/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
    )["Parameter"]["Value"]


def launch_worker(session_id, exam_type, catalog_id, password):
    if not enabled("enable_live_labs"):
        return None

    result = ec2.run_instances(
        ImageId=worker_ami(),
        InstanceType=LAB_INSTANCE_TYPE,
        MinCount=1,
        MaxCount=1,
        SubnetId=LAB_SUBNET_ID,
        SecurityGroupIds=[LAB_SECURITY_GROUP_ID],
        IamInstanceProfile={"Name": LAB_INSTANCE_PROFILE},
        UserData=base64.b64encode(
            worker_user_data(session_id, exam_type, catalog_id, password).encode()
        ).decode(),
        TagSpecifications=[
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": f"learn-k8s-{session_id[:8]}"},
                    {"Key": "LearnK8sSession", "Value": session_id},
                    {"Key": "AutoTerminate", "Value": "true"},
                ],
            }
        ],
    )
    return result["Instances"][0]["InstanceId"]


def consume_credit(uid, session_id, exam_type, catalog_id, expires_at, password):
    ensure_entitlements(uid)
    ddb.transact_write_items(
        TransactItems=[
            {
                "Update": {
                    "TableName": ENTITLEMENTS_TABLE,
                    "Key": {"user_id": {"S": uid}},
                    "UpdateExpression": "ADD exam_credits :minus",
                    "ConditionExpression": "exam_credits >= :one",
                    "ExpressionAttributeValues": {
                        ":minus": {"N": "-1"},
                        ":one": {"N": "1"},
                    },
                }
            },
            {
                "Put": {
                    "TableName": SESSIONS_TABLE,
                    "Item": {
                        "session_id": {"S": session_id},
                        "user_id": {"S": uid},
                        "exam_type": {"S": exam_type},
                        "catalog_id": {"S": catalog_id},
                        "status": {"S": "provisioning"},
                        "started_at": {"N": str(int(time.time()))},
                        "expires_at": {"N": str(expires_at)},
                        "terminal_password": {"S": password},
                    },
                }
            },
        ]
    )


def restore_credit(uid):
    ddb.update_item(
        TableName=ENTITLEMENTS_TABLE,
        Key={"user_id": {"S": uid}},
        UpdateExpression="ADD exam_credits :one",
        ExpressionAttributeValues={":one": {"N": "1"}},
    )


def start_exam(event):
    uid = user_id(event)
    data, _ = body_json(event)
    exam_type = str(data.get("exam_type", "")).upper()

    if exam_type not in CATALOGS:
        return response(400, {"message": "Exam type must be CKAD or CKS."})

    catalog = catalog_for(exam_type, data.get("catalog_id"))
    if not catalog:
        return response(400, {"message": "Unknown exam catalogue."})

    session_id = str(uuid.uuid4())
    expires_at = int(time.time()) + 120 * 60
    password = secrets.token_urlsafe(12)

    try:
        consume_credit(
            uid,
            session_id,
            exam_type,
            catalog["id"],
            expires_at,
            password,
        )
    except ddb.exceptions.TransactionCanceledException:
        return response(402, {"message": "No exam credits available."})

    try:
        instance_id = launch_worker(session_id, exam_type, catalog["id"], password)
        if instance_id:
            ddb.update_item(
                TableName=SESSIONS_TABLE,
                Key={"session_id": {"S": session_id}},
                UpdateExpression="SET instance_id=:i",
                ExpressionAttributeValues={":i": {"S": instance_id}},
            )
        else:
            raise RuntimeError("Live exam labs are not enabled.")
    except Exception as error:
        restore_credit(uid)
        ddb.update_item(
            TableName=SESSIONS_TABLE,
            Key={"session_id": {"S": session_id}},
            UpdateExpression="SET #s=:failed, failure_reason=:reason",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":failed": {"S": "failed"},
                ":reason": {"S": str(error)[:500]},
            },
        )
        return response(503, {"message": "Could not provision exam lab. Credit was restored."})

    return response(200, session_payload(session_id, uid))


def session_payload(session_id, uid):
    item = ddb.get_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id": {"S": session_id}},
        ConsistentRead=True,
    ).get("Item")

    if not item or item.get("user_id", {}).get("S") != uid:
        return {"message": "Session not found.", "statusCode": 404}

    exam_type = item["exam_type"]["S"]
    catalog_id = item["catalog_id"]["S"]
    terminal_url = item.get("terminal_url", {}).get("S")
    payload = {
        "session_id": session_id,
        "exam_type": exam_type,
        "catalog_id": catalog_id,
        "status": item["status"]["S"],
        "expires_at": int(item["expires_at"]["N"]),
        "baseline": EXAM_BASELINE,
        "tasks": public_tasks(exam_type, catalog_id),
        "terminal_url": terminal_url,
        "terminal_username": "candidate" if terminal_url else None,
        "terminal_password": item.get("terminal_password", {}).get("S") if terminal_url else None,
    }
    if "score" in item:
        payload["score"] = int(item["score"]["N"])
    return payload


def worker_terminal_ready(instance_id):
    try:
        sent = ssm.send_command(
            InstanceIds=[instance_id],
            DocumentName="AWS-RunShellScript",
            Parameters={"commands": ["curl -fsS --max-time 2 http://localhost:7681/ >/dev/null"]},
            TimeoutSeconds=10,
        )
        command_id = sent["Command"]["CommandId"]

        for _ in range(5):
            time.sleep(1)
            try:
                invocation = ssm.get_command_invocation(
                    CommandId=command_id,
                    InstanceId=instance_id,
                )
                if invocation.get("Status") == "Success":
                    return True
                if invocation.get("Status") in ("Failed", "TimedOut", "Cancelled"):
                    return False
            except ssm.exceptions.InvocationDoesNotExist:
                pass
    except Exception:
        return False
    return False


def maybe_activate_session(item):
    if item.get("status", {}).get("S") != "provisioning":
        return

    instance_id = item.get("instance_id", {}).get("S")
    if not instance_id:
        return

    instance = ec2.describe_instances(InstanceIds=[instance_id])["Reservations"][0]["Instances"][0]
    if instance["State"]["Name"] != "running":
        return

    if not worker_terminal_ready(instance_id):
        return

    private_ip = instance.get("PrivateIpAddress")
    session_id = item["session_id"]["S"]
    if not private_ip or not LAB_GATEWAY_INSTANCE_ID:
        return

    config = f"""location /session/{session_id}/ {{
  proxy_pass http://{private_ip}:7681/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 7200s;
}}"""

    encoded = base64.b64encode(config.encode()).decode()
    command = (
        f"echo {encoded} | base64 -d >/etc/nginx/lab-routes/{session_id}.conf "
        "&& nginx -t && systemctl reload nginx"
    )

    ssm.send_command(
        InstanceIds=[LAB_GATEWAY_INSTANCE_ID],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": [command]},
    )

    terminal_url = f"{LAB_BASE_URL.rstrip('/')}/session/{session_id}/"
    ddb.update_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id": {"S": session_id}},
        UpdateExpression="SET #s=:ready, terminal_url=:url",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":ready": {"S": "ready"},
            ":url": {"S": terminal_url},
        },
    )


def get_session(event, session_id):
    uid = user_id(event)
    item = ddb.get_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id": {"S": session_id}},
        ConsistentRead=True,
    ).get("Item")

    if not item or item.get("user_id", {}).get("S") != uid:
        return response(404, {"message": "Session not found."})

    try:
        maybe_activate_session(item)
    except Exception:
        pass

    payload = session_payload(session_id, uid)
    if payload.get("statusCode"):
        return response(payload["statusCode"], {"message": payload["message"]})
    return response(200, payload)


def remove_gateway_route(session_id):
    if not LAB_GATEWAY_INSTANCE_ID:
        return
    try:
        ssm.send_command(
            InstanceIds=[LAB_GATEWAY_INSTANCE_ID],
            DocumentName="AWS-RunShellScript",
            Parameters={
                "commands": [
                    f"rm -f /etc/nginx/lab-routes/{session_id}.conf; "
                    "nginx -t && systemctl reload nginx"
                ]
            },
        )
    except Exception:
        pass


def submit_exam(event, session_id):
    uid = user_id(event)
    item = ddb.get_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id": {"S": session_id}},
        ConsistentRead=True,
    ).get("Item")

    if not item or item.get("user_id", {}).get("S") != uid:
        return response(404, {"message": "Session not found."})

    if item.get("status", {}).get("S") != "ready":
        return response(409, {"message": "Session is not ready for grading."})

    instance_id = item.get("instance_id", {}).get("S")
    exam_type = item["exam_type"]["S"]
    catalog_id = item["catalog_id"]["S"]

    if not instance_id:
        return response(409, {"message": "No live worker is attached to this session."})

    tasks = catalog_tasks(exam_type, catalog_id)
    commands = []
    for task in tasks:
        verify = task["verify"].replace("'", "'\\''")
        commands.append(
            f"if bash -lc '{verify}'; then echo '{task['id']}|1'; "
            f"else echo '{task['id']}|0'; fi"
        )

    sent = ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": ["\n".join(commands)]},
        TimeoutSeconds=30,
    )
    command_id = sent["Command"]["CommandId"]

    output = ""
    for _ in range(20):
        time.sleep(1)
        try:
            invocation = ssm.get_command_invocation(
                CommandId=command_id,
                InstanceId=instance_id,
            )
            if invocation.get("Status") in ("Success", "Failed", "TimedOut", "Cancelled"):
                output = invocation.get("StandardOutputContent", "")
                break
        except ssm.exceptions.InvocationDoesNotExist:
            pass

    results = {}
    for line in output.splitlines():
        if "|" in line:
            task_id, passed = line.strip().split("|", 1)
            results[task_id] = passed == "1"

    score = sum(task["weight"] for task in tasks if results.get(task["id"]))
    now = int(time.time())

    ddb.update_item(
        TableName=SESSIONS_TABLE,
        Key={"session_id": {"S": session_id}},
        UpdateExpression="SET #s=:done, score=:score, completed_at=:ts",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":done": {"S": "completed"},
            ":score": {"N": str(score)},
            ":ts": {"N": str(now)},
        },
    )

    try:
        ec2.terminate_instances(InstanceIds=[instance_id])
    except Exception:
        pass
    remove_gateway_route(session_id)

    return response(
        200,
        {
            "session_id": session_id,
            "exam_type": exam_type,
            "catalog_id": catalog_id,
            "score": score,
            "max_score": 100,
            "results": [
                {
                    "id": task["id"],
                    "title": task["title"],
                    "domain": task["domain"],
                    "weight": task["weight"],
                    "passed": bool(results.get(task["id"])),
                }
                for task in tasks
            ],
        },
    )


def cleanup():
    now = int(time.time())
    scan = ddb.scan(
        TableName=SESSIONS_TABLE,
        FilterExpression="expires_at < :now",
        ExpressionAttributeValues={":now": {"N": str(now)}},
    )

    for item in scan.get("Items", []):
        if item.get("status", {}).get("S") in ("expired", "completed"):
            continue

        instance_id = item.get("instance_id", {}).get("S")
        session_id = item["session_id"]["S"]

        if instance_id:
            try:
                ec2.terminate_instances(InstanceIds=[instance_id])
            except Exception:
                pass

        remove_gateway_route(session_id)

        ddb.update_item(
            TableName=SESSIONS_TABLE,
            Key={"session_id": {"S": session_id}},
            UpdateExpression="SET #s=:expired",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":expired": {"S": "expired"}},
        )


def handler(event, context):
    if event.get("source") == "learn-k8s.cleanup":
        cleanup()
        return {"ok": True}

    route = event.get("routeKey", "")

    if route.startswith("OPTIONS "):
        return response(204, {})

    if route == "GET /health":
        return response(
            200,
            {
                "ok": True,
                "paid_exams_enabled": enabled("paid_exams_enabled"),
                "live_labs_enabled": enabled("enable_live_labs"),
                "exam_baseline": EXAM_BASELINE,
            },
        )

    if route == "GET /plans":
        return response(200, {"plans": plan_payloads()})

    if route == "GET /exams/catalogs":
        return response(
            200,
            {
                "baseline": EXAM_BASELINE,
                "catalogs": catalog_list(),
            },
        )

    if route == "POST /payments/webhook":
        return webhook(event)

    if not user_id(event):
        return response(401, {"message": "Authentication required."})

    if route == "GET /me/entitlements":
        return entitlements(event)
    if route == "POST /payments/order":
        return create_order(event)
    if route == "POST /payments/verify":
        return verify_payment(event)
    if route == "POST /exams/start":
        return start_exam(event)
    if route == "GET /exams/session/{session_id}":
        return get_session(event, (event.get("pathParameters") or {}).get("session_id", ""))
    if route == "POST /exams/session/{session_id}/submit":
        return submit_exam(event, (event.get("pathParameters") or {}).get("session_id", ""))

    return response(404, {"message": "Not found."})
