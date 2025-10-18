#!/bin/bash

# Script to help debug Cloud Run deployment issues
# This will show you what needs to be configured

echo "=================================="
echo "Cloud Run Deployment Checker"
echo "=================================="
echo ""

# Check if running in Cloud Shell or with gcloud installed
if ! command -v gcloud &> /dev/null; then
    echo "⚠️  gcloud CLI not found"
    echo "Please run this from Google Cloud Shell or install gcloud CLI"
    echo ""
    echo "Quick steps to fix your deployment:"
    echo ""
    echo "1. Go to Cloud Console: https://console.cloud.google.com"
    echo "2. Open Cloud Shell (button in top right)"
    echo "3. Run these commands:"
    echo ""
    echo "   # Check current Cloud Run configuration"
    echo "   gcloud run services describe job-portal-backend --region us-central1 --format=yaml"
    echo ""
    echo "   # View logs"
    echo "   gcloud run services logs read job-portal-backend --region us-central1 --limit 50"
    echo ""
    echo "4. Look for missing environment variables:"
    echo "   - DATABASE_URL"
    echo "   - JWT_SECRET"
    echo "   - PORT"
    echo ""
    exit 1
fi

PROJECT_ID="splendid-petal-471416-f6"
REGION="us-central1"
SERVICE_NAME="job-portal-backend"

echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

echo "Checking Cloud Run service..."
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="yaml(spec.template.spec.containers[0].env)" 2>&1

echo ""
echo "Checking for Cloud SQL connections..."
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="yaml(spec.template.metadata.annotations)" 2>&1 | grep -i cloudsql || echo "❌ No Cloud SQL connections found"

echo ""
echo "Recent logs (last 20 lines):"
gcloud run services logs read $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --limit 20 2>&1

echo ""
echo "=================================="
echo "What to check:"
echo "=================================="
echo "1. DATABASE_URL is set in environment variables"
echo "2. JWT_SECRET is set"
echo "3. PORT is set to 8080"
echo "4. Cloud SQL connection is configured (run.googleapis.com/cloudsql-instances)"
echo "5. Logs show the actual error"

