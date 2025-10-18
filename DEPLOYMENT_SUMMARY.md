# Cloud Run Deployment - Setup Summary

This document provides a complete overview of the files created for deploying your NestJS application to Google Cloud Run using GitHub Actions.

## Files Created

### 1. Docker Configuration

#### `Dockerfile`
- Multi-stage build for optimized production image
- Uses Node.js 20 Alpine for smaller image size
- Automatically runs Prisma migrations on startup
- Configured for port 8080 (Cloud Run default)
- Non-root user for security
- Signal handling with dumb-init

#### `.dockerignore`
- Excludes unnecessary files from Docker build context
- Reduces image size and build time
- Protects sensitive files from being included

#### `docker-compose.yml`
- Local development environment with PostgreSQL
- Allows testing the full stack locally before deployment
- Mirrors production environment

### 2. GitHub Actions Workflows

#### `.github/workflows/deploy-cloud-run.yml`
**Triggers**: Push to `main` branch or manual workflow dispatch

**Steps**:
1. Checkout code
2. Authenticate with Google Cloud
3. Build Docker image
4. Push to Artifact Registry
5. Deploy to Cloud Run with environment variables and secrets
6. Display service URL

**Required GitHub Secrets**:
- `GCP_PROJECT_ID` - Your Google Cloud Project ID
- `GCP_SA_KEY` - Service account key JSON
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

#### `.github/workflows/build-test.yml`
**Triggers**: Pull requests to `main` or push to `develop`

**Steps**:
1. Checkout and setup Node.js
2. Install dependencies
3. Generate Prisma client
4. Run linter
5. Run tests
6. Build application
7. Build and test Docker image

### 3. Helper Scripts

#### `scripts/build-and-push.sh`
Builds Docker image and pushes to Google Artifact Registry
```bash
./scripts/build-and-push.sh
```

#### `scripts/deploy.sh`
Deploys the application to Cloud Run
```bash
./scripts/deploy.sh production
```

### 4. Documentation

#### `CLOUD_RUN_DEPLOYMENT.md`
Comprehensive guide covering:
- Prerequisites
- Google Cloud setup
- Service account creation
- Secret Manager configuration
- Cloud SQL setup
- GitHub secrets configuration
- Manual deployment commands
- Troubleshooting

#### `DOCKER_QUICK_START.md`
Quick reference for:
- Local Docker commands
- Docker Compose usage
- Container management
- Debugging techniques
- Environment variables

## Quick Start

### For First-Time Setup

1. **Setup Google Cloud** (follow `CLOUD_RUN_DEPLOYMENT.md`):
   ```bash
   # Enable APIs
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
   
   # Create Artifact Registry
   gcloud artifacts repositories create job-portal-api \
     --repository-format=docker \
     --location=us-central1
   
   # Create service account and download key
   gcloud iam service-accounts create github-actions-deployer
   ```

2. **Configure GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add all required secrets (see list above)

3. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add Docker and Cloud Run configuration"
   git push origin main
   ```

4. **Monitor Deployment**:
   - Go to Actions tab in GitHub
   - Watch the deployment workflow
   - Get the Cloud Run URL from the workflow output

### For Local Testing

```bash
# Start with Docker Compose
docker-compose up

# Or build and run manually
docker build -t job-portal-api .
docker run -p 8080:8080 --env-file .env job-portal-api
```

## Architecture Overview

```
GitHub Repository
    ↓ (push to main)
GitHub Actions
    ↓ (build)
Docker Image
    ↓ (push)
Google Artifact Registry
    ↓ (deploy)
Google Cloud Run
    ↓ (connect)
Cloud SQL (PostgreSQL)
```

## Environment Configuration

### Development (docker-compose.yml)
- Local PostgreSQL container
- Local file storage
- Debug logging enabled

### Production (Cloud Run)
- Cloud SQL for PostgreSQL
- Google Cloud Storage for files
- Environment variables from Secret Manager
- Auto-scaling 0-10 instances

## Key Features

### Docker Image
- **Size**: ~200-300MB (Alpine-based)
- **Build time**: ~3-5 minutes
- **Startup time**: ~5-10 seconds
- **Includes**: Node.js, Prisma, NestJS

### Cloud Run Configuration
- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds
- **Scaling**: 0-10 instances
- **Cost**: Pay per request (free tier available)

### Security
- ✅ Non-root container user
- ✅ Secrets in Secret Manager
- ✅ IAM-based access control
- ✅ HTTPS only
- ✅ Environment isolation

## Next Steps

### 1. Initial Deployment
- [ ] Complete Google Cloud setup
- [ ] Configure GitHub secrets
- [ ] Push to main branch
- [ ] Verify deployment

### 2. Database Setup
- [ ] Create Cloud SQL instance
- [ ] Run initial migrations
- [ ] Seed database if needed

### 3. Domain Configuration
- [ ] Map custom domain to Cloud Run
- [ ] Configure SSL certificate
- [ ] Update CORS settings

### 4. Monitoring Setup
- [ ] Configure Cloud Logging
- [ ] Set up error reporting
- [ ] Create uptime checks
- [ ] Configure alerts

### 5. Optimization
- [ ] Review instance scaling
- [ ] Monitor cold starts
- [ ] Optimize memory usage
- [ ] Set up CDN for static assets

## Cost Estimates

### Cloud Run (estimated monthly)
- **Low traffic** (< 100K requests): $0-5
- **Medium traffic** (< 1M requests): $5-50
- **High traffic** (< 10M requests): $50-200

### Cloud SQL (db-f1-micro)
- **Instance**: ~$7/month
- **Storage**: $0.17/GB/month

### Artifact Registry
- **Storage**: $0.10/GB/month
- **Egress**: Free within same region

**Total estimated cost**: $10-50/month for typical usage

## Support Resources

- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)

## Common Issues and Solutions

### Issue: Container fails to start
**Solution**: Check logs with `gcloud run services logs read job-portal-api`

### Issue: Database connection fails
**Solution**: Verify DATABASE_URL and Cloud SQL configuration

### Issue: Build fails in GitHub Actions
**Solution**: Check secrets are configured correctly

### Issue: Cold starts are slow
**Solution**: Consider setting min instances to 1 (increases cost)

### Issue: Out of memory errors
**Solution**: Increase memory allocation in deploy command

## Contact and Support

For issues specific to:
- **Docker/Dockerfile**: Check DOCKER_QUICK_START.md
- **Cloud Run setup**: Check CLOUD_RUN_DEPLOYMENT.md
- **Application errors**: Check Cloud Run logs

---

**Last Updated**: October 18, 2025
**Version**: 1.0.0

