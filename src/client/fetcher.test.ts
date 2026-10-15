import { afterAll, afterEach, beforeEach, expect, test } from 'bun:test';

import { deleteRole } from '../generated/role-management/role-management';
import { securityScansCodeList } from '../generated/security/security';
import { CodeRabbitApiError } from './fetcher';

const SARIF = '{"version":"2.1.0","runs":[]}\n';

// Bun は handler を抜けた後の Request から headers を読めないので、中で値を取っておく
const seen: { method: string; url: URL; apiKey: string | null }[] = [];
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch(req) {
    seen.push({ method: req.method, url: new URL(req.url), apiKey: req.headers.get('x-coderabbitai-api-key') });
    if (req.method === 'DELETE') return new Response(null, { status: 204 });

    const format = new URL(req.url).searchParams.get('format');
    if (format === 'csv') return new Response('id,state\nf-7,open\n', { headers: { 'content-type': 'text/csv' } });
    if (format === 'sarif') return new Response(SARIF, { headers: { 'content-type': 'application/sarif+json' } });
    if (format === 'bad') return Response.json({ error: 'invalid format' }, { status: 400 });
    return Response.json({ data: [{ id: 'f-7' }], next_cursor: null });
  },
});

const savedEnv = { key: process.env.CODERABBIT_API_KEY, url: process.env.CODERABBIT_API_URL };

beforeEach(() => {
  seen.length = 0;
  process.env.CODERABBIT_API_URL = server.url.origin;
  process.env.CODERABBIT_API_KEY = 'test-key-31';
});
afterEach(() => {
  for (const [name, value] of [['CODERABBIT_API_KEY', savedEnv.key], ['CODERABBIT_API_URL', savedEnv.url]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
afterAll(() => server.stop());

test('sends the API key header to the configured base URL with query params', async () => {
  const res = await securityScansCodeList({ limit: 5 });

  expect(res as unknown).toEqual({ data: [{ id: 'f-7' }], next_cursor: null });
  expect(seen[0]!.apiKey).toBe('test-key-31');
  expect(seen[0]!.url.pathname).toBe('/v1/security/scans/code');
  expect(seen[0]!.url.searchParams.get('limit')).toBe('5');
});

test('keeps a path prefix on the base URL', async () => {
  process.env.CODERABBIT_API_URL = `${server.url.origin}/proxy/`;

  await securityScansCodeList();

  expect(seen[0]!.url.pathname).toBe('/proxy/v1/security/scans/code');
});

test('returns CSV bodies as text', async () => {
  expect((await securityScansCodeList({ format: 'csv' })) as unknown).toBe('id,state\nf-7,open\n');
});

test('returns SARIF bodies as the raw downloaded text', async () => {
  expect((await securityScansCodeList({ format: 'sarif' })) as unknown).toBe(SARIF);
});

test('returns undefined for 204 No Content', async () => {
  expect(await deleteRole('r-9')).toBeUndefined();
  expect(seen[0]!.method).toBe('DELETE');
});

test('throws CodeRabbitApiError with status and body on non-2xx', async () => {
  const err = await securityScansCodeList({ format: 'bad' as never }).catch((e) => e);

  expect(err).toBeInstanceOf(CodeRabbitApiError);
  expect(err.status).toBe(400);
  expect(err.body).toEqual({ error: 'invalid format' });
});

test('refuses to call the API without a key', async () => {
  delete process.env.CODERABBIT_API_KEY;

  await expect(securityScansCodeList()).rejects.toThrow('CODERABBIT_API_KEY is not set');
  expect(seen).toHaveLength(0);
});
