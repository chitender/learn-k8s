BLUEPRINTS = {
    "CKAD": [
        {
            "id":"ckad-1","title":"Deployment resources","weight":20,
            "prompt":"In namespace exam, create Deployment web with image nginx:1.27, 3 replicas, CPU request 100m, CPU limit 500m, memory request 64Mi and memory limit 128Mi.",
            "verify":"test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.replicas}')\" = 3 && test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')\" = 100m && test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.template.spec.containers[0].resources.limits.cpu}')\" = 500m"
        },
        {
            "id":"ckad-2","title":"Service discovery","weight":20,
            "prompt":"Expose Deployment web as ClusterIP Service web-svc on port 80 targeting container port 80. Ensure it has Ready endpoints.",
            "verify":"test \"$(kubectl -n exam get svc web-svc -o jsonpath='{.spec.ports[0].port}')\" = 80 && test -n \"$(kubectl -n exam get endpoints web-svc -o jsonpath='{.subsets[0].addresses[0].ip}')\""
        },
        {
            "id":"ckad-3","title":"Configuration","weight":20,
            "prompt":"Create ConfigMap app-config in namespace exam with MODE=production. Configure Deployment web so its container receives MODE from that ConfigMap.",
            "verify":"test \"$(kubectl -n exam get cm app-config -o jsonpath='{.data.MODE}')\" = production && kubectl -n exam get deploy web -o json | grep -q 'app-config'"
        },
        {
            "id":"ckad-4","title":"Readiness","weight":20,
            "prompt":"Configure the web container with an HTTP readiness probe on path / and port 80.",
            "verify":"test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}')\" = / && test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.port}')\" = 80"
        },
        {
            "id":"ckad-5","title":"Scheduled workload","weight":20,
            "prompt":"Create CronJob backup in namespace exam using busybox:1.36. It must run every five minutes and execute: echo backup. Set successfulJobsHistoryLimit to 2.",
            "verify":"test \"$(kubectl -n exam get cronjob backup -o jsonpath='{.spec.schedule}')\" = '*/5 * * * *' && test \"$(kubectl -n exam get cronjob backup -o jsonpath='{.spec.successfulJobsHistoryLimit}')\" = 2"
        },
    ],
    "CKS": [
        {
            "id":"cks-1","title":"Pod Security Admission","weight":20,
            "prompt":"Label namespace exam so Pod Security Admission enforces the restricted policy level.",
            "verify":"test \"$(kubectl get ns exam -o jsonpath='{.metadata.labels.pod-security\\.kubernetes\\.io/enforce}')\" = restricted"
        },
        {
            "id":"cks-2","title":"Least-privilege RBAC","weight":20,
            "prompt":"In namespace exam, create ServiceAccount runtime, Role pod-reader allowing only get and list on pods, and a RoleBinding named runtime-read-pods binding the role to that ServiceAccount.",
            "verify":"kubectl -n exam auth can-i get pods --as=system:serviceaccount:exam:runtime | grep -qx yes && kubectl -n exam auth can-i delete pods --as=system:serviceaccount:exam:runtime | grep -qx no"
        },
        {
            "id":"cks-3","title":"Default-deny ingress","weight":20,
            "prompt":"Create NetworkPolicy default-deny-ingress in namespace exam that selects all Pods and denies all ingress traffic.",
            "verify":"test \"$(kubectl -n exam get networkpolicy default-deny-ingress -o jsonpath='{.spec.podSelector}')\" = 'map[]' && kubectl -n exam get networkpolicy default-deny-ingress -o jsonpath='{.spec.policyTypes}' | grep -q Ingress"
        },
        {
            "id":"cks-4","title":"Harden a workload","weight":20,
            "prompt":"Create Pod secure-pod in namespace exam using busybox:1.36 and command sleep 3600. Configure runAsNonRoot=true, allowPrivilegeEscalation=false, readOnlyRootFilesystem=true, seccompProfile RuntimeDefault, and drop ALL Linux capabilities.",
            "verify":"test \"$(kubectl -n exam get pod secure-pod -o jsonpath='{.spec.securityContext.runAsNonRoot}')\" = true && test \"$(kubectl -n exam get pod secure-pod -o jsonpath='{.spec.containers[0].securityContext.allowPrivilegeEscalation}')\" = false && test \"$(kubectl -n exam get pod secure-pod -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}')\" = true && kubectl -n exam get pod secure-pod -o json | grep -q RuntimeDefault && kubectl -n exam get pod secure-pod -o json | grep -q ALL"
        },
        {
            "id":"cks-5","title":"ServiceAccount token exposure","weight":20,
            "prompt":"Create Pod token-safe in namespace exam using busybox:1.36 and command sleep 3600, with automountServiceAccountToken explicitly disabled.",
            "verify":"test \"$(kubectl -n exam get pod token-safe -o jsonpath='{.spec.automountServiceAccountToken}')\" = false"
        },
    ],
}

def public_tasks(exam_type):
    return [
        {k:v for k,v in task.items() if k != "verify"}
        for task in BLUEPRINTS[exam_type]
    ]
