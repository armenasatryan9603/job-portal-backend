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
      message: 'HotWork API is running',
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
   * Account deletion page for Google Play Data Safety compliance.
   * Served at: https://job-portal-backend-psi-ruddy.vercel.app/delete-account
   */
  @Get('delete-account')
  deleteAccountPage(@Req() req: Request, @Res() res: Response) {
    const apiBase = process.env.BACKEND_URL || 'https://job-portal-backend-psi-ruddy.vercel.app';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delete Account - HotWork</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 2rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 460px;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      color: #6b7280;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    h2 {
      color: #1f2937;
      font-size: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .step-indicator {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }
    .step-dot {
      height: 4px;
      flex: 1;
      border-radius: 2px;
      background: #e5e7eb;
      transition: background 0.3s;
    }
    .step-dot.active { background: #667eea; }
    .step-dot.done { background: #10b981; }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.4rem;
    }
    .phone-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    select, input {
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      padding: 0.65rem 0.75rem;
      font-size: 1rem;
      color: #1f2937;
      outline: none;
      transition: border-color 0.2s;
      background: white;
      width: 100%;
    }
    select { width: auto; flex-shrink: 0; }
    select:focus, input:focus { border-color: #667eea; }
    .btn {
      width: 100%;
      padding: 0.8rem;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      margin-top: 0.5rem;
    }
    .btn:active { transform: scale(0.98); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: #667eea; color: white; }
    .btn-danger  { background: #ef4444; color: white; }
    .btn-ghost   { background: #f3f4f6; color: #374151; margin-top: 0.75rem; }
    .error-msg {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
      display: none;
    }
    .info-box {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
      color: #92400e;
      line-height: 1.6;
    }
    .info-box strong { display: block; margin-bottom: 0.4rem; color: #7c2d12; }
    .info-box ul { padding-left: 1.1rem; }
    .info-box li { margin-bottom: 0.2rem; }
    .otp-input {
      letter-spacing: 0.5rem;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .success-icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .success-title { font-size: 1.4rem; font-weight: 700; color: #1f2937; margin-bottom: 0.5rem; }
    .success-text  { color: #6b7280; line-height: 1.6; }
    .step { display: none; }
    .step.active { display: block; }
    .resend-row { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #6b7280; }
    .resend-link { color: #667eea; cursor: pointer; font-weight: 600; text-decoration: none; }
    .resend-link:hover { text-decoration: underline; }
    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">HotWork</div>
  <div class="subtitle">Account &amp; Data Deletion</div>

  <div class="step-indicator">
    <div class="step-dot active"  id="dot1"></div>
    <div class="step-dot"         id="dot2"></div>
    <div class="step-dot"         id="dot3"></div>
  </div>

  <!-- Step 1: Phone -->
  <div class="step active" id="step1">
    <h2>Enter your phone number</h2>
    <div id="err1" class="error-msg"></div>
    <label>Country code &amp; phone number</label>
    <div class="phone-row">
      <select id="countryCode">
        <option value="374">+374 (AM)</option>
        <option value="1">+1 (US/CA)</option>
        <option value="7">+7 (RU)</option>
        <option value="44">+44 (GB)</option>
        <option value="33">+33 (FR)</option>
        <option value="49">+49 (DE)</option>
        <option value="39">+39 (IT)</option>
        <option value="34">+34 (ES)</option>
        <option value="31">+31 (NL)</option>
        <option value="32">+32 (BE)</option>
        <option value="41">+41 (CH)</option>
        <option value="43">+43 (AT)</option>
        <option value="48">+48 (PL)</option>
        <option value="90">+90 (TR)</option>
        <option value="380">+380 (UA)</option>
        <option value="375">+375 (BY)</option>
        <option value="994">+994 (AZ)</option>
        <option value="995">+995 (GE)</option>
        <option value="996">+996 (KG)</option>
        <option value="998">+998 (UZ)</option>
        <option value="992">+992 (TJ)</option>
        <option value="993">+993 (TM)</option>
        <option value="971">+971 (AE)</option>
        <option value="966">+966 (SA)</option>
        <option value="91">+91 (IN)</option>
        <option value="86">+86 (CN)</option>
        <option value="81">+81 (JP)</option>
        <option value="82">+82 (KR)</option>
        <option value="55">+55 (BR)</option>
        <option value="52">+52 (MX)</option>
        <option value="54">+54 (AR)</option>
        <option value="61">+61 (AU)</option>
        <option value="20">+20 (EG)</option>
        <option value="234">+234 (NG)</option>
        <option value="27">+27 (ZA)</option>
      </select>
      <input type="tel" id="phone" placeholder="Phone number" inputmode="numeric" />
    </div>
    <button class="btn btn-primary" id="sendOtpBtn" onclick="sendOtp()">Send verification code</button>
  </div>

  <!-- Step 2: OTP -->
  <div class="step" id="step2">
    <h2>Enter verification code</h2>
    <div id="err2" class="error-msg"></div>
    <label>6-digit code sent to your phone</label>
    <input type="text" id="otpInput" class="otp-input" placeholder="······" maxlength="6" inputmode="numeric" style="margin-bottom:1.25rem" />
    <button class="btn btn-primary" id="verifyOtpBtn" onclick="verifyOtp()">Verify</button>
    <div class="resend-row">
      Didn't receive it? <span class="resend-link" onclick="sendOtp(true)">Resend code</span>
    </div>
  </div>

  <!-- Step 3: Confirmation -->
  <div class="step" id="step3">
    <h2>Confirm account deletion</h2>
    <div id="err3" class="error-msg"></div>
    <div class="info-box">
      <strong>The following data will be permanently deleted:</strong>
      <ul>
        <li>Your profile and personal information</li>
        <li>All orders you have created or received</li>
        <li>Chat messages and conversations</li>
        <li>Reviews and ratings</li>
        <li>Saved payment methods</li>
        <li>Credit balance and transaction history</li>
        <li>Portfolio items and media files</li>
      </ul>
    </div>
    <p style="font-size:0.875rem;color:#6b7280;margin-bottom:1.25rem;line-height:1.6">
      This action <strong>cannot be undone</strong>. Your account will be anonymised immediately and permanently removed within 90 days.
    </p>
    <button class="btn btn-danger" id="deleteBtn" onclick="deleteAccount()">Delete my account and all data</button>
    <button class="btn btn-ghost" onclick="goBack()">Cancel — keep my account</button>
  </div>

  <!-- Step 4: Done -->
  <div class="step" id="stepDone">
    <div style="text-align:center;padding:1rem 0">
      <div class="success-icon">✓</div>
      <div class="success-title">Account deleted</div>
      <p class="success-text">Your account has been successfully deleted. All personal data will be permanently removed within 90 days.<br><br>You can close this page.</p>
    </div>
  </div>
</div>

<script>
  const API = '${apiBase}';
  let accessToken = null;
  let userId = null;

  function showError(stepNum, msg) {
    const el = document.getElementById('err' + stepNum);
    el.textContent = msg;
    el.style.display = 'block';
  }
  function clearError(stepNum) {
    const el = document.getElementById('err' + stepNum);
    el.style.display = 'none';
    el.textContent = '';
  }

  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span>Please wait…' : label;
  }

  function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const steps = ['step1','step2','step3','stepDone'];
    const idx = steps.indexOf(id);
    ['dot1','dot2','dot3'].forEach((d, i) => {
      const dot = document.getElementById(d);
      dot.classList.remove('active','done');
      if (i < idx) dot.classList.add('done');
      else if (i === idx) dot.classList.add('active');
    });
  }

  async function sendOtp(isResend) {
    clearError(1);
    const phone = document.getElementById('phone').value.trim();
    const countryCode = document.getElementById('countryCode').value;
    if (!phone) { showError(1, 'Please enter your phone number.'); return; }
    setLoading('sendOtpBtn', true, 'Send verification code');
    try {
      const res = await fetch(API + '/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code.');
      showStep('step2');
      if (isResend) {
        const el = document.getElementById('err2');
        el.style.background = '#f0fdf4';
        el.style.color = '#16a34a';
        el.style.border = '1px solid #bbf7d0';
        el.textContent = 'A new code has been sent.';
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
      }
    } catch(e) {
      showError(1, e.message);
    } finally {
      setLoading('sendOtpBtn', false, 'Send verification code');
    }
  }

  async function verifyOtp() {
    clearError(2);
    const phone = document.getElementById('phone').value.trim();
    const countryCode = document.getElementById('countryCode').value;
    const otp = document.getElementById('otpInput').value.trim();
    if (otp.length !== 6) { showError(2, 'Please enter the 6-digit code.'); return; }
    setLoading('verifyOtpBtn', true, 'Verify');
    try {
      const res = await fetch(API + '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code. Please try again.');
      accessToken = data.access_token;
      userId = data.user.id;
      showStep('step3');
    } catch(e) {
      showError(2, e.message);
    } finally {
      setLoading('verifyOtpBtn', false, 'Verify');
    }
  }

  async function deleteAccount() {
    clearError(3);
    if (!accessToken || !userId) { showError(3, 'Session expired. Please start again.'); return; }
    setLoading('deleteBtn', true, 'Delete my account and all data');
    try {
      const res = await fetch(API + '/users/' + userId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Deletion failed. Please try again.');
      }
      document.querySelector('.step-indicator').style.display = 'none';
      showStep('stepDone');
    } catch(e) {
      showError(3, e.message);
    } finally {
      setLoading('deleteBtn', false, 'Delete my account and all data');
    }
  }

  function goBack() {
    clearError(3);
    showStep('step1');
    accessToken = null;
    userId = null;
    document.getElementById('otpInput').value = '';
    document.getElementById('phone').value = '';
  }
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
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
