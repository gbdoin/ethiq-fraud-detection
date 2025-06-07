# Ethiq Fraud Detection - System Architecture

## Overview

The Ethiq fraud detection system uses call forwarding to monitor conversations while preserving STIR/SHAKEN authentication. This architecture provides transparent fraud protection without compromising caller verification or privacy.

## Core Architecture Principles

1. **STIR/SHAKEN Preservation**: Uses call forwarding instead of originating calls to maintain caller attestation
2. **Privacy by Design**: Only analyzes conversations after keyword detection
3. **Real-Time Processing**: Sub-10 second response time for fraud detection
4. **Scalable Multi-tenancy**: Isolated data and processing per user
5. **Fault Tolerance**: Graceful degradation if any component fails

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Original Caller                            │
│                  (Potential Scammer)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ STIR/SHAKEN Intact
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    User's Phone                               │
│              (Call Forwarding Enabled)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Forwards to
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 User's Twilio Number                          │
│                  (Unique per User)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Webhook + CallToken
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Server                             │
│    ┌─────────────────────────────────────────────────┐      │
│    │  • Receive webhook with CallToken               │      │
│    │  • Create conference with transcription         │      │
│    │  • Forward call using CallToken                 │      │
│    │  • Monitor transcripts in real-time            │      │
│    │  • Trigger fraud analysis when needed          │      │
│    └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    Supabase      │ │  Twilio Voice    │ │   OpenAI API     │
│   (Database)     │ │ (Transcription)  │ │ (Fraud Analysis) │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Call Flow Sequence

### 1. Call Initiation and Forwarding
```
Caller → User's Phone → Call Forwarding → Twilio Number
```
- Original caller dials user's real phone number
- User's carrier forwards the call to their Twilio number
- **STIR/SHAKEN Status**: Preserved through the forward

### 2. Webhook Processing
```javascript
POST /incoming-call
{
  CallToken: "TK123...",      // Preserves STIR/SHAKEN
  From: "+1234567890",         // Original caller
  To: "+1987654321",           // User's Twilio number
  StirVerstat: "TN-Validation-Passed-A"  // Attestation level
}
```

### 3. Conference Creation with Transcription
```xml
<Response>
  <Start>
    <Transcription 
      statusCallbackUrl="https://api.ethiq.ai/transcription"
      partialResults="true"
      language="en-US"
    />
  </Start>
  <Dial>
    <Conference>User-${userId}-${timestamp}</Conference>
  </Dial>
</Response>
```

### 4. Outbound Call with CallToken
```javascript
await twilioClient.calls.create({
  to: userRealPhoneNumber,
  from: userTwilioNumber,
  callToken: incomingCallToken,  // Preserves STIR/SHAKEN
  twiml: `<Response>
    <Dial>
      <Conference>User-${userId}-${timestamp}</Conference>
    </Dial>
  </Response>`
});
```

## Database Schema (Supabase)

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  twilio_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Emergency contacts
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  relationship TEXT,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Active calls
CREATE TABLE active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  call_sid TEXT UNIQUE NOT NULL,
  conference_name TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Transcription events
