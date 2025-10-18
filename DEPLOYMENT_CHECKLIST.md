# Google Cloud Run Deployment Checklist

Use this checklist to track your deployment progress.

## Prerequisites ☑️

- [ ] Google Cloud Platform account created
- [ ] Billing enabled on GCP account
- [ ] GitHub repository set up
- [ ] `gcloud` CLI installed (optional, for local setup)
- [ ] Docker installed (optional, for local testing)

## Google Cloud Setup 🔧

### 1. Enable APIs
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```
- [ ] Cloud Run API enabled
- [ ] Cloud Build API enabled
- [ ] Artifact Registry API enabled
- [ ] Secret Manager API enabled

### 2. Create Artifact Registry
```bash
gcloud artifacts repositories create job-portal-api --repository-format=docker --location=us-central1
```
- [ ] Artifact Registry repository created

### 3. Service Account Setup
```bash
gcloud iam service-accounts create github-actions-deployer --display-name="GitHub Actions Deployer"
```
- [ ] Service account created
- [ ] Run Admin role granted
- [ ] Artifact Registry Writer role granted
- [ ] Service Account User role granted
- [ ] Secret Manager Accessor role granted (if using secrets)
- [ ] Service account key downloaded (`github-sa-key.json`)

### 4. Cloud SQL Setup (Database)
```bash
gcloud sql instances create job-portal-db --database-version=POSTGRES_15 --tier=db-f1-micro --region=us-central1
```
- [ ] Cloud SQL instance created
- [ ] Database `jobportal` created
- [ ] Database user created
- [ ] Connection name noted
- [ ] DATABASE_URL constructed

### 5. Secret Manager Setup
```bash
gcloud secrets create gcs-service-account-key --data-file=./service-account-key.json
```
- [ ] GCS service account secret created
- [ ] Firebase service account secret created (if applicable)
- [ ] Cloud Run service account granted access to secrets

## GitHub Configuration 🔐

### Repository Secrets
Go to: Settings → Secrets and variables → Actions → New repository secret

- [ ] `GCP_PROJECT_ID` - Your Google Cloud Project ID
- [ ] `GCP_SA_KEY` - Contents of `github-sa-key.json`
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - JWT signing secret
- [ ] `GOOGLE_CLIENT_ID` - OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - OAuth client secret

### Workflow Configuration
- [ ] `.github/workflows/deploy-cloud-run.yml` reviewed
- [ ] Project ID, region, and service name updated if needed
- [ ] Environment variables configured in workflow

## Local Testing (Optional) 🧪

### Docker Compose
- [ ] `docker-compose.yml` reviewed
- [ ] Environment variables configured
- [ ] `docker-compose up` tested successfully
- [ ] API responds at `http://localhost:8080`

### Manual Docker Build
- [ ] `docker build -t job-portal-api:latest .` successful
- [ ] Container runs without errors
- [ ] Database migrations execute successfully
- [ ] Application starts correctly

## Deployment 🚀

### Initial Deployment
- [ ] Code committed to repository
- [ ] Pushed to `main` branch
- [ ] GitHub Actions workflow triggered
- [ ] Build stage completed successfully
- [ ] Image pushed to Artifact Registry
- [ ] Deployment to Cloud Run successful
- [ ] Service URL obtained

### Verification
- [ ] Service URL accessible
- [ ] Health endpoint responds: `/api/health`
- [ ] Database connection successful
- [ ] API endpoints working correctly
- [ ] Authentication working
- [ ] File uploads working (if applicable)

### Post-Deployment
- [ ] Cloud Run logs reviewed
- [ ] No errors in application logs
- [ ] Database migrations applied
- [ ] Performance acceptable (response times)
- [ ] Memory and CPU usage within limits

## Configuration & Optimization ⚙️

### Environment Variables
- [ ] All required environment variables set
- [ ] CORS origins configured correctly
- [ ] Database connection optimized
- [ ] Secrets properly configured

