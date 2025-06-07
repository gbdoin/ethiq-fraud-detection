# Ethiq Fraud Detection System - Technical Documentation

## Overview

Ethiq is a real-time fraud detection system that monitors phone conversations for potential scam attempts. The system uses call forwarding to preserve STIR/SHAKEN authentication while providing transparent fraud protection for vulnerable individuals.

## How It Works

1. **Call Forwarding**: Users configure their phones to forward calls to their personal Twilio number
2. **Real-Time Transcription**: Twilio transcribes conversations in real-time with partial results
3. **Keyword Detection**: The system monitors transcripts for fraud-related keywords
4. **AI Analysis**: When keywords are detected, an LLM analyzes the conversation for fraud patterns
5. **Automated Response**: If fraud is detected, the system can alert emergency contacts or terminate the call

## Key Features

- ✅ **STIR/SHAKEN Compliant** - Preserves caller authentication through proper call forwarding
- ✅ **Real-Time Protection** - Analyzes conversations as they happen
- ✅ **Privacy-First Design** - Only analyzes when keywords are detected
- ✅ **Scalable Architecture** - Built on Supabase for multi-tenant support
- ✅ **Low Latency** - Responds within 5-10 seconds of detecting fraud

## Architecture Documents

### 📐 [System Architecture](./ARCHITECTURE.md)
Complete technical architecture including:
- Call flow with STIR/SHAKEN preservation
- Real-time transcription pipeline
- Database schema and triggers
- Security and isolation model

### 🔧 [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
Step-by-step implementation details:
- Supabase configuration
- Twilio setup with CallToken
- Real-time transcription handling
- Keyword monitoring strategies
- LLM integration patterns

### 🚀 [Deployment Guide](./DEPLOYMENT_GUIDE.md)
Production deployment instructions:
- Environment configuration
- Security best practices
- Monitoring and logging
- Scaling considerations

### 📱 [User Setup Guide](./USER_SETUP_GUIDE.md)
Instructions for end users:
- Phone call forwarding setup
- Emergency contact configuration
- Privacy settings
- Testing procedures

### 🔌 [API Reference](./API_REFERENCE.md)
Complete API documentation:
- Authentication endpoints
- User management
- Call logs and analytics
- Real-time WebSocket events

## Quick Start

### Prerequisites

- Node.js 18+ 
- Supabase account
- Twilio account with voice capabilities
- OpenAI API access (for LLM fraud analysis)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ethiq/ethiq-fraud-detection.git
   cd ethiq-fraud-detection
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Setup Supabase**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Call Handling**: Twilio Voice with CallToken
- **Transcription**: Twilio Real-Time Transcription
- **AI Analysis**: OpenAI GPT-4
- **Real-time**: WebSockets for live updates

## Security Considerations

- All calls maintain STIR/SHAKEN attestation
- End-to-end encryption for sensitive data
- Row-level security in Supabase
- API authentication with JWT tokens
- Audit logging for compliance

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

Proprietary - See [LICENSE](../LICENSE) for details. 