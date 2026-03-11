#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SureWork Backend — One-time AWS Infrastructure Setup
# Run this ONCE to provision all required AWS resources.
# Prerequisites: AWS CLI configured with admin credentials, jq installed
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

AWS_REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
APP_NAME="surework"

echo "🚀 Setting up SureWork infrastructure in $AWS_REGION (account $ACCOUNT_ID)"

# ── 1. ECR repository ─────────────────────────────────────────────────────────
echo "📦 Creating ECR repository..."
aws ecr create-repository \
  --repository-name "$APP_NAME-backend" \
  --region "$AWS_REGION" \
  --image-scanning-configuration scanOnPush=true \
  --query "repository.repositoryUri" --output text || true

ECR_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-backend"
echo "  ECR URI: $ECR_URI"

# ── 2. Secrets Manager ───────────────────────────────────────────────────────
echo "🔐 Creating secrets in AWS Secrets Manager..."
echo "  ⚠️  Fill in the secrets below BEFORE proceeding!"

# DATABASE_URL — filled automatically after RDS is created (see step 4)
aws secretsmanager create-secret \
  --name "surework/prod/jwt_secret" \
  --description "SureWork JWT signing secret" \
  --secret-string "REPLACE_WITH_STRONG_RANDOM_SECRET_32_CHARS_MIN" \
  --region "$AWS_REGION" 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "surework/prod/jwt_secret" \
  --secret-string "REPLACE_WITH_STRONG_RANDOM_SECRET_32_CHARS_MIN" \
  --region "$AWS_REGION"

aws secretsmanager create-secret \
  --name "surework/prod/rpc_url" \
  --description "Alchemy/Infura RPC URL for Polygon" \
  --secret-string "https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY" \
  --region "$AWS_REGION" 2>/dev/null || true

aws secretsmanager create-secret \
  --name "surework/prod/escrow_contract_address" \
  --description "Deployed SureWorkEscrow contract address on Polygon" \
  --secret-string "FILL_AFTER_DEPLOYING_CONTRACT" \
  --region "$AWS_REGION" 2>/dev/null || true

aws secretsmanager create-secret \
  --name "surework/prod/backend_private_key" \
  --description "Backend operational wallet private key" \
  --secret-string "FILL_WITH_BACKEND_WALLET_PRIVATE_KEY" \
  --region "$AWS_REGION" 2>/dev/null || true

echo "  ✅ Secrets created. Update placeholder values in AWS Secrets Manager console."

# ── 3. IAM roles ─────────────────────────────────────────────────────────────
echo "👤 Creating IAM roles..."

# ECS Task Execution Role (allows ECS to pull ECR images and fetch secrets)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' 2>/dev/null || true

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true

# Allow reading secrets
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name SureworkSecretsPolicy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"secretsmanager:GetSecretValue\"],
      \"Resource\": \"arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT_ID:secret:surework/*\"
    }]
  }" 2>/dev/null || true

# ECS Task Role (what the running container can do)
aws iam create-role \
  --role-name sureworkTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' 2>/dev/null || true

# ── 4. RDS PostgreSQL ─────────────────────────────────────────────────────────
echo "🗄️  Creating RDS PostgreSQL instance..."
DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"
echo "  Generated DB password: $DB_PASSWORD  ← SAVE THIS NOW"

aws rds create-db-instance \
  --db-instance-identifier "$APP_NAME-db" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version "16.1" \
  --master-username postgres \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --db-name surework \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --region "$AWS_REGION" 2>/dev/null || echo "  RDS already exists"

echo "  ⏳ RDS takes ~10 min to become available. Once ready, get the endpoint:"
echo "     aws rds describe-db-instances --db-instance-identifier $APP_NAME-db --query 'DBInstances[0].Endpoint.Address' --output text"
echo "  Then update the DATABASE_URL secret:"
echo "     aws secretsmanager update-secret --secret-id surework/prod/database_url --secret-string \"postgresql://postgres:$DB_PASSWORD@<RDS_ENDPOINT>:5432/surework?schema=public\""

# ── 5. ECS Cluster ───────────────────────────────────────────────────────────
echo "📡 Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "$APP_NAME-cluster" \
  --capacity-providers FARGATE \
  --region "$AWS_REGION" 2>/dev/null || true

# ── 6. CloudWatch log group ───────────────────────────────────────────────────
echo "📊 Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name "/ecs/$APP_NAME-backend" \
  --region "$AWS_REGION" 2>/dev/null || true

aws logs put-retention-policy \
  --log-group-name "/ecs/$APP_NAME-backend" \
  --retention-in-days 30 \
  --region "$AWS_REGION" 2>/dev/null || true

# ── 7. Register ECS Task Definition ──────────────────────────────────────────
echo "📋 Registering ECS task definition..."
# Replace placeholders in the template
sed \
  -e "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" \
  -e "s|us-east-1|$AWS_REGION|g" \
  infra/ecs-task-definition.json > /tmp/task-def-final.json

aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region "$AWS_REGION"

echo ""
echo "✅ Infrastructure setup complete!"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. Wait for RDS to be available (~10 min), then update the DATABASE_URL secret"
echo "  2. Create Application Load Balancer + Target Group + HTTPS listener in AWS console"
echo "  3. Create ECS Service pointing to the surework-cluster and surework-backend task definition"
echo "  4. Point your domain (api.surework.app) to the ALB DNS name via Route 53"
echo "  5. Request an SSL certificate in ACM for api.surework.app"
echo "  6. Add GitHub repository secrets:"
echo "     AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (CI/CD IAM user)"
echo "  7. Push to main branch — GitHub Actions will build and deploy automatically"
