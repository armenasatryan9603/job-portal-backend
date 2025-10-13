# Marketplace Backend API Endpoints

This document provides a comprehensive overview of all available API endpoints in the marketplace backend.

## Base URL

```
http://localhost:8080
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 Authentication Endpoints

### POST `/auth/signup`

Create a new user account.

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "client"
}
```

**Role Options:**

- `client` - User who needs work done
- `specialist` - User who can provide services

### POST `/auth/login`

Login with email and password.

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### POST `/auth/reset-password`

Reset user password.

```json
{
  "email": "john@example.com",
  "newPassword": "newpassword123"
}
```

### GET `/auth/profile` 🔒

Get current user profile.

### PUT `/auth/profile` 🔒

Update current user profile.

```json
{
  "name": "John Smith",
  "phone": "+1234567890",
  "bio": "Software developer",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

### GET `/auth/google`

Initiate Google OAuth login.

### GET `/auth/google/status`

Check Google OAuth configuration status.

### GET `/auth/google/callback`

Google OAuth callback endpoint.

### PUT `/auth/role` 🔒

Update user role after initial authentication.

```json
{
  "role": "client"
}
```

**Role Options:**

- `client` - User who needs work done
- `specialist` - User who can provide services

**Response:**

```json
{
  "access_token": "new-jwt-token",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "role": "client"
  }
}
```

---

## 👥 User Management Endpoints

### GET `/users` 🔒

Get all users with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `role` (optional: filter by role)

### GET `/users/search` 🔒

Search users by name, email, or bio.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/users/role/:role` 🔒

Get users by specific role.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)

### GET `/users/:id` 🔒

Get user by ID with detailed information.

### PATCH `/users/:id` 🔒

Update user information.

```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com",
  "phone": "+1234567890",
  "bio": "Updated bio",
  "avatarUrl": "https://example.com/avatar.jpg",
  "role": "client",
  "verified": true
}
```

### PATCH `/users/:id/password` 🔒

Update user password.

```json
{
  "newPassword": "newpassword123"
}
```

### PATCH `/users/:id/credit` 🔒

Update user credit balance.

```json
{
  "amount": 100.5
}
```

### DELETE `/users/:id` 🔒

Delete user (only if no orders or reviews exist).

---

## 🛠️ Service Management Endpoints

### POST `/services` 🔒

Create a new service.

```json
{
  "name": "Web Development",
  "description": "Custom web applications",
  "parentId": 1
}
```

### GET `/services`

Get all services with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `parentId` (optional: filter by parent service)

### GET `/services/root`

Get all root services (services without parent).

### GET `/services/parent/:parentId`

Get child services of a specific parent.

### GET `/services/search`

Search services by name or description.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/services/:id`

Get service by ID with detailed information.

### PATCH `/services/:id` 🔒

Update service information.

```json
{
  "name": "Updated Service Name",
  "description": "Updated description",
  "parentId": 2
}
```

### DELETE `/services/:id` 🔒

Delete service (only if no child services, specialist profiles, or orders exist).

---

## 👨‍💼 Specialist Profile Endpoints

### POST `/specialist-profiles` 🔒

Create a specialist profile.

```json
{
  "userId": 1,
  "serviceId": 1,
  "experienceYears": 5,
  "priceMin": 50.0,
  "priceMax": 150.0,
  "location": "New York, NY"
}
```

### GET `/specialist-profiles`

Get all specialist profiles with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `serviceId` (optional: filter by service)
- `location` (optional: filter by location)

### GET `/specialist-profiles/search`

Search specialist profiles.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/specialist-profiles/service/:serviceId`

Get specialist profiles by service.

### GET `/specialist-profiles/location/:location`

Get specialist profiles by location.

### GET `/specialist-profiles/user/:userId`

Get specialist profile by user ID.

### GET `/specialist-profiles/:id`

Get specialist profile by ID.

### PATCH `/specialist-profiles/:id` 🔒

Update specialist profile.

```json
{
  "serviceId": 2,
  "experienceYears": 6,
  "priceMin": 60.0,
  "priceMax": 160.0,
  "location": "Los Angeles, CA"
}
```

### DELETE `/specialist-profiles/:id` 🔒

Delete specialist profile (only if no proposals exist).

---

## 📋 Order Management Endpoints

### POST `/orders/create` 🔒

Create a new order/job posting.

```json
{
  "serviceId": 1,
  "title": "Website Development",
  "description": "Need a modern website",
  "budget": 5000.0,
  "availableDates": [
    "2024-12-15 9:00 AM",
    "2024-12-16 2:00 PM",
    "2024-12-17 6:00 PM"
  ],
  "location": "Remote",
  "skills": ["React", "Node.js", "MongoDB"]
}
```

