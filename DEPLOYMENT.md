# Cloud Run Deployment Guide

## What You Need for Google Cloud Run

### ✅ Required Infrastructure (Automated by `setup-cloud-run.sh`)

1. **Artifact Registry Repository**
   - Stores your Docker images
   - Location: `us-central1-docker.pkg.dev/splendid-petal-471416-f6/job-portal-api`

2. **Cloud SQL PostgreSQL Instance**
   - Database: `jobportal`
   - Instance: `job-portal-db`
   - Region: `us-central1`
   - Tier: `db-f1-micro` (free tier eligible)

3. **IAM Permissions**
   - Cloud Run service account needs `roles/cloudsql.client`
   - Allows Cloud Run to connect to Cloud SQL

4. **Enabled APIs**
   - Cloud Run API
   - Cloud SQL Admin API
   - Artifact Registry API
   - Cloud Build API

### ✅ Required Configuration (Handled by `deploy.sh`)

1. **Environment Variables**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - JWT token signing secret
   - `PORT` - Always 8080 (Cloud Run requirement)
   - `NODE_ENV` - Set to "production"

2. **Cloud Run Settings**
   - Port: 8080
   - Memory: 2GB
   - CPU: 2 cores
   - Timeout: 600 seconds (10 minutes)
   - Scaling: 0-10 instances
   - Access: Allow unauthenticated

3. **Cloud SQL Connection**
   - Configured via: `--add-cloudsql-instances`
   - Connection: `splendid-petal-471416-f6:us-central1:job-portal-db`

## 🚀 Deployment Process

### First Time (One-Time Setup)

```bash
# Run setup script
./setup-cloud-run.sh

# It will output your DATABASE_URL and JWT_SECRET
# SAVE THESE!
```

### Every Deployment After That

```bash
# Set environment variables
export DATABASE_URL='postgresql://...'  # From setup output
export JWT_SECRET='...'                  # From setup output

# Deploy
./deploy.sh
```

## 📋 Checklist

Before deploying, ensure:

- [ ] Google Cloud CLI (`gcloud`) is installed
- [ ] Docker is installed and running
- [ ] You're authenticated: `gcloud auth login`
- [ ] You've run `setup-cloud-run.sh` (first time only)
- [ ] You've exported `DATABASE_URL` and `JWT_SECRET`

## 🔧 What Each Script Does

### `setup-cloud-run.sh` (Run Once)

Creates all infrastructure:

1. Enables Google Cloud APIs
2. Creates Artifact Registry repo
3. Creates Cloud SQL instance (~5 min)
4. Creates database and user
5. Sets up permissions
6. Generates secure credentials

### `deploy.sh` (Run Every Time)

Deploys your application:

1. Validates environment variables
2. Builds Docker image
3. Pushes to Artifact Registry
4. Deploys to Cloud Run
5. Shows service URL

## 🛠️ Manual Check

If you want to verify everything manually:

```bash
# Check Artifact Registry
gcloud artifacts repositories list --location=us-central1

# Check Cloud SQL
gcloud sql instances list

# Check Cloud Run service
gcloud run services list --region=us-central1

# View logs
gcloud run services logs read job-portal-backend --region=us-central1
```

## ⚠️ Common Issues

### 1. "Permission denied"

```bash
# Re-authenticate
gcloud auth login
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 2. "Repository not found"

```bash
# Run setup again
./setup-cloud-run.sh
```

### 3. "Environment variable not set"

```bash
# Make sure to export before deploying
export DATABASE_URL='...'
export JWT_SECRET='...'
```

### 4. Container fails to start

- Check logs: `gcloud run services logs read job-portal-backend --region=us-central1 --limit=50`
- Common cause: Wrong DATABASE_URL format
- Correct format: `postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE`

## 💡 Tips

- **DATABASE_URL must include Cloud SQL socket path**: `?host=/cloudsql/...`
- **No spaces in DATABASE_URL**: Will cause connection failures
- **Save your credentials**: Store DATABASE_URL and JWT_SECRET securely
- **Monitor logs**: Use Cloud Console or `gcloud run services logs read`
- **First deployment takes longer**: Building image and starting instance

## 🎯 Summary

**You need 2 scripts:**

1. `setup-cloud-run.sh` - Run once to create infrastructure
2. `deploy.sh` - Run every time you want to deploy

**You need 2 environment variables:**

1. `DATABASE_URL` - From setup script output
2. `JWT_SECRET` - From setup script output

**That's it!** Everything else is automated.
