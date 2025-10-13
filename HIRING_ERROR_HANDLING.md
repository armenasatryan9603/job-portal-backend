# Hiring Error Handling Documentation

## Overview

This document describes the comprehensive error handling implemented for the hiring system in the marketplace backend.

## Error Types and Responses

### 1. Validation Errors (400 Bad Request)

#### `INVALID_SPECIALIST_ID`

- **Message**: "Invalid specialist ID"
- **Details**: "Specialist ID must be a positive number"
- **Cause**: specialistId is missing, null, or <= 0

#### `INVALID_ORDER_ID`

- **Message**: "Invalid order ID"
- **Details**: "Order ID must be a positive number"
- **Cause**: orderId is missing, null, or <= 0

#### `INVALID_CLIENT_ID`

- **Message**: "Invalid client ID"
- **Details**: "Client ID must be a positive number"
- **Cause**: clientId is missing, null, or <= 0

#### `EMPTY_MESSAGE`

- **Message**: "Message cannot be empty"
- **Details**: "Please provide a message when hiring a specialist"
- **Cause**: message is empty or only whitespace

#### `MESSAGE_TOO_LONG`

- **Message**: "Message is too long"
- **Details**: "Message cannot exceed 1000 characters"
- **Cause**: message length > 1000 characters
- **Additional Info**: `maxLength: 1000`, `currentLength: <actual_length>`

#### `SELF_HIRING_NOT_ALLOWED`

- **Message**: "You cannot hire yourself"
- **Details**: "Specialists cannot be hired for their own orders"
- **Cause**: specialistId === clientId

### 2. Authorization Errors (403 Forbidden)

#### `UNAUTHORIZED_ORDER_ACCESS`

- **Message**: "You can only hire specialists for your own orders"
- **Details**: "You do not have permission to hire specialists for this order"
- **Cause**: order.clientId !== clientId

### 3. Not Found Errors (404 Not Found)

#### `ORDER_NOT_FOUND`

- **Message**: "Order with ID {orderId} not found"
- **Details**: "The order you are trying to hire for does not exist"
- **Cause**: Order doesn't exist in database

#### `SPECIALIST_NOT_FOUND`

- **Message**: "Specialist with ID {specialistId} not found or not a specialist"
- **Details**: "The specialist you are trying to hire does not exist or is not a specialist"
- **Cause**: User doesn't exist or doesn't have 'specialist' role

#### `RECORD_NOT_FOUND`

- **Message**: "Required record not found during hiring process"
- **Details**: "One of the required records (order, specialist, or conversation) was not found"
- **Cause**: Prisma error P2025 (record not found)

### 4. Conflict Errors (409 Conflict)

#### `ALREADY_CONTACTED_SPECIALIST` (Success Response)

- **Message**: "You have already contacted this specialist for this order"
- **Details**: "A conversation with this specialist already exists for this order"
- **Additional Info**: `alreadyContacted: true`, `conversation: <full_conversation_object>`
- **Cause**: Active conversation already exists between client and specialist for this order
- **Note**: This is now returned as a successful response (200) with the existing conversation data

#### `DUPLICATE_CONVERSATION`

- **Message**: "A conversation already exists for this order and specialist"
- **Details**: "There is already a conversation between you and this specialist for this order"
- **Cause**: Prisma error P2002 (unique constraint violation)

### 5. Business Logic Errors (400 Bad Request)

#### `INVALID_ORDER_STATUS`

- **Message**: "Cannot hire specialists for orders with status: {status}"
- **Details**: "Only open orders can have specialists hired for them"
- **Additional Info**: `currentStatus: <status>`, `allowedStatuses: ['open']`
- **Cause**: Order status is not 'open'

### 6. Database Errors (500 Internal Server Error)

#### `DATABASE_ERROR`

- **Message**: "Database error occurred during hiring process"
- **Details**: "An error occurred while processing your hiring request. Please try again."
- **Additional Info**: `code: <prisma_error_code>`
- **Cause**: Any Prisma error with code starting with 'P'

#### `HIRING_FAILED`

- **Message**: "Failed to process hiring request"
- **Details**: "An unexpected error occurred while processing your hiring request. Please try again."
- **Cause**: Any unexpected error not covered by other cases

## Error Response Format

All errors follow this consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": "Detailed explanation of the error",
  "additionalInfo": "Optional additional context"
}
```

## Logging

### Controller Level

- **Success**: Logs successful hiring attempts with client, specialist, and order IDs
- **Failure**: Logs failed hiring attempts with full error stack trace

### Service Level

- All database operations are wrapped in try-catch blocks
- Specific error handling for different Prisma error codes
- Graceful fallback for unexpected errors

## Best Practices

1. **Input Validation**: All input data is validated before processing
2. **Authorization Checks**: Verify user permissions before allowing operations
3. **Business Logic Validation**: Check order status and existing conversations
4. **Database Error Handling**: Specific handling for different Prisma error codes
5. **Logging**: Comprehensive logging for debugging and monitoring
6. **User-Friendly Messages**: Clear, actionable error messages for frontend
7. **Error Codes**: Consistent error codes for frontend handling

## Frontend Integration

The frontend can handle these errors by:

1. **Checking error codes** to determine the type of error
2. **Displaying user-friendly messages** from the `message` field
3. **Showing detailed information** from the `details` field when needed
4. **Handling specific cases** like `ALREADY_CONTACTED_SPECIALIST` to redirect to existing conversation

## Example Frontend Error Handling

```typescript
try {
  const result = await hireSpecialist(data);
  // Handle success
} catch (error) {
  switch (error.response?.data?.error) {
    case 'ALREADY_CONTACTED_SPECIALIST':
      // Redirect to existing conversation
      router.push(`/chat/${error.response.data.conversationId}`);
      break;
    case 'INVALID_ORDER_STATUS':
      // Show status-specific message
      showError(error.response.data.details);
      break;
    default:
      // Show generic error message
      showError(error.response.data.message);
  }
}
```
