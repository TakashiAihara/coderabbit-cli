import { defineConfig } from 'orval';

export default defineConfig({
  coderabbit: {
    input: { target: './openapi/coderabbit.json' },
    output: {
      target: './src/generated',
      schemas: './src/generated/schemas',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      override: {
        mutator: { path: './src/client/fetcher.ts', name: 'coderabbitFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
