# Configuration des services externes - Ethiq

## Services requis

1. **Twilio** - Téléphonie et SMS
2. **Google Cloud** - Speech-to-Text
3. **OpenAI** - Analyse IA
4. **Supabase** - Base de données et authentification
5. **Vercel** - Hébergement frontend (optionnel)
6. **Railway/Render** - Hébergement backend (optionnel)

## 1. Configuration Twilio

### Étapes de configuration:

#### 1.1 Création du compte
1. Aller sur [twilio.com](https://www.twilio.com)
2. Créer un compte (essai gratuit disponible)
3. Vérifier le numéro de téléphone et email

#### 1.2 Récupération des credentials
```bash
# Dans la console Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 1.3 Achat d'un numéro
```bash
# Via Twilio CLI
twilio phone-numbers:buy:local --country-code CA --area-code 514

# Ou via l'interface web
# Console > Phone Numbers > Buy a Number
```

#### 1.4 Configuration SIP (Elastic SIP Trunking)
1. Console Twilio > Elastic SIP Trunking
2. Create new SIP Trunk
3. Configuration:
   ```
   Friendly Name: Ethiq Production
   Termination URI: sip:ethiq.pstn.twilio.com
   ```

#### 1.5 Webhooks de base
```javascript
// Configuration programmatique
const phoneNumber = await twilioClient.incomingPhoneNumbers('PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
  .update({
    voiceUrl: 'https://api.ethiq.app/webhook/voice',
    voiceMethod: 'POST',
    smsUrl: 'https://api.ethiq.app/webhook/sms',
    smsMethod: 'POST'
  });
```

### Coûts estimés:
- Numéro de téléphone: ~1-3$ USD/mois
- Appels entrants: ~0.0085$ USD/minute
- SMS sortants: ~0.0075$ USD/message
- SIP: ~0.001$ USD/minute

## 2. Configuration Google Cloud Speech

### Étapes de configuration:

#### 2.1 Création du projet
1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer un nouveau projet: "ethiq-fraud-detection"
3. Activer l'API Speech-to-Text

#### 2.2 Création du compte de service
```bash
# Via gcloud CLI
gcloud iam service-accounts create ethiq-speech \
  --display-name="Ethiq Speech Service"

gcloud projects add-iam-policy-binding ethiq-fraud-detection \
  --member="serviceAccount:ethiq-speech@ethiq-fraud-detection.iam.gserviceaccount.com" \
  --role="roles/speech.client"

# Télécharger la clé
gcloud iam service-accounts keys create ./credentials.json \
  --iam-account=ethiq-speech@ethiq-fraud-detection.iam.gserviceaccount.com
```

#### 2.3 Configuration dans l'application
```javascript
// Dans le code
process.env.GOOGLE_APPLICATION_CREDENTIALS = "./credentials.json";

// Ou via variable d'environnement
export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
```

### Coûts estimés:
- 0-60 minutes/mois: Gratuit
- Au-delà: ~0.006$ USD/15 secondes
- Modèle amélioré: ~0.009$ USD/15 secondes

## 3. Configuration OpenAI

### Étapes de configuration:

#### 3.1 Création du compte
1. Aller sur [platform.openai.com](https://platform.openai.com)
2. Créer un compte
3. Ajouter une méthode de paiement

#### 3.2 Génération de la clé API
```bash
# Dans le dashboard OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3.3 Configuration des limites
- Définir un budget mensuel
- Configurer des alertes de dépassement
- Rate limiting: 3500 requêtes/minute pour GPT-4

### Coûts estimés:
- GPT-4o-mini: ~0.15$ / 1M tokens input, 0.60$ / 1M tokens output
- GPT-4: ~30$ / 1M tokens input, 60$ / 1M tokens output

## 4. Configuration Supabase

### Étapes de configuration:

#### 4.1 Création du projet
```bash
# Via Supabase CLI
supabase projects create ethiq-production --org-id your-org-id --region ca-central-1

# Ou via l'interface web
# app.supabase.com > New Project
```

#### 4.2 Configuration de la base de données
```sql
-- Exécuter les migrations
supabase db push

-- Ou manuellement dans SQL Editor
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  -- ... autres colonnes
);
```

#### 4.3 Configuration RLS (Row Level Security)
```sql
-- Exemple de politique RLS
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
```

#### 4.4 Variables d'environnement
```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

*Nouveau*:
### 4.5 Gestion des Configurations des Services pour Multitenancy

Avec une architecture multitenant, `serveur.cjs` ne s'appuiera pas uniquement sur des variables d'environnement globales pour les configurations des services externes spécifiques aux opérations des tenants (comme les identifiants API Twilio d'un tenant, le numéro de téléphone Twilio du tenant, l'adresse SIP du tenant, ou les contacts d'urgence).

- **Supabase comme source de vérité**: La base de données Supabase stockera ces configurations spécifiques à chaque tenant. Par exemple, dans la table `accounts` (ou une table de configuration liée), on trouvera :
    - `tenant_twilio_account_sid` (si chaque tenant a son propre sous-compte ou si Ethiq gère cela)
    - `tenant_twilio_auth_token`
    - `tenant_twilio_phone_number` (le numéro Twilio provisionné pour ce tenant)
    - `tenant_sip_address`
    - `tenant_emergency_contact_phone`
    - Potentiellement, des configurations spécifiques pour Google Cloud Speech par tenant (ex: modèle de langue préféré, clés API si le tenant fournit les siennes).

- **Accès par `serveur.cjs`**:
    - `serveur.cjs` utilisera ses propres variables d'environnement Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) pour se connecter à la base de données.
    - Lors du traitement d'un appel ou d'une session WebSocket pour un tenant identifié, `serveur.cjs` interrogera Supabase pour récupérer les configurations spécifiques à ce tenant.
    - Les clients des services (Twilio, Google Cloud Speech) seront ensuite instanciés dynamiquement avec ces configurations récupérées.

- **Variables d'environnement globales vs. spécifiques au tenant**:
    - Les variables d'environnement globales pour Twilio (ex: `TWILIO_ACCOUNT_SID` dans le `.env` de `serveur.cjs`) pourraient représenter un compte maître Ethiq utilisé pour la gestion administrative des numéros ou comme solution de repli, mais les opérations directes pour le compte d'un tenant (envoyer un SMS depuis *son* numéro, utiliser *ses* crédits) utiliseront les configurations du tenant stockées dans Supabase.
    - De même pour `GOOGLE_APPLICATION_CREDENTIALS`, cela pourrait pointer vers un compte de service central Ethiq, mais la journalisation et potentiellement certaines configurations pourraient être adaptées par tenant.

Cette approche assure une meilleure isolation, flexibilité et permet une gestion plus fine des ressources et des coûts par tenant.

### Coûts estimés:
- Plan gratuit: 500MB DB, 2GB bandwidth, 50K requêtes auth
- Plan Pro: 25$/mois/projet

## 5. Variables d'environnement complètes

### Fichier `.env.example`:
```bash
# Twilio (Peuvent être pour un compte maître Ethiq ou comme valeurs par défaut si non surchargées par tenant depuis DB)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15141234567 # Numéro de fallback ou principal pour l'application, pas nécessairement celui utilisé pour les tenants

# Google Cloud (Pour le compte de service principal de l'application)
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-cloud.json
GOOGLE_CLOUD_PROJECT_ID=ethiq-fraud-detection

# OpenAI (Clé API centrale pour l'application)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (Essentiel pour que serveur.cjs accède à toutes les configurations, y compris celles des tenants)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Clé publique pour le frontend si nécessaire
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Clé de service pour le backend (serveur.cjs)

# Application
NODE_ENV=production
PORT=8080
API_URL=https://api.ethiq.app
FRONTEND_URL=https://app.ethiq.app

# Redis (optionnel)
REDIS_URL=redis://localhost:6379

# Monitoring (optionnel)
SENTRY_DSN=https://xxxxxx@sentry.io/xxxxxx
DATADOG_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 6. Scripts de vérification

### Script de test des services:
```javascript
// test-services.js
const checkServices = async () => {
  console.log('🔍 Vérification des services...\n');

  // Test Twilio
  try {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const account = await twilio.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('✅ Twilio: Connecté -', account.friendlyName);
  } catch (error) {
    console.error('❌ Twilio:', error.message);
  }

  // Test Google Cloud
  try {
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    const projectId = await client.getProjectId();
    console.log('✅ Google Cloud: Connecté - Project:', projectId);
  } catch (error) {
    console.error('❌ Google Cloud:', error.message);
  }

  // Test OpenAI
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI();
    const models = await openai.models.list();
    console.log('✅ OpenAI: Connecté -', models.data.length, 'modèles disponibles');
  } catch (error) {
    console.error('❌ OpenAI:', error.message);
  }

  // Test Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const { data, error } = await supabase.from('users').select('count').single();
    if (error) throw error;
    console.log('✅ Supabase: Connecté');
  } catch (error) {
    console.error('❌ Supabase:', error.message);
  }
};

checkServices();
```

## 7. Checklist de déploiement

### Avant le déploiement:
- [ ] Tous les comptes de services créés
- [ ] Toutes les clés API générées
- [ ] Variables d'environnement configurées
- [ ] Limites et budgets définis
- [ ] Webhooks Twilio configurés
- [ ] Base de données migrée
- [ ] RLS activé sur Supabase
- [ ] Tests de connectivité passés

### Monitoring post-déploiement:
- [ ] Vérifier les logs Twilio
- [ ] Monitorer l'usage Google Cloud
- [ ] Suivre les coûts OpenAI
- [ ] Vérifier les métriques Supabase
- [ ] Tester un appel de bout en bout

## 8. Troubleshooting commun

### Erreur Twilio "Invalid Phone Number":
```bash
# Vérifier le format
# Doit être E.164: +15141234567
```

### Erreur Google Cloud "Permission Denied":
```bash
# Vérifier les permissions
gcloud projects get-iam-policy ethiq-fraud-detection
```

### Erreur OpenAI "Rate Limit":
```javascript
// Implémenter retry avec backoff
const retryWithBackoff = async (fn, retries = 3) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      return retryWithBackoff(fn, retries - 1);
    }
    throw error;
  }
};
``` 