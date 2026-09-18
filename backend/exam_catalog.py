EXAM_BASELINE = "Kubernetes v1.35"

EXAM_GUIDE = {
    "CKAD": {
        "duration_minutes": 120,
        "source": "Linux Foundation / CNCF public CKAD curriculum",
        "source_url": "https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/",
        "domains": {
            "design_build": {
                "name": "Application Design and Build",
                "weight": 20,
                "competencies": [
                    "container_images", "workload_resources", "multi_container", "volumes"
                ],
            },
            "deployment": {
                "name": "Application Deployment",
                "weight": 20,
                "competencies": [
                    "deployment_strategies", "rolling_updates", "helm", "kustomize"
                ],
            },
            "observability": {
                "name": "Application Observability and Maintenance",
                "weight": 15,
                "competencies": [
                    "api_deprecations", "probes", "monitoring_cli", "logs", "debugging"
                ],
            },
            "environment": {
                "name": "Application Environment, Configuration and Security",
                "weight": 25,
                "competencies": [
                    "crd_operators", "auth_authz_admission", "quotas", "configmaps",
                    "resource_requirements", "secrets", "serviceaccounts", "security_context"
                ],
            },
            "networking": {
                "name": "Services and Networking",
                "weight": 20,
                "competencies": ["networkpolicy", "services", "ingress"],
            },
        },
    },
    "CKS": {
        "duration_minutes": 120,
        "source": "Linux Foundation public CKS curriculum",
        "source_url": "https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist/",
        "domains": {
            "cluster_setup": {
                "name": "Cluster Setup",
                "weight": 15,
                "competencies": [
                    "network_security_policy", "cis_benchmark", "ingress_tls",
                    "node_metadata", "verify_binaries"
                ],
            },
            "cluster_hardening": {
                "name": "Cluster Hardening",
                "weight": 15,
                "competencies": [
                    "rbac", "serviceaccounts", "restrict_api", "upgrade_kubernetes"
                ],
            },
            "system_hardening": {
                "name": "System Hardening",
                "weight": 10,
                "competencies": [
                    "os_footprint", "least_privilege_identity", "external_network", "kernel_hardening"
                ],
            },
            "microservice": {
                "name": "Minimize Microservice Vulnerabilities",
                "weight": 20,
                "competencies": [
                    "pod_security_standards", "secrets", "isolation", "pod_encryption"
                ],
            },
            "supply_chain": {
                "name": "Supply Chain Security",
                "weight": 20,
                "competencies": [
                    "base_image", "sbom", "artifact_policy", "artifact_signing", "static_analysis"
                ],
            },
            "runtime": {
                "name": "Monitoring, Logging and Runtime Security",
                "weight": 20,
                "competencies": [
                    "behavior_analytics", "threat_detection", "attack_investigation",
                    "container_immutability", "audit_logs"
                ],
            },
        },
    },
}


