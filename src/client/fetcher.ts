const DEFAULT_BASE_URL = 'https://api.coderabbit.ai';

export class CodeRabbitApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`CodeRabbit API ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
}

// Orval の mutator。生成された各関数はパスとクエリだけを渡してくるので、接続先と API key をここで足す
export const coderabbitFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const apiKey = process.env.CODERABBIT_API_KEY;
  if (!apiKey) throw new Error('CODERABBIT_API_KEY is not set');

  const baseUrl = process.env.CODERABBIT_API_URL ?? DEFAULT_BASE_URL;
  const headers = new Headers(options.headers);
  headers.set('x-coderabbitai-api-key', apiKey);

  const res = await fetch(new URL(url, baseUrl), { ...options, headers });

  // format=csv / sarif の応答は JSON ではないので本文をそのまま返す
  // shortcut: 生成型が Blob と言う operation にも文字列を返す。バイナリを返す API が出たら content-type で分ける
  const isJson = res.headers.get('content-type')?.includes('json') ?? false;
  const body = res.status === 204 ? undefined : isJson ? await res.json() : await res.text();

  if (!res.ok) throw new CodeRabbitApiError(res.status, body);
  return body as T;
};
