# Learn Kubernetes — AWS + Paid Exam Architecture

## Goal

Move the public learning site off GitHub Pages to AWS with the lowest practical always-on cost, then add paid CKAD and CKS exam-simulator products.

> The current CNCF security certification is **CKS**. This design treats the earlier "CKSI" wording as CKS.

## Architecture

```text
GitHub Actions (OIDC)
        |
        v
S3 (private) ---> CloudFront ---> Browser
                         |
                         +---- free learning content
                         |
                         +---- pro.html
                                  |
                                  v
                              Cognito
                                  |
                                  v
                         API Gateway HTTP API
                                  |
                                  v
                                Lambda
                         /        |         \
                   DynamoDB    Razorpay     EC2
                   credits     Orders       live labs
                   sessions    webhooks

Live exam path
--------------
CloudFront (lab distribution)
        |
        v
small gateway EC2 (nginx, always-on only when live labs enabled)
        |
        +------> dedicated CKAD/CKS worker EC2
                 kind cluster + kubectl + ttyd
                 auto-terminate at exam TTL
```

## Cost model

The normal website does **not** need ECS, EKS, RDS or an ALB.

Always-on product layer:
- S3 for static files
- CloudFront CDN
- Cognito user pool
- API Gateway HTTP API
- Lambda
- DynamoDB on-demand
- Secrets Manager for Razorpay secrets

These are request-based/serverless services and should remain inexpensive at small traffic volumes.

The expensive part is the real exam lab. It is deliberately separated and created only for a paid exam attempt. A dedicated EC2 worker is the safest model for CKS because the learner needs privileged cluster/system access. Sessions have a strict TTL and are terminated automatically.

## Paid products

Initial server-side product IDs:

- `ckad_attempt` — one CKAD live simulator attempt
- `cks_attempt` — one CKS live simulator attempt

Pricing is an infrastructure variable, not trusted from the browser.

## Payment security

Razorpay flow:

1. Authenticated browser requests `POST /payments/order` with a product ID.
2. Lambda selects the server-side amount and creates a Razorpay Order.
3. Checkout receives only the resulting order ID and public Razorpay key ID.
4. Browser sends payment/order/signature to `POST /payments/verify`.
5. Lambda verifies the HMAC signature and fetches Razorpay payment/order state before granting credits.
6. Razorpay webhooks provide the durable asynchronous source of truth for late payment updates.
7. Entitlement updates are idempotent in DynamoDB.

Razorpay key secret and webhook secret never enter the browser or GitHub repository.

## CI/CD

GitHub Actions authenticates to AWS through OIDC. No long-lived AWS access keys are stored in GitHub.

Required GitHub repository variables/secrets:

### Variables
- `AWS_REGION` (recommended: `ap-south-1`)
- `AWS_ROLE_ARN`
- `AWS_TF_STATE_BUCKET`
- `AWS_TF_STATE_KEY` (optional, default `learn-k8s/prod.tfstate`)

### Secrets
- `RAZORPAY_KEY_ID` (public identifier, secret storage is still convenient)

The Razorpay key secret and webhook secret should be inserted directly into the AWS Secrets Manager secret created by Terraform.

## Migration sequence

1. Bootstrap GitHub OIDC role and Terraform state bucket.
2. Configure repository variables.
3. Run the AWS deployment workflow manually.
4. Validate the CloudFront URL.
5. Configure Razorpay test-mode credentials and webhook.
6. Enable paid exam checkout only after the live lab engine is validated.
7. Point the final custom domain to CloudFront.
8. Disable the GitHub Pages deployment workflow after cutover.

## Exam realism

CKAD and CKS are performance-based command-line exams. A realistic paid product therefore needs:

- two-hour timer
- browser terminal
- real Kubernetes API
- task list with weighted scoring
- namespace/context instructions
- reset/reconnect handling
- automatic grading
- strict session expiry
- no solution reveal until submission/expiry

The frontend exam cockpit is built independently from the worker implementation so we can improve the lab AMI and grader without changing billing.