TASKS = {
    "CKAD": {
        "ckad-image": {
            "domain": "design_build", "competency": "container_images",
            "title": "Build an OCI image",
            "prompt": "In /home/candidate/image, modify the Dockerfile to use nginx:alpine and build local/ckad-web:v1.",
            "verify": "grep -Eq '^FROM nginx:alpine$' /home/candidate/image/Dockerfile && docker image inspect local/ckad-web:v1 >/dev/null",
        },
        "ckad-deploy": {
            "domain": "design_build", "competency": "workload_resources",
            "title": "Choose and create the workload",
            "prompt": "In namespace exam, create Deployment web with image nginx:1.27 and 3 replicas.",
            "verify": "test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.replicas}')\" = 3 && test \"$(kubectl -n exam get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}')\" = nginx:1.27",
        },
        "ckad-cronjob": {
            "domain": "design_build", "competency": "workload_resources",
            "title": "Create a CronJob",
            "prompt": "Create CronJob backup in namespace exam using busybox:1.36. Run every five minutes and execute: echo backup.",
            "verify": "test \"$(kubectl -n exam get cronjob backup -o jsonpath='{.spec.schedule}')\" = '*/5 * * * *'",
        },
        "ckad-multicontainer": {
            "domain": "design_build", "competency": "multi_container",
            "title": "Multi-container Pod",
            "prompt": "Create Pod multi in namespace exam with app container nginx:1.27, sidecar busybox:1.36 running sleep 3600, and an initContainer named init using busybox:1.36.",
            "verify": "test \"$(kubectl -n exam get pod multi -o jsonpath='{.spec.initContainers[0].name}')\" = init && test \"$(kubectl -n exam get pod multi -o jsonpath='{.spec.containers[1].name}')\" = sidecar",
        },
        "ckad-volumes": {
            "domain": "design_build", "competency": "volumes",
            "title": "Persistent and ephemeral storage",
            "prompt": "Create a 1Gi hostPath PV pv-exam, PVC data in namespace exam, and Pod volume-demo mounting the claim at /data plus an emptyDir at /cache.",
            "verify": "test \"$(kubectl -n exam get pod volume-demo -o jsonpath='{.spec.volumes[0].persistentVolumeClaim.claimName}')\" = data && kubectl -n exam get pod volume-demo -o json | grep -q emptyDir",
        },

        "ckad-bluegreen": {
            "domain": "deployment", "competency": "deployment_strategies",
            "title": "Blue/green deployment",
            "prompt": "Create Deployments app-blue and app-green in namespace exam with label app=shop and version=blue/green. Create Service shop selecting app=shop,version=blue.",
            "verify": "test \"$(kubectl -n exam get svc shop -o jsonpath='{.spec.selector.version}')\" = blue && kubectl -n exam get deploy app-green >/dev/null",
        },
        "ckad-rollout": {
            "domain": "deployment", "competency": "rolling_updates",
            "title": "Rolling update",
            "prompt": "Update Deployment rollout-demo in namespace exam to nginx:1.27 and configure maxUnavailable=0 and maxSurge=1.",
            "verify": "test \"$(kubectl -n exam get deploy rollout-demo -o jsonpath='{.spec.template.spec.containers[0].image}')\" = nginx:1.27 && test \"$(kubectl -n exam get deploy rollout-demo -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}')\" = 0",
        },
        "ckad-helm": {
            "domain": "deployment", "competency": "helm",
            "title": "Deploy with Helm",
            "prompt": "Install the provided chart /home/candidate/charts/demo as release catalog-helm in namespace exam and set replicaCount=2.",
            "verify": "helm -n exam status catalog-helm >/dev/null && test \"$(kubectl -n exam get deploy catalog-helm-demo -o jsonpath='{.spec.replicas}')\" = 2",
        },
        "ckad-kustomize": {
            "domain": "deployment", "competency": "kustomize",
            "title": "Deploy a Kustomize overlay",
            "prompt": "Apply /home/candidate/kustomize/overlays/prod. The resulting Deployment must be named prod-kustom-app in namespace exam.",
            "verify": "kubectl -n exam get deploy prod-kustom-app >/dev/null",
        },

        "ckad-api": {
            "domain": "observability", "competency": "api_deprecations",
            "title": "Fix a deprecated API manifest",
            "prompt": "Repair /home/candidate/legacy/deployment.yaml so it uses a supported Deployment API and successfully apply it in namespace exam as legacy-fixed.",
            "verify": "test \"$(kubectl -n exam get deploy legacy-fixed -o jsonpath='{.apiVersion}')\" = apps/v1",
        },
        "ckad-probes": {
            "domain": "observability", "competency": "probes",
            "title": "Health probes",
            "prompt": "Configure Deployment probe-demo in namespace exam with HTTP readiness and liveness probes on / port 80.",
            "verify": "test \"$(kubectl -n exam get deploy probe-demo -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}')\" = / && test \"$(kubectl -n exam get deploy probe-demo -o jsonpath='{.spec.template.spec.containers[0].livenessProbe.httpGet.port}')\" = 80",
        },
        "ckad-monitor": {
            "domain": "observability", "competency": "monitoring_cli",
            "title": "Inspect application state",
            "prompt": "Using kubectl only, determine the Ready replica count for Deployment monitor-demo and write only the number to /home/candidate/answers/monitor-ready.txt.",
            "verify": "test \"$(cat /home/candidate/answers/monitor-ready.txt 2>/dev/null)\" = \"$(kubectl -n exam get deploy monitor-demo -o jsonpath='{.status.readyReplicas}')\"",
        },
        "ckad-logs": {
            "domain": "observability", "competency": "logs",
            "title": "Find the failure in logs",
            "prompt": "Inspect logs for Pod log-demo in namespace exam. Write the ERROR code only to /home/candidate/answers/log-error.txt.",
            "verify": "test \"$(cat /home/candidate/answers/log-error.txt 2>/dev/null)\" = DB_TIMEOUT",
        },
        "ckad-debug": {
            "domain": "observability", "competency": "debugging",
            "title": "Debug an ImagePullBackOff",
            "prompt": "Deployment debug-me in namespace exam is broken. Fix it so its container uses nginx:1.27 and becomes available.",
            "verify": "test \"$(kubectl -n exam get deploy debug-me -o jsonpath='{.spec.template.spec.containers[0].image}')\" = nginx:1.27",
        },

        "ckad-crd": {
            "domain": "environment", "competency": "crd_operators",
            "title": "Extend the Kubernetes API",
            "prompt": "Create a namespaced CRD widgets.training.learn-k8s.io with kind Widget and then create Widget sample in namespace exam.",
            "verify": "kubectl get crd widgets.training.learn-k8s.io >/dev/null && kubectl -n exam get widgets.training.learn-k8s.io sample >/dev/null",
        },
        "ckad-rbac": {
            "domain": "environment", "competency": "auth_authz_admission",
            "title": "Application RBAC",
            "prompt": "Create ServiceAccount reporter, Role pod-reader permitting get/list on pods, and bind them in namespace exam.",
            "verify": "kubectl -n exam auth can-i get pods --as=system:serviceaccount:exam:reporter | grep -qx yes && kubectl -n exam auth can-i delete pods --as=system:serviceaccount:exam:reporter | grep -qx no",
        },
        "ckad-quota": {
            "domain": "environment", "competency": "quotas",
            "title": "Namespace quota",
            "prompt": "Create ResourceQuota exam-quota in namespace quota-exam limiting requests.cpu to 2 and limits.memory to 2Gi.",
            "verify": "test \"$(kubectl -n quota-exam get resourcequota exam-quota -o jsonpath='{.spec.hard.requests\\.cpu}')\" = 2 && test \"$(kubectl -n quota-exam get resourcequota exam-quota -o jsonpath='{.spec.hard.limits\\.memory}')\" = 2Gi",
        },
        "ckad-configmap": {
            "domain": "environment", "competency": "configmaps",
            "title": "ConfigMap injection",
            "prompt": "Create ConfigMap app-config with MODE=production in namespace exam and expose MODE to Deployment config-demo as an environment variable.",
            "verify": "test \"$(kubectl -n exam get cm app-config -o jsonpath='{.data.MODE}')\" = production && kubectl -n exam get deploy config-demo -o json | grep -q app-config",
        },
        "ckad-resources": {
            "domain": "environment", "competency": "resource_requirements",
            "title": "Requests and limits",
            "prompt": "Set Deployment resource-demo container CPU request=100m, CPU limit=500m, memory request=64Mi, memory limit=128Mi.",
            "verify": "test \"$(kubectl -n exam get deploy resource-demo -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')\" = 100m && test \"$(kubectl -n exam get deploy resource-demo -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}')\" = 128Mi",
        },
        "ckad-secret": {
            "domain": "environment", "competency": "secrets",
            "title": "Consume a Secret",
            "prompt": "Create Secret db-creds with key password=s3cret in namespace exam and expose it to Deployment secret-demo as DB_PASSWORD.",
            "verify": "test \"$(kubectl -n exam get secret db-creds -o jsonpath='{.data.password}' | base64 -d)\" = s3cret && kubectl -n exam get deploy secret-demo -o json | grep -q db-creds",
        },
        "ckad-sa": {
            "domain": "environment", "competency": "serviceaccounts",
            "title": "Use a ServiceAccount",
            "prompt": "Create ServiceAccount app-sa in namespace exam and configure Deployment sa-demo to use it.",
            "verify": "test \"$(kubectl -n exam get deploy sa-demo -o jsonpath='{.spec.template.spec.serviceAccountName}')\" = app-sa",
        },
        "ckad-securitycontext": {
            "domain": "environment", "competency": "security_context",
            "title": "Harden an application container",
            "prompt": "Configure Pod security-demo in namespace security-exam to runAsNonRoot, disallow privilege escalation and drop ALL capabilities.",
            "verify": "test \"$(kubectl -n security-exam get pod security-demo -o jsonpath='{.spec.securityContext.runAsNonRoot}')\" = true && test \"$(kubectl -n security-exam get pod security-demo -o jsonpath='{.spec.containers[0].securityContext.allowPrivilegeEscalation}')\" = false && kubectl -n security-exam get pod security-demo -o json | grep -q ALL",
        },

        "ckad-netpol": {
            "domain": "networking", "competency": "networkpolicy",
            "title": "NetworkPolicy",
            "prompt": "Create NetworkPolicy web-ingress in namespace exam selecting app=web and allowing ingress only from Pods labeled access=web.",
            "verify": "test \"$(kubectl -n exam get networkpolicy web-ingress -o jsonpath='{.spec.podSelector.matchLabels.app}')\" = web && test \"$(kubectl -n exam get networkpolicy web-ingress -o jsonpath='{.spec.ingress[0].from[0].podSelector.matchLabels.access}')\" = web",
        },
        "ckad-service": {
            "domain": "networking", "competency": "services",
            "title": "Troubleshoot a Service",
            "prompt": "Service backend-svc in namespace exam has no endpoints. Fix its selector so it targets the provided backend Deployment.",
            "verify": "test -n \"$(kubectl -n exam get endpoints backend-svc -o jsonpath='{.subsets[0].addresses[0].ip}')\"",
        },
        "ckad-ingress": {
            "domain": "networking", "competency": "ingress",
            "title": "Expose with Ingress",
            "prompt": "Create Ingress web-ingress in namespace exam routing host app.example.test path / to Service web-svc port 80.",
            "verify": "test \"$(kubectl -n exam get ingress web-ingress -o jsonpath='{.spec.rules[0].host}')\" = app.example.test && test \"$(kubectl -n exam get ingress web-ingress -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}')\" = web-svc",
        },
    },

    "CKS": {
        "cks-netpol": {
            "domain": "cluster_setup", "competency": "network_security_policy",
            "title": "Restrict cluster-level network access",
            "prompt": "Create default-deny-ingress NetworkPolicy in namespace secure selecting all Pods and denying all ingress.",
            "verify": "test \"$(kubectl -n secure get networkpolicy default-deny-ingress -o jsonpath='{.spec.podSelector}')\" = 'map[]'",
        },
        "cks-cis": {
            "domain": "cluster_setup", "competency": "cis_benchmark",
            "title": "Review CIS findings",
            "prompt": "Read /opt/exam/fixtures/kube-bench.txt. Write the comma-separated FAIL control IDs, in file order, to /home/candidate/answers/cis-fails.txt.",
            "verify": "test \"$(cat /home/candidate/answers/cis-fails.txt 2>/dev/null)\" = 1.2.1,4.2.6",
        },
        "cks-tls": {
            "domain": "cluster_setup", "competency": "ingress_tls",
            "title": "Ingress TLS",
            "prompt": "Using /opt/exam/fixtures/tls.crt and tls.key, create TLS Secret web-tls and Ingress secure-web in namespace secure for secure.example.test.",
            "verify": "test \"$(kubectl -n secure get ingress secure-web -o jsonpath='{.spec.tls[0].secretName}')\" = web-tls && test \"$(kubectl -n secure get ingress secure-web -o jsonpath='{.spec.rules[0].host}')\" = secure.example.test",
        },
        "cks-metadata": {
            "domain": "cluster_setup", "competency": "node_metadata",
            "title": "Protect cloud metadata",
            "prompt": "Create NetworkPolicy block-metadata in namespace secure selecting all Pods and allowing egress to 0.0.0.0/0 except 169.254.169.254/32.",
            "verify": "kubectl -n secure get networkpolicy block-metadata -o json | grep -q 169.254.169.254/32",
        },
        "cks-binary": {
            "domain": "cluster_setup", "competency": "verify_binaries",
            "title": "Verify a platform binary",
            "prompt": "Verify /opt/exam/fixtures/kubelet.bin against /opt/exam/fixtures/kubelet.sha256. Write PASS to /home/candidate/answers/binary-check.txt only if it matches.",
            "verify": "test \"$(cat /home/candidate/answers/binary-check.txt 2>/dev/null)\" = PASS",
        },

        "cks-rbac": {
            "domain": "cluster_hardening", "competency": "rbac",
            "title": "Least-privilege RBAC",
            "prompt": "In namespace secure, create ServiceAccount runtime, Role pod-reader allowing get/list on pods only, and bind it.",
            "verify": "kubectl -n secure auth can-i get pods --as=system:serviceaccount:secure:runtime | grep -qx yes && kubectl -n secure auth can-i delete pods --as=system:serviceaccount:secure:runtime | grep -qx no",
        },
        "cks-serviceaccount": {
            "domain": "cluster_hardening", "competency": "serviceaccounts",
            "title": "Reduce ServiceAccount exposure",
            "prompt": "Create Pod token-safe in namespace secure using busybox:1.36 sleep 3600 and explicitly disable automountServiceAccountToken.",
            "verify": "test \"$(kubectl -n secure get pod token-safe -o jsonpath='{.spec.automountServiceAccountToken}')\" = false",
        },
        "cks-api": {
            "domain": "cluster_hardening", "competency": "restrict_api",
            "title": "Restrict API server anonymous access",
            "prompt": "Inside kind control-plane exam-control-plane, ensure the kube-apiserver static Pod manifest contains --anonymous-auth=false.",
            "verify": "docker exec exam-control-plane grep -q -- '--anonymous-auth=false' /etc/kubernetes/manifests/kube-apiserver.yaml",
        },
        "cks-upgrade": {
            "domain": "cluster_hardening", "competency": "upgrade_kubernetes",
            "title": "Plan a secure Kubernetes upgrade",
            "prompt": "The provided /opt/exam/fixtures/version-advisory.txt identifies the required target. Write only that target version to /home/candidate/answers/upgrade-target.txt.",
            "verify": "test \"$(cat /home/candidate/answers/upgrade-target.txt 2>/dev/null)\" = v1.35.0",
        },

        "cks-os": {
            "domain": "system_hardening", "competency": "os_footprint",
            "title": "Minimize host services",
            "prompt": "Disable and mask legacy-debug.service on the worker host.",
            "verify": "systemctl is-enabled legacy-debug.service 2>/dev/null | grep -qx masked",
        },
        "cks-identity": {
            "domain": "system_hardening", "competency": "least_privilege_identity",
            "title": "Fix excessive sudo privilege",
            "prompt": "Edit /etc/sudoers.d/app-user so app-user may run only /usr/bin/systemctl status and not ALL commands.",
            "verify": "grep -q '/usr/bin/systemctl status' /etc/sudoers.d/app-user && ! grep -Eq 'ALL=\\(ALL\\).*ALL' /etc/sudoers.d/app-user",
        },
        "cks-network": {
            "domain": "system_hardening", "competency": "external_network",
            "title": "Limit unnecessary network exposure",
            "prompt": "Add an iptables INPUT rule rejecting TCP port 9090 while leaving the exam terminal reachable.",
            "verify": "iptables -C INPUT -p tcp --dport 9090 -j REJECT >/dev/null 2>&1",
        },
        "cks-seccomp": {
            "domain": "system_hardening", "competency": "kernel_hardening",
            "title": "Apply seccomp hardening",
            "prompt": "Create Pod seccomp-demo in namespace secure with seccompProfile.type RuntimeDefault.",
            "verify": "test \"$(kubectl -n secure get pod seccomp-demo -o jsonpath='{.spec.securityContext.seccompProfile.type}')\" = RuntimeDefault",
        },

        "cks-pss": {
            "domain": "microservice", "competency": "pod_security_standards",
            "title": "Enforce Pod Security Standards",
            "prompt": "Label namespace restricted-apps so Pod Security Admission enforce is restricted.",
            "verify": "test \"$(kubectl get ns restricted-apps -o jsonpath='{.metadata.labels.pod-security\\.kubernetes\\.io/enforce}')\" = restricted",
        },
        "cks-secret": {
            "domain": "microservice", "competency": "secrets",
            "title": "Use Secrets safely",
            "prompt": "Create Secret api-token in namespace secure from literal token=safevalue and mount it read-only at /var/run/secret in Pod secret-consumer.",
            "verify": "test \"$(kubectl -n secure get secret api-token -o jsonpath='{.data.token}' | base64 -d)\" = safevalue && test \"$(kubectl -n secure get pod secret-consumer -o jsonpath='{.spec.containers[0].volumeMounts[0].readOnly}')\" = true",
        },
        "cks-isolation": {
            "domain": "microservice", "competency": "isolation",
            "title": "Tenant isolation",
            "prompt": "In namespace tenant-a create ResourceQuota tenant-quota with pods=5 and a default-deny NetworkPolicy selecting all Pods.",
            "verify": "test \"$(kubectl -n tenant-a get resourcequota tenant-quota -o jsonpath='{.spec.hard.pods}')\" = 5 && kubectl -n tenant-a get networkpolicy default-deny >/dev/null",
        },
        "cks-mtls": {
            "domain": "microservice", "competency": "pod_encryption",
            "title": "Enforce workload mTLS policy",
            "prompt": "Using the provided training CRD, create PeerAuthentication default in namespace secure with mtls.mode STRICT.",
            "verify": "test \"$(kubectl -n secure get peerauthentication default -o jsonpath='{.spec.mtls.mode}')\" = STRICT",
        },

        "cks-base": {
            "domain": "supply_chain", "competency": "base_image",
            "title": "Minimize the base image",
            "prompt": "Edit /home/candidate/supply/Dockerfile so its final FROM image is cgr.dev/chainguard/static:latest.",
            "verify": "grep -Eq '^FROM cgr.dev/chainguard/static:latest$' /home/candidate/supply/Dockerfile",
        },
        "cks-sbom": {
            "domain": "supply_chain", "competency": "sbom",
            "title": "Inspect an SBOM",
            "prompt": "Read /opt/exam/fixtures/sbom.txt and write the version of openssl to /home/candidate/answers/openssl-version.txt.",
            "verify": "test \"$(cat /home/candidate/answers/openssl-version.txt 2>/dev/null)\" = 3.0.12",
        },
        "cks-registry": {
            "domain": "supply_chain", "competency": "artifact_policy",
            "title": "Permit only trusted registries",
            "prompt": "Create ValidatingAdmissionPolicy trusted-registry that rejects Pod container images not starting with registry.example.com/.",
            "verify": "kubectl get validatingadmissionpolicy trusted-registry -o json | grep -q 'registry.example.com/'",
        },
        "cks-sign": {
            "domain": "supply_chain", "competency": "artifact_signing",
            "title": "Validate an artifact signature",
            "prompt": "Verify /opt/exam/fixtures/artifact.txt using artifact.sig and artifact.pub. Write PASS to /home/candidate/answers/signature.txt only after successful verification.",
            "verify": "test \"$(cat /home/candidate/answers/signature.txt 2>/dev/null)\" = PASS",
        },
        "cks-static": {
            "domain": "supply_chain", "competency": "static_analysis",
            "title": "Remediate a static-analysis finding",
            "prompt": "Fix /home/candidate/supply/insecure-pod.yaml so the container sets allowPrivilegeEscalation=false, readOnlyRootFilesystem=true and drops ALL capabilities.",
            "verify": "grep -q 'allowPrivilegeEscalation: false' /home/candidate/supply/insecure-pod.yaml && grep -q 'readOnlyRootFilesystem: true' /home/candidate/supply/insecure-pod.yaml && grep -q 'ALL' /home/candidate/supply/insecure-pod.yaml",
        },

        "cks-behavior": {
            "domain": "runtime", "competency": "behavior_analytics",
            "title": "Analyze runtime behavior",
            "prompt": "Inspect /opt/exam/fixtures/falco.log and write the triggered rule name to /home/candidate/answers/falco-rule.txt.",
            "verify": "test \"$(cat /home/candidate/answers/falco-rule.txt 2>/dev/null)\" = Terminal_shell_in_container",
        },
        "cks-threat": {
            "domain": "runtime", "competency": "threat_detection",
            "title": "Detect a suspicious connection",
            "prompt": "Inspect /opt/exam/fixtures/network-events.log and write the suspicious destination IP to /home/candidate/answers/threat-ip.txt.",
            "verify": "test \"$(cat /home/candidate/answers/threat-ip.txt 2>/dev/null)\" = 203.0.113.77",
        },
        "cks-attack": {
            "domain": "runtime", "competency": "attack_investigation",
            "title": "Investigate an API attack trail",
            "prompt": "Inspect /opt/exam/fixtures/audit.log and write the service account username responsible for deleting the Secret to /home/candidate/answers/actor.txt.",
            "verify": "test \"$(cat /home/candidate/answers/actor.txt 2>/dev/null)\" = system:serviceaccount:secure:compromised",
        },
        "cks-immutable": {
            "domain": "runtime", "competency": "container_immutability",
            "title": "Make a container filesystem immutable",
            "prompt": "Create Pod immutable in namespace secure with readOnlyRootFilesystem=true and an emptyDir mounted at /tmp.",
            "verify": "test \"$(kubectl -n secure get pod immutable -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}')\" = true && kubectl -n secure get pod immutable -o json | grep -q emptyDir",
        },
        "cks-audit": {
            "domain": "runtime", "competency": "audit_logs",
            "title": "Write an audit policy",
            "prompt": "Create /home/candidate/audit-policy.yaml with apiVersion audit.k8s.io/v1, kind Policy, and a rule logging Secret create/update/delete at RequestResponse level.",
            "verify": "grep -q 'audit.k8s.io/v1' /home/candidate/audit-policy.yaml && grep -q 'RequestResponse' /home/candidate/audit-policy.yaml && grep -q 'secrets' /home/candidate/audit-policy.yaml",
        },
    },
}


