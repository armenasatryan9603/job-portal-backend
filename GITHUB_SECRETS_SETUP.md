# GitHub Secrets Setup for Cloud Run Deployment

Your deployment is using **GitHub Actions**, which means you need to configure secrets in your GitHub repository.

## 🔑 Required GitHub Secrets

Go to your GitHub repository:
```
https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
```

### 1. GCP_PROJECT_ID
```
splendid-petal-471416-f6
```

### 2. GCP_SA_KEY
This is your service account key JSON. It should already be set, but if not:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=splendid-petal-471416-f6
2. Find or create a service account with these roles:
   - Cloud Run Admin
   - Service Account User
   - Artifact Registry Writer
   - Cloud SQL Client
3. Create a JSON key and paste the **entire JSON content** as the secret value

### 3. DATABASE_URL
**Critical!** This must be in the Cloud SQL socket format:
```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE
```

**Example:**
```
postgresql://jobportal:YourSecurePassword@/jobportal?host=/cloudsql/splendid-petal-471416-f6:us-central1:job-portal-db
```

**⚠️ Common Mistakes:**
- ❌ `postgresql://user:pass@localhost:5432/db` - WRONG! (local format)
- ❌ `postgresql://user:pass@127.0.0.1:5432/db` - WRONG! (IP format)
- ✅ `postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE` - CORRECT!

### 4. JWT_SECRET
Generate a secure random string:
```bash
openssl rand -base64 32
```

Example output:
```
7K3+mPx9vN2wQ5rL8sT1dF6jH4nY0oZ+aE3cG9bV1A=
```

### 5. CLOUD_SQL_CONNECTION_NAME
```
splendid-petal-471416-f6:us-central1:job-portal-db
```

## ✅ Verification Checklist

Before pushing to trigger deployment, verify:

- [ ] All 5 secrets are set in GitHub
- [ ] DATABASE_URL uses `/cloudsql/` format (not localhost or IP)
- [ ] DATABASE_URL password matches your Cloud SQL user password
- [ ] GCP_SA_KEY is valid JSON (starts with `{` and ends with `}`)
- [ ] CLOUD_SQL_CONNECTION_NAME has format `PROJECT:REGION:INSTANCE`

## 🚀 Deploy

After setting all secrets, trigger deployment:

### Option 1: Push to main branch
```bash
git add .
git commit -m "Fix Cloud Run deployment configuration"
git push origin main
```

### Option 2: Manual trigger
Go to:
```
https://github.com/YOUR_USERNAME/YOUR_REPO/actions
```
Click "Deploy to Cloud Run" → "Run workflow"

## 🔍 Troubleshooting

### Still getting "failed to start"?

1. **Check the logs** in Cloud Console:
   - Go to: https://console.cloud.google.com/run?project=splendid-petal-471416-f6
   - Click on `job-portal-backend`
   - Click "LOGS" tab
   - Look for error messages

2. **Common errors and fixes:**

   **Error: "P1001: Can't reach database server"**
   - DATABASE_URL is wrong or Cloud SQL connection not configured
   - Check DATABASE_URL format uses `/cloudsql/` path
   - Verify CLOUD_SQL_CONNECTION_NAME is set

   **Error: "password authentication failed"**
   - Wrong password in DATABASE_URL
   - Reset password: `gcloud sql users set-password jobportal --instance=job-portal-db --password=NewPassword`
   - Update DATABASE_URL secret with new password

   **Error: "database does not exist"**
   - Database not created
   - Run: `gcloud sql databases create jobportal --instance=job-portal-db`

   **Error: "role does not exist"**
   - User not created
   - Run: `gcloud sql users create jobportal --instance=job-portal-db --password=YourPassword`

3. **Verify Cloud SQL instance exists:**
```bash
gcloud sql instances list --project=splendid-petal-471416-f6
```

Should show `job-portal-db` with status `RUNNABLE`

## 📋 Quick Setup Script

If you haven't created Cloud SQL yet, run:

```bash
./setup-cloud-run.sh
```

This will:
- Create Cloud SQL instance
- Create database and user
- Output the correct DATABASE_URL format
- Generate JWT_SECRET

Then copy those values to GitHub Secrets!

## 🎯 Summary

1. ✅ Fixed GitHub Actions workflow (matches deploy.sh now)
2. ⚠️  **You must set 5 GitHub Secrets** (see above)
3. 🚀 Push to main branch to trigger deployment

The most common issue is **wrong DATABASE_URL format** - make sure it uses `/cloudsql/` path!

