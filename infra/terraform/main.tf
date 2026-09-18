data "aws_caller_identity" "current" {}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "\${path.module}/../../backend"
  output_path = "\${path.module}/.learn-k8s-api.zip"
}

resource "aws_s3_bucket" "site" {
  bucket_prefix = "\${var.site_name}-site-"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "\${var.site_name}-oac"
  description                       = "Private S3 origin for Learn Kubernetes"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "site" {
  name        = "\${var.site_name}-static"
  default_ttl = 3600
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.site.id
    compress               = true
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "site_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["\${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_bucket.json
}

resource "aws_cognito_user_pool" "users" {
  name                     = "\${var.site_name}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "\${var.site_name}-web"
  user_pool_id = aws_cognito_user_pool.users.id
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"
}

resource "aws_dynamodb_table" "entitlements" {
  name         = "\${var.site_name}-entitlements"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  attribute { name = "user_id" type = "S" }
  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "payments" {
  name         = "\${var.site_name}-payments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "order_id"
  attribute { name = "order_id" type = "S" }
  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "\${var.site_name}-exam-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"
  attribute { name = "session_id" type = "S" }
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
  point_in_time_recovery { enabled = true }
}

resource "aws_secretsmanager_secret" "razorpay" {
  name_prefix = "\${var.site_name}/razorpay-"
  description = "JSON object with key_secret and webhook_secret. Populate out-of-band."
}

resource "aws_iam_role" "api" {
  name_prefix = "\${var.site_name}-api-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_basic" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "api" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:TransactWriteItems",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.entitlements.arn,
          aws_dynamodb_table.payments.arn,
          aws_dynamodb_table.sessions.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.razorpay.arn]
      },
      {
        Effect   = "Allow"
        Action   = [
          "ec2:RunInstances",
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus",
          "ec2:TerminateInstances",
          "ec2:CreateTags"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand", "ssm:DescribeInstanceInformation", "ssm:GetCommandInvocation"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.lab_worker.arn]
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name    = "\${var.site_name}-api"
  role             = aws_iam_role.api.arn
  runtime          = "python3.13"
  handler          = "app.handler"
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      ENTITLEMENTS_TABLE      = aws_dynamodb_table.entitlements.name
      PAYMENTS_TABLE          = aws_dynamodb_table.payments.name
      SESSIONS_TABLE          = aws_dynamodb_table.sessions.name
      RAZORPAY_SECRET_ARN     = aws_secretsmanager_secret.razorpay.arn
      RAZORPAY_KEY_ID         = var.razorpay_key_id
      PAID_EXAMS_ENABLED      = tostring(var.paid_exams_enabled)
      ENABLE_LIVE_LABS        = tostring(var.enable_live_labs)
      PRODUCTS_JSON = jsonencode({
        ckad_attempt = {
          name         = "CKAD Simulator Attempt"
          amount       = var.ckad_price_inr * 100
          currency     = "INR"
          credit_field = "ckad_credits"
        }
        cks_attempt = {
          name         = "CKS Simulator Attempt"
          amount       = var.cks_price_inr * 100
          currency     = "INR"
          credit_field = "cks_credits"
        }
      })
      LAB_SUBNET_ID           = var.enable_live_labs ? aws_subnet.labs[0].id : ""
      LAB_SECURITY_GROUP_ID   = var.enable_live_labs ? aws_security_group.worker[0].id : ""
      LAB_INSTANCE_PROFILE    = aws_iam_instance_profile.lab_worker.name
      LAB_WORKER_AMI          = data.aws_ssm_parameter.al2023_x86.value
      LAB_INSTANCE_TYPE       = var.lab_instance_type
      LAB_GATEWAY_INSTANCE_ID = var.enable_live_labs ? aws_instance.gateway[0].id : ""
      LAB_BASE_URL            = var.enable_live_labs ? "https://\${aws_cloudfront_distribution.labs[0].domain_name}" : ""
    }
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "\${var.site_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_headers = ["authorization", "content-type", "x-razorpay-signature"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.\${var.aws_region}.amazonaws.com/\${aws_cognito_user_pool.users.id}"
  }
}

locals {
  public_routes = toset([
    "GET /health",
    "POST /payments/webhook"
  ])

  protected_routes = toset([
    "GET /me/entitlements",
    "POST /payments/order",
    "POST /payments/verify",
    "POST /exams/start",
    "GET /exams/session/{session_id}",\n    "POST /exams/session/{session_id}/submit"
  ])
}

resource "aws_apigatewayv2_route" "public" {
  for_each  = local.public_routes
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/\${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_route" "protected" {
  for_each           = local.protected_routes
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = each.value
  target             = "integrations/\${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_cloudwatch_event_rule" "cleanup" {
  name                = "\${var.site_name}-exam-cleanup"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "cleanup" {
  rule  = aws_cloudwatch_event_rule.cleanup.name
  arn   = aws_lambda_function.api.arn
  input = jsonencode({ source = "learn-k8s.cleanup" })
}

resource "aws_lambda_permission" "cleanup" {
  statement_id  = "AllowEventBridgeCleanup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cleanup.arn
}
