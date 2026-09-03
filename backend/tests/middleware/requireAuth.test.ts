import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const getUser = vi.fn();
const getUserById = vi.fn();

vi.mock('../../src/db/client.js', () => ({ supabase: { auth: { getUser: (...a: unknown[]) => getUser(...a) } } }));
vi.mock('../../src/db/index.js', () => ({ getUserById: (...a: unknown[]) => getUserById(...a) }));

const { requireAuth } = await import('../../src/middleware/requireAuth.js');

function fakeReq(authHeader: string | undefined): Request {
  return { header: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : undefined) } as unknown as Request;
}

beforeEach(() => {
  getUser.mockReset();
  getUserById.mockReset();
});

describe('requireAuth', () => {
  it('401s (via next(err)) when there is no Authorization header', async () => {
    const next = vi.fn();
    await requireAuth(fakeReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });

  it('401s when the token does not verify with Supabase Auth', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const next = vi.fn();
    await requireAuth(fakeReq('Bearer bad-token'), {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });

  it('403s when the verified account has no matching public.users row', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    getUserById.mockResolvedValue(null);
    const next = vi.fn();
    await requireAuth(fakeReq('Bearer good-token'), {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403 });
  });

  it('attaches req.user and calls next() with no error on a valid session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    getUserById.mockResolvedValue({
      id: 'auth-user-1',
      organisation_id: 'org-1',
      role: 'pm',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const req = fakeReq('Bearer good-token');
    const next = vi.fn();
    await requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(); // called with no arguments = success
    expect(req.user).toEqual({ id: 'auth-user-1', organisationId: 'org-1', role: 'pm', email: 'test@example.com' });
  });
});
