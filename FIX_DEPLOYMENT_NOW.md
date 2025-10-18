# Fix Your Deployment - Step by Step

## Current Error
```
The user-provided container failed to start and listen on port 8080
```

This means your app is **crashing before it can start**. Follow these steps in order:

---

## Step 1: Check if You Have a Database

Open Google Cloud Console and check if you have a Cloud SQL instance:
https://console.cloud.google.com/sql/instances?project=splendid-petal-471416-f6

### Option A: You HAVE a Cloud SQL instance

Good! Continue to Step 2.

### Option B: You DON'T have a Cloud SQL instance yet

You need to create one first. Open Cloud Shell and run:

```bash
# Create Cloud SQL instance (takes ~5 minutes)
gcloud sql instances create job-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --project=splendid-petal-471416-f6

# Create database
gcloud sql databases create jobportal \
  --instance=job-portal-db

# Create user (IMPORTANT: Remember this password!)
gcloud sql users create jobportal \
  --instance=job-portal-db \
  --password=ChangeThisToSecurePassword123
```

Wait for the instance to be created, then continue to Step 2.

---

## Step 2: Get Your Database Connection Details

Open Cloud Shell (top right corner of Cloud Console):

```bash
# Get your Cloud SQL connection name
gcloud sql instances describe job-portal-db \
  --format="value(connectionName)" \
  --project=splendid-petal-471416-f6
```

**Copy this output!** It looks like:
```
splendid-petal-471416-f6:us-central1:job-portal-db
```

---

## Step 3: Build Your DATABASE_URL

Use this **exact format**:
```
postgresql://USERNAME:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
```

**Example with your project:**
```
postgresql://jobportal:ChangeThisToSecurePassword123@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

Replace:
- `jobportal` (first) → your database username
- `ChangeThisToSecurePassword123` → your actual password
- `jobportal` (after @/) → your database name
- Connection name → from Step 2

**⚠️ CRITICAL: Make sure there are NO spaces in this URL!**

---

## Step 4: Configure GitHub Secrets

Go to your GitHub repository:
https://github.com/YOUR_USERNAME/job-portal-backend/settings/secrets/actions

Click "New repository secret" and add/update these **5 secrets**:

### 1. GCP_PROJECT_ID
```
splendid-petal-471416-f6
```

### 2. DATABASE_URL
```
postgresql://jobportal:YourPassword@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```
(Use YOUR actual password from Step 1!)

### 3. CLOUD_SQL_CONNECTION_NAME
```
splendid-petal-471416-f6:us-central1:job-portal-db
```

### 4. JWT_SECRET
```
super-secure-jwt-secret-key-change-this-in-production-12345
```
(Any random secure string)

### 5. GCP_SA_KEY
This should already be set. If not, you need to create a service account key.

---

## Step 5: Grant Cloud Run Access to Cloud SQL

Open Cloud Shell and run:

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe splendid-petal-471416-f6 --format="value(projectNumber)")

# Grant Cloud SQL Client role to Cloud Run
gcloud projects add-iam-policy-binding splendid-petal-471416-f6 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"

echo "✅ Permission granted!"
```

---

## Step 6: Verify GitHub Secrets Are Set

Go back to GitHub Secrets and verify you see ALL of these:

- ✅ GCP_PROJECT_ID
- ✅ DATABASE_URL
- ✅ CLOUD_SQL_CONNECTION_NAME
- ✅ JWT_SECRET
- ✅ GCP_SA_KEY

**Missing any? Go back and add them!**

---

## Step 7: Trigger a New Deployment

Now push a change to trigger deployment:

```bash
# From your project directory
echo "# Deployment fix" >> README.md
git add README.md
git commit -m "Trigger deployment with correct configuration"
git push origin main
```

---

## Step 8: Monitor the Deployment

Watch the GitHub Actions:
https://github.com/YOUR_USERNAME/job-portal-backend/actions

After deployment starts, check the logs in Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/job-portal-backend/logs?project=splendid-petal-471416-f6

**You should see:**
```
🚀 Starting application...
Environment: production
Port: 8080
✅ Application is running on port 8080
```

---

## Common Mistakes - Double Check These!

### ❌ Wrong DATABASE_URL Format
```
postgresql://user:pass@localhost:5432/db  ❌ WRONG!
```

### ✅ Correct DATABASE_URL Format
```
postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE  ✅ CORRECT!
```

### ❌ Spaces in DATABASE_URL
```
postgresql://user:pass @/db?host= /cloudsql/...  ❌ NO SPACES!
```

### ❌ Wrong password
Make sure you're using the EXACT password you set when creating the user

### ❌ Wrong connection name format
```
job-portal-db  ❌ Too short!
```
Should be:
```
splendid-petal-471416-f6:us-central1:job-portal-db  ✅
```

---

## Still Not Working?

### Check the Logs

Open Cloud Shell and run:
```bash
gcloud run services logs read job-portal-backend \
  --region us-central1 \
  --limit 50 \
  --project splendid-petal-471416-f6
```

### Look for these specific errors:

1. **"P1001: Can't reach database server"**
   - DATABASE_URL is wrong
   - Cloud SQL connection not configured
   - Run Step 5 again

2. **"password authentication failed"**
   - Wrong password in DATABASE_URL
   - Check your password

3. **"database does not exist"**
   - Database not created
   - Run: `gcloud sql databases create jobportal --instance=job-portal-db`

4. **"role does not exist"**
   - User not created
   - Run: `gcloud sql users create jobportal --instance=job-portal-db --password=YourPassword`

5. **No logs or "Application starting"**
   - Check GitHub secrets are ACTUALLY set
   - Verify you pushed after setting secrets

---

## Quick Verification Checklist

Before pushing:

- [ ] Cloud SQL instance exists and is running
- [ ] Database `jobportal` exists
- [ ] User `jobportal` exists with known password
- [ ] Got Cloud SQL connection name (PROJECT:REGION:INSTANCE format)
- [ ] Built DATABASE_URL in correct format (no spaces!)
- [ ] Set all 5 GitHub secrets
- [ ] Granted Cloud SQL Client role to Cloud Run service account
- [ ] Pushed changes to trigger new deployment

---

## Need More Help?

1. **Copy your actual error from logs** (hide your password!)
2. **Verify you followed EVERY step above**
3. **Check if Cloud SQL instance is actually running**
4. **Test database connection from Cloud Shell:**
   ```bash
   gcloud sql connect job-portal-db --user=jobportal --project=splendid-petal-471416-f6
   ```

---

**The #1 cause of this error is incorrect DATABASE_URL. Double-check it!**

