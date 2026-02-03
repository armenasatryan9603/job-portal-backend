# Vercel Environment Variables Setup

## Required Environment Variables for Ameriabank vPOS

Make sure these are set in your Vercel project settings:

### Payment Gateway Configuration

1. **AMERIABANK_CLIENT_ID**
   - Value: `c771a553-1b4e-450e-bda2-032ac9c9be77`

2. **AMERIABANK_USERNAME**
   - Value: `3d19541048`

3. **AMERIABANK_PASSWORD**
   - Value: `lazY2k`

4. **AMERIABANK_VPOS_URL** (InitPayment endpoint)
   - Value: `https://servicestest.ameriabank.am/VPOS/api/VPOS/InitPayment`

5. **AMERIABANK_VPOS_STATUS_URL** (GetPaymentDetails endpoint)
   - Value: `https://servicestest.ameriabank.am/VPOS/api/VPOS/GetPaymentDetails`

6. **BACKEND_URL**
   - Value: `https://job-portal-backend-eight-sand.vercel.app`

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable above with its corresponding value
4. Make sure to select **Production**, **Preview**, and **Development** environments (or at least Production)
5. Click **Save**
6. **Redeploy** your application for changes to take effect

## Verify Environment Variables

After setting the variables and redeploying, check the logs. You should see:
- ✅ No errors about "credentials not configured"
- ✅ URLs should contain `servicestest` (not `services`)
- ✅ Username should be `3d19541048` (not placeholder values)

## Common Issues

### Issue: Still seeing placeholder values in logs
**Solution:** Make sure you redeployed after setting the environment variables. Vercel doesn't automatically apply new env vars to running deployments.

### Issue: Wrong URL being used (production instead of test)
**Solution:** Check that `AMERIABANK_VPOS_STATUS_URL` is set to the test URL (`servicestest.ameriabank.am`), not production (`services.ameriabank.am`).

### Issue: 500 errors from Ameriabank API
**Solution:** Verify all credentials are correct and match exactly what was provided by Ameriabank (no extra spaces, correct case).
