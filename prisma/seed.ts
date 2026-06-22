import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'admin@example.com';
const DEMO_PASSWORD = 'password123';
const DEMO_SITE_NAME = 'Demo Blog';
const DEMO_DOMAIN = 'demo.example.com';

const PAGES = [
  '/',
  '/about',
  '/blog',
  '/blog/getting-started',
  '/blog/privacy-analytics',
  '/blog/building-with-prisma',
  '/pricing',
  '/docs',
  '/docs/api',
  '/docs/sdk',
  '/contact',
  '/changelog',
];

const CUSTOM_EVENTS = [
  'Signup',
  'Purchase',
  'Download',
  'Outbound Link',
  '404',
  'Search',
];

const BROWSERS = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
const OS_LIST = ['windows', 'macos', 'linux', 'android', 'ios'];
const REFERRERS = [
  null,
  null,
  null,
  null,
  'google',
  'google',
  'twitter',
  'facebook',
  'reddit',
  'bing',
  'linkedin',
  'direct',
];

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'BR', 'IN', 'NL'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDeviceId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) id += '-';
    else id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function randomDate(dayOffset: number, startHour = 6, endHour = 23): Date {
  const base = new Date();
  base.setDate(base.getDate() - (29 - dayOffset));
  base.setHours(randomInt(startHour, endHour), randomInt(0, 59), randomInt(0, 59), 0);
  return base;
}