CREATE TABLE transcription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES active_calls(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_final BOOLEAN DEFAULT false,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fraud analysis results
CREATE TABLE fraud_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES active_calls(id) ON DELETE CASCADE,
  triggered_by_keywords TEXT[],
  full_transcript TEXT NOT NULL,
  llm_analysis JSONB NOT NULL,
  fraud_score FLOAT NOT NULL,
  fraud_detected BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts sent
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_analysis_id UUID REFERENCES fraud_analyses(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES emergency_contacts(id),
  alert_type TEXT NOT NULL, -- 'sms', 'call', 'app_notification'
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
```

### Real-time Triggers

```sql
-- Trigger for keyword monitoring
CREATE OR REPLACE FUNCTION check_transcript_keywords()
RETURNS TRIGGER AS $$
DECLARE
  keywords TEXT[] := ARRAY['social security', 'bank account', 'wire transfer', 
                           'gift card', 'IRS', 'arrest warrant', 'Medicare'];
  detected_keywords TEXT[];
BEGIN
  -- Check if transcript contains any keywords
  detected_keywords := ARRAY(
    SELECT keyword 
    FROM unnest(keywords) AS keyword 
    WHERE NEW.text ILIKE '%' || keyword || '%'
  );
  
  IF array_length(detected_keywords, 1) > 0 THEN
    -- Notify the monitoring service
    PERFORM pg_notify('keyword_detected', json_build_object(
      'call_id', NEW.call_id,
      'keywords', detected_keywords,
      'transcript_id', NEW.id
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_keyword_monitor
AFTER INSERT ON transcription_events
FOR EACH ROW EXECUTE FUNCTION check_transcript_keywords();
```

## Real-time Transcription Handling

### Webhook Endpoint
```javascript
app.post('/transcription', async (req, res) => {
  const { CallSid, SequenceNumber, TranscriptionText, IsFinal } = req.body;
  
  // Store in database
  await supabase.from('transcription_events').insert({
    call_id: await getCallIdBySid(CallSid),
    sequence_number: SequenceNumber,
    text: TranscriptionText,
    is_final: IsFinal === 'true'
  });
  
  res.sendStatus(200);
});
```

### Keyword Monitoring Service
```javascript
// Listen for PostgreSQL notifications
const client = new Client(postgresConfig);
await client.connect();
await client.query('LISTEN keyword_detected');

client.on('notification', async (msg) => {
  const { call_id, keywords } = JSON.parse(msg.payload);
  
  // Get full transcript
  const transcript = await getFullTranscript(call_id);
  
  // Analyze with LLM
  const analysis = await analyzeFraud(transcript, keywords);
  
  if (analysis.fraudDetected) {
    await triggerFraudResponse(call_id, analysis);
  }
});
```

## Fraud Analysis Pipeline

### 1. Transcript Aggregation
```javascript
async function getFullTranscript(callId) {
  const { data } = await supabase
    .from('transcription_events')
    .select('text, sequence_number')
    .eq('call_id', callId)
    .order('sequence_number');
    
  return data.map(e => e.text).join(' ');
}
```

### 2. LLM Analysis
```javascript
async function analyzeFraud(transcript, triggeredKeywords) {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: `You are a fraud detection expert. Analyze this phone conversation for potential scam attempts. 
                Keywords detected: ${triggeredKeywords.join(', ')}
                
                Return a JSON object with:
                - fraudScore: 0-100
                - fraudDetected: boolean
                - fraudType: string (if detected)
                - explanation: string
                - suggestedAction: string`
    }, {
      role: "user",
      content: transcript
    }],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### 3. Response Actions
```javascript
async function triggerFraudResponse(callId, analysis) {
  // Store analysis
  const { data: fraudAnalysis } = await supabase
    .from('fraud_analyses')
    .insert({
      call_id: callId,
      ...analysis
    })
    .select()
    .single();
    
  // Get user's emergency contacts
  const contacts = await getEmergencyContacts(callId);
  
  // Send alerts
  for (const contact of contacts) {
    await twilioClient.messages.create({
      to: contact.phone_number,
      from: TWILIO_ALERT_NUMBER,
      body: `FRAUD ALERT: ${analysis.fraudType} detected on call with ${callerNumber}. ${analysis.explanation}`
    });
  }
  
  // Optionally terminate call
  if (analysis.fraudScore > 90) {
    await terminateCall(callId);
  }
}
```

## Security Architecture

### Authentication & Authorization
- JWT tokens for API access
- Row-level security (RLS) in Supabase
- API key rotation every 90 days

### Data Protection
- All sensitive data encrypted at rest (AES-256)
- TLS 1.3 for all API communications
- PII redaction in logs

### Compliance
- GDPR compliant data handling
- Call recordings deleted after analysis
- Audit logs for all data access

## Scalability Considerations

### Horizontal Scaling
- Stateless Node.js servers behind load balancer
- Database connection pooling
- Redis for session management

### Performance Optimization
- Transcript caching for active calls
- Batch processing for non-critical alerts
- CDN for static assets

### Monitoring
- Real-time dashboards for call volume
- Alert latency metrics
- LLM response time tracking

## Failure Modes and Recovery

### Transcription Failure
- Fallback to post-call analysis
- User notification of degraded service

### LLM Service Outage
- Rule-based fallback detection
- Queue analysis for later processing

### Database Failure
- Read replicas for high availability
- Automatic failover
- Point-in-time recovery 