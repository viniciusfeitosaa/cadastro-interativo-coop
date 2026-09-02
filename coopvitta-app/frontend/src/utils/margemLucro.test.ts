import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cobrancaFromMargem, margemFromCobranca, roundMoney } from './margemLucro.ts';

describe('margemLucro', () => {
  it('100 e 25% → 133.33', () => {
    assert.equal(cobrancaFromMargem(100, 25), 133.33);
  });

  it('100 e 133.33 → ~25%', () => {
    const m = margemFromCobranca(100, 133.33);
    assert.ok(m != null && Math.abs(m - 25) < 0.02);
  });

  it('margem 100 → null', () => {
    assert.equal(cobrancaFromMargem(100, 100), null);
  });

  it('margem negativa → null', () => {
    assert.equal(cobrancaFromMargem(100, -1), null);
  });

  it('cobrança < repasse → null', () => {
    assert.equal(margemFromCobranca(100, 80), null);
  });

  it('roundMoney', () => {
    assert.equal(roundMoney(133.333), 133.33);
  });
});
