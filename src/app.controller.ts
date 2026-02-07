import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

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
   * Served at: https://job-portal-backend-psi-ruddy.vercel.app//.well-known/apple-app-site-association
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
   * Served at: https://job-portal-backend-psi-ruddy.vercel.app//.well-known/assetlinks.json
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

  /**
   * Payment callback redirect handler
   * Served at: https://job-portal-backend-psi-ruddy.vercel.app//profile/refill-credits
   * Simple success page - user closes webview manually
   */
  @Get('profile/refill-credits')
  paymentCallbackRedirect(@Req() req: Request, @Res() res: Response) {
    // Check if this is a web browser request
    const acceptHeader = req.headers['accept'] || '';
    const isWebRequest =
      acceptHeader.includes('text/html') ||
      req.headers['user-agent']?.includes('Mozilla');

    if (isWebRequest) {
      // Serve simple HTML page
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - HotWork</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .success-icon {
      font-size: 4rem;
      color: #10b981;
      margin-bottom: 1rem;
    }
    h1 {
      color: #1f2937;
      margin: 0 0 1rem 0;
    }
    p {
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.6;
    }
    .info {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>Payment Successful</h1>
    <p>Your credits have been added successfully!</p>
    <p class="info">
      You can close this page and return to the app.
    </p>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // For API requests, return JSON
    return res.json({
      message: 'Payment callback redirect',
      path: '/profile/refill-credits',
      action: 'Close the webview and return to the app',
    });
  }
}
