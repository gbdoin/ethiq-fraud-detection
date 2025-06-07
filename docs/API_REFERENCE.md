# Ethiq Fraud Detection - API Reference

## Overview

The Ethiq API provides programmatic access to fraud detection services, user management, and real-time call monitoring. All API requests require authentication unless otherwise specified.

## Base URL

```
Production: https://api.ethiq.ai
Staging: https://api-staging.ethiq.ai
```

## Authentication

All API requests require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "phone_number": "+1234567890",
    "twilio_number": "+1987654321"
  }
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "details": {
      "field": "phone_number",
      "value": "123"
    }
  },
  "request_id": "req_abc123"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid token |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- **Default limit**: 100 requests per 15 minutes
- **Webhook endpoints**: Unlimited
- **Headers returned**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Endpoints

### Authentication

#### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "phone_number": "+1234567890",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful. Please verify your email.",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2024-01-01T00:00:00Z",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

#### Refresh Token

```http
POST /auth/refresh
Authorization: Bearer <expired_token>
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2024-01-01T00:00:00Z"
}
```

### User Management

#### Get Current User

```http
GET /api/user/profile
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "phone_number": "+1234567890",
  "twilio_number": "+1987654321",
  "call_forwarding_active": true,
  "created_at": "2023-01-01T00:00:00Z",
  "subscription": {
    "plan": "premium",
    "status": "active",
    "expires_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Update User Profile

```http
PATCH /api/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "call_forwarding_active": false
}
```

**Response:** `200 OK`
```json
{
  "message": "Profile updated successfully",
  "user": { /* updated user object */ }
}
```

#### Provision Twilio Number

```http
POST /api/user/provision-number
Authorization: Bearer <token>
Content-Type: application/json

{
  "area_code": "415",
  "capabilities": ["voice", "sms"]
}
```

**Response:** `201 Created`
```json
{
  "twilio_number": "+14155551234",
  "twilio_number_sid": "PNxxxxx",
  "monthly_cost": "$1.00",
  "capabilities": ["voice", "sms"]
}
```

### Emergency Contacts

#### List Emergency Contacts

```http
GET /api/emergency-contacts
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "contacts": [
    {
      "id": "contact_123",
      "name": "John Smith",
      "phone_number": "+1234567890",
      "relationship": "Son",
      "priority": 1,
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### Add Emergency Contact

```http
POST /api/emergency-contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Smith",
  "phone_number": "+1234567890",
  "relationship": "Daughter",
  "priority": 2
}
```

**Response:** `201 Created`
```json
{
  "id": "contact_456",
  "name": "Jane Smith",
  "phone_number": "+1234567890",
  "relationship": "Daughter",
  "priority": 2,
  "created_at": "2023-01-01T00:00:00Z"
}
```

#### Update Emergency Contact

```http
PUT /api/emergency-contacts/{contact_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Smith-Jones",
  "priority": 1
}
```

**Response:** `200 OK`
```json
{
  "message": "Contact updated successfully",
  "contact": { /* updated contact */ }
}
```

#### Delete Emergency Contact

```http
DELETE /api/emergency-contacts/{contact_id}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

### Call History

#### List Calls

```http
GET /api/calls?limit=20&offset=0&status=completed
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (active, completed, failed)
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date

**Response:** `200 OK`
```json
{
  "calls": [
    {
      "id": "call_123",
      "call_sid": "CAxxxxx",
      "caller_number": "+1234567890",
      "status": "completed",
      "started_at": "2023-01-01T10:00:00Z",
      "ended_at": "2023-01-01T10:15:00Z",
      "duration_seconds": 900,
      "fraud_detected": false,
      "stir_shaken_status": "TN-Validation-Passed-A"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

#### Get Call Details

```http
GET /api/calls/{call_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "call_123",
  "call_sid": "CAxxxxx",
  "caller_number": "+1234567890",
  "status": "completed",
  "started_at": "2023-01-01T10:00:00Z",
  "ended_at": "2023-01-01T10:15:00Z",
  "duration_seconds": 900,
  "fraud_analysis": {
    "fraud_detected": true,
    "fraud_score": 85,
    "fraud_type": "tech_support",
    "confidence": 92,
    "triggered_keywords": ["virus", "remote access"],
    "explanation": "Caller claimed to be from Microsoft...",
    "analyzed_at": "2023-01-01T10:05:00Z"
  },
  "alerts_sent": [
    {
      "contact_name": "John Smith",
      "alert_type": "sms",
      "sent_at": "2023-01-01T10:05:30Z",
      "delivered": true
    }
  ]
}
```

### Fraud Analysis

#### Get Fraud Analysis

```http
GET /api/fraud-analysis/{analysis_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "analysis_123",
  "call_id": "call_123",
  "triggered_by_keywords": ["IRS", "arrest"],
  "fraud_score": 95,
  "fraud_detected": true,
  "fraud_type": "irs_scam",
  "confidence": 98,
  "explanation": "Classic IRS scam pattern detected...",
  "evidence_quotes": [
    "This is the IRS calling about your unpaid taxes",
    "You will be arrested within 24 hours"
  ],
  "recommended_action": "terminate",
  "created_at": "2023-01-01T10:05:00Z"
}
```

#### Report False Positive

```http
POST /api/fraud-analysis/{analysis_id}/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "feedback_type": "false_positive",
  "comments": "This was my accountant calling"
}
```

**Response:** `200 OK`
```json
{
  "message": "Thank you for your feedback",
  "feedback_id": "feedback_789"
}
```

### System Management

#### Test Protection

```http
POST /api/test/protection
Authorization: Bearer <token>
Content-Type: application/json

{
  "test_type": "full",
  "alert_contacts": true
}
```

**Response:** `202 Accepted`
```json
{
  "message": "Test initiated",
  "test_id": "test_456",
  "expected_duration": "60 seconds"
}
```

#### Get System Status

```http
GET /api/system/status
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "protection_active": true,
  "twilio_number_active": true,
  "call_forwarding_verified": true,
  "last_test": "2023-01-01T00:00:00Z",
  "emergency_contacts_count": 3,
  "subscription_status": "active"
}
```

## Webhook Endpoints

These endpoints are called by Twilio and don't require authentication. They must validate the Twilio signature.

### Incoming Call

```http
POST /voice/incoming
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: <signature>

