import { afterAll, expect, spyOn, test } from 'bun:test';
import { InvalidArgumentError } from 'commander';

import { collect, program } from './cli';

test('collect accumulates key=value pairs and keeps "=" inside values', () => {
  expect(collect('b=x=y', collect('a=1', {}))).toEqual({ a: '1', b: 'x=y' });
});

test('collect rejects input without a key', () => {
  expect(() => collect('=1', {})).toThrow(InvalidArgumentError);
  expect(() => collect('novalue', {})).toThrow('expected key=value');
});

const paths: string[] = [];
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch(req) {
    const url = new URL(req.url);
    paths.push(`${url.pathname}${url.search}`);
    if (url.searchParams.get('format') === 'csv') return new Response('a,b\n1,2\n', { headers: { 'content-type': 'text/csv' } });
    return Response.json({ ok: true });
  },
});
afterAll(() => server.stop());

const run = async (...args: string[]) => {
  const saved = { key: process.env.CODERABBIT_API_KEY, url: process.env.CODERABBIT_API_URL };
  process.env.CODERABBIT_API_KEY = 'k';
  process.env.CODERABBIT_API_URL = server.url.origin;
  const out = spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    await program.parseAsync(args, { from: 'user' });
    return out.mock.calls.map((c) => String(c[0])).join('');
  } finally {
    out.mockRestore();
    for (const [name, value] of [['CODERABBIT_API_KEY', saved.key], ['CODERABBIT_API_URL', saved.url]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

test('commands call their API path with the given query', async () => {
  paths.length = 0;
  await run('security-code', '-q', 'limit=3', '-q', 'state=open');
  await run('repositories', 'org-5');
  await run('role', 'r-8');

  expect(paths).toEqual([
    '/v1/security/scans/code?limit=3&state=open',
    '/v1/organizations/org-5/repositories',
    '/v1/roles/r-8',
  ]);
});

test('prints JSON pretty and text bodies verbatim', async () => {
  expect(await run('users')).toBe('{\n  "ok": true\n}\n');
  expect(await run('security-code', '-q', 'format=csv')).toBe('a,b\n1,2\n');
});
