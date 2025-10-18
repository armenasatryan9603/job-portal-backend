# Docker and Google Cloud Run Setup - Complete Guide

## 📦 What Was Created

All necessary files for deploying your NestJS application to Google Cloud Run via GitHub Actions have been created:

### Docker Configuration Files
- ✅ `Dockerfile` - Multi-stage production-optimized Docker image
- ✅ `.dockerignore` - Excludes unnecessary files from build
- ✅ `docker-compose.yml` - Local development environment

### GitHub Actions Workflows
- ✅ `.github/workflows/deploy-cloud-run.yml` - Automated deployment to Cloud Run
- ✅ `.github/workflows/build-test.yml` - Build and test on pull requests

### Helper Scripts
- ✅ `scripts/build-and-push.sh` - Manual build and push to Artifact Registry
- ✅ `scripts/deploy.sh` - Manual deployment to Cloud Run

### Documentation
- ✅ `CLOUD_RUN_DEPLOYMENT.md` - Complete setup guide
- ✅ `DOCKER_QUICK_START.md` - Docker commands reference
- ✅ `DEPLOYMENT_SUMMARY.md` - Overview and next steps

## 🚀 Quick Start Guide

### Option 1: Automated Deployment (Recommended)

#### Step 1: Google Cloud Setup

```bash
# 1. Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# 3. Create Artifact Registry repository
gcloud artifacts repositories create job-portal-api \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Job Portal API"

# 4. Create service account for GitHub Actions
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# 5. Grant permissions
PROJECT_ID=$(gcloud config get-value project)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 6. Create and download service account key
gcloud iam service-accounts keys create github-sa-key.json \
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

# Display the key (copy this for GitHub secrets)
cat github-sa-key.json
```

#### Step 2: Setup Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create job-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create jobportal \
  --instance=job-portal-db

# Create user (replace YOUR_PASSWORD)
gcloud sql users create jobportal \
  --instance=job-portal-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name
gcloud sql instances describe job-portal-db --format="value(connectionName)"
```

#### Step 3: Create Secrets in Secret Manager

```bash
# Create secrets for your application
gcloud secrets create gcs-service-account-key \
  --data-file=./service-account-key.json

# Create Firebase secret (if applicable)
# gcloud secrets create firebase-service-account \
#   --data-file=./firebase-service-account.json

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding gcs-service-account-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 4: Configure GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `GCP_PROJECT_ID` | Your GCP project ID | `my-project-123456` |
| `GCP_SA_KEY` | Content of `github-sa-key.json` | `{"type": "service_account",...}` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@/db?host=/cloudsql/...` |
| `JWT_SECRET` | Random secure string | `your-super-secret-jwt-key-here` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `GOCSPX-xxxxx` |

#### Step 5: Update Workflow File (if needed)

Edit `.github/workflows/deploy-cloud-run.yml` to match your configuration:

```yaml
env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1  # Change if using different region
  SERVICE_NAME: job-portal-api  # Change if you want a different name
```

#### Step 6: Deploy

```bash
# Commit and push to trigger deployment
git add .
git commit -m "Add Docker and Cloud Run deployment configuration"
git push origin main
```

The GitHub Action will automatically:
1. ✅ Build the Docker image
2. ✅ Push to Artifact Registry
3. ✅ Deploy to Cloud Run
4. ✅ Run database migrations
5. ✅ Display the service URL

#### Step 7: Verify Deployment

```bash
# Get your service URL
gcloud run services describe job-portal-api \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'

# Test the endpoint
curl https://YOUR_SERVICE_URL/api/health
```

### Option 2: Local Testing with Docker

#### Using Docker Compose (Easiest)

```bash
# Start all services (PostgreSQL + API)
docker-compose up

# In another terminal, test the API
curl http://localhost:8080/api/health
```

#### Manual Docker Build

```bash
# Build the image
docker build -t job-portal-api:latest .

# Run with PostgreSQL (using docker-compose for DB only)
docker-compose up -d postgres
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://jobportal:jobportal123@localhost:5432/jobportal" \
  -e JWT_SECRET="local-secret" \
  job-portal-api:latest
```

### Option 3: Manual Deployment to Cloud Run

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Build and push
./scripts/build-and-push.sh

# Deploy
./scripts/deploy.sh production
```