CATALOGS = {
    "CKAD": [
        {
            "id": "ckad-a", "title": "CKAD Catalogue A",
            "tasks": [
                "ckad-image", "ckad-deploy",
                "ckad-bluegreen", "ckad-rollout",
                "ckad-probes", "ckad-debug",
                "ckad-rbac", "ckad-configmap", "ckad-resources",
                "ckad-netpol", "ckad-service", "ckad-ingress",
            ],
        },
        {
            "id": "ckad-b", "title": "CKAD Catalogue B",
            "tasks": [
                "ckad-cronjob", "ckad-multicontainer",
                "ckad-helm", "ckad-kustomize",
                "ckad-api", "ckad-logs",
                "ckad-crd", "ckad-quota", "ckad-secret",
                "ckad-netpol", "ckad-service", "ckad-ingress",
            ],
        },
        {
            "id": "ckad-c", "title": "CKAD Catalogue C",
            "tasks": [
                "ckad-volumes", "ckad-deploy",
                "ckad-bluegreen", "ckad-helm",
                "ckad-monitor", "ckad-debug",
                "ckad-sa", "ckad-securitycontext", "ckad-resources",
                "ckad-netpol", "ckad-service", "ckad-ingress",
            ],
        },
        {
            "id": "ckad-d", "title": "CKAD Catalogue D",
            "tasks": [
                "ckad-image", "ckad-multicontainer",
                "ckad-rollout", "ckad-kustomize",
                "ckad-api", "ckad-probes",
                "ckad-crd", "ckad-configmap", "ckad-secret",
                "ckad-netpol", "ckad-service", "ckad-ingress",
            ],
        },
    ],
    "CKS": [
        {
            "id": "cks-a", "title": "CKS Catalogue A",
            "tasks": [
                "cks-netpol", "cks-cis",
                "cks-rbac", "cks-serviceaccount",
                "cks-os", "cks-seccomp",
                "cks-pss", "cks-secret",
                "cks-base", "cks-sign",
                "cks-behavior", "cks-audit",
            ],
        },
        {
            "id": "cks-b", "title": "CKS Catalogue B",
            "tasks": [
                "cks-tls", "cks-metadata",
                "cks-api", "cks-upgrade",
                "cks-identity", "cks-network",
                "cks-isolation", "cks-mtls",
                "cks-sbom", "cks-registry",
                "cks-threat", "cks-attack",
            ],
        },
        {
            "id": "cks-c", "title": "CKS Catalogue C",
            "tasks": [
                "cks-binary", "cks-netpol",
                "cks-rbac", "cks-api",
                "cks-os", "cks-seccomp",
                "cks-pss", "cks-isolation",
                "cks-static", "cks-sign",
                "cks-immutable", "cks-audit",
            ],
        },
        {
            "id": "cks-d", "title": "CKS Catalogue D",
            "tasks": [
                "cks-cis", "cks-tls",
                "cks-serviceaccount", "cks-upgrade",
                "cks-identity", "cks-network",
                "cks-secret", "cks-mtls",
                "cks-base", "cks-sbom",
                "cks-behavior", "cks-threat",
            ],
        },
    ],
}


