# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for the marketplace application.

## Prerequisites

1. A Google Cloud Platform account
2. Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your project ID

## Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API" and enable it
3. Also enable "Google OAuth2 API" if not already enabled

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Configure the following:

### Authorized JavaScript origins:

```
http://localhost:3000
http://localhost:3001
```

### Authorized redirect URIs:

```
http://localhost:8080/auth/google/callback
```

5. Click "Create" and copy the Client ID and Client Secret

## Step 4: Configure Environment Variables

Add the following to your `.env` file in the backend directory:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000
```

## Step 5: Test the Setup

1. Start your backend server:

   ```bash
   cd backend
   npm run start:dev
   ```

2. Start your frontend:

   ```bash
   cd job-portal-mobile
   npm start
   ```

3. Navigate to `http://localhost:3000`
4. Click the "Google" button to test OAuth authentication

## Troubleshooting

### Common Issues:

1. **"Popup blocked" error**: Make sure popups are allowed for localhost
2. **"Invalid redirect URI"**: Check that the redirect URI in Google Console matches your environment
3. **"Client ID not found"**: Verify the GOOGLE_CLIENT_ID in your .env file
4. **CORS errors**: Make sure your frontend URL is in the authorized origins

### Testing OAuth Status:

You can check if Google OAuth is properly configured by visiting:

```
http://localhost:8080/auth/google/status
```

This should return a JSON response indicating whether OAuth is configured.

## Production Setup

For production deployment:

1. Update the authorized origins and redirect URIs in Google Console to use your production domain
2. Update the environment variables with production URLs
3. Ensure HTTPS is used for all OAuth redirects in production

## Security Notes

- Never commit your Google OAuth credentials to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Cloud Console

