# Ethiq Fraud Detection - Solution Multitenant

## 🛡️ À propos

Ethiq est une solution de détection de fraude téléphonique en temps réel qui protège les utilisateurs contre les tentatives d'escroquerie. Le système analyse les conversations téléphoniques et alerte automatiquement l'utilisateur et ses proches en cas de détection de comportement frauduleux.

## 🚀 Fonctionnalités principales

- **Détection en temps réel** : Analyse des appels via IA pour détecter les tentatives de fraude
- **Alertes automatiques** : SMS envoyés aux contacts d'urgence
- **Architecture multitenant** : Support de plusieurs clients sur la même infrastructure
- **Provisioning automatique** : Configuration automatique des ressources Twilio et SIP
- **Interface utilisateur** : Dashboard pour gérer les contacts et consulter l'historique

## 📚 Documentation

Consultez la documentation complète dans le dossier [`/docs`](./docs/):
- [Architecture technique](./docs/ARCHITECTURE.md)
- [Plan d'implémentation](./docs/IMPLEMENTATION_PLAN.md)
- [Guide d'automatisation](./docs/AUTOMATION_GUIDE.md)
- [Configuration des services](./docs/SERVICES_SETUP.md)

## 🏗️ Architecture

```
Client → Renvoi d'appel → Twilio → WebSocket Server → Google Speech → OpenAI → Alertes
                                          ↓
                                      Supabase DB
```

## 🛠️ Technologies utilisées

- **Backend**: Node.js, Express, WebSocket
- **Base de données**: Supabase (PostgreSQL)
- **Téléphonie**: Twilio (Voice, SMS, SIP)
- **IA**: Google Cloud Speech-to-Text, OpenAI GPT-4
- **Frontend**: Next.js, Tailwind CSS (à venir)

## 📋 Prérequis

- Node.js 18+
- Compte Twilio
- Compte Google Cloud avec Speech-to-Text API activée
- Compte OpenAI
- Compte Supabase

## 🚀 Installation rapide

1. **Cloner le repository**
   ```bash
   git clone https://github.com/gbdoin/ethiq-fraud-detection.git
   cd ethiq-fraud-detection
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer l'environnement**
   ```bash
   cp .env.example .env
   # Éditer .env avec vos credentials
   ```

4. **Démarrer le serveur**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

Voir le guide complet dans [docs/SERVICES_SETUP.md](./docs/SERVICES_SETUP.md)

### Variables d'environnement essentielles:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxx.supabase.co
```

## 📱 Utilisation

### Pour l'utilisateur final:
1. Créer un compte sur la plateforme
2. Configurer le renvoi d'appel vers le numéro Twilio fourni
3. Ajouter les contacts d'urgence
4. Le système protège automatiquement tous les appels

### Pour les développeurs:
Consultez la [documentation technique](./docs/) pour comprendre l'architecture et contribuer au projet.

## 🗺️ Roadmap

- [x] Architecture multitenant
- [x] Documentation complète
- [ ] API REST complète
- [ ] Interface web (Next.js)
- [ ] Application mobile
- [ ] Support multilingue
- [ ] Analytics avancées

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez consulter notre guide de contribution avant de soumettre une PR.

## 📄 Licence

Ce projet est sous licence propriétaire. Contactez Ethiq pour plus d'informations.

## 📞 Contact

Pour toute question ou demande de démonstration, contactez l'équipe Ethiq.

---

Développé avec ❤️ par l'équipe Ethiq
