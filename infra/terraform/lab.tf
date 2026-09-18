data "aws_ssm_parameter" "al2023_x86" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

data "aws_ssm_parameter" "al2023_arm" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_vpc" "labs" {
  count                = var.enable_live_labs ? 1 : 0
  cidr_block           = "10.77.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "\${var.site_name}-labs" }
}

resource "aws_internet_gateway" "labs" {
  count  = var.enable_live_labs ? 1 : 0
  vpc_id = aws_vpc.labs[0].id
}

resource "aws_subnet" "labs" {
  count                   = var.enable_live_labs ? 1 : 0
  vpc_id                  = aws_vpc.labs[0].id
  cidr_block              = "10.77.10.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "\${var.aws_region}a"
}

resource "aws_route_table" "labs" {
  count  = var.enable_live_labs ? 1 : 0
  vpc_id = aws_vpc.labs[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.labs[0].id
  }
}

resource "aws_route_table_association" "labs" {
  count          = var.enable_live_labs ? 1 : 0
  subnet_id      = aws_subnet.labs[0].id
  route_table_id = aws_route_table.labs[0].id
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  count = var.enable_live_labs ? 1 : 0
  name  = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "gateway" {
  count       = var.enable_live_labs ? 1 : 0
  name_prefix = "\${var.site_name}-gateway-"
  vpc_id      = aws_vpc.labs[0].id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "worker" {
  count       = var.enable_live_labs ? 1 : 0
  name_prefix = "\${var.site_name}-worker-"
  vpc_id      = aws_vpc.labs[0].id

  ingress {
    from_port       = 7681
    to_port         = 7681
    protocol        = "tcp"
    security_groups = [aws_security_group.gateway[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "lab_worker" {
  name_prefix = "\${var.site_name}-lab-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lab_ssm" {
  role       = aws_iam_role.lab_worker.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "lab_worker" {
  name_prefix = "\${var.site_name}-lab-"
  role        = aws_iam_role.lab_worker.name
}

locals {
  gateway_user_data = <<-EOF
#!/bin/bash
set -eux
dnf install -y nginx
mkdir -p /etc/nginx/lab-routes
cat >/etc/nginx/nginx.conf <<'NGINX'
events {}
http {
  map $http_upgrade $connection_upgrade { default upgrade; '' close; }
  server {
    listen 80 default_server;
    location = /health {
      add_header Content-Type text/plain;
      return 200 'ok';
    }
    include /etc/nginx/lab-routes/*.conf;
  }
}
NGINX
systemctl enable --now nginx
EOF
}

resource "aws_instance" "gateway" {
  count                       = var.enable_live_labs ? 1 : 0
  ami                         = data.aws_ssm_parameter.al2023_arm.value
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.labs[0].id
  vpc_security_group_ids      = [aws_security_group.gateway[0].id]
  iam_instance_profile        = aws_iam_instance_profile.lab_worker.name
  associate_public_ip_address = true
  user_data                   = local.gateway_user_data

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = "\${var.site_name}-lab-gateway" }
}

resource "aws_cloudfront_cache_policy" "labs" {
  count       = var.enable_live_labs ? 1 : 0
  name        = "\${var.site_name}-labs-no-cache"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config { cookie_behavior = "all" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "all" }
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false
  }
}

resource "aws_cloudfront_origin_request_policy" "labs" {
  count = var.enable_live_labs ? 1 : 0
  name  = "\${var.site_name}-labs-origin"
  cookies_config { cookie_behavior = "all" }
  headers_config { header_behavior = "allViewer" }
  query_strings_config { query_string_behavior = "all" }
}

resource "aws_cloudfront_distribution" "labs" {
  count           = var.enable_live_labs ? 1 : 0
  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  origin {
    domain_name = aws_instance.gateway[0].public_dns
    origin_id   = "lab-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "lab-gateway"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = aws_cloudfront_cache_policy.labs[0].id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.labs[0].id
    compress                 = false
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
