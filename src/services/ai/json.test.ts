import { describe, expect, it } from 'vitest';
import { extractJson } from './json';
import { AiError } from './types';

describe('extractJson', () => {
  it('parses plain JSON objects and arrays', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('  [1, 2] ')).toEqual([1, 2]);
  });

  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a": "b"}\n```')).toEqual({ a: 'b' });
    expect(extractJson('```\n{"a": "b"}\n```')).toEqual({ a: 'b' });
  });

  it('tolerates prose before and after', () => {
    expect(extractJson('Sure! Here is the plan:\n{"tasks": []}\nLet me know.')).toEqual({ tasks: [] });
    expect(extractJson('Result: [1,2,3]. Done.')).toEqual([1, 2, 3]);
  });

  it('prefers a fenced block over braces in the surrounding prose', () => {
    expect(extractJson('Note {not json}\n```json\n{"ok": true}\n```')).toEqual({ ok: true });
  });

  it('handles nested braces and brackets inside strings', () => {
    const text = 'x {"s": "a } b ] c \\" d", "n": {"m": [1, {"k": "}"}]}} y';
    expect(extractJson(text)).toEqual({ s: 'a } b ] c " d', n: { m: [1, { k: '}' }] } });
  });

  it('skips a non-JSON brace group in the prose before the payload', () => {
    expect(extractJson('Note {not json} then {"ok": true} and [x]')).toEqual({ ok: true });
    expect(extractJson('Use {a} or {b} or {c}: [1, 2]')).toEqual([1, 2]);
  });

  it('handles arrays of objects with escaped quotes and brackets in strings', () => {
    expect(extractJson('Here: [{"t": "say \\"hi]\\""}, {"t": "[x]"}]')).toEqual([{ t: 'say "hi]"' }, { t: '[x]' }]);
  });

  it('gives up quickly on pathological input', () => {
    const started = Date.now();
    expect(() => extractJson('{'.repeat(200_000))).toThrow(AiError);
    expect(() => extractJson('{a} '.repeat(50_000))).toThrow(AiError);
    expect(() => extractJson('"' + '\\"'.repeat(100_000))).toThrow(AiError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not tolerate trailing commas', () => {
    expect(() => extractJson('{"a": 1,}')).toThrow(AiError);
  });

  it('throws AiError kind parse with an excerpt for non-JSON', () => {
    let caught: unknown;
    try {
      extractJson('I cannot help with that request because it is unclear what you want from me here today.', 'openai');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AiError);
    const err = caught as AiError;
    expect(err.kind).toBe('parse');
    expect(err.providerId).toBe('openai');
    expect(err.message).toContain('I cannot help');
    expect(err.message.length).toBeLessThan(140);
  });

  it('throws on empty or non-string input', () => {
    expect(() => extractJson('')).toThrow(AiError);
    expect(() => extractJson(undefined as unknown as string)).toThrow(AiError);
  });
});