CallToken=TKxxxxx&From=%2B1234567890&To=%2B1987654321&CallSid=CAxxxxx
```

**Response:** `200 OK`
```xml
<Response>
  <Start>
    <Transcription statusCallbackUrl="https://api.ethiq.ai/voice/transcription"/>
  </Start>
  <Dial>
    <Conference>ethiq-user123-1234567890</Conference>
  </Dial>
</Response>
```

### Transcription Event

```http
POST /voice/transcription
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: <signature>

CallSid=CAxxxxx&TranscriptionText=Hello+this+is+a+test&SequenceNumber=1&IsFinal=false
```

**Response:** `200 OK`

### Call Status

```http
POST /voice/status
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: <signature>

CallSid=CAxxxxx&CallStatus=completed&Duration=900
```

**Response:** `200 OK`

## WebSocket API

Real-time updates for active calls and fraud alerts.

### Connection

```javascript
const ws = new WebSocket('wss://api.ethiq.ai/ws');

// Authenticate after connection
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer eyJhbGciOiJIUzI1NiIs...'
  }));
});
```

### Events

#### Authentication Success

```json
{
  "type": "auth_success",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Call Started

```json
{
  "type": "call_started",
  "call_id": "call_123",
  "caller_number": "+1234567890",
  "timestamp": "2023-01-01T10:00:00Z"
}
```

#### Transcript Update

```json
{
  "type": "transcript_update",
  "call_id": "call_123",
  "text": "Hello, this is...",
  "is_final": false,
  "sequence": 5
}
```

#### Fraud Alert

```json
{
  "type": "fraud_alert",
  "call_id": "call_123",
  "analysis_id": "analysis_456",
  "fraud_score": 85,
  "fraud_type": "tech_support",
  "severity": "high"
}
```

#### Call Ended

```json
{
  "type": "call_ended",
  "call_id": "call_123",
  "duration": 900,
  "fraud_detected": true
}
```

### Client Commands

#### Subscribe to Call

```json
{
  "type": "subscribe_call",
  "call_id": "call_123"
}
```

#### Unsubscribe from Call

```json
{
  "type": "unsubscribe_call",
  "call_id": "call_123"
}
```

## Data Types

### Phone Number Format

All phone numbers must be in E.164 format:
- Start with `+` 
- Country code
- No spaces or special characters
- Example: `+14155551234`

### Timestamps

All timestamps are in ISO 8601 format with timezone:
- Example: `2023-01-01T10:00:00Z`

### UUIDs

All IDs are UUID v4 format:
- Example: `550e8400-e29b-41d4-a716-446655440000`

## Code Examples

### Node.js

```javascript
const axios = require('axios');

class EthiqClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.ethiq.ai';
  }

  async getProfile() {
    const response = await axios.get(`${this.baseURL}/api/user/profile`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.data;
  }

  async addEmergencyContact(contact) {
    const response = await axios.post(
      `${this.baseURL}/api/emergency-contacts`,
      contact,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }
}
```

### Python

```python
import requests

class EthiqClient:
    def __init__(self, token):
        self.token = token
        self.base_url = 'https://api.ethiq.ai'
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_profile(self):
        response = requests.get(
            f'{self.base_url}/api/user/profile',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def add_emergency_contact(self, name, phone_number, relationship):
        data = {
            'name': name,
            'phone_number': phone_number,
            'relationship': relationship
        }
        response = requests.post(
            f'{self.base_url}/api/emergency-contacts',
            json=data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
```

### cURL

```bash
# Get user profile
curl -X GET https://api.ethiq.ai/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Add emergency contact
curl -X POST https://api.ethiq.ai/api/emergency-contacts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone_number": "+1234567890",
    "relationship": "Son"
  }'
```

## Versioning

The API uses URL versioning. The current version is v1 (implicit in URLs).

Future versions will be explicitly versioned:
- `https://api.ethiq.ai/v2/...`

## Support

- **Documentation**: [docs.ethiq.ai](https://docs.ethiq.ai)
- **Status Page**: [status.ethiq.ai](https://status.ethiq.ai)
- **Support Email**: api-support@ethiq.ai
- **Developer Discord**: [discord.ethiq.ai](https://discord.ethiq.ai) 