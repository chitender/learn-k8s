output "site_bucket" {
  value = aws_s3_bucket.site.id
}

output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "api_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.users.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "razorpay_secret_arn" {
  value = aws_secretsmanager_secret.razorpay.arn
}

output "lab_url" {
  value = var.enable_live_labs ? "https://${aws_cloudfront_distribution.labs[0].domain_name}" : ""
}
