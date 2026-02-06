# Ameriabank vPOS Test Environment

## Credentials (already in `.env`)

- **Client ID:** `c771a553-1b4e-450e-bda2-032ac9c9be77`
- **Username:** `3d19541048`
- **Password:** `lazY2k`
- **VPOS URL:** `https://servicestest.ameriabank.am/VPOS/api/VPOS/InitPayment`
- **Status URL:** `https://servicestest.ameriabank.am/VPOS/api/VPOS/GetPaymentDetails`

## Test card (use on payment page)

| Field       | Value              |
|------------|--------------------|
| Card number| `4083060013681818` |
| Cardholder | `TEST CARD VPOS`   |
| Exp. date  | `05/28`            |
| CVV        | `233`              |

## Test rules (handled by backend)

- **OrderID:** Must be in range **30164001–30165000**. The backend automatically uses this range when `AMERIABANK_VPOS_URL` contains `servicestest`.
- **Amount:** Must be **10 AMD**. The backend sends 10 AMD in test mode regardless of the amount the user selects for credit refill.

## How to test

### 1. Credit refill (single-phase payment)

1. Ensure backend is running and `.env` has the Ameriabank test vars and `BACKEND_URL` reachable by the bank (e.g. your deployed backend URL for callback).
2. From the app (or API):
   - **POST** `/credit/refill/initiate` with `{ "amount": 100, "currency": "USD" }` (or any amount; test mode will send 10 AMD).
   - Use the returned `paymentUrl` to open the bank's payment page.
3. On the bank page, pay with the **test card** above.
4. After success, the bank redirects to `BACKEND_URL/credit/refill/callback?...` and credits are added.

### 2. Bank's acceptance criteria

Testing is considered done when you have:

- At least **5 successful** completed payments (REST, completed status).
- At least **4 successful** Cancel payment requests.
- At least **4 successful** Refund payment requests.

Refund and Cancel are now implemented! See sections below for how to use them.

### 3. Callback URL

- **GET** `https://<BACKEND_URL>/credit/refill/callback?orderID=...&responseCode=...&paymentID=...`
- The bank redirects the user here after payment. `BACKEND_URL` in `.env` must be the public URL of your backend (e.g. Vercel backend) so the bank can reach it.

### 4. Local testing

**IMPORTANT:** When testing locally, Ameriabank needs to reach your callback URL. Since `localhost` is not accessible from the internet, you have two options:

**Option A: Use ngrok (recommended for local testing)**
1. Install ngrok: `brew install ngrok` (Mac) or download from [ngrok.com](https://ngrok.com)
2. Start your local backend: `npm run start:dev` (runs on port 8080)
3. In another terminal, run: `ngrok http 8080`
4. Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)
5. Update `.env`: `BACKEND_URL=https://abc123.ngrok.io`
6. Restart your backend server
7. Now when you initiate payment, the callback will go to your ngrok URL which tunnels to localhost

**Option B: Deploy to Vercel first**
- Deploy your latest code to Vercel
- Keep `BACKEND_URL=https://job-portal-backend-eight-sand.vercel.app` in `.env`
- The callback will go to your deployed Vercel instance

**Note:** The `BACKEND_URL` in `.env` is what gets sent to Ameriabank as the `BackURL`. Make sure it's publicly accessible!

### 5. Cancel Payment

To cancel a payment, use the cancel endpoint:

**POST** `/credit/payment/cancel`
- **Headers:** 
  - `Authorization: Bearer <token>` (required)
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "paymentID": "string",
    "orderID": "string"
  }
  ```
- **Example:**
  ```bash
  curl -X POST https://your-backend-url/credit/payment/cancel \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "paymentID": "12345678",
      "orderID": "30164001"
    }'
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Payment canceled successfully",
    "response": {
      "ResponseCode": "00",
      "ResponseMessage": "Success",
      ...
    }
  }
  ```
- **Notes:**
  - Payment can only be canceled if it's in a cancelable state
  - Already canceled payments will return an error
  - Requires valid paymentID and orderID from a completed payment

### 6. Refund Payment

To refund a payment (full or partial), use the refund endpoint:

**POST** `/credit/payment/refund`
- **Headers:**
  - `Authorization: Bearer <token>` (required)
  - `Content-Type: application/json`
- **Body (Full Refund):**
  ```json
  {
    "paymentID": "string",
    "orderID": "string"
  }
  ```
- **Body (Partial Refund):**
  ```json
  {
    "paymentID": "string",
    "orderID": "string",
    "amount": 5
  }
  ```
- **Example (Full Refund):**
  ```bash
  curl -X POST https://your-backend-url/credit/payment/refund \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "paymentID": "12345678",
      "orderID": "30164001"
    }'
  ```
- **Example (Partial Refund):**
  ```bash
  curl -X POST https://your-backend-url/credit/payment/refund \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "paymentID": "12345678",
      "orderID": "30164001",
      "amount": 5
    }'
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Payment refunded successfully (full)",
    "response": {
      "ResponseCode": "00",
      "ResponseMessage": "Success",
      ...
    }
  }
  ```
- **Notes:**
  - Omit `amount` for full refund
  - Provide `amount` (in AMD) for partial refund
  - Amount must be greater than 0 and less than or equal to original payment amount
  - Already refunded payments will return an error
  - Requires valid paymentID and orderID from a completed payment

### 7. How to Get PaymentID and OrderID

To perform cancel or refund operations, you need the `paymentID` and `orderID` from completed payment transactions. Here are several ways to get them:

#### Option A: From CreditTransaction API

**GET** `/credit/transactions`
- Returns user's transaction history
- Each transaction includes:
  - `referenceId` - This is the `paymentID`
  - `metadata.orderID` - This is the `orderID`
- Example response:
  ```json
  {
    "transactions": [
      {
        "id": 123,
        "referenceId": "12345678",
        "metadata": {
          "orderID": "30164001",
          "paymentID": "12345678",
          ...
        },
        ...
      }
    ]
  }
  ```

#### Option B: From Database Query

Query the `CreditTransaction` table directly:

```sql
SELECT 
  id,
  "referenceId" as paymentID,
  metadata->>'orderID' as orderID,
  amount,
  status,
  "createdAt"
FROM "CreditTransaction"
WHERE type = 'refill'
  AND status = 'completed'
  AND "referenceId" IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 10;
```

#### Option C: From Payment Callback Logs

When a payment completes successfully, the callback logs include both `paymentID` and `orderID`. Check your backend logs for entries like:

```
Payment callback received - OrderID: 30164001, PaymentID: 12345678, ResponseCode: 00
```

#### Important Notes

- Only use `paymentID` and `orderID` from **completed** payments
- Each payment can only be canceled or refunded once
- Keep a record of which payments you've used for testing to avoid duplicate operations
- For bank approval, you need 4 unique cancel operations and 4 unique refund operations

---

**Summary:** With the current `.env` (test URLs + credentials), the backend already uses OrderID in 30164001–30165000 and amount 10 AMD. Use the test card on the bank's page and complete at least 5 successful payments, then perform 4 cancel operations and 4 refund operations to satisfy the bank's test criteria.
