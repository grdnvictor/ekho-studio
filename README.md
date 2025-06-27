# 🎵 EKHO Studio

**Générateur d'audio IA conversationnel** - Créez des voix off professionnelles en discutant simplement avec notre assistant IA.

![Node.js](https://img.shields.io/badge/Node.js-23.8.0-green)
![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Express](https://img.shields.io/badge/Express-4.21.2-lightgrey)

## ✨ Membres
- **Erwann Jouvet (développeur)**
- **Victor Grandin (développeur)**
- **Lucie Godard (développeur)**
- **Nicolas Lamatière (marketing)**

## ✨ Fonctionnalités

### 🤖 Assistant IA Conversationnel
- **Interface chat intuitive** : Discutez naturellement avec l'IA
- **Génération guidée** : L'assistant vous pose les bonnes questions
- **Collecte intelligente** : Détection automatique du contexte (type de projet, public cible, style)
- **Suggestions contextuelles** : Boutons de réponse rapide adaptatifs

### 🎙️ Génération Audio Avancée
- **Synthèse vocale haute qualité** avec Gemini TTS
- **Voix multiples** : 11+ voix professionnelles (Aoede, Achernar, Charon, etc.)
- **Styles adaptatifs** : Dynamique, calme, professionnel, chaleureux
- **Optimisation automatique** : Sélection de la voix selon le contexte

### 🎯 Types de Projets Supportés
- **Publicités** radio/TV
- **Podcasts** et émissions
- **Formations** e-learning
- **Documentaires** et narrations
- **Présentations** corporate

## 🚀 Installation Rapide

### Prérequis
- Node.js 22+
- Docker & Docker Compose
- Clé API Gemini (pour la synthèse vocale)

### 1. Configuration
```bash
# Cloner le repo
git clone <your-repo-url>
cd ekho-studio

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec votre GEMINI_API_KEY
```

### 2. Lancement avec Docker
```bash
# Démarrer tous les services
docker compose up -d

# Accès aux services
# Frontend: http://localhost:3000
# Backend: http://localhost:3333
# Base de données: PostgreSQL sur port 5432
# Prisma Studio: http://localhost:5555
```

### 3. Lancement en développement
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (nouveau terminal)
cd frontend
npm install
npm run dev
```

## 📁 Architecture

```
ekho-studio/
├── backend/                 # API Express + TypeScript
│   ├── src/agents/         # Agents IA conversationnels
│   ├── src/services/       # Services audio (Gemini TTS)
│   ├── src/routes/         # Routes API REST
│   └── src/controllers/    # Logique métier
├── frontend/               # Interface Next.js
│   ├── src/app/           # Pages et composants
│   └── src/components/    # UI components (shadcn/ui)
└── compose.yml            # Configuration Docker
```

## 🔧 Configuration

### Variables d'environnement (.env)
```bash
# API Keys
GEMINI_API_KEY=your_gemini_api_key_here

# Base de données
DATABASE_URL=postgresql://postgres:postgres@database:5432/db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=db

# Serveur
SERVER_PORT=3333
INTERNAL_SERVER_PORT=3333

# LM Studio (optionnel, pour l'analyse conversationnelle)
LM_STUDIO_URL=http://localhost:1234/v1
```

## 🎮 Utilisation

### Interface Conversationnelle
1. **Accédez** à http://localhost:3000
2. **Cliquez** sur "Assistant IA Conversationnel"
3. **Décrivez** votre projet (ex: "Je veux créer une pub radio")
4. **Répondez** aux questions de l'assistant
5. **Récupérez** votre audio généré !

## 🛠️ Développement

### Scripts utiles
```bash
# Backend
npm run dev          # Serveur de développement
npm run build        # Build TypeScript
npm run test         # Tests unitaires

# Frontend
npm run dev          # Serveur Next.js
npm run build        # Build production
npm run lint         # Linting

# Base de données
npx prisma generate  # Génération client
npx prisma migrate   # Migrations
npx prisma studio    # Interface graphique
```

### API Endpoints Principaux
- `POST /audio-agent/chat` - Chat avec l'assistant
- `POST /generate/audio` - Génération audio directe
- `GET /audio/:filename` - Fichiers audio statiques
- `GET /audio-test` - Page de test audio

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| **next** | 3000 | Interface utilisateur Next.js |
| **server** | 3333 | API backend Express |
| **database** | 5432 | Base de données PostgreSQL |
| **prisma-studio** | 5555 | Interface admin DB |

## 🔊 Test Audio

Vérifiez que tout fonctionne :
- **Interface** : http://localhost:3000/audio
- **Test audio** : http://localhost:3333/audio-test
- **Liste des fichiers** : http://localhost:3333/audio-list

## 🚨 Dépannage

### Problèmes courants
```bash
# Erreur GEMINI_API_KEY
echo "GEMINI_API_KEY=your_key_here" >> .env

# Problème de ports
docker compose down && docker compose up -d

# Base de données
docker compose exec server npx prisma migrate reset

# Cache Docker
docker compose down -v && docker compose up --build
```
