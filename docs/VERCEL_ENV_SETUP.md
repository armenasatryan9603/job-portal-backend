# Vercel Environment Variables Setup

## Required Environment Variables for Fast Bank

Make sure these are set in your Vercel project settings:

### Payment Gateway Configuration

1. **FASTBANK_API_KEY**
   - Value: API key issued by Fast Bank for this project.

2. **FASTBANK_API_SECRET**
   - Value: Secret/token used to authenticate/sign Fast Bank API requests.

3. **FASTBANK_MERCHANT_ID**
   - Value: Merchant identifier configured on the Fast Bank side.

4. **FASTBANK_PAYMENT_INIT_URL** (payment/checkout initiation endpoint)
   - Example: `https://sandbox.fastbank.example.com/api/payments/init`

5. **FASTBANK_PAYMENT_STATUS_URL** (payment status endpoint)
   - Example: `https://sandbox.fastbank.example.com/api/payments/status`

6. **FASTBANK_BINDING_PAYMENT_URL** (saved-card / binding payment endpoint)
   - Example: `https://sandbox.fastbank.example.com/api/payments/binding`

7. **FASTBANK_CANCEL_URL** (payment cancel/void endpoint)
   - Example: `https://sandbox.fastbank.example.com/api/payments/cancel`

8. **FASTBANK_REFUND_URL** (payment refund endpoint)
   - Example: `https://sandbox.fastbank.example.com/api/payments/refund`

9. **BACKEND_URL**
   - Value: Public HTTPS URL of your backend (e.g. the Vercel deployment URL). This is used as the callback/redirect base for Fast Bank.

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable above with its corresponding value
4. Make sure to select **Production**, **Preview**, and **Development** environments (or at least Production)
5. Click **Save**
6. **Redeploy** your application for changes to take effect

## Verify Environment Variables

After setting the variables and redeploying, check the logs. You should see:
- ✅ No errors about payment gateway credentials not being configured
- ✅ Fast Bank endpoints are reachable (no connection/timeout errors)
- ✅ Status / cancel / refund requests return expected responses

## Common Issues

### Issue: Still seeing placeholder values in logs
**Solution:** Make sure you redeployed after setting the environment variables. Vercel doesn't automatically apply new env vars to running deployments.

### Issue: Wrong URL being used (production instead of test)
**Solution:** Point all `FASTBANK_*_URL` values to the sandbox environment while testing, and to production endpoints only when you are ready to go live.

### Issue: 4xx/5xx errors from Fast Bank API
**Solution:** Verify all credentials and endpoint URLs are correct and match exactly what was provided by Fast Bank (no extra spaces, correct case). Check Fast Bank logs/portal if available.
