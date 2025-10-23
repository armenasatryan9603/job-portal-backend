#!/bin/bash

# ========================================
# Google Cloud Run Deployment Script
# Using Cloud Build (No local Docker required)
# ========================================
# This script builds your app in the cloud and deploys to Cloud Run

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ID="splendid-petal-471416-f6"
REGION="me-west1"
SERVICE_NAME="job-portal-backend"
CLOUD_SQL_INSTANCE="job-portal"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/job-portal-api/job-portal-api:latest"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Job Portal - Cloud Run Deploy${NC}"
echo -e "${GREEN}   (Using Cloud Build)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable not set${NC}"
    echo ""
    echo -e "${YELLOW}Set it with your actual database credentials:${NC}"
    echo ""
    echo -e "${BLUE}For Cloud SQL (Private connection via Unix socket - RECOMMENDED):${NC}"
    echo "export DATABASE_URL='postgresql://postgres:Qw123456789==@localhost/job-portal?host=/cloudsql/${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}'"
    echo ""
    echo -e "${BLUE}For Cloud SQL (Public IP):${NC}"
    echo "export DATABASE_URL='postgresql://postgres:Qw123456789==@34.165.227.126:5432/job-portal'"
    echo ""
    echo -e "${BLUE}Your Cloud SQL Instance:${NC} ${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ ERROR: JWT_SECRET environment variable not set${NC}"
    echo ""
    echo -e "${YELLOW}Set it with:${NC}"
    echo "export JWT_SECRET='your-super-secret-key-here'"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables verified${NC}"
echo ""

# Set project
echo -e "${YELLOW}📋 Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Build and push image using Cloud Build
echo ""
echo -e "${YELLOW}🔨 Building Docker image with Cloud Build...${NC}"
echo -e "${BLUE}(This builds in the cloud - no local Docker needed!)${NC}"
gcloud builds submit --tag $IMAGE_NAME

# Deploy to Cloud Run
echo ""
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 600 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 0 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}" \
  --set-env-vars "PORT=8080,NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "JWT_SECRET=${JWT_SECRET}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo ""
echo -e "${GREEN}🌐 Service URL:${NC} $SERVICE_URL"
echo ""
echo -e "${YELLOW}📝 Check logs:${NC}"
echo "   gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"
echo ""
echo -e "${YELLOW}🔍 Test health endpoint:${NC}"
echo "   curl $SERVICE_URL/health"
echo ""

