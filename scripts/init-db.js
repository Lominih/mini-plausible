const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL UNIQUE,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
  );

  CREATE TABLE IF NOT EXISTS "site_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    FOREIGN KEY ("site_id") REFERENCES "sites"("id"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
  );

  CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "referrer" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "city" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "device_id" TEXT,
    "session_id" TEXT,
    "props" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  );

  CREATE INDEX IF NOT EXISTS "events_site_id_created_at_idx" ON "events"("site_id", "created_at");
  CREATE INDEX IF NOT EXISTS "events_site_id_name_idx" ON "events"("site_id", "name");

  CREATE TABLE IF NOT EXISTS "daily_aggregates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "bounce_rate" REAL NOT NULL DEFAULT 0,
    "avg_duration" REAL NOT NULL DEFAULT 0,
    "top_pages" TEXT NOT NULL DEFAULT '[]',
    "top_sources" TEXT NOT NULL DEFAULT '[]',
    "countries" TEXT NOT NULL DEFAULT '[]',
    "browsers" TEXT NOT NULL DEFAULT '[]',
    "devices" TEXT NOT NULL DEFAULT '[]',
    UNIQUE("site_id", "date")
  );

  CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "first_visit" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pages_viewed" TEXT NOT NULL DEFAULT '[]',
    "referrer" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "city" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER
  );

  CREATE INDEX IF NOT EXISTS "sessions_site_id_last_seen_idx" ON "sessions"("site_id", "last_seen");
  CREATE INDEX IF NOT EXISTS "sessions_site_id_device_id_idx" ON "sessions"("site_id", "device_id");

  CREATE TABLE IF NOT EXISTS "event_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "properties_schema" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE,
    UNIQUE ("site_id", "name")
  );

  CREATE TABLE IF NOT EXISTS "pageviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "referrer" TEXT,
    "user_id" TEXT,
    "session_id" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "device" TEXT,
    "duration" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS "pageviews_site_id_created_at_idx" ON "pageviews"("site_id", "created_at");
  CREATE INDEX IF NOT EXISTS "pageviews_session_id_idx" ON "pageviews"("session_id");

  CREATE TABLE IF NOT EXISTS "funnels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
  );
`);

console.log("Database initialized successfully at", dbPath);
db.close();