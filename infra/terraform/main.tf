# BuildOS staging infrastructure — ap-south-1 (Mumbai), per
# docs/architecture/23-deployment-architecture.md and ADR-01..07.
#
# STATUS: skeleton committed for review; NOT APPLIED (no AWS credentials in
# this environment — UNKNOWN — REQUIRES CONFIRMATION: account id, domain,
# certificate ARN, and image registry choice ECR vs GHCR).

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # backend "s3" {} # configure per environment before first apply
}

provider "aws" {
  region = "ap-south-1"
}

variable "app_secret" {
  type      = string
  sensitive = true
}

# ── Data tier ────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name = "buildos-${terraform.workspace}"
}

resource "aws_db_parameter_group" "pg16" {
  name   = "buildos-pg16-${terraform.workspace}"
  family = "postgres16"

  # RLS + pgvector readiness
  parameter { name = "rds.force_ssl", value = "1" }
  parameter { name = "shared_preload_libraries", value = "pg_stat_statements,vector" }
}

resource "aws_db_instance" "postgres" {
  identifier             = "buildos-${terraform.workspace}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  multi_az               = true
  db_name                = "buildos"
  username               = "buildos_admin"
  password               = var.app_secret # managed via Secrets Manager in the full module
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.pg16.name
  backup_retention_period = 35
  deletion_protection    = terraform.workspace == "prod"
  storage_encrypted      = true
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "buildos-${terraform.workspace}"
  engine               = "redis"
  node_type            = "cache.t4g.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
}

# ── Object storage (documents, KMS) ─────────────────────────────────────────
resource "aws_kms_key" "docs" {
  description             = "BuildOS document encryption"
  deletion_window_in_days = 30
}

resource "aws_s3_bucket" "documents" {
  bucket = "buildos-documents-${terraform.workspace}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.docs.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

# ── Compute (ECS Fargate) — service defs; networking module in full rollout ──
resource "aws_ecs_cluster" "main" {
  name = "buildos-${terraform.workspace}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Container definitions for core-api / erp-web / workers are parameterised in
# the full module (23 §2): min 2 tasks each, scaling on ALB requests + queue
# depth. Image tags come from the CI pipeline (GitHub Actions → ECR).

output "postgres_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}
output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}
output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}