## 📋 Dockerfile Explanation

```dockerfile
# Stage 1: Builder - Compile TypeScript and generate Prisma client
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production - Minimal runtime image
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p uploads/media
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

**Key Features:**
- ✅ Multi-stage build (smaller final image)
- ✅ Alpine Linux (minimal size ~200MB)
- ✅ Automated Prisma migrations on startup
- ✅ Non-root user for security
- ✅ Signal handling with dumb-init
- ✅ Production dependencies only

## 🔧 Configuration

### Environment Variables Required

**Essential:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 8080)

**Optional:**
- `CORS_ORIGIN` - Allowed origins (comma-separated)
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `GCS_BUCKET_NAME` - Google Cloud Storage bucket
- `GCS_PROJECT_ID` - GCP project ID

### Cloud Run Configuration

The deployment configures:
- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds (5 minutes)
- **Concurrency**: 80 requests per instance
- **Min instances**: 0 (scale to zero)
- **Max instances**: 10

### Cost Estimation

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| Cloud Run | 1M requests | $5-20 |
| Cloud SQL | db-f1-micro | ~$7 |
| Artifact Registry | 5GB storage | $0.50 |
| Secret Manager | 6 secrets | Free tier |
| **Total** | | **~$15-30/month** |

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
gcloud run services logs tail job-portal-api --region us-central1

# Recent logs
gcloud run services logs read job-portal-api --region us-central1 --limit 100
```

### View Service Status

```bash
gcloud run services describe job-portal-api \
  --platform managed \
  --region us-central1
```

### Metrics Dashboard

Visit: https://console.cloud.google.com/run/detail/us-central1/job-portal-api

## 🐛 Troubleshooting

### Issue: Container fails to start
```bash
# Check logs
gcloud run services logs read job-portal-api --region us-central1 --limit 50
```

### Issue: Database connection fails
- Verify `DATABASE_URL` format
- Check Cloud SQL instance is running
- Ensure Cloud Run service account has Cloud SQL Client role

### Issue: Secrets not accessible
```bash
# Verify secret exists
gcloud secrets describe gcs-service-account-key

# Check IAM permissions
gcloud secrets get-iam-policy gcs-service-account-key
```

### Issue: GitHub Actions deployment fails
- Verify all GitHub secrets are set correctly
- Check service account has required permissions
- Review GitHub Actions logs for specific error

### Issue: Build fails locally
```bash
# Check Docker is running
docker --version
docker ps

# Build with verbose output
docker build --progress=plain -t job-portal-api:latest .
```

## 🔒 Security Checklist

- ✅ Non-root container user
- ✅ Secrets in Secret Manager (not in environment variables)
- ✅ Service account with minimal permissions
- ✅ HTTPS only (enforced by Cloud Run)
- ✅ No hardcoded credentials in code
- ✅ `.dockerignore` excludes sensitive files
- ✅ Regular dependency updates

## 📚 Additional Resources

- [CLOUD_RUN_DEPLOYMENT.md](CLOUD_RUN_DEPLOYMENT.md) - Complete deployment guide
- [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md) - Docker commands reference
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Overview and architecture

### External Documentation
- [Google Cloud Run](https://cloud.google.com/run/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-google-cloud-run)

## 🎯 Next Steps

1. ✅ Complete Google Cloud setup
2. ✅ Configure GitHub secrets
3. ✅ Push to main branch
4. ✅ Verify deployment
5. ⬜ Set up custom domain
6. ⬜ Configure monitoring alerts
7. ⬜ Set up CI/CD for staging environment
8. ⬜ Implement health checks
9. ⬜ Configure auto-scaling policies
10. ⬜ Set up backup strategy for database

## 💡 Tips

1. **Use staging environment**: Create a separate Cloud Run service for staging
2. **Monitor costs**: Set up billing alerts in Google Cloud Console
3. **Optimize cold starts**: Consider min-instances=1 for production
4. **Database connections**: Use connection pooling for better performance
5. **Static assets**: Consider using Cloud CDN for media files
6. **Environment-specific configs**: Use different env files for dev/staging/prod

---

**Created**: October 18, 2025  
**Last Updated**: October 18, 2025  
**Version**: 1.0.0

