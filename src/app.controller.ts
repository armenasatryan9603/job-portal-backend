import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get()
  root() {
    return {
      message: 'Job Portal API is running',
      version: '1.0.0',
    };
  }

  /**
   * Apple App Site Association file for iOS Universal Links
   * Served at: https://job-portal-backend-eight-sand.vercel.app/.well-known/apple-app-site-association
   */
  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  appleAppSiteAssociation() {
    // Get Apple Team ID from environment variable
    // Format: TEAM_ID.com.jobportalmobile.app
    // Example: ABC123DEFG.com.jobportalmobile.app
    const teamId = process.env.APPLE_TEAM_ID || 'TEAM_ID';
    const bundleId = 'com.jobportalmobile.app';
    const appID = `${teamId}.${bundleId}`;

    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: appID,
            paths: ['/orders/*', '/profile/refill-credits'],
          },
        ],
      },
    };
  }

  /**
   * Android Asset Links file for Android App Links
   * Served at: https://job-portal-backend-eight-sand.vercel.app/.well-known/assetlinks.json
   */
  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  androidAssetLinks() {
    // Get SHA-256 fingerprint from environment variable
    // You can get this by running:
    // keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
    const sha256Fingerprint =
      process.env.ANDROID_SHA256_FINGERPRINT ||
      'YOUR_APP_SHA256_FINGERPRINT';

    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.jobportalmobile.app',
          sha256_cert_fingerprints: [sha256Fingerprint],
        },
      },
    ];
  }
}
