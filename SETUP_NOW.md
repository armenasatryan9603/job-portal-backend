# Quick Setup Guide - Fix Your Deployment Now

## What Went Wrong?

Your container failed to start because it couldn't connect to the database. Here's how to fix it:

## Step 1: Get Your Cloud SQL Connection Name

```bash
gcloud sql instances list
```

This will show your Cloud SQL instance. Look for something like:
```
NAME              DATABASE_VERSION  REGION         TIER
job-portal-db     POSTGRES_15       us-central1    db-f1-micro
```

Now get the full connection name:
```bash
gcloud sql instances describe job-portal-db --format="value(connectionName)"
```

**Example output:** `splendid-petal-471416-f6:us-central1:job-portal-db`

## Step 2: Build Your DATABASE_URL

Your DATABASE_URL should look like this:
```
postgresql://USERNAME:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
```

**Example:**
```
postgresql://jobportal:myPassword123@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

Replace:
- `jobportal` (first one) → your database username
- `myPassword123` → your database password
- `jobportal` (after @/) → your database name
- `splendid-petal-471416-f6:us-central1:job-portal-db` → your connection name from Step 1

## Step 3: Add GitHub Secrets

Go to: https://github.com/YOUR_USERNAME/job-portal-backend/settings/secrets/actions

Add or update these secrets:

### Required:
1. **`DATABASE_URL`**
   - Your complete DATABASE_URL from Step 2
   
2. **`CLOUD_SQL_CONNECTION_NAME`**
   - Just the connection name: `PROJECT:REGION:INSTANCE`
   - Example: `splendid-petal-471416-f6:us-central1:job-portal-db`

3. **`JWT_SECRET`**
   - Any secure random string
   - Example: `your-super-secure-jwt-secret-key-12345`

4. **`GCP_PROJECT_ID`**
   - Your Google Cloud project ID
   - Example: `splendid-petal-471416-f6`

5. **`GCP_SA_KEY`**
   - Your service account key JSON (entire file content)

## Step 4: Grant Cloud Run Access to Cloud SQL

```bash
# Get your project number
PROJECT_ID="splendid-petal-471416-f6"  # Replace with your project ID
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

## Step 5: Verify Your Database

```bash
# Make sure database and user exist
gcloud sql databases list --instance=job-portal-db
gcloud sql users list --instance=job-portal-db
```

If your database or user doesn't exist:

```bash
# Create database
gcloud sql databases create jobportal --instance=job-portal-db

# Create user
gcloud sql users create jobportal \
  --instance=job-portal-db \
  --password=YOUR_SECURE_PASSWORD
```

## Step 6: Commit and Push

```bash
git add .
git commit -m "Update deployment configuration with Cloud SQL support"
git push origin main
```

This will trigger a new deployment with the fixes.

## Step 7: Monitor Deployment

Watch the deployment in GitHub Actions:
https://github.com/YOUR_USERNAME/job-portal-backend/actions

Or watch Cloud Run logs:
```bash
gcloud run services logs tail job-portal-api --region us-central1
```

## Expected Success Output

You should see in the logs:
```
🚀 Starting application...
Environment: production
Port: 8080
...
✅ Application is running on port 8080
🔗 Health check: http://localhost:8080/health
```

## If It Still Fails

1. **Check the logs:**
   ```bash
   gcloud run services logs read job-portal-api \
     --region us-central1 \
     --limit 50
   ```

2. **Verify DATABASE_URL format:** Make sure it matches exactly:
   ```
   postgresql://user:pass@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE
   ```

3. **Test database connection:** From Cloud Shell:
   ```bash
   gcloud sql connect job-portal-db --user=jobportal
   ```

4. **Read the detailed troubleshooting guide:**
   - See `TROUBLESHOOTING_CLOUD_RUN.md`

## Quick Checklist

- [ ] Got Cloud SQL connection name
- [ ] Built correct DATABASE_URL
- [ ] Added DATABASE_URL to GitHub secrets
- [ ] Added CLOUD_SQL_CONNECTION_NAME to GitHub secrets
- [ ] Verified JWT_SECRET is set
- [ ] Granted Cloud SQL Client role to Cloud Run service account
- [ ] Database exists in Cloud SQL
- [ ] User exists in Cloud SQL
- [ ] Pushed changes to GitHub
- [ ] Monitoring deployment logs

## Common Mistakes

❌ **Wrong DATABASE_URL format**
```
postgresql://user:pass@localhost:5432/db  ❌ (Wrong! This is for external database)
```

✅ **Correct DATABASE_URL format**
```
postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE  ✅
```

❌ **Missing Cloud SQL connection**
- Forgot to add `CLOUD_SQL_CONNECTION_NAME` secret

❌ **Wrong password in DATABASE_URL**
- Check your Cloud SQL user password

❌ **Database doesn't exist**
- Create it with: `gcloud sql databases create jobportal --instance=job-portal-db`

---

**After fixing, your deployment should succeed!** 🎉

If you need help, check the logs first - they'll tell you exactly what's wrong.

