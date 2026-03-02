# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Delivereats** is a microservices-based food delivery platform. It uses gRPC for internal service communication and exposes a REST API through an API Gateway. Frontend is Angular 17.

## Common Commands

### Full Stack (Docker)
```bash
# Start all services (production mode)
docker-compose up --build

# Start only databases (for local development)
docker-compose -f docker-compose.dev.yml up -d

# Tear down and clean volumes
docker-compose down -v
```

### Per-Service Development (run inside any backend service directory)
```bash
npm run dev        # Hot-reload dev server (ts-node + nodemon)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled output
npm run lint       # ESLint
npm run format     # Prettier
npm test           # Jest unit tests (auth-service has tests)
npm run test:coverage  # Coverage report
```

### Frontend (inside `frontend/`)
```bash
ng serve           # Dev server at http://localhost:4200
ng build           # Production build
ng test            # Karma/Jasmine tests
```

### Deployment
```bash
./deploy-build.sh  # Build Docker images and push to GCP Cloud Run
./insert-products.sh  # Seed test product data
```

## Architecture

### Communication Flow
```
Angular (4200) → API Gateway REST (3000) → gRPC → Backend Services
```

The **API Gateway** (`api-gateway/`) is the only REST entrypoint for the frontend. It validates JWTs and translates HTTP requests to gRPC calls directed at the appropriate service.

### Services & Ports

| Service | gRPC Port | DB Port |
|---|---|---|
| auth-service | 50052 | 5432 |
| restaurant-catalog-service | 50051 | 5433 |
| order-service | 50053 | 5434 |
| delivery-service | 50054 | 5435 |
| notification-service | 50055 | — (SMTP only) |

Each service owns an **independent PostgreSQL instance** (database-per-service). There are no shared databases.

### Internal Service Calls
- `order-service` calls `restaurant-catalog-service` to validate products/prices before creating an order.
- `order-service` calls `notification-service` to send confirmation emails after order creation.
- All inter-service calls use gRPC with Protocol Buffers (`.proto` files in each service's `src/infrastructure/grpc/proto/`).

### Clean Architecture (per service)
Each backend service follows the same layered structure:
```
src/
├── domain/          # Entities and repository interfaces (zero external deps)
├── application/     # Use cases and DTOs
└── infrastructure/  # gRPC handlers/clients, PostgreSQL repos, DI container
```

Dependency injection uses a `DIContainer` singleton (`src/infrastructure/di/`). To add a new dependency, register it in the container and resolve it in the gRPC handler entrypoint.

### Proto Files
`.proto` definitions live in each service's `src/infrastructure/grpc/proto/`. The API Gateway holds **client** proto copies; services hold **server** proto copies. Keep these in sync when modifying RPCs.

## Environment Variables

Each service reads from a `.env` file. Key variables:

```env
# JWT (auth-service and api-gateway must share the same secret)
JWT_SECRET=...
JWT_EXPIRES_IN=24h

# Database (per service)
DB_HOST=localhost        # Use service name in Docker (e.g., "auth-db")
DB_PORT=543X
DB_NAME=*_db
DB_USER=*_user
DB_PASSWORD=*_password

# gRPC
GRPC_PORT=500XX
AUTH_SERVICE_URL=localhost:50052   # in api-gateway

# SMTP (notification-service only)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...        # Gmail App Password, not account password
```

When running locally (not Docker), set `DB_HOST=localhost` and start databases with `docker-compose -f docker-compose.dev.yml up -d`.

## Key Conventions

- TypeScript strict mode is enabled across all services.
- Domain entities contain **no infrastructure imports**. Use cases depend only on domain interfaces.
- gRPC handlers are thin — they extract proto request fields, call use cases, and map results back to proto responses.
- Database schemas are in `src/infrastructure/database/postgres/schema.sql` per service. There are no migration tools; schemas are applied on first container start via Docker init scripts.
