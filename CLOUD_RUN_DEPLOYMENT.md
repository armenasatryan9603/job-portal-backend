# Google Cloud Run Deployment Guide

This guide explains how to deploy your NestJS application to Google Cloud Run using GitHub Actions.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. GitHub repository for your project
3. Google Cloud CLI installed locally (optional, for manual setup)

## Setup Instructions

### 1. Create Google Cloud Project

```bash
# Create a new project (or use existing one)
gcloud projects create YOUR_PROJECT_ID

# Set the project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 2. Create Artifact Registry Repository

```bash
# Create a repository for Docker images
gcloud artifacts repositories create job-portal-api \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Job Portal API"
```

### 3. Create Service Account

```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create and download service account key
gcloud iam service-accounts keys create github-sa-key.json \
  --iam-account=github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 4. Create Secrets in Google Cloud Secret Manager

```bash
# Create secret for GCS service account
gcloud secrets create gcs-service-account-key \
  --data-file=./service-account-key.json

# Create secret for Firebase service account
gcloud secrets create firebase-service-account \
  --data-file=./path-to-firebase-service-account.json

# Grant Cloud Run service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding gcs-service-account-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding firebase-service-account \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 5. Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

Required secrets:
- `GCP_PROJECT_ID`: Your Google Cloud Project ID
- `GCP_SA_KEY`: Contents of the `github-sa-key.json` file
- `DATABASE_URL`: PostgreSQL connection string (e.g., from Cloud SQL)
- `JWT_SECRET`: Secret key for JWT tokens
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

### 6. Setup Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create job-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create jobportal \
  --instance=job-portal-db

# Create user
gcloud sql users create jobportal \
  --instance=job-portal-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name
gcloud sql instances describe job-portal-db \
  --format="value(connectionName)"
```

Your `DATABASE_URL` should be:
```
postgresql://jobportal:YOUR_SECURE_PASSWORD@/jobportal?host=/cloudsql/CONNECTION_NAME
```

### 7. Configure Cloud Run Service

The GitHub Actions workflow will automatically deploy, but you can also deploy manually:

```bash
# Build the image
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/job-portal-api/job-portal-api:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/job-portal-api/job-portal-api:latest

# Deploy to Cloud Run
gcloud run deploy job-portal-api \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/job-portal-api/job-portal-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:job-portal-db \
  --set-env-vars DATABASE_URL=postgresql://... \
  --set-secrets=GCS_SERVICE_ACCOUNT_KEY=gcs-service-account-key:latest \
  --set-secrets=FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest
```

## Environment Variables

The following environment variables should be set in Cloud Run:

### Required
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `PORT`: 8080 (automatically set by Cloud Run)

### OAuth
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### Storage
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket name
- `GCS_PROJECT_ID`: GCP Project ID

### CORS
- `CORS_ORIGIN`: Comma-separated list of allowed origins

## Secrets Management

Secrets are stored in Google Secret Manager and mounted to Cloud Run:
- `gcs-service-account-key`: GCS service account credentials
- `firebase-service-account`: Firebase admin SDK credentials

## Automatic Deployment

Once configured, every push to the `main` branch will:
1. Build a Docker image
2. Push to Google Artifact Registry
3. Deploy to Cloud Run
4. Run Prisma migrations automatically

## Testing the Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe job-portal-api \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)')

# Test the endpoint
curl $SERVICE_URL/api/health
```

## Monitoring and Logs

View logs:
```bash
gcloud run services logs read job-portal-api \
  --region us-central1 \
  --limit 50
```

View service details:
```bash
gcloud run services describe job-portal-api \
  --region us-central1
```

## Cost Optimization

- **Min instances**: Set to 0 to avoid idle costs
- **Max instances**: Set to 10 to control maximum costs
- **Memory**: 1Gi is sufficient for most workloads
- **CPU**: 1 vCPU is allocated per instance
- **Timeout**: 300 seconds (5 minutes) for long-running requests

## Troubleshooting

### Container fails to start
Check logs: `gcloud run services logs read job-portal-api --region us-central1`

### Database connection issues
- Ensure Cloud SQL instance is running
- Verify DATABASE_URL format
- Check Cloud SQL instance connection name
- Ensure Cloud Run service account has Cloud SQL Client role

### Secret access denied
- Verify secrets exist in Secret Manager
- Check IAM permissions for Cloud Run service account
- Ensure secrets are in the same project

### Build fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Ensure Prisma schema is valid

## Security Best Practices

1. **Never commit secrets**: Use Secret Manager for sensitive data
2. **Use least privilege**: Grant minimal required permissions
3. **Enable VPC**: For production, use VPC connector for Cloud SQL
4. **Authentication**: Enable IAM authentication for Cloud Run (remove `--allow-unauthenticated` for private APIs)
5. **HTTPS only**: Cloud Run enforces HTTPS by default

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)

