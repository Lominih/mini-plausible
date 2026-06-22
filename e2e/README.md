# E2E Tests for Mini-Plausible

End-to-end tests using [Playwright](https://playwright.dev/) that verify the full API against a running server.

## Prerequisites

- **Node.js** 18+ installed
- **Mini-Plausible** server running on `http://localhost:3000`
- **SQLite** database seeded (or fresh)

## Quick Start

\`\`\`bash
# 1. Start the server (in a separate terminal)
cd mini-plausible
npm run dev

# 2. Run E2E tests
npx playwright test
\`\`\`

## Configuration

The Playwright config is at [`e2e/playwright.config.ts`](./playwright.config.ts).

| Option        | Default                  | Environment Variable |
|--------------|--------------------------|---------------------|
| Base URL     | `http://localhost:3000`  | `BASE_URL`          |
| Browser      | Chromium                 | --                  |
| Retries (CI) | 2                        | `CI`               |
| Parallelism  | All tests (local)        | `CI=1` for serial  |

### Custom Base URL

\`\`\`bash
# Test against a different server
BASE_URL=http://localhost:4000 npx playwright test
\`\`\`

## Test Files

| File                    | Description                                          |
|------------------------|------------------------------------------------------|
| `analytics.spec.ts`    | Data collection, dashboard rendering, filters, UTM, comparison |
| `api.spec.ts`          | Auth CRUD, user management, sites, funnels, paths, event definitions, data export |

## What's Tested

### Analytics (`analytics.spec.ts`)
- Single event ingestion via `POST /api/event`
- Batch event ingestion via `POST /api/events`
- Realtime visitor count
- All breakdown endpoints (pages, referrers, browsers, OS, devices, countries)
- Entry and exit pages
- UTM parameter breakdown
- Bounce rate and visit duration time series
- Period comparison mode
- Filter application
- Missing siteId error handling

### API (`api.spec.ts`)
- Health check endpoint
- User registration (valid, duplicate, invalid)
- User login (valid, wrong password, nonexistent user)
- Token refresh (valid, invalid)
- User profile retrieval and updates
- Password change with verification
- Site CRUD (create, list, get, update)
- Site member invitation
- Duplicate domain rejection
- Site stats and embed code
- Funnel creation, listing, and validation
- User path analysis
- Event definition CRUD lifecycle
- Data export in JSON and CSV formats

## Writing New Tests

All tests use Playwright's `request` fixture for API testing (no browser needed):

\`\`\`typescript
import { test, expect } from "@playwright/test";

test("my new test", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
});
\`\`\`

## Debugging

\`\`\`bash
# Run with verbose output
npx playwright test --reporter=list

# Run a specific test file
npx playwright test e2e/analytics.spec.ts

# Run a specific test by name
npx playwright test -g "realtime"

# Debug mode (opens browser)
npx playwright test --debug
\`\`\`

## Viewing HTML Report

\`\`\`bash
npx playwright show-report
\`\`\`

## Project Structure

\`\`\`
e2e/
  playwright.config.ts    # Playwright configuration
  analytics.spec.ts       # Analytics & data collection tests
  api.spec.ts             # API endpoint tests
  README.md               # This file
\`\`\`
