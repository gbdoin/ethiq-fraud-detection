# Plan d'implémentation - Solution Multitenant Ethiq

## Phases de développement

### Phase 1: Infrastructure de base (Semaine 1-2)

#### 1.1 Configuration Supabase
- [ ] Créer le projet Supabase
- [ ] Implémenter le schéma de base de données
- [ ] Configurer Row Level Security (RLS)
- [ ] Créer les fonctions de base (triggers, stored procedures)

#### 1.2 Refactoring du serveur
- [ ] Extraire les configurations hardcodées
  - [ ] *Nouveau*: Identifier toutes les configurations et identifiants hardcodés (Twilio, Google Cloud, numéros de téléphone, adresses SIP, etc.) dans `serveur.cjs`.
  - [ ] *Nouveau*: Concevoir un schéma dans Supabase pour stocker les configurations spécifiques à chaque tenant (clés API, numéros de téléphone, adresses SIP, contacts d'urgence, préférences d'alerte, etc.).
- [ ] Implémenter la gestion des tenants
  - [ ] *Nouveau*: Définir un mécanisme clair pour l'identification des tenants lors des requêtes HTTP entrantes (ex: webhooks Twilio basés sur des numéros "To" uniques mappés aux tenants).
  - [ ] *Nouveau*: Définir un mécanisme clair pour l'identification et l'authentification des tenants sur les connexions WebSocket (ex: authentification par token JWT émis par Supabase).
  - [ ] *Nouveau*: Implémenter la logique dans `serveur.cjs` pour récupérer et utiliser les configurations spécifiques au tenant depuis Supabase en temps réel, basé sur le tenant identifié.
  - [ ] *Nouveau*: Assurer l'instanciation dynamique des clients Twilio et Google Speech en utilisant les identifiants spécifiques au tenant.
- [ ] Adapter le WebSocket pour multi-sessions
  - [ ] *Détail*: Refactoriser la gestion des connexions WebSocket pour stocker et gérer l'état de session (ex: `recognizeStream`, `streamActive`, `alertSent`) de manière indépendante pour chaque tenant connecté.
  - [ ] *Nouveau*: Utiliser un espace de noms pour les noms de conférence avec un identifiant de tenant pour prévenir les collisions (ex: `Conf-${tenantId}-${callerNumber}`).
- [ ] Créer un système de configuration par environnement
- [ ] *Nouveau*: **Refactoriser la logique métier pour la prise en compte des tenants**
  - [ ] *Nouveau*: Modifier la fonction `triggerFraudAlert` pour qu'elle soit sensible au tenant :
    - [ ] Utiliser les numéros de contact d'urgence spécifiques au tenant, récupérés depuis Supabase.
    - [ ] Cibler le `conferenceSid` spécifique de l'appel du tenant.
  - [ ] *Nouveau*: Modifier la fonction `addSipToConference` pour utiliser les adresses SIP spécifiques au tenant et le numéro Twilio du tenant comme `callerId`.
- [ ] *Nouveau*: **Journalisation et gestion des erreurs améliorées**
  - [ ] *Nouveau*: Améliorer la journalisation dans `serveur.cjs` pour inclure les identifiants des tenants afin d'améliorer le débogage et la surveillance (lien avec Phase 4.1).

#### 1.3 API de gestion
- [ ] Endpoints d'authentification (login, register, logout)
- [ ] Endpoints de gestion de compte
- [ ] Endpoints de gestion des contacts d'urgence
- [ ] Documentation API (OpenAPI/Swagger)

### Phase 2: Automatisation Twilio (Semaine 3)

#### 2.1 Gestion des numéros
- [ ] Intégration Twilio API pour la recherche de numéros
- [ ] Automatisation de l'achat de numéros
- [ ] Configuration automatique des webhooks
- [ ] Gestion du pool de numéros disponibles

#### 2.2 Configuration SIP
- [ ] Génération automatique d'adresses SIP
- [ ] Configuration des endpoints SIP dans Twilio
- [ ] Tests de connectivité SIP

### Phase 3: Interface utilisateur (Semaine 4-5)

#### 3.1 Application web
- [ ] Page d'inscription
- [ ] Dashboard utilisateur
- [ ] Gestion des contacts d'urgence
- [ ] Historique des appels
- [ ] Paramètres du compte

#### 3.2 Onboarding utilisateur
- [ ] Wizard de configuration
- [ ] Instructions pour le renvoi d'appel
- [ ] Test de configuration
- [ ] Support intégré

### Phase 4: Monitoring et Analytics (Semaine 6)

#### 4.1 Logging et monitoring
- [ ] Intégration avec un service de logging (ex: Datadog, LogRocket)
- [ ] Dashboards de monitoring
- [ ] Alertes système

#### 4.2 Analytics utilisateur
- [ ] Statistiques d'utilisation
- [ ] Détection de patterns de fraude
- [ ] Rapports mensuels

### Phase 5: Optimisations et scaling (Semaine 7-8)

#### 5.1 Performance
- [ ] Mise en cache Redis
- [ ] Optimisation des requêtes DB
- [ ] Load testing

#### 5.2 Déploiement
- [ ] CI/CD pipeline
- [ ] Containerisation (Docker)
- [ ] Déploiement sur cloud (AWS/GCP/Azure)

## Ordre de priorité des tâches

### Priorité 1 (MVP - Minimum Viable Product)
1. Base de données Supabase avec tables essentielles
2. Refactoring serveur pour support multitenant
3. API d'authentification et gestion de compte basique
4. Automatisation création numéro Twilio
5. Interface web minimale (inscription + dashboard)

### Priorité 2 (Fonctionnalités essentielles)
1. Gestion complète des contacts d'urgence
2. Configuration automatique SIP
3. Historique des appels
4. Onboarding guidé

### Priorité 3 (Améliorations)
1. Analytics et rapports
2. Monitoring avancé
3. Optimisations performance
4. Features additionnelles

## Technologies recommandées

### Backend
- **Framework**: Express.js (existant) ou migration vers Fastify
- **Base de données**: Supabase (PostgreSQL + Auth + Realtime)
- **Cache**: Redis
- **Queue**: Bull/BullMQ
- **Logging**: Winston + Datadog

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand ou TanStack Query
- **Forms**: React Hook Form + Zod

### Infrastructure
- **Hosting**: Vercel (Frontend) + Railway/Render (Backend)
- **CDN**: Cloudflare
- **Monitoring**: Datadog ou New Relic
- **CI/CD**: GitHub Actions

## Estimations de temps

- **MVP fonctionnel**: 2-3 semaines
- **Version production-ready**: 6-8 semaines
- **Version complète avec toutes les features**: 10-12 semaines

## Risques et mitigation

### Risques techniques
1. **Complexité WebSocket multi-tenant**
   - Mitigation: Utiliser des namespaces Socket.io par tenant

2. **Limites API Twilio**
   - Mitigation: Implémenter rate limiting et queue

3. **Coûts services externes**
   - Mitigation: Monitoring strict et alertes de dépassement

### Risques business
1. **Adoption utilisateur**
   - Mitigation: Onboarding simplifié au maximum

2. **Support technique**
   - Mitigation: Documentation complète et FAQ

3. **Conformité légale**
   - Mitigation: Consultation juridique pour RGPD/privacy 