### Cloud Run Settings
- [ ] Memory allocation appropriate (default: 1GB)
- [ ] CPU allocation appropriate (default: 1 vCPU)
- [ ] Timeout configured (default: 300s)
- [ ] Min instances set (default: 0)
- [ ] Max instances set (default: 10)
- [ ] Concurrency configured (default: 80)

### Monitoring & Alerts
- [ ] Cloud Logging configured
- [ ] Error reporting enabled
- [ ] Uptime checks created
- [ ] Billing alerts set up
- [ ] Performance monitoring enabled

## Security 🔒

- [ ] Service account uses least privilege principle
- [ ] Secrets stored in Secret Manager (not env vars)
- [ ] HTTPS enforced (automatic with Cloud Run)
- [ ] Authentication implemented on sensitive endpoints
- [ ] CORS properly configured
- [ ] No sensitive data in logs
- [ ] Container runs as non-root user
- [ ] `.dockerignore` excludes sensitive files

## Domain & DNS (Optional) 🌐

- [ ] Custom domain purchased
- [ ] Domain verified in Google Cloud
- [ ] Domain mapping created in Cloud Run
- [ ] SSL certificate provisioned
- [ ] DNS records updated
- [ ] Domain accessible via HTTPS

## Documentation 📚

- [ ] README updated with deployment instructions
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Team members have access to necessary credentials
- [ ] Runbook created for common issues

## Maintenance & Monitoring 🔍

### Regular Tasks
- [ ] Review Cloud Run logs weekly
- [ ] Monitor billing and costs
- [ ] Update dependencies monthly
- [ ] Review security advisories
- [ ] Test backup and restore procedures

### Performance Monitoring
- [ ] Response time metrics reviewed
- [ ] Error rate acceptable (<1%)
- [ ] Cold start times acceptable
- [ ] Database performance optimized
- [ ] Memory usage within limits

### Scaling Considerations
- [ ] Auto-scaling tested under load
- [ ] Database connection pool sized appropriately
- [ ] Max instances sufficient for peak load
- [ ] Min instances set for performance requirements

## Troubleshooting Guide 🔧

If deployment fails, check:
- [ ] GitHub secrets are correctly set
- [ ] Service account has all required permissions
- [ ] Artifact Registry repository exists
- [ ] Cloud Run API is enabled
- [ ] DATABASE_URL is correctly formatted
- [ ] All required environment variables are set
- [ ] Cloud SQL instance is running
- [ ] Network connectivity from Cloud Run to Cloud SQL

## Rollback Plan 🔄

In case of issues:
- [ ] Previous version available in Artifact Registry
- [ ] Rollback command documented
- [ ] Database migration rollback procedure defined
- [ ] Team knows how to execute rollback

```bash
# Rollback to previous version
gcloud run services update-traffic job-portal-api \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1
```

## Cost Management 💰

- [ ] Monthly budget set in GCP
- [ ] Billing alerts configured
- [ ] Cost breakdown reviewed
- [ ] Optimization opportunities identified
- [ ] Unused resources cleaned up

### Expected Monthly Costs
- Cloud Run: $5-20 (based on traffic)
- Cloud SQL (db-f1-micro): ~$7
- Artifact Registry: $0.50
- Secret Manager: Free tier
- **Total**: ~$15-30/month

## Support & Resources 📞

### Documentation Files
- `README_DOCKER_CLOUDRUN.md` - Main deployment guide
- `CLOUD_RUN_DEPLOYMENT.md` - Detailed Cloud Run setup
- `DOCKER_QUICK_START.md` - Docker commands reference
- `DEPLOYMENT_SUMMARY.md` - Overview and architecture

### External Resources
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud SQL Docs](https://cloud.google.com/sql/docs)
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)

---

## Completion Status

**Total Items**: Count items above  
**Completed**: _____ / _____  
**Progress**: _____%

**Deployment Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Completed

**Date Started**: _______________  
**Date Completed**: _______________  
**Deployed By**: _______________

---

**Notes & Issues**:
- 
- 
- 

**Next Steps**:
1. 
2. 
3.

