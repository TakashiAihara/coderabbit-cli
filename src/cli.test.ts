import { expect, test } from 'bun:test';

import { collect } from './cli';

test('collect accumulates key=value pairs and keeps "=" inside values', () => {
  expect(collect('b=x=y', collect('a=1', {}))).toEqual({ a: '1', b: 'x=y' });
});

test('collect rejects input without a key', () => {
  expect(() => collect('=1', {})).toThrow('--query expects key=value');
  expect(() => collect('novalue', {})).toThrow('--query expects key=value');
});
