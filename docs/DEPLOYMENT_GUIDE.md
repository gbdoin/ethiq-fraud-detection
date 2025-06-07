# Ethiq Fraud Detection - Deployment Guide

## Overview

This guide covers deploying the Ethiq fraud detection system to production, including infrastructure setup, security hardening, monitoring, and maintenance procedures.

## Production Architecture

### Recommended Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFlare                                │
│                  (DDoS Protection)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer                               │
│                 (AWS ALB/NLB)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────┐     ┌───────────────────────┐
│   Node.js Server 1    │     │   Node.js Server 2    │
│   (Auto-scaling)      │     │   (Auto-scaling)      │
└───────────────────────┘     └───────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Redis Cluster                             │
│                  (Session Storage)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase (Managed)                            │
│              PostgreSQL + Realtime                            │
└─────────────────────────────────────────────────────────────┘
```

## Pre-Deployment Checklist

### 1. Infrastructure Requirements

- [ ] Domain with SSL certificate
- [ ] Supabase project (Pro plan recommended)
- [ ] Twilio account with:
  - [ ] Voice capabilities
  - [ ] Real-time transcription access
  - [ ] SMS capabilities
  - [ ] Phone numbers provisioned
- [ ] OpenAI API access (GPT-4)
- [ ] Monitoring service (Datadog/New Relic)
- [ ] Error tracking (Sentry)

### 2. Security Audit

- [ ] All secrets in environment variables
- [ ] Database RLS policies tested
- [ ] API rate limiting configured
- [ ] Webhook validation enabled
- [ ] CORS properly configured
- [ ] Security headers implemented

## Deployment Steps

### Step 1: Environment Configuration

Create production `.env` file:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://api.ethiq.ai

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_SMS_NUMBER=+1234567890

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Redis (for scaling)
REDIS_URL=redis://user:pass@host:6379

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
DATADOG_API_KEY=xxxxx

# Security
JWT_SECRET=generate-strong-secret
WEBHOOK_SECRET=generate-strong-secret
API_RATE_LIMIT=100
```

### Step 2: Database Migration

```bash
# Run migrations
npm run db:migrate:prod

# Verify RLS policies
npm run db:verify-security

# Create indexes for performance
psql $DATABASE_URL << EOF
CREATE INDEX idx_active_calls_user_id ON active_calls(user_id);
CREATE INDEX idx_transcription_events_call_id ON transcription_events(call_id);
CREATE INDEX idx_fraud_analyses_created_at ON fraud_analyses(created_at);
CREATE INDEX idx_alerts_fraud_analysis_id ON alerts(fraud_analysis_id);
EOF
```

### Step 3: Application Deployment

#### Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node healthcheck.js

# Run as non-root
USER node

EXPOSE 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - redis
    networks:
      - ethiq-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - ethiq-network

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - app
    networks:
      - ethiq-network

volumes:
  redis-data:

networks:
  ethiq-network:
```

#### Using AWS ECS

```json
{
  "family": "ethiq-fraud-detection",
  "taskRoleArn": "arn:aws:iam::xxx:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::xxx:role/ecsExecutionRole",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "ethiq-app",
      "image": "xxx.dkr.ecr.us-east-1.amazonaws.com/ethiq:latest",
      "memory": 2048,
      "cpu": 1024,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:xxx:secret:ethiq/db"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ethiq",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Step 4: Twilio Configuration

```javascript
// scripts/configure-twilio.js
const twilio = require('twilio');

async function configureTwilio() {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Update webhook URLs for all numbers
  const numbers = await client.incomingPhoneNumbers.list();
  
  for (const number of numbers) {
    await client.incomingPhoneNumbers(number.sid).update({
      voiceUrl: `${process.env.BASE_URL}/voice/incoming`,
      voiceMethod: 'POST',
      statusCallback: `${process.env.BASE_URL}/voice/status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log(`Updated ${number.phoneNumber}`);
  }

  // Configure IP access control
  await client.sip.ipAccessControlLists.create({
    friendlyName: 'Ethiq Production IPs',
    ipAccessControlListEntries: [
      { friendlyName: 'Production Server', ipAddress: process.env.SERVER_IP }
    ]
  });
}