def _catalog(exam_type, catalog_id):
    for catalog in CATALOGS[exam_type]:
        if catalog["id"] == catalog_id:
            return catalog
    raise KeyError(catalog_id)


def catalog_tasks(exam_type, catalog_id):
    catalog = _catalog(exam_type, catalog_id)
    selected = [dict(TASKS[exam_type][task_id], id=task_id) for task_id in catalog["tasks"]]
    by_domain = {}
    for task in selected:
        by_domain.setdefault(task["domain"], []).append(task)

    result = []
    for domain_id, tasks in by_domain.items():
        domain_weight = EXAM_GUIDE[exam_type]["domains"][domain_id]["weight"]
        base = domain_weight // len(tasks)
        remainder = domain_weight - (base * len(tasks))
        for index, task in enumerate(tasks):
            task["weight"] = base + (1 if index < remainder else 0)
            result.append(task)
    return result


def public_tasks(exam_type, catalog_id):
    return [
        {k: v for k, v in task.items() if k != "verify"}
        for task in catalog_tasks(exam_type, catalog_id)
    ]


def catalog_list(exam_type=None):
    exam_types = [exam_type] if exam_type else ["CKAD", "CKS"]
    output = []
    for et in exam_types:
        for catalog in CATALOGS[et]:
            output.append({
                "id": catalog["id"],
                "exam_type": et,
                "title": catalog["title"],
                "duration_minutes": EXAM_GUIDE[et]["duration_minutes"],
                "baseline": EXAM_BASELINE,
                "domains": [
                    {
                        "id": domain_id,
                        "name": domain["name"],
                        "weight": domain["weight"],
                    }
                    for domain_id, domain in EXAM_GUIDE[et]["domains"].items()
                ],
            })
    return output
