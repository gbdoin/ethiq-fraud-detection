# Ethiq Fraud Detection - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Ethiq fraud detection system with STIR/SHAKEN compliance, real-time transcription, and LLM-based analysis.

## Prerequisites

- Node.js 18+ with npm
- Supabase project with database access
- Twilio account with:
  - Voice capabilities enabled
  - At least one phone number
  - Access to Real-Time Transcription (Public Beta)
- OpenAI API key with GPT-4 access

## Phase 1: Database Setup

### 1.1 Initialize Supabase Schema

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE call_status AS ENUM ('active', 'completed', 'failed');
CREATE TYPE alert_type AS ENUM ('sms', 'call', 'app_notification');
CREATE TYPE alert_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
```

### 1.2 Create Core Tables

```sql
-- Users table with RLS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  twilio_number TEXT UNIQUE,
  twilio_number_sid TEXT UNIQUE,
  call_forwarding_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### 1.3 Set Up Real-time Monitoring

```sql
-- Function to monitor keywords in real-time
CREATE OR REPLACE FUNCTION monitor_fraud_keywords()
RETURNS TRIGGER AS $$
DECLARE
  fraud_keywords TEXT[] := ARRAY[
    'social security number',
    'bank account',
    'wire transfer',
    'gift card',
    'IRS',
    'arrest warrant',
    'Medicare',
    'refund',
    'virus on computer',
    'tech support',
    'verify your identity'
  ];
  detected TEXT[];
  should_analyze BOOLEAN := false;
BEGIN
  -- Only check if transcript has meaningful content
  IF length(NEW.text) > 10 THEN
    -- Check for keywords (case-insensitive)
    detected := ARRAY(
      SELECT keyword 
      FROM unnest(fraud_keywords) AS keyword 
      WHERE NEW.text ILIKE '%' || keyword || '%'
    );
    
    -- Also check for urgency patterns
    IF NEW.text ~* '(urgent|immediate|right now|today only|limited time|act now)' THEN
      should_analyze := true;
    END IF;
    
    -- If keywords found or urgency detected
    IF array_length(detected, 1) > 0 OR should_analyze THEN
      PERFORM pg_notify('fraud_analysis_needed', json_build_object(
        'call_id', NEW.call_id,
        'keywords', detected,
        'transcript_event_id', NEW.id,
        'urgency_detected', should_analyze
      )::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_fraud_keywords
AFTER INSERT ON transcription_events
FOR EACH ROW EXECUTE FUNCTION monitor_fraud_keywords();
```

## Phase 2: Server Implementation

### 2.1 Core Server Setup

```javascript
// server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { Client } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// PostgreSQL client for LISTEN/NOTIFY
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});
```

### 2.2 Implement Call Handling with CallToken

```javascript
// Incoming call webhook - preserves STIR/SHAKEN
app.post('/voice/incoming', async (req, res) => {
  const { 
    CallToken,      // Critical for STIR/SHAKEN
    From: callerNumber,
    To: twilioNumber,
    CallSid,
    StirVerstat     // STIR/SHAKEN status
  } = req.body;

  try {
    // Get user by Twilio number
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('twilio_number', twilioNumber)
      .single();

    if (!user || !user.call_forwarding_active) {
      return res.send('<Response><Reject/></Response>');
    }

    // Create conference name
    const conferenceName = `ethiq-${user.id}-${Date.now()}`;

    // Log active call
    const { data: activeCall } = await supabase
      .from('active_calls')
      .insert({
        user_id: user.id,
        call_sid: CallSid,
        conference_name: conferenceName,
        caller_number: callerNumber,
        stir_shaken_status: StirVerstat || 'unknown'
      })
      .select()
      .single();

    // Start real-time transcription
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Configure transcription
    const transcription = twiml.start().transcription({
      name: `transcript-${activeCall.id}`,
      statusCallbackUrl: `${process.env.BASE_URL}/voice/transcription`,
      statusCallbackMethod: 'POST',
      partialResults: true,
      language: 'en-US',
      speechModel: 'phone_call',
      profanityFilter: false
    });

    // Join conference
    const dial = twiml.dial();
    dial.conference(conferenceName, {
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
      beep: false
    });

    // Immediately forward the call with CallToken
    await forwardCallWithToken(user, callerNumber, conferenceName, CallToken);

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Call handling error:', error);
    res.send('<Response><Say>Sorry, an error occurred.</Say></Response>');
  }
});

// Forward call preserving STIR/SHAKEN
async function forwardCallWithToken(user, callerNumber, conferenceName, callToken) {
  try {
    await twilioClient.calls.create({
      to: user.phone_number,
      from: user.twilio_number,
      callToken: callToken,  // Preserves STIR/SHAKEN attestation
      twiml: `<Response>
        <Dial>
          <Conference beep="false">${conferenceName}</Conference>
        </Dial>
      </Response>`
    });
  } catch (error) {
    console.error('Call forwarding error:', error);
    // Log error but don't crash - caller is already in conference
  }
}
```

