# Learn Kubernetes — AWS + Paid Exam Architecture

## Product shape

The site moves from GitHub Pages to AWS while keeping the always-on footprint small:

```text
GitHub Actions (OIDC)
        |
        v
CloudFormation
        |
        +--> S3 (private) --> CloudFront --> free learning site / Pro UI
        |
        +--> Cognito --> API Gateway HTTP API --> Lambda
                                             |       |
                                             |       +--> DynamoDB
                                             |       +--> Secrets Manager
                                             |       +--> Razorpay
                                             |
                                             +--> optional live exam infrastructure
                                                      |
                                                      +--> t4g.nano nginx gateway
                                                      +--> one dedicated EC2 worker per attempt
```

No EKS, ECS, RDS, NAT Gateway or ALB is required for the normal product path.

## GitHub Actions -> Secrets Manager

GitHub Actions reads deployment variables/secrets and pushes one JSON configuration document into the CloudFormation-created secret:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PAID_EXAMS_ENABLED`
- `ENABLE_LIVE_LABS`
- pricing bundle definitions

The Lambda reads the secret through its IAM role. Razorpay secrets are not stored in CloudFormation parameters, stack outputs, the static frontend or repository.

## Plans

One exam credit starts one CKAD or CKS simulator session.

| Plan | Credits | Price | Approx price/attempt |
| --- | ---: | ---: | ---: |
| Free | 2 | ₹0 | trial |
| Bronze | 5 | ₹699 | ₹140 |
| Silver | 10 | ₹1,379 | ₹138 |
| Gold | 20 | ₹2,699 | ₹135 |

The working economic assumption is ₹100 infrastructure cost for a candidate who consumes the full two-hour lab. These prices represent roughly a 30–40% cost-plus markup before taxes, support, refunds, fraud and payment-gateway fees. Actual AWS usage must be measured and the bundle prices adjusted from configuration.

Free credits are granted once when a verified Cognito user first loads their entitlement record. Paid bundle credits are additive and can be used on either CKAD or CKS.

## Exam catalogues

The simulator never uses copied or recalled live certification questions.

The task bank is original Learn Kubernetes material mapped to the current public Linux Foundation/CNCF exam competencies.

Current catalogue structure:

- 4 CKAD forms
- 4 CKS forms
- official domain weights are preserved inside every form
- the union of forms covers every public competency represented in `backend/exam_catalog.py`
- CI validates competency coverage, task IDs and 100% weighting

The current certification pages list both exams as two-hour performance-based tests and currently identify Kubernetes v1.35 as the exam environment baseline. The learning site can independently continue to teach newer Kubernetes releases.

## CKAD public domains

- Application Design and Build — 20%
- Application Deployment — 20%
- Application Observability and Maintenance — 15%
- Application Environment, Configuration and Security — 25%
- Services and Networking — 20%

## CKS public domains

The simulator follows the current Linux Foundation page:

- Cluster Setup — 15%
- Cluster Hardening — 15%
- System Hardening — 10%
- Minimize Microservice Vulnerabilities — 20%
- Supply Chain Security — 20%
- Monitoring, Logging and Runtime Security — 20%

## Session lifecycle

```text
verified user
   |
   | 1 exam credit
   v
select CKAD/CKS catalogue
   |
   v
DynamoDB transaction consumes credit + creates session
   |
   v
dedicated x86 EC2 worker
   |
   +--> Docker
   +--> kind v0.32
   +--> Kubernetes v1.35.5 node image
   +--> kubectl
   +--> Helm
   +--> ttyd browser terminal
   |
   v
candidate solves tasks
   |
   v
submit
   |
   v
Lambda runs server-side verifiers through SSM
   |
   v
weighted score
   |
   +--> terminate worker
   +--> remove nginx route
```

Expired sessions are cleaned every five minutes.

## Razorpay flow

1. Browser submits only a plan ID.
2. Lambda looks up the price and credit count from Secrets Manager.
3. Lambda creates a Razorpay Order.
4. Browser opens Razorpay Checkout using the returned order/key ID.
5. Lambda verifies the HMAC signature.
6. Lambda queries Razorpay to require captured payment + paid order state.
7. A DynamoDB transaction grants credits exactly once.
8. Signed Razorpay webhooks provide asynchronous recovery for delayed events.

## Deployment

GitHub Actions uses AWS OIDC temporary credentials.

Required repository variables:

- `AWS_ROLE_ARN`
- `AWS_REGION` (default `ap-south-1`)
- `PAID_EXAMS_ENABLED` (default false)
- `ENABLE_LIVE_LABS` (default false)

Required repository secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

The deployment workflow:

1. validates the learning site and exam catalogue
2. compiles the Python backend
3. validates the CloudFormation template
4. creates/reuses a private Lambda artifact bucket
5. uploads the backend ZIP
6. deploys CloudFormation
7. writes GitHub-held runtime configuration into Secrets Manager
8. builds the static site from stack outputs
9. syncs `dist/` to private S3
10. invalidates CloudFront

GitHub Pages remains a static fallback until the AWS URL is validated and cutover is complete.
