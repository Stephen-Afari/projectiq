import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { verifyWebhookSecret } from '../../src/middleware/verifyWebhookSecret.js';
import { ApiError } from '../../src/lib/ApiError.js';
import { config } from '../../src/config.js';

function fakeReq(headerValue: string | undefined): Request {
  return { header: () => headerValue } as unknown as Request;
}

describe('verifyWebhookSecret', () => {
  it('rejects a request with no secret header at all', () => {
    const next = () => {};
    expect(() => verifyWebhookSecret(fakeReq(undefined), {} as Response, next)).toThrow(ApiError);
  });

  it('rejects a request with a wrong secret', () => {
    const next = () => {};
    expect(() => verifyWebhookSecret(fakeReq('definitely-not-the-secret'), {} as Response, next)).toThrow(
      ApiError,
    );
  });

  it('rejects with a 401 status code specifically', () => {
    try {
      verifyWebhookSecret(fakeReq('wrong'), {} as Response, () => {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(401);
    }
  });

  it('calls next() with no error when the secret matches exactly', () => {
    let called = false;
    const next = () => {
      called = true;
    };
    expect(() => verifyWebhookSecret(fakeReq(config.n8nWebhookSecret), {} as Response, next)).not.toThrow();
    expect(called).toBe(true);
  });
});
