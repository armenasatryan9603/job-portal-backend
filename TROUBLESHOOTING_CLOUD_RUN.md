# Cloud Run Troubleshooting Guide

## Common Error: "Container failed to start and listen on the port"

This error means your container is either:
1. **Crashing before it can start** (most common)
2. **Not listening on port 8080**
3. **Taking too long to start**

## Most Likely Issue: DATABASE_URL

### Problem
The most common cause is an **incorrect or missing DATABASE_URL**. This causes:
- Prisma fails to connect to the database
- The app crashes during initialization
- Container exits before Cloud Run can detect it's healthy

### Solution: Check Your DATABASE_URL Format

#### For Cloud SQL (Recommended for Cloud Run)

Your `DATABASE_URL` should look like this:

```bash
postgresql://USERNAME:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
```

**Example:**
```bash
postgresql://jobportal:myP@ssw0rd@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

**Important parts:**
- `USERNAME`: Your database user (e.g., `jobportal`)
- `PASSWORD`: Your database password
- `DATABASE`: Your database name (e.g., `jobportal`)
- `CONNECTION_NAME`: Your Cloud SQL connection name (format: `PROJECT:REGION:INSTANCE`)

#### How to Get Your Cloud SQL Connection Name

```bash
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"
```

Example output: `splendid-petal-471416-f6:us-central1:job-portal-db`

#### Update GitHub Secret

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Update `DATABASE_URL` with the correct value

### Additional Cloud Run Configuration for Cloud SQL

You also need to add the Cloud SQL connection to your Cloud Run service:

```bash
gcloud run services update job-portal-api \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE \
  --region us-central1
```

Or add to `.github/workflows/deploy-cloud-run.yml`:

```yaml
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --add-cloudsql-instances splendid-petal-471416-f6:us-central1:job-portal-db \
  # ... other flags
```

## Debugging Steps

### Step 1: Check Cloud Run Logs

```bash
# View recent logs
gcloud run services logs read job-portal-api \
  --region us-central1 \
  --limit 100

# Real-time logs
gcloud run services logs tail job-portal-api \
  --region us-central1
```

Look for:
- ❌ `Error: P1001: Can't reach database server` → Database connection issue
- ❌ `Error: P1017: Server has closed the connection` → Database not accessible
- ❌ `ECONNREFUSED` → Wrong host/port
- ❌ Migration errors → Database schema issues
- ✅ `Application is running on port 8080` → App started successfully

### Step 2: Verify Environment Variables

```bash
# Check what's deployed
gcloud run services describe job-portal-api \
  --region us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

Make sure:
- ✅ `DATABASE_URL` is set
- ✅ `PORT` is set to 8080
- ✅ `JWT_SECRET` is set
- ✅ `NODE_ENV` is set

### Step 3: Test Database Connection Locally

```bash
# Set your DATABASE_URL
export DATABASE_URL="postgresql://..."

# Test connection
npx prisma db execute --stdin <<< "SELECT 1"

# Or check status
npx prisma db pull --print
```

### Step 4: Check Cloud SQL Instance

```bash
# Is it running?
gcloud sql instances list

# Check specific instance
gcloud sql instances describe job-portal-db

# Test connection from Cloud Shell
gcloud sql connect job-portal-db --user=jobportal
```

### Step 5: Check Service Account Permissions

Cloud Run needs permission to connect to Cloud SQL:

```bash
# Get the Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

## Other Common Issues

### Issue: "Error: listen EADDRINUSE"
**Cause**: Port 8080 is already in use (rare in Cloud Run)
**Solution**: Ensure no other process is using the port

### Issue: "Migration failed"
**Cause**: Database schema is out of sync
**Solution**: 
```bash
# Reset migrations (CAREFUL: This will delete data)
npx prisma migrate reset

# Or apply manually
npx prisma migrate deploy
```

### Issue: Container starts but immediately exits
**Cause**: App crashes after startup
**Solution**: Check logs for JavaScript errors

### Issue: "Memory limit exceeded"
**Cause**: App uses more than 1GB RAM
**Solution**: Increase memory in deployment:
```bash
gcloud run deploy job-portal-api \
  --memory 2Gi \
  --region us-central1
```

### Issue: "Request timeout"
**Cause**: Request takes longer than 300 seconds
**Solution**: Increase timeout or optimize code:
```bash
gcloud run deploy job-portal-api \
  --timeout 600 \
  --region us-central1
```

## Quick Fix Checklist

- [ ] DATABASE_URL is correctly formatted for Cloud SQL
- [ ] DATABASE_URL includes the Cloud SQL connection name
- [ ] Cloud SQL instance is running
- [ ] Cloud SQL connection is added to Cloud Run service
- [ ] Database user and password are correct
- [ ] Database exists in Cloud SQL
- [ ] Cloud Run service account has Cloud SQL Client role
- [ ] JWT_SECRET is set
- [ ] PORT is set to 8080
- [ ] Check Cloud Run logs for specific errors

## Testing Locally

Before deploying, test locally with Docker:

```bash
# Build image
docker build -t job-portal-api:test .

# Run with your DATABASE_URL
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="test-secret" \
  -e PORT=8080 \
  job-portal-api:test

# In another terminal, test
curl http://localhost:8080/health
```

If it works locally but fails in Cloud Run:
- ❌ DATABASE_URL format might be wrong for Cloud SQL
- ❌ Cloud SQL connection not added to Cloud Run
- ❌ Network/firewall issue

## Complete DATABASE_URL Setup Example

### Step 1: Create Cloud SQL Instance
```bash
gcloud sql instances create job-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

### Step 2: Create Database and User
```bash
# Create database
gcloud sql databases create jobportal --instance=job-portal-db

# Create user
gcloud sql users create jobportal \
  --instance=job-portal-db \
  --password=YOUR_SECURE_PASSWORD
```

### Step 3: Get Connection Name
```bash
gcloud sql instances describe job-portal-db \
  --format="value(connectionName)"
```
Output: `splendid-petal-471416-f6:us-central1:job-portal-db`

### Step 4: Build DATABASE_URL
```
postgresql://jobportal:YOUR_SECURE_PASSWORD@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

### Step 5: Update GitHub Secret
Add this as `DATABASE_URL` in GitHub Secrets

### Step 6: Update Deployment
Add to `.github/workflows/deploy-cloud-run.yml`:
```yaml
--add-cloudsql-instances splendid-petal-471416-f6:us-central1:job-portal-db \
```

## Still Not Working?

### Get Help from Logs

The logs will tell you exactly what's wrong:

```bash
gcloud run services logs read job-portal-api \
  --region us-central1 \
  --limit 200 \
  --format="table(timestamp,textPayload)"
```

### Manual Deployment Test

Try deploying manually with verbose output:

```bash
gcloud run deploy job-portal-api \
  --image us-central1-docker.pkg.dev/PROJECT/job-portal-api/job-portal-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --set-env-vars JWT_SECRET="test" \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE \
  --verbosity debug
```

### Contact Support

If still stuck, gather:
1. Cloud Run logs (last 50 lines)
2. Your DATABASE_URL format (hide password)
3. Cloud SQL connection name
4. Error message from Cloud Run

---

**Most deployments fail due to DATABASE_URL issues. Double-check this first!**

