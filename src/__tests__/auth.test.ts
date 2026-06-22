import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mini-plausible-dev-secret-change-in-production';

function generateToken(payload: { userId: string; email: string; siteAccess?: string[] }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

describe('Auth (JWT)', () => {
  it('generates a valid JWT token', () => {
    const token = generateToken({ userId: 'user-1', email: 'test@example.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifies a valid token and returns payload', () => {
    const payload = { userId: 'user-1', email: 'test@example.com' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe('user-1');
    expect(decoded.email).toBe('test@example.com');
  });

  it('includes siteAccess in the payload', () => {
    const payload = {
      userId: 'user-1',
      email: 'test@example.com',
      siteAccess: ['site-a', 'site-b'],
    };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.siteAccess).toEqual(['site-a', 'site-b']);
  });

  it('rejects an invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('rejects a token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 'user-1' }, 'wrong-secret', { expiresIn: '7d' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, JWT_SECRET, {
      expiresIn: '-1s',
    });
    expect(() => verifyToken(token)).toThrow();
  });

  it('handles missing siteAccess gracefully', () => {
    const token = generateToken({ userId: 'user-1', email: 'test@example.com' });
    const decoded = verifyToken(token);
    expect(decoded.siteAccess).toBeUndefined();
  });

  it('token contains standard JWT fields', () => {
    const token = generateToken({ userId: 'user-1', email: 'test@example.com' });
    const decoded = verifyToken(token);
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });
});