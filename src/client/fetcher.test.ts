import { afterAll, beforeEach, expect, test } from 'bun:test';

import { securityScansCodeList } from '../generated/security/security';
import { CodeRabbitApiError } from './fetcher';

// Bun は handler を抜けた後の Request から headers を読めないので、中で値を取っておく
const seen: { url: URL; apiKey: string | null }[] = [];
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch(req) {
    seen.push({ url: new URL(req.url), apiKey: req.headers.get('x-coderabbitai-api-key') });
    const format = new URL(req.url).searchParams.get('format');
    if (format === 'csv') return new Response('id,state\nf-7,open\n', { headers: { 'content-type': 'text/csv' } });
    if (format === 'bad') return Response.json({ error: 'invalid format' }, { status: 400 });
    return Response.json({ data: [{ id: 'f-7' }], next_cursor: null });
  },
});

beforeEach(() => {
  seen.length = 0;
  process.env.CODERABBIT_API_URL = server.url.origin;
  process.env.CODERABBIT_API_KEY = 'test-key-31';
});
afterAll(() => server.stop());

test('sends the API key header to the configured base URL with query params', async () => {
  const res = await securityScansCodeList({ limit: 5 });

  expect(res as unknown).toEqual({ data: [{ id: 'f-7' }], next_cursor: null });
  expect(seen[0]!.apiKey).toBe('test-key-31');
  expect(seen[0]!.url.pathname).toBe('/v1/security/scans/code');
  expect(seen[0]!.url.searchParams.get('limit')).toBe('5');
});

test('returns non-JSON bodies as text', async () => {
  expect((await securityScansCodeList({ format: 'csv' })) as unknown).toBe('id,state\nf-7,open\n');
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