**Fields:**

- `serviceId` (optional): Service category ID
- `title` (required): Job title
- `description` (required): Detailed job description
- `budget` (required): Project budget in USD
- `availableDates` (optional): Array of available date and time slots (e.g., ["2024-12-15 9:00 AM", "2024-12-16 2:00 PM"])
- `location` (optional): Work location
- `skills` (optional): Array of required skills

### GET `/orders`

Get all orders with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `status` (optional: filter by status)
- `serviceId` (optional: filter by service)
- `clientId` (optional: filter by client)

### GET `/orders/search`

Search orders.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/orders/client/:clientId`

Get orders by client.

### GET `/orders/service/:serviceId`

Get orders by service.

### GET `/orders/status/:status`

Get orders by status.

### GET `/orders/:id`

Get order by ID with detailed information.

### PATCH `/orders/:id` 🔒

Update order.

```json
{
  "serviceId": 2,
  "title": "Updated Title",
  "description": "Updated description",
  "budget": 6000.0,
  "status": "in_progress"
}
```

### DELETE `/orders/:id` 🔒

Delete order (only if no proposals or reviews exist).

### GET `/orders/my-orders` 🔒

Get current user's posted orders.

### PATCH `/orders/:id/status` 🔒

Update order status.

```json
{
  "status": "in_progress"
}
```

**Valid statuses:** `open`, `in_progress`, `completed`, `cancelled`

### GET `/orders/available` 🔒

Get available orders for specialists with filtering.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `serviceId` (optional: filter by service)
- `location` (optional: filter by location)
- `budgetMin` (optional: minimum budget)
- `budgetMax` (optional: maximum budget)

---

## 💼 Order Proposal Endpoints

### POST `/order-proposals` 🔒

Create a new order proposal.

```json
{
  "orderId": 1,
  "userId": 2,
  "price": 4500.0,
  "message": "I can complete this project in 2 weeks"
}
```

### GET `/order-proposals`

Get all order proposals with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `status` (optional: filter by status)
- `orderId` (optional: filter by order)
- `userId` (optional: filter by user)

### GET `/order-proposals/search`

Search order proposals.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/order-proposals/order/:orderId`

Get proposals for a specific order.

### GET `/order-proposals/user/:userId`

Get proposals by user.

### GET `/order-proposals/status/:status`

Get proposals by status.

### GET `/order-proposals/:id`

Get order proposal by ID.

### PATCH `/order-proposals/:id` 🔒

Update order proposal.

```json
{
  "price": 5000.0,
  "message": "Updated proposal message",
  "status": "accepted"
}
```

### DELETE `/order-proposals/:id` 🔒

Delete order proposal (cannot delete accepted proposals).

---

## ⭐ Review Endpoints

### POST `/reviews` 🔒

Create a new review.

```json
{
  "orderId": 1,
  "reviewerId": 1,
  "specialistId": 2,
  "rating": 5,
  "comment": "Excellent work, highly recommended!"
}
```

### GET `/reviews`

Get all reviews with pagination.
**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `orderId` (optional: filter by order)
- `reviewerId` (optional: filter by reviewer)
- `specialistId` (optional: filter by specialist)

### GET `/reviews/search`

Search reviews.
**Query Parameters:**

- `q` (required: search query)
- `page` (default: 1)
- `limit` (default: 10)

### GET `/reviews/order/:orderId`

Get reviews for a specific order.

### GET `/reviews/reviewer/:reviewerId`

Get reviews by reviewer.

### GET `/reviews/specialist/:specialistId`

Get reviews for a specific specialist.

### GET `/reviews/rating/average`

Get average rating.
**Query Parameters:**

- `specialistId` (optional: filter by specialist)

### GET `/reviews/rating/distribution`

Get rating distribution.
**Query Parameters:**

- `specialistId` (optional: filter by specialist)

### GET `/reviews/:id`

Get review by ID.

### PATCH `/reviews/:id` 🔒

Update review.

```json
{
  "rating": 4,
  "comment": "Updated review comment"
}
```

### DELETE `/reviews/:id` 🔒

Delete review.

---

## 💳 Credit Management Endpoints

### POST `/credit/refill/initiate` 🔒

Initiate credit refill payment.

```json
{
  "amount": 100.0
}
```

### POST `/credit/refill/webhook`

Webhook endpoint for payment processing.

```json
{
  "orderId": "payment_order_id",
  "paidAmount": 100.0
}
```

---

## 📊 Response Format

All endpoints return responses in the following format:

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## 🔒 Authentication Required

Endpoints marked with 🔒 require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 📝 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔍 Search and Filtering

