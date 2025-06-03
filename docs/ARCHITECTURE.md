# Ethiq Fraud Detection - Architecture Multitenant

## Vue d'ensemble

Ce document décrit l'architecture pour transformer l'application Ethiq de détection de fraude téléphonique en une solution SaaS multitenant. L'objectif est de permettre à plusieurs clients d'utiliser la même infrastructure tout en maintenant l'isolation des données et la personnalisation par client.

## Architecture actuelle (Single-tenant)

L'application actuelle fonctionne avec:
- Un serveur Node.js unique
- Un numéro Twilio unique
- Une adresse SIP unique
- Configuration codée en dur dans le serveur

## Architecture cible (Multitenant)

### 1. Composants principaux

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Web/Mobile                    │
│                    (Interface utilisateur)                    │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Gateway                           │
│                    (Auth & Routing)                           │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│    API Management        │    │   Serveur WebSocket      │
│  (Gestion des comptes)   │    │  (Traitement d'appels)   │
└──────────────────────────┘    └──────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        Base de données                        │
│                         (Supabase)                            │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Twilio      │  │  Google Cloud   │  │     OpenAI      │
│   (Téléphonie)  │  │    Speech       │  │  (Analyse IA)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 2. Base de données (Supabase)

#### Tables principales:

**users**
```sql
- id (UUID, PK)
- email (TEXT, UNIQUE)
- password_hash (TEXT)
- first_name (TEXT)
- last_name (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**accounts**
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- twilio_phone_number (TEXT, UNIQUE)
- sip_address (TEXT, UNIQUE)
- status (ENUM: 'active', 'suspended', 'cancelled')
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**emergency_contacts**
```sql
- id (UUID, PK)
- account_id (UUID, FK -> accounts.id)
- name (TEXT)
- phone_number (TEXT)
- relationship (TEXT)
- created_at (TIMESTAMP)
```

**call_logs**
```sql
- id (UUID, PK)
- account_id (UUID, FK -> accounts.id)
- call_sid (TEXT, UNIQUE)
- caller_number (TEXT)
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- fraud_detected (BOOLEAN)
- transcript (TEXT)
- ai_analysis (JSONB)
```

**alerts**
```sql
- id (UUID, PK)
- call_log_id (UUID, FK -> call_logs.id)
- alert_type (ENUM: 'sms', 'conference_announcement')
- sent_at (TIMESTAMP)
- status (TEXT)
```

### 3. Flux d'appel multitenant

1. **Réception d'appel**
   - L'appel arrive sur un numéro Twilio assigné à un client
   - Twilio déclenche le webhook vers notre serveur

2. **Identification du tenant**
   - Le serveur identifie le client via le numéro Twilio appelé
   - Récupération des informations du compte depuis la base de données

3. **Traitement personnalisé**
   - Configuration des paramètres spécifiques au client
   - Démarrage du stream WebSocket avec contexte client
   - Analyse et alertes selon les préférences du client

### 4. Isolation des données

- **Row Level Security (RLS)** dans Supabase pour garantir l'isolation
- Chaque requête inclut le contexte du tenant
- Les WebSockets sont isolés par session/client

### 5. Services externes

#### Twilio
- Pool de numéros disponibles par région
- Attribution automatique lors de la création de compte
- Configuration des webhooks par numéro

#### Google Cloud Speech
- Compte de service unique avec quotas
- Facturation trackée par tenant

#### OpenAI
- Clé API unique
- Logs des requêtes par tenant pour facturation

## Considérations de sécurité

1. **Authentification**
   - JWT tokens pour l'API
   - Session management
   - 2FA optionnel

2. **Autorisation**
   - RBAC (Role-Based Access Control)
   - Permissions granulaires

3. **Chiffrement**
   - HTTPS/WSS obligatoire
   - Chiffrement des données sensibles en base

4. **Audit**
   - Logs de toutes les actions
   - Traçabilité complète des appels

## Scalabilité

1. **Horizontal scaling**
   - Serveurs WebSocket en cluster
   - Load balancing

2. **Caching**
   - Redis pour les sessions
   - Cache des configurations client

3. **Queue management**
   - Bull/BullMQ pour les tâches asynchrones
   - Retry logic pour les services externes 