configureTwilio().catch(console.error);
```

### Step 5: Security Hardening

#### Nginx Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.ethiq.ai;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Twilio webhook endpoints (no rate limit)
    location ~ ^/voice/(incoming|transcription|status) {
        proxy_pass http://app:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Twilio-Signature $http_x_twilio_signature;
    }

    # API endpoints (with rate limit)
    location /api/ {
        limit_req zone=api;
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Application Security

```javascript
// security/middleware.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Request validation
const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
```

## Monitoring Setup

### 1. Health Checks

```javascript
// healthcheck.js
app.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'checking',
    redis: 'checking',
    twilio: 'checking'
  };

  // Check database
  try {
    await supabase.from('users').select('count').limit(1);
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
  }

  // Check Redis
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    checks.redis = 'error';
  }

  // Check Twilio
  try {
    await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    checks.twilio = 'ok';
  } catch (error) {
    checks.twilio = 'error';
  }

  const allOk = Object.values(checks).every(status => status === 'ok');
  res.status(allOk ? 200 : 503).json(checks);
});
```

### 2. Logging Configuration

```javascript
// logging/winston.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'ethiq-fraud-detection',
    environment: process.env.NODE_ENV 
  },
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: { 
        node: process.env.ELASTICSEARCH_URL 
      },
      index: 'ethiq-logs'
    })
  ]
});

// Production console output
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 3. Metrics Collection

```javascript
// metrics/prometheus.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});

const activeCalls = new prometheus.Gauge({
  name: 'active_calls_total',
  help: 'Number of active calls'
});

const fraudDetections = new prometheus.Counter({
  name: 'fraud_detections_total',
  help: 'Total number of fraud detections',
  labelNames: ['fraud_type']
});

const transcriptionLatency = new prometheus.Histogram({
  name: 'transcription_latency_ms',
  help: 'Latency of transcription processing'
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS=30
S3_BUCKET="ethiq-backups"

# Create backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ethiq_${DATE}.sql"

# Dump database
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://${S3_BUCKET}/database/

# Clean old backups
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup
if [ $? -eq 0 ]; then
  echo "Backup successful: ${BACKUP_FILE}.gz"
  # Send success notification
  curl -X POST $SLACK_WEBHOOK -d '{"text":"Database backup completed successfully"}'
else
  echo "Backup failed!"
  # Send failure alert
  curl -X POST $PAGERDUTY_WEBHOOK -d '{"message":"Database backup failed","severity":"error"}'
fi
```

### Disaster Recovery Plan

1. **RPO (Recovery Point Objective)**: 1 hour
2. **RTO (Recovery Time Objective)**: 2 hours

#### Recovery Steps:

```bash
# 1. Restore database
gunzip < backup.sql.gz | psql $NEW_DATABASE_URL

# 2. Update DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://dns-failover.json

# 3. Update Twilio webhooks
npm run twilio:update-webhooks --url=$NEW_BASE_URL

# 4. Verify services
npm run health:check:all
```

## Maintenance Procedures

### Rolling Updates

```bash
#!/bin/bash
# rolling-update.sh

# For ECS
aws ecs update-service \
  --cluster ethiq-production \
  --service ethiq-app \
  --force-new-deployment

# For Kubernetes
kubectl set image deployment/ethiq-app \
  ethiq-app=ethiq:$NEW_VERSION \
  --record

# Monitor rollout
kubectl rollout status deployment/ethiq-app
```

### Database Maintenance

```sql
-- Weekly maintenance tasks
-- Run during low-traffic hours

-- Vacuum and analyze
VACUUM ANALYZE;

-- Update statistics
ANALYZE transcription_events;
ANALYZE fraud_analyses;

-- Clean old data (keep 90 days)
DELETE FROM transcription_events 
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM active_calls 
WHERE status = 'completed' 
AND ended_at < NOW() - INTERVAL '90 days';

-- Reindex for performance
REINDEX TABLE transcription_events;
REINDEX TABLE fraud_analyses;
```

## Troubleshooting

### Common Issues

#### High Latency in Fraud Detection

```bash
# Check metrics
curl localhost:3000/metrics | grep transcription_latency

# Check PostgreSQL locks
psql $DATABASE_URL -c "
SELECT pid, usename, pg_blocking_pids(pid) as blocked_by, query 
FROM pg_stat_activity 
WHERE pg_blocking_pids(pid)::text != '{}';
"

# Check Redis performance
redis-cli --latency
```

#### Twilio Webhook Failures

```javascript
// Add retry logic
const axios = require('axios').create({
  timeout: 5000,
  retry: 3,
  retryDelay: 1000
});

// Webhook with fallback
app.post('/voice/incoming', async (req, res) => {
  try {
    // Primary logic
    await handleIncomingCall(req, res);
  } catch (error) {
    // Fallback response
    logger.error('Webhook error', { error, body: req.body });
    res.send(`
      <Response>
        <Say>We're experiencing technical difficulties. Please try again.</Say>
        <Hangup/>
      </Response>
    `);
    
    // Queue for retry
    await redis.lpush('failed_webhooks', JSON.stringify({
      timestamp: Date.now(),
      body: req.body,
      error: error.message
    }));
  }
});
```

## Post-Deployment Verification

### Smoke Tests

```javascript
// smoke-tests.js
const assert = require('assert');

async function runSmokeTests() {
  console.log('Running smoke tests...');

  // Test 1: API Health
  const health = await fetch(`${BASE_URL}/health`);
  assert(health.ok, 'Health check failed');

  // Test 2: Database connectivity
  const { data } = await supabase.from('users').select('count');
  assert(data, 'Database query failed');

  // Test 3: Twilio connectivity
  const account = await twilioClient.api.accounts(ACCOUNT_SID).fetch();
  assert(account.status === 'active', 'Twilio account not active');

  // Test 4: Redis connectivity
  await redis.set('smoke_test', 'pass');
  const value = await redis.get('smoke_test');
  assert(value === 'pass', 'Redis test failed');

  console.log('✅ All smoke tests passed!');
}

runSmokeTests().catch(console.error);
```

### Load Testing

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  // Test webhook endpoint
  let webhook = http.post(
    `${__ENV.BASE_URL}/voice/transcription`,
    JSON.stringify({
      CallSid: 'CAtest123',
      TranscriptionText: 'This is a test transcript',
      SequenceNumber: '1',
      IsFinal: 'false'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(webhook, {
    'webhook status is 200': (r) => r.status === 200,
    'webhook response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## Compliance and Auditing

### GDPR Compliance

```javascript
// gdpr/data-export.js
async function exportUserData(userId) {
  const data = {};

  // Get all user data
  data.profile = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  data.calls = await supabase
    .from('active_calls')
    .select('*')
    .eq('user_id', userId);

  data.fraudAnalyses = await supabase
    .from('fraud_analyses')
    .select('*')
    .eq('call_id', data.calls.map(c => c.id));

  // Anonymize sensitive data
  data.calls = data.calls.map(call => ({
    ...call,
    caller_number: anonymizePhone(call.caller_number)
  }));

  return data;
}

// Data deletion
async function deleteUserData(userId) {
  // Delete in correct order (respecting foreign keys)
  await supabase.from('alerts').delete()
    .eq('fraud_analysis_id', /* subquery */);
  
  await supabase.from('fraud_analyses').delete()
    .eq('call_id', /* subquery */);
    
  await supabase.from('transcription_events').delete()
    .eq('call_id', /* subquery */);
    
  await supabase.from('active_calls').delete()
    .eq('user_id', userId);
    
  await supabase.from('emergency_contacts').delete()
    .eq('user_id', userId);
    
  await supabase.from('users').delete()
    .eq('id', userId);
}
```

## Final Checklist

- [ ] All environment variables set
- [ ] SSL certificates valid
- [ ] Twilio webhooks configured
- [ ] Database backed up
- [ ] Monitoring alerts configured
- [ ] Error tracking enabled
- [ ] Load testing passed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Team trained on procedures 