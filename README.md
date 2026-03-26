# Hide & Seek 🏙️

Aplikacja mobilna do rozbudowanej zabawy w chowanego w mieście.

## Tech Stack

- **Mobile:** React Native + Expo (iOS & Android)
- **Backend:** Node.js + Fastify + Socket.IO (TypeScript)
- **Database:** PostgreSQL + PostGIS
- **Storage:** MinIO (S3-compatible)
- **Maps:** OpenStreetMap + Overpass API
- **Monorepo:** npm workspaces + Turborepo

## Quick Start

### Wymagania
- Node.js >= 20
- Docker & Docker Compose
- Expo CLI (`npx expo`)

### Setup

```bash
# Zainstaluj zależności
npm install

# Uruchom bazę danych i MinIO
npm run docker:up

# Uruchom backend (dev)
npm run dev:server

# Uruchom aplikację mobilną
npm run dev:mobile
```

## Struktura projektu

```
apps/
  mobile/     — Expo (React Native)
  server/     — Backend Node.js
packages/
  shared/     — Wspólne typy TypeScript
docker/       — Docker Compose + Dockerfile
docs/         — Architektura, hosting, API
```

## Dokumentacja

- [Architektura](docs/architecture.md)
- [Hosting & Deployment](docs/hosting.md)
