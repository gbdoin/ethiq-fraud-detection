# Documentation Ethiq - Solution de détection de fraude multitenant

## Vue d'ensemble

Cette documentation décrit la transformation de l'application Ethiq de détection de fraude téléphonique d'une solution single-tenant vers une architecture SaaS multitenant scalable.

## Objectif

Permettre à plusieurs clients d'utiliser la même infrastructure tout en:
- Maintenant l'isolation complète des données
- Automatisant le provisioning des ressources
- Minimisant les interventions manuelles
- Optimisant les coûts d'infrastructure

## Documentation disponible

### 📐 [Architecture](./ARCHITECTURE.md)
Description détaillée de l'architecture multitenant incluant:
- Diagrammes des composants
- Schéma de base de données
- Flux de traitement des appels
- Considérations de sécurité

### 📋 [Plan d'implémentation](./IMPLEMENTATION_PLAN.md)
Plan détaillé par phases avec:
- Tâches prioritaires pour le MVP
- Estimations de temps
- Technologies recommandées
- Gestion des risques

### 🤖 [Guide d'automatisation](./AUTOMATION_GUIDE.md)
Détails sur:
- Processus entièrement automatisables
- Actions nécessitant une intervention utilisateur
- Scripts et outils CLI disponibles
- Métriques d'automatisation

### 🔧 [Configuration des services](./SERVICES_SETUP.md)
Instructions complètes pour configurer:
- Twilio (téléphonie et SMS)
- Google Cloud Speech (transcription)
- OpenAI (analyse IA)
- Supabase (base de données)
- Services d'hébergement

## Quick Start

### Pour commencer le développement:

1. **Cloner le repository**
   ```bash
   git clone https://github.com/gbdoin/ethiq-fraud-detection.git
   cd ethiq-fraud-detection
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les services externes**
   - Suivre le guide [SERVICES_SETUP.md](./SERVICES_SETUP.md)
   - Copier `.env.example` vers `.env`
   - Remplir toutes les variables

4. **Démarrer le développement**
   ```bash
   npm run dev
   ```

## Workflow de développement recommandé

### Phase 1: Infrastructure (Priorité haute)
1. ✅ Configuration Supabase et schéma DB
2. ✅ Refactoring du serveur pour multitenant
3. ✅ API d'authentification basique

### Phase 2: Automatisation (Priorité haute)
1. ✅ Provisioning automatique Twilio
2. ✅ Configuration SIP automatique
3. ✅ Onboarding utilisateur simplifié

### Phase 3: Interface (Priorité moyenne)
1. ⏳ Dashboard utilisateur
2. ⏳ Gestion des contacts
3. ⏳ Historique des appels

### Phase 4: Optimisations (Priorité basse)
1. ⏳ Monitoring et analytics
2. ⏳ Scaling et performance
3. ⏳ Features avancées

## Points d'attention

### Ce que l'utilisateur DOIT faire manuellement:
1. **Configurer le renvoi d'appel** sur son téléphone
2. **Ajouter ses contacts d'urgence**
3. **Vérifier son identité** (si requis)

### Ce que le système fait automatiquement:
1. **Provisionne un numéro Twilio**
2. **Configure l'adresse SIP**
3. **Analyse les appels en temps réel**
4. **Envoie les alertes**

## Support et contribution

### Pour obtenir de l'aide:
- Consulter la documentation
- Vérifier les issues GitHub
- Contacter l'équipe de développement

### Pour contribuer:
1. Fork le repository
2. Créer une branche feature
3. Commiter les changements
4. Ouvrir une Pull Request

## Ressources utiles

- [Documentation Twilio](https://www.twilio.com/docs)
- [Google Cloud Speech docs](https://cloud.google.com/speech-to-text/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

## Contact

Pour toute question sur l'architecture ou l'implémentation, contacter l'équipe technique Ethiq. 