#!/bin/bash

# Script to build and push Docker image to Google Artifact Registry
# Usage: ./scripts/build-and-push.sh

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"your-project-id"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"job-portal-api"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Docker image...${NC}"
docker build -t ${SERVICE_NAME}:${IMAGE_TAG} .

echo -e "${GREEN}Tagging image for Artifact Registry...${NC}"
docker tag ${SERVICE_NAME}:${IMAGE_TAG} \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:${IMAGE_TAG}

echo -e "${GREEN}Configuring Docker authentication...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo -e "${GREEN}Pushing image to Artifact Registry...${NC}"
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:${IMAGE_TAG}

echo -e "${GREEN}Image pushed successfully!${NC}"
echo -e "Image: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

echo -e "\n${YELLOW}To deploy to Cloud Run, run:${NC}"
echo "gcloud run deploy ${SERVICE_NAME} \\"
echo "  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:${IMAGE_TAG} \\"
echo "  --platform managed \\"
echo "  --region ${REGION}"