async function main() {
  console.log('Seeding database...\n');

  // 1. Create demo user
  const hashedPassword = await hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Admin User',
      password: hashedPassword,
    },
  });
  console.log(`  User: ${user.email} (${user.id})`);

  // 2. Create demo site
  const site = await prisma.site.upsert({
    where: { id: 'demo-site-001' },
    update: {},
    create: {
      id: 'demo-site-001',
      name: DEMO_SITE_NAME,
      domain: DEMO_DOMAIN,
      timezone: 'UTC',
      userId: user.id,
    },
  });
  console.log(`  Site: ${site.name} (${site.domain})`);

  // 3. Create site membership
  await prisma.siteMember.upsert({
    where: { id: 'demo-member-001' },
    update: {},
    create: {
      id: 'demo-member-001',
      siteId: site.id,
      userId: user.id,
      role: 'owner',
    },
  });

  // 4. Create event definitions
  for (const eventName of CUSTOM_EVENTS) {
    await prisma.eventDefinition.upsert({
      where: {
        siteId_name: { siteId: site.id, name: eventName },
      },
      update: {},
      create: {
        siteId: site.id,
        name: eventName,
        propertiesSchema: '{}',
      },
    });
  }

  // 5. Generate device pool
  const deviceIds: string[] = [];
  for (let i = 0; i < 200; i++) {
    deviceIds.push(generateDeviceId());
  }

  // 6. Generate 30 days of events
  console.log('  Generating events for 30 days...');
  let totalEvents = 0;

  for (let day = 0; day < 30; day++) {
    // More events on weekdays, fewer on weekends
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - (29 - day));
    const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
    const eventsPerDay = isWeekend ? randomInt(30, 60) : randomInt(80, 150);

    const events: Array<{
      siteId: string;
      name: string;
      url: string;
      referrer: string | null;
      screenWidth: number;
      screenHeight: number;
      browser: string;
      os: string;
      country: string;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      deviceId: string;
      sessionId: string;
      props: string;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < eventsPerDay; i++) {
      const isCustomEvent = Math.random() < 0.15;
      const eventName = isCustomEvent ? randomItem(CUSTOM_EVENTS) : 'pageview';
      const deviceIdx = randomInt(0, deviceIds.length - 1);
      const deviceId = deviceIds[deviceIdx];
      // Session ID: same for events within a short period from the same device
      const sessionId = `${deviceId.substring(0, 8)}-${day}-${Math.floor(i / 3)}`;

      const hasUTM = Math.random() < 0.25;
      const screenWidth = randomItem([375, 414, 768, 1024, 1280, 1440, 1920, 2560]);

      events.push({
        siteId: site.id,
        name: eventName,
        url: randomItem(PAGES),
        referrer: randomItem(REFERRERS),
        screenWidth,
        screenHeight: Math.round(screenWidth * 0.56),
        browser: randomItem(BROWSERS),
        os: randomItem(OS_LIST),
        country: randomItem(COUNTRIES),
        utmSource: hasUTM ? randomItem(['google', 'newsletter', 'twitter', 'facebook', 'reddit']) : null,
        utmMedium: hasUTM ? randomItem(['cpc', 'email', 'social', 'organic', 'referral']) : null,
        utmCampaign: hasUTM ? randomItem(['spring_sale', 'product_launch', 'blog_promo', 'brand_awareness']) : null,
        deviceId,
        sessionId,
        props: isCustomEvent
          ? JSON.stringify({ plan: randomItem(['free', 'pro', 'enterprise']) })
          : '{}',
        createdAt: randomDate(day),
      });
    }

    // Batch insert events for this day
    const batchSize = 50;
    for (let b = 0; b < events.length; b += batchSize) {
      const batch = events.slice(b, b + batchSize);
      await prisma.event.createMany({ data: batch });
    }

    // Create a daily aggregate
    const uniqueDevices = new Set(events.map((e) => e.deviceId));
    const sessions = new Set(events.map((e) => e.sessionId));
    const singlePageSessions = new Set<string>();
    const sessionPageCounts = new Map<string, number>();
    for (const e of events) {
      sessionPageCounts.set(e.sessionId, (sessionPageCounts.get(e.sessionId) ?? 0) + 1);
    }
    for (const [sid, count] of sessionPageCounts) {
      if (count === 1) singlePageSessions.add(sid);
    }

    const aggregateDate = new Date(baseDate);
    aggregateDate.setHours(0, 0, 0, 0);

    await prisma.dailyAggregate.upsert({
      where: { siteId_date: { siteId: site.id, date: aggregateDate } },
      update: {},
      create: {
        siteId: site.id,
        date: aggregateDate,
        pageviews: events.filter((e) => e.name === 'pageview').length,
        visitors: uniqueDevices.size,
        sessions: sessions.size,
        bounceRate: sessions.size > 0 ? Math.round((singlePageSessions.size / sessions.size) * 100) / 100 : 0,
        avgDuration: randomInt(30, 300),
        topPages: JSON.stringify(PAGES.slice(0, 5).map((p) => ({ url: p, count: randomInt(5, 50) }))),
        topSources: JSON.stringify(
          ['google', 'twitter', 'facebook', 'direct'].map((s) => ({
            referrer: s,
            count: randomInt(2, 30),
          })),
        ),
        countries: JSON.stringify(
          COUNTRIES.slice(0, 5).map((c) => ({
            country: c,
            count: randomInt(3, 25),
          })),
        ),
        browsers: JSON.stringify(
          BROWSERS.map((b) => ({
            browser: b,
            count: randomInt(5, 40),
          })),
        ),
        devices: JSON.stringify([
          { screenWidth: '<768', count: randomInt(10, 30) },
          { screenWidth: '768-1024', count: randomInt(5, 20) },
          { screenWidth: '1024-1440', count: randomInt(10, 25) },
          { screenWidth: '>1440', count: randomInt(10, 30) },
        ]),
      },
    });

    totalEvents += events.length;
    process.stdout.write(`  Day ${day + 1}/30: ${events.length} events\r`);
  }

  console.log('\n');

  // 7. Create sample funnels
  const funnel1 = await prisma.funnel.create({
    data: {
      siteId: site.id,
      userId: user.id,
      name: 'Homepage → Signup → Purchase',
      steps: JSON.stringify([
        { type: 'page', value: '/' },
        { type: 'event', value: 'Signup' },
        { type: 'event', value: 'Purchase' },
      ]),
    },
  });

  const funnel2 = await prisma.funnel.create({
    data: {
      siteId: site.id,
      userId: user.id,
      name: 'Blog → Docs → Signup',
      steps: JSON.stringify([
        { type: 'page', value: '/blog' },
        { type: 'page', value: '/docs' },
        { type: 'event', value: 'Signup' },
      ]),
    },
  });

  console.log(`  Funnels: ${funnel1.name}, ${funnel2.name}`);
  console.log(`\nSeed complete:`);
  console.log(`    User:       ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`    Site:       ${DEMO_DOMAIN} (id: ${site.id})`);
  console.log(`    Events:     ${totalEvents}`);
  console.log(`    Funnels:    2`);
  console.log(`    Aggregates: 30 days`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });