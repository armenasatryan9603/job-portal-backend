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
   - Use the returned `paymentUrl` to open the bank’s payment page.
3. On the bank page, pay with the **test card** above.
4. After success, the bank redirects to `BACKEND_URL/credit/refill/callback?...` and credits are added.

### 2. Bank’s acceptance criteria

Testing is considered done when you have:

- At least **5 successful** completed payments (REST, completed status).
- At least one **Refund** (if you implement refund).
- At least one **Cancel** (if you implement cancel).

Refund and Cancel are not implemented in this codebase yet; they would require calling the bank’s Refund/Cancel APIs (see bank integration docs).

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

---

**Summary:** With the current `.env` (test URLs + credentials), the backend already uses OrderID in 30164001–30165000 and amount 10 AMD. Use the test card on the bank’s page and complete at least 5 successful payments to satisfy the bank’s test criteria.
