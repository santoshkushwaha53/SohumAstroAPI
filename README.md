# SohumAstroAPI

Production-ready **Vedic & Western astrology API** built with Node.js + TypeScript, powered by [Swiss Ephemeris](https://www.astro.com/swisseph/).

## Architecture

```
┌──────────────────────────────────────────────┐
│               HTTP Clients                    │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│          Express API Layer                    │
│  Routes → Validators (Zod) → Controllers      │
│  Middlewares: auth, rate-limit, error         │
└──────────────────┬───────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
┌────────▼──────┐   ┌─────────▼──────────┐
│ Vedic Module  │   │  Western Module     │
│ birth-chart   │   │  birth-chart        │
│ nakshatra     │   │  aspects            │
│ dasha         │   │  synastry           │
│ navamsa       │   │  transits           │
└────────┬──────┘   └─────────┬──────────┘
         └─────────┬──────────┘
                   │
┌──────────────────▼───────────────────────────┐
│         Astronomy Engine (Swiss Ephemeris)    │
│  EphemerisService → julian.ts → swisseph.d.ts │
└──────────────────┬───────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
┌─────▼────┐ ┌────▼─────┐ ┌───▼──────┐
│ Postgres │ │  Redis   │ │  BullMQ  │
│ (Prisma) │ │  Cache   │ │  Jobs    │
└──────────┘ └──────────┘ └──────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Language | TypeScript 5 (strict) |
| HTTP | Express 4 |
| ORM | Prisma 5 + PostgreSQL |
| Cache | Redis (ioredis) |
| Queue | BullMQ |
| Validation | Zod |
| Logging | Pino |
| Docs | Swagger / OpenAPI 3 |
| Astronomy | Swiss Ephemeris (swisseph) |
| Tests | Vitest + Supertest |

## Folder Structure

```
src/
├── app.ts                    # Express app factory
├── server.ts                 # Entry point + bootstrap
├── config/
│   ├── index.ts              # Env validation (Zod)
│   ├── logger.ts             # Pino logger
│   └── swagger.ts            # OpenAPI spec
├── api/
│   ├── routes/               # Route definitions + JSDoc annotations
│   ├── controllers/          # Request handlers
│   ├── middlewares/          # auth, error, rate-limit
│   └── validators/           # Zod schemas per domain
├── modules/
│   ├── astronomy/            # Swiss Ephemeris wrapper
│   │   ├── swisseph.d.ts     # Type declarations
│   │   ├── types.ts
│   │   ├── julian.ts         # UTC conversion + JD
│   │   └── ephemeris.service.ts
│   ├── vedic/                # Vedic domain
│   │   ├── birth-chart.service.ts
│   │   ├── nakshatra.service.ts
│   │   ├── dasha.service.ts
│   │   └── navamsa.service.ts
│   ├── western/              # Western domain
│   │   ├── birth-chart.service.ts
│   │   ├── aspects.service.ts
│   │   ├── synastry.service.ts
│   │   └── transit.service.ts
│   └── shared/types.ts
├── db/prisma.client.ts
├── cache/redis.client.ts
└── jobs/
    ├── queue.ts
    └── processors/report.processor.ts
prisma/schema.prisma
tests/
```

## Quick Start

### 1. Prerequisites

```bash
node >= 20
docker + docker-compose   # or local Postgres + Redis
```

### 2. Install dependencies

```bash
npm install
```

> `swisseph` is a native addon — it will compile automatically. Requires `python3`, `make`, `g++`.

### 3. Configure environment

```bash
cp .env.example .env
# edit DATABASE_URL, REDIS_URL, MASTER_API_KEY
```

### 4. Database setup

```bash
npx prisma generate
npx prisma db push        # or: npx prisma migrate dev --name init
```

### 5. Run in development

```bash
npm run dev
```

### 6. Docker (full stack)

```bash
docker-compose up --build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check (no auth) |
| POST | `/api/v1/astro/planet-positions` | Planetary positions |
| POST | `/api/v1/vedic/birth-chart` | Vedic sidereal birth chart |
| POST | `/api/v1/vedic/dasha/vimshottari` | Vimshottari Dasha periods |
| POST | `/api/v1/vedic/navamsa` | D9 Navamsa chart |
| POST | `/api/v1/western/birth-chart` | Western tropical birth chart |
| POST | `/api/v1/western/synastry` | Synastry cross-aspects |
| POST | `/api/v1/transits` | Transit aspects to natal chart |

**Swagger UI:** `http://localhost:3000/docs`

**Authentication:** Pass `x-api-key: <your-key>` header on all endpoints except `/health`.

---

## Sample Requests

### Vedic Birth Chart

```bash
curl -s -X POST http://localhost:3000/api/v1/vedic/birth-chart \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date": "1990-06-15",
    "time": "14:30:00",
    "timezone": "+05:30",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "ayanamsa": "LAHIRI",
    "houseSystem": "W"
  }' | jq .
```

### Vimshottari Dasha

```bash
curl -s -X POST http://localhost:3000/api/v1/vedic/dasha/vimshottari \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date": "1990-06-15",
    "time": "14:30:00",
    "timezone": "+05:30",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "yearsAhead": 50
  }' | jq .
```

### Planet Positions (sidereal)

```bash
curl -s -X POST http://localhost:3000/api/v1/astro/planet-positions \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date": "2024-01-01",
    "time": "12:00:00",
    "timezone": "+00:00",
    "mode": "sidereal"
  }' | jq .
```

### Western Synastry

```bash
curl -s -X POST http://localhost:3000/api/v1/western/synastry \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "person1": {
      "date": "1990-06-15", "time": "14:30:00", "timezone": "+05:30",
      "latitude": 28.6139, "longitude": 77.2090, "label": "Alice"
    },
    "person2": {
      "date": "1992-03-22", "time": "08:00:00", "timezone": "+05:30",
      "latitude": 19.0760, "longitude": 72.8777, "label": "Bob"
    }
  }' | jq .
```

### Transits

```bash
curl -s -X POST http://localhost:3000/api/v1/transits \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "natal": {
      "date": "1990-06-15", "time": "14:30:00", "timezone": "+05:30",
      "latitude": 28.6139, "longitude": 77.2090
    },
    "transitDate": "2024-06-15",
    "transitTime": "12:00:00",
    "transitTimezone": "+00:00"
  }' | jq .
```

---

## Tests

```bash
npm test               # run all tests
npm run test:coverage  # with coverage report
```

---

## Production Checklist

- [ ] Replace `MASTER_API_KEY` with hashed DB lookup in `auth.middleware.ts`
- [ ] Set `EPHE_PATH` to real Swiss Ephemeris files for higher accuracy
- [ ] Add `prisma migrate deploy` to CI/CD pipeline
- [ ] Configure Redis persistence (`--appendonly yes` — already in compose)
- [ ] Set `NODE_ENV=production` and a strong `JWT_SECRET`
- [ ] Add `helmet` CSP headers appropriate to your frontend
- [ ] Configure log shipping (Datadog / Loki / CloudWatch)
- [ ] Set up BullMQ dashboard authentication in production
- [ ] Enable Prisma connection pooling (`pgbouncer=true` in DATABASE_URL for high traffic)
- [ ] Add `CORS_ORIGIN` to your specific domain(s)

---

## Ayanamsa Reference

| Name | Constant | Notes |
|------|----------|-------|
| LAHIRI | SE_SIDM_LAHIRI | Indian standard; default |
| RAMAN | SE_SIDM_RAMAN | B.V. Raman system |
| KRISHNAMURTI | SE_SIDM_KRISHNAMURTI | KP system |
| FAGAN_BRADLEY | SE_SIDM_FAGAN_BRADLEY | Western sidereal |
| TRUE_CITRA | SE_SIDM_TRUE_CITRA | Chitrapaksha |

## House Systems

| Code | Name | Common Use |
|------|------|-----------|
| W | Whole Sign | Vedic |
| P | Placidus | Western |
| E | Equal | Western |
| K | Koch | Western |
