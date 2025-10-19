#!/bin/bash

# ========================================
# One-Time Cloud Run Setup Script
# ========================================
# Run this ONCE before your first deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ID="splendid-petal-471416-f6"
REGION="us-central1"
CLOUD_SQL_INSTANCE="job-portal-db"
DB_NAME="jobportal"
DB_USER="jobportal"
ARTIFACT_REPO="job-portal-api"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Cloud Run One-Time Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Set project
echo -e "${YELLOW}Setting project...${NC}"
gcloud config set project $PROJECT_ID

# 1. Enable required APIs
echo ""
echo -e "${YELLOW}📦 Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# 2. Create Artifact Registry repository
echo ""
echo -e "${YELLOW}🗄️  Creating Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe $ARTIFACT_REPO --location=$REGION &>/dev/null; then
    echo -e "${BLUE}Repository already exists, skipping...${NC}"
else
    gcloud artifacts repositories create $ARTIFACT_REPO \
      --repository-format=docker \
      --location=$REGION \
      --description="Job Portal API Docker images"
    echo -e "${GREEN}✅ Repository created${NC}"
fi

# 3. Create Cloud SQL instance
echo ""
echo -e "${YELLOW}🗄️  Creating Cloud SQL instance (this takes ~5 minutes)...${NC}"
if gcloud sql instances describe $CLOUD_SQL_INSTANCE &>/dev/null; then
    echo -e "${BLUE}Cloud SQL instance already exists, skipping...${NC}"
else
    gcloud sql instances create $CLOUD_SQL_INSTANCE \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region=$REGION \
      --root-password=temporary-password-change-later
    echo -e "${GREEN}✅ Cloud SQL instance created${NC}"
fi

# 4. Create database
echo ""
echo -e "${YELLOW}📊 Creating database...${NC}"
if gcloud sql databases describe $DB_NAME --instance=$CLOUD_SQL_INSTANCE &>/dev/null; then
    echo -e "${BLUE}Database already exists, skipping...${NC}"
else
    gcloud sql databases create $DB_NAME --instance=$CLOUD_SQL_INSTANCE
    echo -e "${GREEN}✅ Database created${NC}"
fi

# 5. Create database user
echo ""
echo -e "${YELLOW}👤 Creating database user...${NC}"
echo -e "${RED}Enter a secure password for database user '${DB_USER}':${NC}"
read -s DB_PASSWORD
echo ""

gcloud sql users create $DB_USER \
  --instance=$CLOUD_SQL_INSTANCE \
  --password=$DB_PASSWORD || echo -e "${BLUE}User might already exist${NC}"

# 6. Grant Cloud Run permissions to access Cloud SQL
echo ""
echo -e "${YELLOW}🔐 Granting Cloud Run permissions...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📝 IMPORTANT: Save these for deployment:${NC}"
echo ""
echo -e "${BLUE}1. Export DATABASE_URL:${NC}"
echo "   export DATABASE_URL='postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}'"
echo ""
echo -e "${BLUE}2. Export JWT_SECRET:${NC}"
echo "   export JWT_SECRET='$(openssl rand -base64 32)'"
echo ""
echo -e "${BLUE}3. Run deployment:${NC}"
echo "   ./deploy.sh"
echo ""
echo -e "${RED}⚠️  SAVE YOUR DATABASE PASSWORD: ${DB_PASSWORD}${NC}"
echo ""

