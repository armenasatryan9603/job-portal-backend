#!/bin/bash

# Quick deployment script with the 0.0.0.0 binding fix
set -e

PROJECT_ID="splendid-petal-471416-f6"
REGION="us-central1"
SERVICE_NAME="job-portal-backend"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/job-portal-api/job-portal-api:fix-$(date +%s)"

echo "=================================="
echo "Quick Fix Deployment"
echo "=================================="
echo ""
echo "This will:"
echo "1. Build Docker image with the 0.0.0.0 binding fix"
echo "2. Push to Artifact Registry"
echo "3. Deploy to Cloud Run"
echo ""

# Set project
gcloud config set project $PROJECT_ID

echo "Building Docker image with fix..."
docker build -t $IMAGE_NAME .

echo ""
echo "Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo ""
echo "Pushing image..."
docker push $IMAGE_NAME

echo ""
echo "Deploying to Cloud Run..."
echo "⚠️  Make sure these environment variables are already set in Cloud Run:"
echo "  - DATABASE_URL"
echo "  - JWT_SECRET"
echo "  - CLOUD_SQL_CONNECTION"
echo ""

# Deploy with existing configuration
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --port 8080 \
  --timeout 600 \
  --memory 2Gi \
  --cpu 2

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Check logs:"
echo "gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"

