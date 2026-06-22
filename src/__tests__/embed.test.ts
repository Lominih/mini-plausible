import { describe, it, expect } from 'vitest';
import {
  generateEmbedScript,
  generateEmbedTag,
  generateScriptTag,
} from '../services/embed';

describe('generateEmbedScript', () => {
  it('generates HTML with site ID', () => {
    const html = generateEmbedScript({ siteId: 'abc-123' });
    expect(html).toContain('abc-123');
    expect(html).toContain('Mini Plausible Analytics');
  });

  it('includes the tracking endpoint', () => {
    const html = generateEmbedScript({ siteId: 'abc-123', endpoint: '/api/event' });
    expect(html).toContain('/api/event');
  });

  it('uses custom domain when provided', () => {
    const html = generateEmbedScript({
      siteId: 'abc-123',
      domain: 'https://analytics.example.com',
    });
    expect(html).toContain('https://analytics.example.com/tracker.js');
  });

  it('defaults endpoint to /api/event', () => {
    const html = generateEmbedScript({ siteId: 'abc-123' });
    expect(html).toContain('/api/event');
  });

  it('generates valid HTML structure', () => {
    const html = generateEmbedScript({ siteId: 'abc-123' });
    expect(html).toContain('<script');
    expect(html).toContain('</script>');
    expect(html).toContain('<!--');
  });

  it('includes custom events support when enabled', () => {
    const html = generateEmbedScript({ siteId: 'abc-123', customEvents: true });
    expect(html).toContain('window.mp');
  });

  it('includes hash mode support when enabled', () => {
    const html = generateEmbedScript({ siteId: 'abc-123', hashMode: true });
    expect(html).toContain('hashchange');
  });
});

describe('generateEmbedTag', () => {
  it('generates a single script tag', () => {
    const tag = generateEmbedTag({ siteId: 'test-123' });
    expect(tag).toContain('<script');
    expect(tag).toContain('test-123');
    expect(tag).toContain('tracker.js');
  });

  it('uses defer attribute', () => {
    const tag = generateEmbedTag({ siteId: 'test-123' });
    expect(tag).toContain('defer');
  });

  it('includes data-site-id attribute', () => {
    const tag = generateEmbedTag({ siteId: 'test-123' });
    expect(tag).toContain('data-site-id');
  });

  it('includes data-api-endpoint attribute', () => {
    const tag = generateEmbedTag({ siteId: 'test-123', endpoint: '/collect' });
    expect(tag).toContain('data-api-endpoint');
  });

  it('uses custom domain', () => {
    const tag = generateEmbedTag({ siteId: 'test-123', domain: 'https://stats.io' });
    expect(tag).toContain('https://stats.io/tracker.js');
  });
});

describe('generateScriptTag', () => {
  it('generates a script tag', () => {
    const tag = generateScriptTag({ siteId: 'test-123' });
    expect(tag).toContain('<script');
    expect(tag).toContain('</script>');
  });

  it('includes site ID in data attribute', () => {
    const tag = generateScriptTag({ siteId: 'test-123' });
    expect(tag).toContain('test-123');
  });

  it('defaults to /api/event endpoint', () => {
    const tag = generateScriptTag({ siteId: 'test-123' });
    expect(tag).toContain('/api/event');
  });
});