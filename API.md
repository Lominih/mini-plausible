# Mini-Plausible API Documentation

A lightweight, self-hosted web analytics API inspired by Plausible.

**Base URL:** `http://localhost:3000`

**Authentication:** Most endpoints require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

**Database:** SQLite (via Prisma ORM)

---

## Table of Contents

- [Health](#health)
- [Event Collection](#event-collection)
- [Authentication](#authentication)
- [Users](#users)
- [Sites](#sites)
- [Analytics](#analytics)
- [Funnels](#funnels)
- [User Paths](#user-paths)
- [Event Definitions](#event-definitions)
- [Data Export](#data-export)
- [Database Schema](#database-schema)

---

## Health

### `GET /health`

Health check endpoint. No authentication required.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 12345.67
}
```

---

## Event Collection

### `POST /api/event`

Ingest a single analytics event. No authentication required, but requires the `x-site-id` header.

**Headers:**

| Header         | Required | Description                   |
|---------------|----------|-------------------------------|
| `x-site-id`  | Yes      | The site UUID                 |
| `x-device-id`| No       | Persistent device identifier  |
| `x-session-id`| No      | Session identifier            |

**Request Body:**

```json
{
  "name": "pageview",
  "url": "https://example.com/pricing",
  "referrer": "https://google.com",
  "screenWidth": 1920,
  "screenHeight": 1080,
  "props": { "author": "John" },
  "utm": {
    "utm_source": "twitter",
    "utm_medium": "social",
    "utm_campaign": "launch"
  }
}
```

| Field          | Type    | Required | Description                   |
|---------------|---------|----------|-------------------------------|
| `name`        | string  | Yes      | Event name (1-200 chars)      |
| `url`         | string  | Yes      | Page URL where event occurred |
| `referrer`    | string  | No       | Referrer URL                  |
| `screenWidth` | integer | No       | Screen width in pixels        |
| `screenHeight`| integer | No       | Screen height in pixels       |
| `props`       | object  | No       | Custom event properties       |
| `utm`         | object  | No       | UTM parameters                |

**Response (201):**

```json
{
  "success": true,
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error (400):**

```json
{
  "success": false,
  "error": "Missing x-site-id header"
}
```

---

### `POST /api/events`

Batch ingest multiple analytics events. No authentication required.

**Headers:** Same as `POST /api/event`.

**Request Body:** JSON array of event payloads.

```json
[
  { "name": "pageview", "url": "https://example.com/", "screenWidth": 1920 },
  { "name": "signup", "url": "https://example.com/signup", "props": { "plan": "pro" } }
]
```

**Response (201 - all success):**

```json
{
  "success": true,
  "eventIds": ["a1b2c3d4-...", "b2c3d4e5-..."],
  "errors": []
}
```

**Response (207 - partial failure):**

```json
{
  "success": false,
  "eventIds": ["a1b2c3d4-..."],
  "errors": ["name: Required"]
}
```

---

## Authentication

### `POST /api/auth/register`

Register a new user account.

**Request Body:**

```json
{ "email": "user@example.com", "password": "securepass123", "name": "John Doe" }
```

| Field      | Type   | Required | Constraints       |
|-----------|--------|----------|-------------------|
| `email`   | string | Yes      | Valid email format |
| `password`| string | Yes      | 8-128 characters  |
| `name`    | string | No       | Max 128 chars     |

**Response (201):**

```json
{
  "user": { "id": "...", "email": "user@example.com", "name": "John Doe", "createdAt": "..." },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error (409):** `{ "error": "Email already registered" }`

---

### `POST /api/auth/login`

Authenticate an existing user.

**Request Body:** `{ "email": "user@example.com", "password": "securepass123" }`

**Response (200):**

```json
{
  "user": { "id": "...", "email": "user@example.com", "name": "John Doe" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

**Error (401):** `{ "error": "Invalid email or password" }`

---

### `POST /api/auth/refresh`

Exchange a refresh token for new tokens.

**Request Body:** `{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }`

**Response (200):** `{ "accessToken": "...", "refreshToken": "..." }`

**Error (401):** `{ "error": "Invalid or expired refresh token" }`

---

### `GET /api/auth/me`

Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**

```json
{
  "user": {
    "id": "...", "email": "user@example.com", "name": "John Doe",
    "createdAt": "...", "updatedAt": "...",
    "_count": { "sites": 3 }
  }
}
```

---

## Users

### `GET /api/users/me`

Get authenticated user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):** Same shape as `GET /api/auth/me`.

---

### `PUT /api/users/me`

Update authenticated user's profile or password.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

| Field             | Type   | Required | Constraints                              |
|------------------|--------|----------|------------------------------------------|
| `name`           | string | No       | Max 128 characters                       |
| `email`          | string | No       | Valid email                              |
| `currentPassword`| string | Conditional | Required when `newPassword` provided |
| `newPassword`    | string | No       | 8-128 characters                         |

**Response (200):** Updated user object.

**Error (401):** `{ "error": "Current password is incorrect" }`

---

### `DELETE /api/users/me`

Delete the authenticated user's account.

**Response (200):** `{ "message": "Account deleted successfully" }`

---

## Sites

All site routes require authentication.

### `GET /api/sites`

List all sites the authenticated user has access to.

**Response (200):**

```json
[{
  "id": "...", "name": "My Blog", "domain": "blog.example.com",
  "timezone": "UTC", "createdAt": "...", "role": "owner"
}]
```

---

### `POST /api/sites`

Create a new site.

**Request Body:**

```json
{ "name": "My Blog", "domain": "blog.example.com", "timezone": "America/New_York" }
```

| Field      | Type   | Required | Constraints        |
|-----------|--------|----------|-------------------|
| `name`    | string | Yes      | Site display name  |
| `domain`  | string | Yes      | Unique domain      |
| `timezone`| string | No       | Defaults to "UTC"  |

**Response (201):** Created site object with `id`, `name`, `domain`, `timezone`, `userId`, timestamps.

**Error (409):** `{ "error": "A site with this domain already exists" }`

---

### `GET /api/sites/:id`

Get detailed site information including members.

**Response (200):** Site object with `members` array containing user details and roles.

**Error (403):** `{ "error": "You do not have access to this site" }`

---

### `PUT /api/sites/:id`

Update site settings. Requires site membership.

**Request Body:** `{ "name": "...", "domain": "...", "timezone": "..." }` (all optional)

**Response (200):** Updated site object.

**Error (409):** `{ "error": "Domain already in use" }`

---

### `DELETE /api/sites/:id`

Delete a site and all associated data. Requires site membership.

**Response:** `204 No Content`

---

### `POST /api/sites/:id/members`

Invite a user to a site by email.

**Request Body:** `{ "email": "teammate@example.com", "role": "editor" }`

| Field  | Type   | Required | Description                                        |
|-------|--------|----------|----------------------------------------------------|
| `email`| string | Yes     | Must be a registered user                           |
| `role` | string | No      | "owner", "editor", or "viewer" (default: "viewer") |

**Response (201):** Membership object with user details.

---

### `GET /api/sites/:id/stats`

Quick stats overview for a site.

**Response (200):**

```json
{
  "today": { "pageviews": 1234, "visitors": 856, "sessions": 902 },
  "last30Days": { "pageviews": 45678, "visitors": 23456, "sessions": 28901 },
  "totalEventsTracked": 12345
}
```

---

### `GET /api/sites/:id/embed`

Get the JavaScript embed script.

**Response (200):** `{ "embedCode": "<script defer ...></script>" }`

---

## Analytics

All analytics routes require authentication.

**Common Query Parameters:**

| Parameter   | Type   | Default | Description                                          |
|------------|--------|---------|------------------------------------------------------|
| `siteId`   | string | --      | **Required.** Site UUID                               |
| `period`   | string | `30d`   | "realtime", "7d", "30d", "90d", or "custom"          |
| `date_from`| string | --      | Start date (ISO 8601) for custom period              |
| `date_to`  | string | --      | End date (ISO 8601) for custom period                |
| `filters`  | string | --      | Filter string like `browser:Chrome;os:Windows`      |
| `compare`  | string | `false` | Set to "true" for period comparison                  |
| `limit`    | string | `10`    | Max results for breakdown endpoints                  |

---

### `GET /api/analytics/realtime`

Real-time visitor count (sessions active in last 5 minutes).

**Response (200):** `{ "onlineVisitors": 42, "pageviewsLast5Min": 128 }`

---

### `GET /api/analytics/visitors`

Visitor count over time.

**Response (200):** `[{ "date": "2025-01-01", "value": 150 }, ...]`

**With `compare=true`:** `{ "current": [...], "previous": [...], "change": 30, "changePercentage": 25.0 }`

---

### `GET /api/analytics/pageviews`

Pageview count over time.

**Response (200):** `[{ "date": "2025-01-01", "value": 500 }, ...]`

---

### `GET /api/analytics/bounce-rate`

Bounce rate over time.

**Response (200):** `[{ "date": "2025-01-01", "value": 45.2 }, ...]`

---

### `GET /api/analytics/visit-duration`

Average visit duration over time (seconds).

**Response (200):** `[{ "date": "2025-01-01", "value": 120.5 }, ...]`

---

### `GET /api/analytics/pages`

Top pages breakdown.

**Response (200):** `[{ "name": "/", "count": 1500, "percentage": 35.5 }, ...]`

---

### `GET /api/analytics/referrers`

Top referrers breakdown.

**Response (200):** `[{ "name": "https://google.com", "count": 500, "percentage": 25.0 }, ...]`

---

### `GET /api/analytics/countries`

Countries breakdown.

**Response (200):** `[{ "name": "United States", "count": 3000, "percentage": 40.0 }, ...]`

---

### `GET /api/analytics/browsers`

Browsers breakdown.

**Response (200):** `[{ "name": "Chrome", "count": 4000, "percentage": 55.0 }, ...]`

---

### `GET /api/analytics/os`

Operating systems breakdown.

**Response (200):** `[{ "name": "Windows", "count": 3500, "percentage": 45.0 }, ...]`

---

### `GET /api/analytics/devices`

Devices breakdown.

**Response (200):** `[{ "name": "desktop", "count": 4500, "percentage": 60.0 }, ...]`

---

### `GET /api/analytics/entry-pages`

Top entry (landing) pages.

**Response (200):** `[{ "name": "/", "count": 1200, "percentage": 45.0 }, ...]`

---

### `GET /api/analytics/exit-pages`

Top exit pages.

**Response (200):** `[{ "name": "/signup/complete", "count": 800, "percentage": 30.0 }, ...]`

---

### `GET /api/analytics/utm`

UTM parameter breakdown.

**Query Parameters:**

| Parameter  | Type   | Default        | Description                                |
|-----------|--------|----------------|--------------------------------------------|
| `group_by`| string | `utm_source`   | `utm_source`, `utm_medium`, or `utm_campaign` |

**Response (200):** `[{ "name": "twitter", "count": 500, "percentage": 25.0 }, ...]`

---

## Funnels

### `GET /api/analytics/funnels`

List saved funnels, or execute one by ID or inline steps.

**Query Parameters:**

| Parameter   | Type   | Required | Description                                    |
|------------|--------|----------|------------------------------------------------|
| `siteId`   | string | Yes      | Site UUID                                       |
| `funnelId` | string | No*      | Run a saved funnel by ID                        |
| `steps`    | string | No*      | JSON array of inline funnel steps               |
| `startDate`| string | No       | ISO 8601 (default: 30 days ago)                 |
| `endDate`  | string | No       | ISO 8601 (default: now)                         |

*Either `funnelId`, `steps`, or neither (to list) should be provided.

**Inline steps format:** `[{ "type": "page", "value": "/" }, { "type": "event", "value": "signup" }]`

**List response (200):** `{ "funnels": [{ "id": "...", "name": "Signup Flow", "steps": [...], ... }] }`

**Execute response (200):** `{ "totalVisitors": 1000, "steps": [{ "name": "/", "visitors": 1000, "conversionRate": 100 }, ...] }`

---

### `POST /api/analytics/funnels`

Create and save a new funnel.

**Request Body:**

```json
{
  "siteId": "uuid", "name": "Checkout Flow",
  "steps": [
    { "type": "page", "value": "/" },
    { "type": "page", "value": "/pricing" },
    { "type": "event", "value": "purchase" }
  ]
}
```

| Field    | Type  | Required | Constraints                      |
|---------|-------|----------|----------------------------------|
| `siteId`| string| Yes      | Valid UUID, user must have access |
| `name`  | string| Yes      | 1-128 characters                 |
| `steps` | array | Yes      | 2-10 steps                       |

**Step schema:** `{ "type": "event" | "page", "value": "string" }`

**Response (201):** Created funnel object.

---

## User Paths

### `GET /api/analytics/paths`

Analyze user navigation paths.

**Query Parameters:**

| Parameter  | Type   | Required | Description                                  |
|-----------|--------|----------|----------------------------------------------|
| `siteId`  | string | Yes      | Site UUID                                     |
| `startDate`| string| No       | ISO 8601 datetime (default: 30 days ago)      |
| `endDate` | string | No       | ISO 8601 datetime (default: now)              |
| `maxDepth`| number | No       | Max path depth, 1-10 (default: auto)          |
| `limit`   | number | No       | Max paths returned, 1-200 (default: 50)       |

**Response (200):**

```json
{
  "paths": [
    { "path": ["/", "/pricing", "/signup"], "count": 120 },
    { "path": ["/", "/blog", "/docs"], "count": 85 }
  ]
}
```

---

## Event Definitions

### `GET /api/events/definitions`

List event definitions for a site.

**Query Parameters:** `siteId` (required).

**Response (200):** `{ "definitions": [{ "id": "...", "name": "signup", "propertiesSchema": {...}, ... }] }`

---

### `POST /api/events/definitions`

Create a new event definition.

**Request Body:**

```json
{
  "siteId": "uuid", "name": "purchase",
  "propertiesSchema": { "amount": "number", "currency": "string" }
}
```

**Response (201):** Created definition object.

---

### `PUT /api/events/definitions/:id`

Update an event definition.

**Request Body:** `{ "name": "new_name", "propertiesSchema": {...} }` (both optional)

**Response (200):** Updated definition object.

---

### `DELETE /api/events/definitions/:id`

Delete an event definition.

**Response (200):** `{ "message": "Event definition deleted" }`

---

## Data Export

### `GET /api/export/:siteId`

Export all site data. Supports JSON and CSV formats.

**Query Parameters:**

| Parameter | Type   | Default | Description                         |
|----------|--------|---------|-------------------------------------|
| `format` | string | `json`  | Export format: `json` or `csv`       |

**JSON Response (200):**

```json
{
  "site": { "id": "...", "domain": "...", "name": "...", "timezone": "...", "createdAt": "..." },
  "eventDefinitions": [...],
  "events": [...],
  "pageviews": [...],
  "aggregatedEvents": [{ "name": "pageview", "total": 5000, "uniqueVisitors": 1200 }],
  "funnels": [...],
  "exportedAt": "..."
}
```

**CSV Response (200):** Content-Type `text/csv` with sections for Events, Aggregated Events, and Event Definitions.

---

## Database Schema

SQLite via Prisma ORM. Key models:

### User
| Field      | Type     | Notes                 |
|-----------|----------|-----------------------|
| id        | UUID     | Primary key           |
| email     | string   | Unique                |
| name      | string?  | Optional display name |
| password  | string   | bcrypt hashed          |
| createdAt | DateTime | Auto-generated         |
| updatedAt | DateTime | Auto-updated           |

### Site
| Field    | Type     | Notes                |
|---------|----------|----------------------|
| id      | UUID     | Primary key          |
| name    | string   | Display name         |
| domain  | string   | Unique domain        |
| timezone| string   | Defaults to "UTC"    |
| userId  | string   | Owner (FK to User)   |

### Event
| Field        | Type     | Notes                                |
|-------------|----------|--------------------------------------|
| id          | UUID     | Primary key                          |
| siteId      | string   | FK to Site (indexed)                  |
| name        | string   | Event name (indexed with siteId)     |
| url         | string   | Page URL                             |
| referrer    | string?  | Referrer URL                         |
| screenWidth | int?     | Screen width                         |
| screenHeight| int?     | Screen height                        |
| browser     | string?  | Parsed browser                       |
| os          | string?  | Parsed OS                            |
| country     | string?  | GeoIP country                        |
| city        | string?  | GeoIP city                           |
| utmSource   | string?  | UTM source                           |
| utmMedium   | string?  | UTM medium                           |
| utmCampaign | string?  | UTM campaign                         |
| deviceId    | string?  | Device identifier                    |
| sessionId   | string?  | Session identifier                   |
| props       | string   | JSON custom properties               |
| createdAt   | DateTime | Indexed with siteId                   |

### Session
| Field        | Type     | Notes                    |
|-------------|----------|--------------------------|
| id          | UUID     | Primary key              |
| siteId      | string   | FK to Site (indexed)     |
| deviceId    | string   | Indexed                  |
| firstVisit  | DateTime | First visit              |
| lastSeen    | DateTime | Indexed                  |
| pagesViewed | string   | JSON array of URLs       |
| referrer    | string?  | Initial referrer         |
| browser     | string?  | Browser name             |
| os          | string?  | OS name                  |
| country     | string?  | Country                  |
| city        | string?  | City                     |
| screenWidth | int?     | Screen width             |
| screenHeight| int?     | Screen height            |

### DailyAggregate
| Field       | Type     | Notes                        |
|------------|----------|------------------------------|
| id         | UUID     | Primary key                  |
| siteId     | string   | FK to Site                   |
| date       | DateTime | Unique per site              |
| pageviews  | int      | Total pageviews              |
| visitors   | int      | Unique visitors              |
| sessions   | int      | Total sessions               |
| bounceRate | float    | Bounce rate %                |
| avgDuration| float    | Average duration (sec)       |
| topPages   | string   | JSON array                   |
| topSources | string   | JSON array                   |
| countries  | string   | JSON array                   |
| browsers   | string   | JSON array                   |
| devices    | string   | JSON array                   |

### EventDefinition
| Field            | Type     | Notes                     |
|-----------------|----------|---------------------------|
| id              | UUID     | Primary key               |
| siteId          | string   | FK to Site (cascade)      |
| name            | string   | Unique per site           |
| propertiesSchema| string   | JSON type definitions     |
| createdAt       | DateTime | Auto-generated             |
| updatedAt       | DateTime | Auto-updated               |

### Pageview
| Field      | Type     | Notes                   |
|-----------|----------|-------------------------|
| id        | UUID     | Primary key             |
| siteId    | string   | FK to Site (cascade)    |
| url       | string   | Indexed                 |
| referrer  | string?  | Referrer URL            |
| userId    | string?  | Optional user ID        |
| sessionId | string?  | Indexed                 |
| browser   | string?  | Browser name            |
| os        | string?  | OS name                 |
| country   | string?  | Country                 |
| device    | string?  | Device type             |
| duration  | int?     | Duration in seconds     |
| createdAt | DateTime | Indexed                 |

### SiteMember
| Field  | Type     | Notes                          |
|-------|----------|--------------------------------|
| id    | UUID     | Primary key                    |
| siteId| string   | FK to Site                      |
| userId| string   | FK to User                      |
| role  | string   | "owner", "editor", or "viewer" |

### Funnel
| Field     | Type     | Notes                    |
|----------|----------|--------------------------|
| id       | UUID     | Primary key              |
| siteId   | string   | FK to Site (cascade)     |
| name     | string   | Funnel display name      |
| steps    | string   | JSON array of steps      |
| userId   | string   | Creator (FK to User)     |
| createdAt| DateTime | Auto-generated            |
| updatedAt| DateTime | Auto-updated              |
