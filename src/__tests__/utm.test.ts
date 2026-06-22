import { describe, it, expect } from 'vitest';
import { extractUTMParams } from '../utils/utm';

describe('extractUTMParams', () => {
  it('returns empty object for empty URL', () => {
    const result = extractUTMParams('');
    expect(result).toEqual({});
  });

  it('returns empty object for URL without UTM params', () => {
    const result = extractUTMParams('https://example.com/page');
    expect(result).toEqual({});
  });

  it('extracts utm_source', () => {
    const result = extractUTMParams('https://example.com/?utm_source=google');
    expect(result.utm_source).toBe('google');
  });

  it('extracts utm_medium', () => {
    const result = extractUTMParams('https://example.com/?utm_medium=cpc');
    expect(result.utm_medium).toBe('cpc');
  });

  it('extracts utm_campaign', () => {
    const result = extractUTMParams('https://example.com/?utm_campaign=summer_sale');
    expect(result.utm_campaign).toBe('summer_sale');
  });

  it('extracts utm_term', () => {
    const result = extractUTMParams('https://example.com/?utm_term=analytics+tool');
    expect(result.utm_term).toBe('analytics tool');
  });

  it('extracts utm_content', () => {
    const result = extractUTMParams('https://example.com/?utm_content=banner_ad');
    expect(result.utm_content).toBe('banner_ad');
  });

  it('extracts all UTM params at once', () => {
    const url =
      'https://example.com/page?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_term=plausible&utm_content=cta_button';
    const result = extractUTMParams(url);
    expect(result).toEqual({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch',
      utm_term: 'plausible',
      utm_content: 'cta_button',
    });
  });

  it('ignores non-UTM query parameters', () => {
    const result = extractUTMParams('https://example.com/?foo=bar&utm_source=google&baz=qux');
    expect(result).toEqual({ utm_source: 'google' });
  });

  it('prefers URL params over body params', () => {
    const result = extractUTMParams('https://example.com/?utm_source=url_val', {
      utm_source: 'body_val',
    });
    expect(result.utm_source).toBe('url_val');
  });

  it('falls back to body params when URL has none', () => {
    const result = extractUTMParams('https://example.com/', {
      utm_source: 'body_val',
      utm_medium: 'social',
    });
    expect(result.utm_source).toBe('body_val');
    expect(result.utm_medium).toBe('social');
  });

  it('handles malformed URL gracefully', () => {
    const result = extractUTMParams('not-a-valid-url');
    expect(result).toEqual({});
  });

  it('handles URL-encoded UTM values', () => {
    const result = extractUTMParams('https://example.com/?utm_campaign=hello%20world');
    expect(result.utm_campaign).toBe('hello world');
  });

  it('ignores empty UTM values', () => {
    const result = extractUTMParams('https://example.com/?utm_source=');
    expect(result.utm_source).toBeUndefined();
  });
});