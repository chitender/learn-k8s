# AWS deployment

This Terraform stack hosts Learn Kubernetes on AWS and creates the paid-exam backend.

## Why this shape

The normal website does not need ECS, EKS, RDS, NAT Gateway or an ALB. Static delivery stays on S3 + CloudFront; identity and commerce use Cognito, API Gateway, Lambda and DynamoDB.

The live exam environment is optional and separate. When enabled, it uses a tiny nginx gateway plus a dedicated short-lived EC2 worker per candidate attempt.

## Bootstrap prerequisites

Create once:

1. S3 bucket for Terraform state.
2. GitHub OIDC provider with URL `https://token.actions.githubusercontent.com` and audience `sts.amazonaws.com`.
3. An IAM deploy role whose trust policy is restricted to this repository/main branch.
4. GitHub repository variables:
   - `AWS_REGION`
   - `AWS_ROLE_ARN`
   - `AWS_TF_STATE_BUCKET`
   - optional `AWS_TF_STATE_KEY` (defaults to `learn-k8s/prod.tfstate`)
5. GitHub secret:
   - `RAZORPAY_KEY_ID`

Do not store AWS access keys in GitHub. The deployment workflow uses OIDC temporary credentials.

## Safety defaults

Both commerce and live compute are off by default:

```hcl
paid_exams_enabled = false
enable_live_labs   = false
```

That lets us validate the AWS site and account flow before any user can be charged.

## Configure Razorpay

Terraform creates a Secrets Manager secret container but intentionally does not write secret values into Terraform state.

After the first apply:

```bash
aws secretsmanager put-secret-value \
  --secret-id <razorpay_secret_arn> \
  --secret-string '{"key_secret":"rzp_secret_here","webhook_secret":"choose-a-strong-webhook-secret"}'
```

Configure Razorpay's webhook URL:

```text
<api_url>/payments/webhook
```

Subscribe at minimum to:
- `payment.captured`
- `payment.failed`
- `order.paid`

Test in Razorpay Test mode first. Only after payment verification, webhook delivery and credit idempotency are proven should `paid_exams_enabled` be set to true.

## Live exam workers

With `enable_live_labs=true` the stack adds:

- dedicated lab VPC/public subnet
- t4g.nano nginx gateway
- CloudFront in front of the gateway for HTTPS/WebSocket delivery
- security group that only lets the gateway reach worker ttyd ports
- SSM-managed worker role

Each CKAD/CKS attempt creates a dedicated x86 EC2 worker, bootstraps Docker, kind, kubectl and ttyd, and automatically expires after two hours.

The first version bootstraps tools at instance launch. Before public launch, build a pre-baked worker AMI to reduce startup time and pin all binaries/images by digest.