### 2.3 Handle Real-time Transcriptions

```javascript
// Transcription webhook
app.post('/voice/transcription', async (req, res) => {
  const {
    CallSid,
    TranscriptionSid,
    TranscriptionText,
    TranscriptionStatus,
    SequenceNumber,
    IsFinal
  } = req.body;

  try {
    // Get call ID from CallSid
    const { data: call } = await supabase
      .from('active_calls')
      .select('id')
      .eq('call_sid', CallSid)
      .single();

    if (call) {
      // Store transcription event
      await supabase.from('transcription_events').insert({
        call_id: call.id,
        sequence_number: parseInt(SequenceNumber),
        text: TranscriptionText,
        is_final: IsFinal === 'true',
        raw_event: req.body
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Transcription error:', error);
    res.sendStatus(500);
  }
});
```

### 2.4 Implement Fraud Detection Pipeline

```javascript
// Listen for PostgreSQL notifications
async function startFraudMonitoring() {
  await pgClient.connect();
  await pgClient.query('LISTEN fraud_analysis_needed');

  pgClient.on('notification', async (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      await analyzePotentialFraud(payload);
    } catch (error) {
      console.error('Fraud monitoring error:', error);
    }
  });
}

// Analyze potential fraud with LLM
async function analyzePotentialFraud(payload) {
  const { call_id, keywords, urgency_detected } = payload;

  // Get full transcript so far
  const { data: events } = await supabase
    .from('transcription_events')
    .select('text, sequence_number')
    .eq('call_id', call_id)
    .order('sequence_number');

  const transcript = events.map(e => e.text).join(' ');

  // Skip if transcript too short
  if (transcript.length < 100) return;

  // Call OpenAI for analysis
  const analysis = await analyzeWithLLM(transcript, keywords);

  // Store analysis
  const { data: fraudAnalysis } = await supabase
    .from('fraud_analyses')
    .insert({
      call_id,
      triggered_by_keywords: keywords,
      full_transcript: transcript,
      llm_analysis: analysis,
      fraud_score: analysis.fraudScore,
      fraud_detected: analysis.fraudDetected
    })
    .select()
    .single();

  // Take action if fraud detected
  if (analysis.fraudDetected && analysis.fraudScore > 70) {
    await handleFraudDetection(call_id, fraudAnalysis.id, analysis);
  }
}

// LLM Analysis
async function analyzeWithLLM(transcript, keywords) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: `You are a fraud detection expert analyzing phone conversations. 
        Detected keywords: ${keywords.join(', ')}
        
        Analyze for common scam patterns:
        - Urgency and pressure tactics
        - Requests for personal information
        - Payment demands (especially gift cards)
        - Impersonation (IRS, tech support, etc.)
        - Too-good-to-be-true offers
        
        Return JSON with:
        {
          "fraudScore": 0-100,
          "fraudDetected": boolean,
          "fraudType": "none|impersonation|financial|tech_support|other",
          "confidence": 0-100,
          "explanation": "detailed explanation",
          "evidenceQuotes": ["exact quotes from transcript"],
          "recommendedAction": "continue|warn|terminate"
        }`
      }, {
        role: 'user',
        content: `Analyze this conversation:\n\n${transcript}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.3
    })
  });

  return await response.json()
    .then(data => JSON.parse(data.choices[0].message.content));
}
```

### 2.5 Implement Fraud Response

```javascript
async function handleFraudDetection(callId, analysisId, analysis) {
  // Get call and user details
  const { data: call } = await supabase
    .from('active_calls')
    .select('*, users!inner(*)')
    .eq('id', callId)
    .single();

  const user = call.users;

  // Get emergency contacts
  const { data: contacts } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('priority');

  // Send alerts to emergency contacts
  for (const contact of contacts) {
    await sendEmergencyAlert(contact, call, analysis, analysisId);
  }

  // Play warning in conference if high confidence
  if (analysis.fraudScore > 85 && analysis.confidence > 80) {
    await playWarningInConference(call.conference_name, analysis);
  }

  // Log all actions
  await supabase.from('fraud_response_logs').insert({
    fraud_analysis_id: analysisId,
    actions_taken: {
      alerts_sent: contacts.length,
      warning_played: analysis.fraudScore > 85,
      call_terminated: false
    }
  });
}

