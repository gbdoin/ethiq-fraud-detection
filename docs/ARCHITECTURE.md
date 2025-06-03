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
│                          │    │  (serveur.cjs)           │
└──────────────────────────┘    └──────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        Base de données                        │
│         (Supabase - Gère aussi les configurations tenant)     │
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
   - L'appel arrive sur un numéro Twilio assigné à un tenant (client).
   - Twilio déclenche le webhook configuré vers `serveur.cjs`.

2. **Identification du tenant et Récupération de la Configuration**
   - `serveur.cjs` identifie le tenant (ex: via le numéro Twilio unique sur lequel l'appel a été reçu, mappé au tenant dans Supabase).
   - Les informations et configurations spécifiques au tenant (identifiants Twilio, numéros de contact d'urgence, adresses SIP, préférences d'alerte, etc.) sont récupérées depuis Supabase.

3. **Démarrage de la Conférence et du Stream WebSocket**
   - Une conférence Twilio est créée, potentiellement avec un nom identifiant le tenant (ex: `Conf-${tenantId}-${callerNumber}`).
   - `serveur.cjs` initie la connexion WebSocket vers le client Twilio (via la TwiML `<Stream>`).
   - *Nouveau*: La connexion WebSocket établie par Twilio vers `serveur.cjs` est authentifiée (ex: via un token JWT propre au tenant, préalablement généré et stocké, ou via un identifiant de session sécurisé) pour associer la session WebSocket au bon tenant.

4. **Traitement Personnalisé de l'Appel**
   - Le client Google Cloud Speech est instancié dynamiquement, utilisant les configurations/identifiants appropriés (soit centraux, soit spécifiques au tenant si applicable, récupérés de Supabase).
   - Le flux audio est traité par `serveur.cjs`. L'état de la session (ex: `recognizeStream`, `streamActive`, `alertSent`) est géré de manière isolée pour cette connexion/ce tenant.
   - En cas de détection de fraude (basée sur les mots-clés et l'analyse IA):
     - La fonction `triggerFraudAlert` est appelée avec le contexte du tenant.
     - L'alerte SMS est envoyée au contact d'urgence du tenant (récupéré de Supabase).
     - L'annonce est jouée dans la conférence Twilio spécifique au tenant.
   - Si l'appel doit être transféré, la fonction `addSipToConference` utilise l'adresse SIP et le `callerId` (numéro Twilio du tenant) spécifiques au tenant, récupérés de Supabase.

### 4. Isolation des données

- **Row Level Security (RLS)** dans Supabase pour garantir l'isolation des données stockées (comptes, logs d'appels, contacts, etc.). Chaque requête à la base de données depuis `serveur.cjs` ou l'API de management s'exécute dans le contexte du tenant approprié.
- *Nouveau*: L'état des sessions WebSocket actives dans `serveur.cjs` (incluant les flux de reconnaissance vocale et les indicateurs d'état) est strictement isolé par tenant. Chaque instance `ws` (connexion WebSocket) maintient son propre contexte et ses propres ressources.
- Les WebSockets sont isolés par session/client. *(Note: Répétition partielle, le point précédent est plus spécifique)*

### 5. Services externes

#### Twilio
- Pool de numéros disponibles par région (géré par Ethiq ou le tenant).
- Attribution lors de la création de compte.
- Configuration des webhooks par numéro pour pointer vers `serveur.cjs`.
- *Nouveau*: `serveur.cjs` utilise les identifiants d'API Twilio (Account SID, Auth Token) spécifiques au tenant, ou mappés au tenant, récupérés de Supabase pour toutes les opérations API (création d'appel, modification de conférence, envoi de SMS). Le `TWILIO_PHONE_NUMBER` utilisé est celui du tenant.

#### Google Cloud Speech
- Compte de service unique avec quotas ou potentiellement des configurations par tenant si nécessaire pour une facturation/gestion plus fine.
- *Nouveau*: `serveur.cjs` instancie le client Speech-to-Text. Si des configurations spécifiques au tenant sont utilisées (ex: modèle de langue personnalisé, clés API distinctes), celles-ci sont chargées depuis Supabase. La journalisation des appels API vers Google Cloud inclura des identifiants de tenant pour le suivi.
- Facturation trackée par tenant (si possible via les mécanismes de Google Cloud ou par estimation interne basée sur l'usage).

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