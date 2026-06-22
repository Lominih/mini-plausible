# Mini Plausible

A lightweight, privacy-first web analytics platform — a self-hosted alternative to Plausible Analytics.

## Overview

Mini Plausible tracks pageviews and custom events without cookies, IP addresses, or personal data collection. The entire analytics pipeline runs on your own infrastructure, giving you full control over visitor data.

## Features

- **Privacy-first**: No cookies, no IP tracking, GDPR/CCPA compliant by default
- **Lightweight SDK**: <5 KB minified client-side tracking script
- **Event batching**: Efficient network usage with batched event delivery
- **UTM tracking**: Automatic extraction of UTM campaign parameters
- **Device detection**: Browser, OS, and device type identification from user agent
- **Session tracking**: Visitor sessions with bounce rate and duration metrics
- **Funnel analysis**: Multi-step conversion funnels with drop-off rates
- **Real-time analytics**: Live visitor counts and pageview streams
- **Daily aggregation**: Pre-computed daily aggregates for fast queries
- **Custom events**: Track any event with arbitrary properties
- **JWT authentication**: Secure API access with token-based auth
- **Docker-ready**: Production deployment with Docker Compose
- **SQLite + PostgreSQL**: Works with SQLite for dev and PostgreSQL for production

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

The server starts at `http://localhost:3000`.

### Docker

```bash
# Build and start all services
docker compose up -d

# Run database migrations
docker compose exec app npx prisma db push

# Seed demo data
docker compose exec app npm run db:seed
```

## API Documentation

### Authentication

Most endpoints require a JWT token. Get one via the auth endpoint:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123","name":"Admin"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

### Collect Events

```bash
# Single event
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "your-site-id",
    "name": "pageview",
    "url": "https://example.com/",
    "referrer": "",
    "browser": "Chrome",
    "os": "Windows",
    "screen_width": 1920
  }'
```

### Analytics Queries

```bash
# Get analytics for a site
curl http://localhost:3000/api/analytics/SITE_ID?period=30d \
  -H "Authorization: Bearer YOUR_TOKEN"

# Available periods: realtime, 7d, 30d, 90d, custom
```

### Funnel Analysis

```bash
# Create and query a funnel
curl -X POST http://localhost:3000/api/analytics/funnels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "your-site-id",
    "name": "Signup Funnel",
    "steps": [
      {"type": "page", "value": "/"},
      {"type": "event", "value": "Signup"},
      {"type": "event", "value": "Purchase"}
    ]
  }'
```

## SDK Integration

### Script Tag (recommended)

```html
<script
  defer
  data-domain="yourdomain.com"
  data-api-endpoint="https://analytics.example.com/api/event"
  src="https://analytics.example.com/tracker.js"
></script>
```

### Custom Events

```javascript
plausible('Signup', { props: { plan: 'pro' } });
plausible('Purchase', { props: { amount: 49.99, currency: 'USD' } });
```

### Node.js / npm

```bash
cd sdk && npm install && npm run build
```

The built `sdk/dist/plausible.min.js` can be served from your own domain.

## Project Structure

```
mini-plausible/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.ts                # Express app setup
│   ├── middleware/
│   │   └── auth.ts           # JWT auth middleware
│   ├── routes/
│   │   ├── analytics.ts      # Analytics query endpoints
│   │   ├── auth.ts           # Register / login
│   │   ├── collect.ts        # Event ingestion
│   │   ├── funnels.ts        # Funnel CRUD + analysis
│   │   ├── sites.ts          # Site management
│   │   └── ...
│   ├── services/
│   │   ├── pipeline.ts       # Event queue + batch inserts
│   │   ├── aggregation.ts    # Daily aggregate computation
│   │   ├── funnel.ts         # Funnel calculation engine
│   │   ├── query-builder.ts  # Analytics query construction
│   │   ├── embed.ts          # Embed script generation
│   │   └── ...
│   └── utils/
│       ├── user-agent.ts     # Browser / OS detection
│       ├── utm.ts            # UTM parameter extraction
│       └── prisma.ts         # Prisma client singleton
├── sdk/
│   ├── src/index.ts          # Client-side tracking SDK
│   ├── package.json          # SDK build config
│   ├── rollup.config.js      # Bundle config (UMD + ESM)
│   └── embed.html            # Embed demo page
├── prisma/
│   └── schema.prisma         # Database schema
├── Dockerfile                # Multi-stage production build
├── docker-compose.yml        # App + PostgreSQL services
├── vitest.config.ts          # Test configuration
└── package.json
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret for JWT signing | dev fallback |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

See `.env.example` for a full template.

## License

MIT