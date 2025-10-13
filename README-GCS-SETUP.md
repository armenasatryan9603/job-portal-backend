# Google Cloud Storage Setup Guide

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID

## 2. Enable Google Cloud Storage API

1. Go to "APIs & Services" > "Library"
2. Search for "Cloud Storage API"
3. Click "Enable"

## 3. Create Storage Bucket

1. Go to "Cloud Storage" > "Buckets"
2. Click "Create Bucket"
3. Choose a unique name (e.g., `job-portal-media-{your-project-id}`)
4. Select location (recommend: `us-central1` for global access)
5. Choose storage class: `Standard`
6. Set access control: `Uniform`
7. Click "Create"

## 4. Create Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `job-portal-storage`
4. Description: `Service account for job portal media uploads`
5. Click "Create and Continue"
6. Grant roles:
   - `Storage Object Admin` (for upload/delete)
   - `Storage Object Viewer` (for read access)
7. Click "Done"

## 5. Generate Service Account Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Download the key file
6. Save it securely (e.g., `backend/service-account-key.json`)

## 6. Configure Environment Variables

Add to your `.env` file:

```env
# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_BUCKET_NAME="job-portal-media-{your-project-id}"
GOOGLE_CLOUD_KEY_FILE="service-account-key.json"
```

## 7. Update Bucket Permissions (Optional)

For public read access to uploaded files:

1. Go to your bucket
2. Click "Permissions" tab
3. Click "Add Principal"
4. Add `allUsers` with `Storage Object Viewer` role
5. This allows direct access to files via public URLs

## 8. Test the Setup

1. Install dependencies: `npm install`
2. Start the server: `npm run start:dev`
3. Test file upload through the mobile app

## File Structure

```
backend/
├── service-account-key.json  # Your GCS service account key
├── .env                      # Environment variables
└── src/
    └── storage/
        └── gcs.service.ts    # GCS service implementation
```

## Security Notes

- Never commit service account keys to version control
- Use environment variables for sensitive data
- Consider using Google Cloud Secret Manager for production
- Set up proper IAM roles and permissions
- Enable audit logging for production use

## Cost Optimization

- Use appropriate storage classes (Standard, Nearline, Coldline)
- Set up lifecycle policies for old files
- Monitor usage in Google Cloud Console
- Consider using Cloud CDN for better performance
