# 🔥 Fix Cloud Run Deployment Issue

## Current Problem
Your container is failing to start and listen on port 8080. This is likely due to one of these issues:

1. **Database connection problems** (most common)
2. **Missing environment variables**
3. **Application startup errors**

## 🚨 Immediate Fix Steps

### Step 1: Check Cloud Run Logs
```bash
gcloud run services logs read job-portal-backend --region us-central1 --limit 50
```

Look for these specific errors:
- **"P1001: Can't reach database server"** → Database connection issue
- **"password authentication failed"** → Wrong database password
- **"database does not exist"** → Database not created
- **"Application starting"** → App is starting but failing later

### Step 2: Verify GitHub Secrets
Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

**Required secrets:**
- ✅ `GCP_PROJECT_ID`: `splendid-petal-471416-f6`
- ✅ `GCP_SA_KEY`: Your service account JSON
- ✅ `DATABASE_URL`: `postgresql://jobportal:YOUR_PASSWORD@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db`
- ✅ `JWT_SECRET`: Your generated secret
- ✅ `CLOUD_SQL_CONNECTION_NAME`: `splendid-petal-471416-f6:us-central1:job-portal-db`

### Step 3: Verify Infrastructure
Check if these exist in Google Cloud Console:

1. **Cloud SQL Instance:**
   - Go to: https://console.cloud.google.com/sql/instances
   - Should see: `job-portal-db` (status: RUNNABLE)

2. **Artifact Registry:**
   - Go to: https://console.cloud.google.com/artifacts
   - Should see: `job-portal-api` repository

3. **Database and User:**
   - In Cloud SQL instance → Databases tab → Should see `jobportal`
   - In Cloud SQL instance → Users tab → Should see `jobportal` user

### Step 4: Test Database Connection
If you have `gcloud` CLI installed:
```bash
# Connect to your database
gcloud sql connect job-portal-db --user=jobportal --project=splendid-petal-471416-f6
```

## 🔧 Common Fixes

### Fix 1: Database Connection Issues
**Problem:** Wrong DATABASE_URL format
**Solution:** Use correct Cloud SQL socket format:
```
postgresql://jobportal:YOUR_PASSWORD@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

**❌ Wrong formats:**
```
postgresql://user:pass@localhost:5432/db
postgresql://user:pass@127.0.0.1:5432/db
```

### Fix 2: Missing Database/User
**Problem:** Database or user doesn't exist
**Solution:** Create them in Cloud SQL:
1. Go to Cloud SQL instance
2. Create database: `jobportal`
3. Create user: `jobportal` with password

### Fix 3: Wrong Password
**Problem:** Password in DATABASE_URL doesn't match Cloud SQL user password
**Solution:** Update GitHub Secret with correct password

### Fix 4: Missing Cloud SQL Connection
**Problem:** Cloud Run can't connect to Cloud SQL
**Solution:** Verify Cloud SQL connection is configured in deployment

## 🚀 Deploy Fix

After fixing the issues:

```bash
git add .
git commit -m "Fix Cloud Run deployment issues"
git push origin main
```

## 🔍 Debugging Commands

### Check Cloud Run Service:
```bash
gcloud run services describe job-portal-backend --region us-central1
```

### Check Cloud SQL Instance:
```bash
gcloud sql instances list --project=splendid-petal-471416-f6
```

### Check Artifact Registry:
```bash
gcloud artifacts repositories list --location=us-central1
```

### View Recent Logs:
```bash
gcloud run services logs read job-portal-backend --region us-central1 --limit 100
```

## 📋 Quick Checklist

Before deploying again:
- [ ] Cloud SQL instance exists and is running
- [ ] Database `jobportal` exists
- [ ] User `jobportal` exists with known password
- [ ] GitHub Secrets are set correctly
- [ ] DATABASE_URL uses `/cloudsql/` format
- [ ] Artifact Registry repository exists

## 🎯 Most Likely Issue

**90% of the time, this error is caused by:**
1. **Wrong DATABASE_URL format** (not using `/cloudsql/` path)
2. **Database/user doesn't exist** in Cloud SQL
3. **Wrong password** in DATABASE_URL

Check these first! 🔍
