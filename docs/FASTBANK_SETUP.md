## Fast Bank payment gateway setup

This project now uses a generic Fast Bank payment provider behind a `PaymentProvider` abstraction. All credit refill and saved-card flows in `CreditService` are wired to `FastBankPaymentProvider` (`backend/src/payments/payment.provider.ts`).

To complete the integration you must configure Fast Bank sandbox/production credentials and endpoints.

### 1. Required environment variables

Set the following variables in `backend/.env` (and in your deployment platform, e.g. Vercel):

- `FASTBANK_API_KEY`: API access key issued by Fast Bank.
- `FASTBANK_API_SECRET`: Secret/token used to sign or authenticate API requests.
- `FASTBANK_MERCHANT_ID`: Merchant identifier configured on the Fast Bank side.
- `FASTBANK_PAYMENT_INIT_URL`: Full URL of the “create payment / checkout / order registration” endpoint. It must accept at least: `amount`, `currency`, `orderId`, `callbackUrl`, `customerId`, `saveCard`.
- `FASTBANK_PAYMENT_STATUS_URL`: Full URL of the payment status endpoint. It must accept `paymentId` (and optionally `orderId`) and return the current state and amounts.
- `FASTBANK_BINDING_PAYMENT_URL`: Full URL of the endpoint that charges a saved card / binding token. It must accept `bindingToken`, `amount`, `currency`, `customerId`.
- `FASTBANK_CANCEL_URL`: Full URL of the endpoint that cancels/voids a payment.
- `FASTBANK_REFUND_URL`: Full URL of the endpoint that refunds a payment (full or partial).

All of these URLs should point to the sandbox environment in non‑production and to the production environment in live deployments.

### 2. Expected request/response shape

The Fast Bank provider is intentionally defensive and accepts several common field names. You should map your real API to the following expectations, or adjust `FastBankPaymentProvider` if needed:

#### Init payment (`FASTBANK_PAYMENT_INIT_URL`)

**Request body (minimum):**

- `amount`: number – amount in the minor units expected by Fast Bank.
- `currency`: string – e.g. `"USD"`, `"AMD"`.
- `orderId`: string – internal order identifier (already generated in `CreditService`).
- `callbackUrl`: string – URL that Fast Bank will redirect/webhook to after payment.
- `customerId`: string – internal user ID.
- `saveCard`: boolean – whether card should be tokenized.

**Response body (expected fields):**

- One of `redirectUrl`, `paymentUrl`, `url`, `checkoutUrl` – URL the client should open in a webview/browser to complete payment.
- Optional identifiers, any of:
  - `orderId` / `OrderId` / `id`
  - `paymentId` / `PaymentId` / `paymentID` / `PaymentID`

#### Binding payment (`FASTBANK_BINDING_PAYMENT_URL`)

**Request body (minimum):**

- `amount`
- `currency`
- `bindingToken`
- `customerId`

**Response body (expected fields):**

- `success`: boolean – or
- `status` / `Status` / `paymentStatus` / `PaymentStatus` – where values like `"approved"`, `"success"`, `"succeeded"` are treated as success.
- Optional:
  - `amount` / `chargedAmount` / `totalAmount`
  - `paymentId` / `PaymentId` / `paymentID` / `PaymentID`

#### Status (`FASTBANK_PAYMENT_STATUS_URL`)

**Request body (minimum):**

- `paymentId`

**Response body (expected fields):**

- One of `status`, `Status`, `paymentStatus`, `PaymentStatus`, `state`, `State`.
  - The provider maps:
    - `"approved"`, `"success"`, `"succeeded"` → `approved`
    - `"declined"`, `"failed"`, `"error"` → `declined`
    - `"pending"`, `"processing"` → `pending`
- Optional:
  - `amount` / `totalAmount` / `depositedAmount`
  - `currency` / `Currency`

#### Cancel (`FASTBANK_CANCEL_URL`) and refund (`FASTBANK_REFUND_URL`)

**Request body (minimum):**

- `paymentId`
- For refunds: also `amount` (and optionally `orderId`).

**Response body (expected fields):**

- Same `status`/`success` pattern as above.
- Optional human‑readable text in `message` / `description` / `info`.

### 3. How the provider is used in the code

- New‑card credit refills:
  - `CreditService.initiatePayment` calls `FastBankPaymentProvider.initCreditRefill`.
  - The backend returns `paymentUrl` to mobile, which opens it in a webview.
- Saved‑card credit refills:
  - `CreditService.initiatePayment` with `cardId` calls `CreditService.makeBindingPayment`, which uses `FastBankPaymentProvider.makeBindingPayment`.
  - On success, credits are updated immediately and a `CreditTransaction` is logged.
- Callbacks:
  - `/credit/refill/callback` and `/subscriptions/callback` use `CreditService.handlePaymentCallback` / `SubscriptionsService.handleSubscriptionPaymentCallback`, both of which rely on `CreditService.getPaymentDetails`, now backed by `FastBankPaymentProvider.getPaymentDetails`.

If Fast Bank’s field names or semantics differ from the assumptions above, update the small mapping logic inside `FastBankPaymentProvider` accordingly.

