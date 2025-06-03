# Guide d'automatisation - Ethiq Multitenant

## Vue d'ensemble

Ce document détaille les processus qui peuvent être automatisés versus ceux nécessitant une intervention manuelle dans le déploiement de la solution Ethiq multitenant.

## Processus entièrement automatisables

### 1. Création de compte utilisateur

#### Ce que l'AI/système peut faire automatiquement:

**Étape 1: Provisioning Twilio**
```javascript
// Pseudo-code
async function provisionTwilioNumber(userLocation) {
  // 1. Rechercher numéros disponibles selon la localisation
  const availableNumbers = await twilioClient.availablePhoneNumbers
    .list({
      nearLatLong: userLocation,
      capabilities: ['voice', 'sms']
    });
  
  // 2. Acheter le premier numéro disponible
  const phoneNumber = await twilioClient.incomingPhoneNumbers
    .create({
      phoneNumber: availableNumbers[0].phoneNumber,
      voiceUrl: `${API_URL}/webhook/voice`,
      smsUrl: `${API_URL}/webhook/sms`
    });
  
  return phoneNumber;
}
```

**Étape 2: Configuration SIP**
```javascript
async function createSipEndpoint(userId) {
  // Générer adresse SIP unique
  const sipAddress = `user_${userId}@ethiq.sip.twilio.com`;
  
  // Créer credential SIP
  const credential = await twilioClient.sip.credentialLists
    .create({friendlyName: `User_${userId}`})
    .credentials
    .create({
      username: sipAddress,
      password: generateSecurePassword()
    });
  
  return { sipAddress, credential };
}
```

**Étape 3: Configuration base de données**
```sql
-- Automatiquement exécuté lors de l'inscription
INSERT INTO users (email, password_hash, first_name, last_name)
VALUES ($1, $2, $3, $4)
RETURNING id;

INSERT INTO accounts (user_id, twilio_phone_number, sip_address, status)
VALUES ($1, $2, $3, 'active');
```

### 2. Déploiement infrastructure

#### Via GitHub Actions + MCP:
```yaml
# .github/workflows/deploy.yml
name: Deploy Multitenant Infrastructure
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Supabase Functions
        run: supabase functions deploy
      
      - name: Deploy Backend to Railway
        run: railway up
      
      - name: Deploy Frontend to Vercel
        run: vercel --prod
```

### 3. Monitoring et alertes

- Configuration automatique des webhooks de monitoring
- Alertes automatiques en cas de:
  - Dépassement de quotas
  - Erreurs système
  - Tentatives de fraude détectées

### 4. Gestion des appels

- Routage automatique basé sur le numéro appelé
- Transcription en temps réel
- Analyse IA et détection de fraude
- Envoi d'alertes SMS
- Logging des appels

## Processus nécessitant une intervention utilisateur

### 1. Configuration du renvoi d'appel

**Ce que l'utilisateur DOIT faire manuellement:**

#### Sur iPhone:
1. Ouvrir Réglages
2. Aller dans Téléphone > Renvoi d'appel
3. Activer le renvoi d'appel
4. Entrer le numéro Twilio fourni

#### Sur Android:
1. Ouvrir l'app Téléphone
2. Menu (3 points) > Paramètres
3. Appels > Renvoi d'appel
4. Configurer "Toujours transférer" avec le numéro Twilio

**Pourquoi c'est manuel:** Les APIs iOS/Android ne permettent pas de modifier ces paramètres programmatiquement pour des raisons de sécurité.

### 2. Vérification d'identité (KYC)

Pour des raisons légales et de conformité:
- Upload de pièce d'identité
- Vérification d'adresse
- Acceptation des conditions d'utilisation

### 3. Configuration des contacts d'urgence

L'utilisateur doit:
- Ajouter manuellement les numéros de ses proches
- Obtenir leur consentement pour recevoir des alertes
- Définir l'ordre de priorité

### 4. Paiement et facturation

- Ajout des informations de carte bancaire
- Choix du plan d'abonnement
- Validation des paiements récurrents

## Automatisation via CLI (pour développeurs)

### Scripts disponibles:

```bash
# Créer un nouveau tenant
npm run create-tenant -- --email user@example.com --region CA-QC

# Déployer l'infrastructure complète
npm run deploy-all

# Migrer la base de données
npm run migrate:latest

# Générer les types TypeScript depuis Supabase
npm run generate-types
```

### Commandes Twilio CLI:

```bash
# Lister les numéros disponibles
twilio phone-numbers:list --country-code CA

# Configurer un webhook
twilio phone-numbers:update +1234567890 \
  --voice-url https://api.ethiq.app/webhook/voice

# Créer un trunk SIP
twilio api:trunking:v1:trunks:create \
  --friendly-name "Ethiq Production"
```

## Workflow d'onboarding optimisé

### Ce que le système fait:
1. ✅ Crée le compte utilisateur
2. ✅ Provisionne le numéro Twilio
3. ✅ Configure l'adresse SIP
4. ✅ Envoie email de bienvenue avec instructions

### Ce que l'utilisateur fait:
1. 👤 Configure le renvoi d'appel sur son téléphone
2. 👤 Ajoute ses contacts d'urgence
3. 👤 Teste le système avec un appel test
4. 👤 Configure ses préférences

## Outils d'automatisation recommandés

### Pour le développement:
- **Terraform**: Infrastructure as Code
- **Ansible**: Configuration management
- **Docker Compose**: Environnement local

### Pour la production:
- **GitHub Actions**: CI/CD
- **Dependabot**: Mise à jour des dépendances
- **Sentry**: Error tracking automatique

## Métriques d'automatisation

### KPIs à suivre:
- Temps moyen de provisioning: < 30 secondes
- Taux de succès d'onboarding: > 95%
- Interventions manuelles requises: < 5%
- Temps de résolution des incidents: < 1 heure

## Limitations et considérations

### Limitations techniques:
- Les APIs des opérateurs télécom sont limitées
- Certaines configurations iOS/Android sont protégées
- Les limites de rate des APIs externes

### Considérations légales:
- RGPD/Privacy: certaines actions nécessitent un consentement explicite
- KYC/AML: vérification d'identité obligatoire
- Enregistrement des appels: réglementations locales

## Roadmap d'automatisation future

### Court terme (3 mois):
- [ ] Auto-scaling des serveurs WebSocket
- [ ] Provisioning automatique de certificats SSL
- [ ] Backup automatique des données

### Moyen terme (6 mois):
- [ ] ML pour améliorer la détection de fraude
- [ ] Chatbot pour support niveau 1
- [ ] A/B testing automatique

### Long terme (12 mois):
- [ ] Provisioning cross-platform (AWS, GCP, Azure)
- [ ] Disaster recovery automatique
- [ ] Conformité automatique multi-juridictions 