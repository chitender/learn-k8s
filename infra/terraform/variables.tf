variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "site_name" {
  type    = string
  default = "learn-k8s"
}

variable "razorpay_key_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "paid_exams_enabled" {
  type    = bool
  default = false
}

variable "enable_live_labs" {
  type    = bool
  default = false
}

variable "ckad_price_inr" {
  type    = number
  default = 999
}

variable "cks_price_inr" {
  type    = number
  default = 1299
}

variable "lab_instance_type" {
  type    = string
  default = "t3a.medium"
}