Most list endpoints support:

- **Pagination**: `page` and `limit` parameters
- **Search**: Use the `/search` endpoints with `q` parameter
- **Filtering**: Various filter parameters specific to each endpoint

---

## 📋 Order Status Values

- `open` - Order is open for proposals
- `in_progress` - Order is being worked on
- `completed` - Order is completed
- `cancelled` - Order is cancelled

## 💼 Proposal Status Values

- `pending` - Proposal is waiting for response
- `accepted` - Proposal is accepted
- `rejected` - Proposal is rejected
- `cancelled` - Proposal is cancelled

## ⭐ Rating Values

- Integer between 1 and 5 (inclusive)

---

# 📁 Media Files API

## Media Files Endpoints

### POST `/media-files/upload` 🔒

Upload a media file for an order.

**Content-Type:** `multipart/form-data`

**Form Data:**

- `file` (required): The media file to upload
- `orderId` (required): ID of the order this media file belongs to
- `fileType` (optional): Type of file - "image" or "video" (auto-detected if not provided)

**Supported File Types:**

- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, MOV, AVI, QuickTime

**File Size Limit:** 50MB

**Response:**

```json
{
  "id": 1,
  "orderId": 1,
  "fileName": "project-screenshot.jpg",
  "fileUrl": "/uploads/media/uuid-filename.jpg",
  "fileType": "image",
  "mimeType": "image/jpeg",
  "fileSize": 2048576,
  "uploadedBy": 2,
  "createdAt": "2024-12-15T10:30:00.000Z"
}
```

### POST `/media-files` 🔒

Create a new media file record for an order (without file upload).

```json
{
  "orderId": 1,
  "fileName": "project-screenshot.jpg",
  "fileUrl": "https://s3.amazonaws.com/bucket/uploads/1234567890-project-screenshot.jpg",
  "fileType": "image",
  "mimeType": "image/jpeg",
  "fileSize": 2048576
}
```

**Fields:**

- `orderId` (required): ID of the order this media file belongs to
- `fileName` (required): Original name of the uploaded file
- `fileUrl` (required): URL where the file is stored (e.g., S3 URL)
- `fileType` (required): Type of file - "image" or "video"
- `mimeType` (required): MIME type of the file (e.g., "image/jpeg", "video/mp4")
- `fileSize` (required): Size of the file in bytes

### GET `/media-files/order/:orderId`

Get all media files for a specific order.

**Response:**

```json
[
  {
    "id": 1,
    "orderId": 1,
    "fileName": "project-screenshot.jpg",
    "fileUrl": "https://s3.amazonaws.com/bucket/uploads/1234567890-project-screenshot.jpg",
    "fileType": "image",
    "mimeType": "image/jpeg",
    "fileSize": 2048576,
    "uploadedBy": 2,
    "createdAt": "2024-12-15T10:30:00.000Z",
    "User": {
      "id": 2,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
]
```

### GET `/media-files/:id` 🔒

Get a specific media file by ID.

### DELETE `/media-files/:id` 🔒

Delete a media file. Only the order owner or the user who uploaded the file can delete it.

---

# 💬 Chat API

## Chat Endpoints

### POST `/chat/conversations` 🔒

Create a new conversation.

```json
{
  "orderId": 1,
  "title": "Project Discussion",
  "participantIds": [2, 3]
}
```

**Fields:**

- `orderId` (optional): ID of the order this conversation is related to
- `title` (optional): Conversation title
- `participantIds` (required): Array of user IDs to include in the conversation

### GET `/chat/conversations` 🔒

Get user's conversations with pagination.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)

### GET `/chat/conversations/:id` 🔒

Get specific conversation with participants and last message.

### GET `/chat/conversations/:id/messages` 🔒

Get messages for a conversation.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 50)

### POST `/chat/messages` 🔒

Send a message.

```json
{
  "conversationId": 1,
  "content": "Hello! How can I help you?",
  "messageType": "text",
  "metadata": {}
}
```

**Fields:**

- `conversationId` (required): ID of the conversation
- `content` (required): Message content
- `messageType` (optional): Type of message - "text", "image", "file", "system" (default: "text")
- `metadata` (optional): Additional data like file info, etc.

### POST `/chat/conversations/:id/read` 🔒

Mark messages as read in a conversation.

### GET `/chat/unread-count` 🔒

Get unread message count for the current user.

**Response:**

```json
{
  "unreadCount": 5
}
```

### POST `/chat/orders/:orderId/conversation` 🔒

Create a conversation for an order (between client and specialist).

### GET `/chat/conversations/:id/participants` 🔒

Get conversation participants (excluding current user).
