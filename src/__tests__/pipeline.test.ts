import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventQueue, RawEvent } from '../services/pipeline';

function makePartialPrisma() {
  return {
    event: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  } as any;
}

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    siteId: 'site-1',
    name: 'pageview',
    url: 'https://example.com/',
    ...overrides,
  };
}

describe('EventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty buffer', () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma);
    expect(queue.getBufferSize()).toBe(0);
  });

  it('enqueues events into buffer', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 0 });
    await queue.enqueue(makeEvent());
    expect(queue.getBufferSize()).toBe(1);
  });

  it('deduplicates events within the window', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 30000 });

    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/page' }));
    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/page' }));

    expect(queue.getBufferSize()).toBe(1);
  });

  it('allows events with different device IDs', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 30000 });

    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/page' }));
    await queue.enqueue(makeEvent({ deviceId: 'd2', url: '/page' }));

    expect(queue.getBufferSize()).toBe(2);
  });

  it('allows events with different URLs for the same device', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 30000 });

    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/page1' }));
    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/page2' }));

    expect(queue.getBufferSize()).toBe(2);
  });

  it('auto-flushes when buffer reaches max size', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, {
      bufferSize: 2,
      batchSize: 2,
      dedupWindowMs: 0,
    });

    await queue.enqueue(makeEvent({ url: '/page0' }));
    await queue.enqueue(makeEvent({ url: '/page1' }));
    // buffer now has 2 items
    await queue.enqueue(makeEvent({ url: '/page2' }));
    // the 3rd enqueue sees buffer.length(2) >= bufferSize(2), so it flushes first

    expect(prisma.event.createMany).toHaveBeenCalledTimes(1);
  });

  it('flushes events and inserts into database', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 0 });

    await queue.enqueue(makeEvent({ url: '/a' }));
    await queue.enqueue(makeEvent({ url: '/b' }));
    await queue.flush();

    expect(prisma.event.createMany).toHaveBeenCalledTimes(1);
    const callArgs = prisma.event.createMany.mock.calls[0][0];
    expect(callArgs.data).toHaveLength(2);
  });

  it('normalizes browser names on flush', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 0 });

    await queue.enqueue(
      makeEvent({ browser: 'Google Chrome', os: 'Windows NT 10.0' }),
    );
    await queue.flush();

    const data = prisma.event.createMany.mock.calls[0][0].data;
    expect(data[0].browser).toBe('chrome');
    expect(data[0].os).toBe('windows');
  });

  it('normalizes referrer domains', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 0 });

    await queue.enqueue(makeEvent({ referrer: 'https://www.google.com/search?q=test' }));
    await queue.flush();

    const data = prisma.event.createMany.mock.calls[0][0].data;
    expect(data[0].referrer).toBe('google');
  });

  it('normalizes URL to pathname', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 0 });

    await queue.enqueue(makeEvent({ url: 'https://example.com/path?foo=bar#hash' }));
    await queue.flush();

    const data = prisma.event.createMany.mock.calls[0][0].data;
    expect(data[0].url).toBe('/path?foo=bar#hash');
  });

  it('flushes empty buffer without error', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma);
    await queue.flush();
    expect(prisma.event.createMany).not.toHaveBeenCalled();
  });

  it('batches inserts when event count exceeds batch size', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, {
      bufferSize: 10,
      batchSize: 2,
      dedupWindowMs: 0,
    });

    for (let i = 0; i < 4; i++) {
      await queue.enqueue(makeEvent({ url: `/p${i}` }));
    }
    await queue.flush();

    expect(prisma.event.createMany).toHaveBeenCalledTimes(2);
  });

  it('cleans up old dedup entries', async () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { dedupWindowMs: 1000 });

    await queue.enqueue(makeEvent({ deviceId: 'd1', url: '/a' }));
    vi.advanceTimersByTime(5000);

    queue.cleanupDedupMap();
    expect(queue.getBufferSize()).toBe(1);
  });

  it('start and stop manage the flush timer', () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma, { flushIntervalMs: 1000 });

    queue.start();
    queue.stop();

    expect(queue.getBufferSize()).toBe(0);
  });

  it('does not start duplicate timers', () => {
    const prisma = makePartialPrisma();
    const queue = new EventQueue(prisma);

    queue.start();
    queue.start();
    queue.stop();
  });
});