// Send SMS alert
async function sendEmergencyAlert(contact, call, analysis, analysisId) {
  try {
    const message = await twilioClient.messages.create({
      to: contact.phone_number,
      from: process.env.TWILIO_SMS_NUMBER,
      body: `⚠️ FRAUD ALERT for ${call.users.name || 'your contact'}!\n\n` +
            `Type: ${analysis.fraudType}\n` +
            `Caller: ${call.caller_number}\n` +
            `Confidence: ${analysis.confidence}%\n\n` +
            `${analysis.explanation}\n\n` +
            `Call dashboard: ${process.env.DASHBOARD_URL}/alerts/${analysisId}`
    });

    await supabase.from('alerts').insert({
      fraud_analysis_id: analysisId,
      contact_id: contact.id,
      alert_type: 'sms',
      status: 'sent',
      sent_at: new Date(),
      external_id: message.sid
    });
  } catch (error) {
    console.error('Alert sending error:', error);
  }
}
```

## Phase 3: Security Implementation

### 3.1 API Authentication

```javascript
// JWT middleware
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Apply to protected routes
app.use('/api/*', authenticateUser);
```

### 3.2 Webhook Security

```javascript
// Validate Twilio webhooks
const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = `${process.env.BASE_URL}${req.originalUrl}`;
  
  if (twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    req.body
  )) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
};

// Apply to Twilio webhooks
app.use('/voice/*', validateTwilioRequest);
```

## Phase 4: Monitoring and Analytics

### 4.1 Real-time Metrics

```javascript
// Track key metrics
const metrics = {
  activeCalls: 0,
  fraudAlertsToday: 0,
  averageResponseTime: 0,
  transcriptionLatency: []
};

// Update metrics on events
pgClient.on('notification', async (msg) => {
  if (msg.channel === 'fraud_analysis_needed') {
    metrics.fraudAlertsToday++;
  }
});

// Expose metrics endpoint
app.get('/metrics', authenticateUser, (req, res) => {
  res.json({
    ...metrics,
    timestamp: new Date(),
    health: 'operational'
  });
});
```

### 4.2 Call Analytics

```sql
-- Create analytics views
CREATE VIEW daily_fraud_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_analyses,
  SUM(CASE WHEN fraud_detected THEN 1 ELSE 0 END) as frauds_detected,
  AVG(fraud_score) as avg_fraud_score,
  COUNT(DISTINCT call_id) as unique_calls
FROM fraud_analyses
GROUP BY DATE(created_at);

CREATE VIEW user_protection_stats AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT ac.id) as total_calls,
  COUNT(DISTINCT fa.id) as fraud_alerts,
  AVG(fa.fraud_score) as avg_risk_score
FROM users u
LEFT JOIN active_calls ac ON u.id = ac.user_id
LEFT JOIN fraud_analyses fa ON ac.id = fa.call_id
GROUP BY u.id, u.email;
```

## Phase 5: Testing

### 5.1 Test Call Flow

```javascript
// Test endpoint for development
app.post('/test/simulate-fraud-call', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).send('Not available in production');
  }

  const { phoneNumber, scenario } = req.body;

  // Scenarios with test scripts
  const scenarios = {
    irs_scam: "This is the IRS. You owe $5,000 in back taxes. You must pay immediately with gift cards or face arrest.",
    tech_support: "This is Microsoft. Your computer has a virus. Give me remote access to fix it.",
    medicare: "Your Medicare benefits are expiring. Provide your social security number to keep coverage."
  };

  // Make test call
  const call = await twilioClient.calls.create({
    to: phoneNumber,
    from: process.env.TWILIO_TEST_NUMBER,
    twiml: `<Response>
      <Say>${scenarios[scenario]}</Say>
      <Pause length="5"/>
      <Hangup/>
    </Response>`
  });

  res.json({ 
    message: 'Test call initiated',
    callSid: call.sid 
  });
});
```

## Best Practices

### Performance Optimization
1. **Batch database operations** where possible
2. **Cache user data** in Redis for active calls
3. **Use connection pooling** for database connections
4. **Implement circuit breakers** for external APIs

### Security Hardening
1. **Rate limit** all API endpoints
2. **Sanitize** all user inputs
3. **Encrypt** sensitive data at rest
4. **Audit log** all data access

### Monitoring
1. **Set up alerts** for high fraud scores
2. **Monitor API latency** for all external calls
3. **Track transcription accuracy** metrics
4. **Review false positive rates** weekly

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Twilio webhooks configured
- [ ] Rate limiting enabled
- [ ] Monitoring dashboards set up
- [ ] Emergency contact tested
- [ ] Fraud detection tested
- [ ] STIR/SHAKEN validation confirmed
- [ ] Load testing completed 