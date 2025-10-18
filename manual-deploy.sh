#!/bin/bash

# Manual deployment script for Cloud Run
# Use this to test deployment with explicit values

set -e

echo "=================================="
echo "Manual Cloud Run Deployment"
echo "=================================="
echo ""

# Configuration - UPDATE THESE VALUES
PROJECT_ID="splendid-petal-471416-f6"
REGION="us-central1"
SERVICE_NAME="job-portal-backend"

echo "⚠️  IMPORTANT: Before running this script, set these environment variables:"
echo ""
echo "export DATABASE_URL='postgresql://USER:PASS@/DB?host=/cloudsql/CONNECTION'"
echo "export JWT_SECRET='your-secret-here'"
echo "export CLOUD_SQL_CONNECTION='PROJECT:REGION:INSTANCE'"
echo ""

# Check if environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "Example:"
    echo "export DATABASE_URL='postgresql://jobportal:password@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db'"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ ERROR: JWT_SECRET not set"
    echo ""
    echo "Example:"
    echo "export JWT_SECRET='super-secret-key-12345'"
    exit 1
fi

echo "✅ Environment variables are set"
echo ""

# Set project
gcloud config set project $PROJECT_ID

echo "Deploying to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Build deploy command
DEPLOY_CMD="gcloud run deploy $SERVICE_NAME \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/job-portal-api/job-portal-api:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --max-instances 10 \
  --min-instances 0 \
  --port 8080 \
  --set-env-vars PORT=8080 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL=\"${DATABASE_URL}\" \
  --set-env-vars JWT_SECRET=\"${JWT_SECRET}\""

# Add Cloud SQL connection if provided
if [ ! -z "$CLOUD_SQL_CONNECTION" ]; then
    echo "✅ Adding Cloud SQL connection: $CLOUD_SQL_CONNECTION"
    DEPLOY_CMD="$DEPLOY_CMD --add-cloudsql-instances $CLOUD_SQL_CONNECTION"
else
    echo "⚠️  CLOUD_SQL_CONNECTION not set. If using Cloud SQL, set it:"
    echo "export CLOUD_SQL_CONNECTION='splendid-petal-471416-f6:us-central1:job-portal-db'"
fi

echo ""
echo "Executing deployment..."
echo ""

# Execute deployment
eval $DEPLOY_CMD

echo ""
echo "✅ Deployment complete!"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"
echo ""
echo "Testing health endpoint..."
curl -f $SERVICE_URL/health || echo "⚠️  Health check failed"

echo ""
echo "View logs:"
echo "gcloud run services logs read $SERVICE_NAME --region $REGION"

