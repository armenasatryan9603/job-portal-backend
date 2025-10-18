#!/bin/bash

# Script to deploy to Google Cloud Run
# Usage: ./scripts/deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-"production"}
PROJECT_ID=${GCP_PROJECT_ID:-"your-project-id"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"job-portal-api"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying to Cloud Run (${ENVIRONMENT})...${NC}"

# Set project
gcloud config set project ${PROJECT_ID}

# Deploy
gcloud run deploy ${SERVICE_NAME} \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars NODE_ENV=${ENVIRONMENT}

echo -e "${GREEN}Deployment completed!${NC}"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "\n${GREEN}Service URL:${NC} ${SERVICE_URL}"
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -f ${SERVICE_URL}/api/health || echo "Health check endpoint not available"

