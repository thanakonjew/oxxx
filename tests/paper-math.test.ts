import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildFill,
  fillDeltas,
  formatDecimal,
  immediateFillPrice,
  mul,
  parseDecimal,
  parsePositiveAmount,
  restingLock,
  restingOrderReached,
} from '../lib/server/paper-math.ts'

const d = parseDecimal

describe('parseDecimal / formatDecimal', () => {
  it('round-trips plain values', () => {
    for (const s of ['0', '1', '10000', '0.5', '123.456', '-12.25', '0.000000000000000001']) {
      assert.equal(formatDecimal(d(s)), s)
    }
  })
  it('normalizes database-style values', () => {
    assert.equal(formatDecimal(d('10000.000000000000000000')), '10000')
    assert.equal(formatDecimal(d('0.100000000000000000')), '0.1')
  })
  it('rejects bad input', () => {
    assert.throws(() => d('abc'))
    assert.throws(() => d('1e5'))
    assert.throws(() => d('1.0000000000000000001'))
    assert.throws(() => d(''))
  })
})

describe('parsePositiveAmount', () => {
  it('accepts values within the allowed decimals', () => {
    assert.equal(parsePositiveAmount('0.001', 3), d('0.001'))
    assert.equal(parsePositiveAmount(' 2 ', 3), d('2'))
  })
  it('rejects zero, negatives, extra decimals and non-strings', () => {
    assert.equal(parsePositiveAmount('0', 3), null)
    assert.equal(parsePositiveAmount('0.000', 3), null)
    assert.equal(parsePositiveAmount('-1', 3), null)
    assert.equal(parsePositiveAmount('0.0001', 3), null)
    assert.equal(parsePositiveAmount('1.2.3', 3), null)
    assert.equal(parsePositiveAmount(1, 3), null)
    assert.equal(parsePositiveAmount(undefined, 3), null)
  })
})

describe('mul', () => {
  it('multiplies exactly when decimals fit', () => {
    assert.equal(formatDecimal(mul(d('65000.12'), d('0.015'))), '975.0018')
  })
  it('rounds up only when asked', () => {
    const tiny = d('0.000000000000000003')
    assert.equal(formatDecimal(mul(tiny, d('0.5'))), '0.000000000000000001')
    assert.equal(formatDecimal(mul(tiny, d('0.5'), 'up')), '0.000000000000000002')
  })
})

describe('fills', () => {
  it('charges the fee in the quote asset', () => {
    const fill = buildFill(d('100'), d('2'), d('0.0005'), 'taker')
    assert.equal(formatDecimal(fill.notional), '200')
    assert.equal(formatDecimal(fill.fee), '0.1')
    const buy = fillDeltas('buy', fill)
    assert.equal(formatDecimal(buy.base), '2')
    assert.equal(formatDecimal(buy.quote), '-200.1')
    const sell = fillDeltas('sell', fill)
    assert.equal(formatDecimal(sell.base), '-2')
    assert.equal(formatDecimal(sell.quote), '199.9')
  })
})

describe('immediateFillPrice', () => {
  const bid = d('99')
  const ask = d('101')
  it('fills market orders at the far side of the book', () => {
    assert.equal(immediateFillPrice('buy', 'market', null, bid, ask), ask)
    assert.equal(immediateFillPrice('sell', 'market', null, bid, ask), bid)
  })
  it('fills crossing limit orders at the better book price', () => {
    assert.equal(immediateFillPrice('buy', 'limit', d('105'), bid, ask), ask)
    assert.equal(immediateFillPrice('sell', 'limit', d('95'), bid, ask), bid)
  })
  it('rests limit orders that do not cross', () => {
    assert.equal(immediateFillPrice('buy', 'limit', d('100'), bid, ask), null)
    assert.equal(immediateFillPrice('sell', 'limit', d('100'), bid, ask), null)
  })
  it('requires a price for limit orders', () => {
    assert.throws(() => immediateFillPrice('buy', 'limit', null, bid, ask))
  })
})

describe('resting orders', () => {
  it('detects when the book reaches the limit', () => {
    assert.equal(restingOrderReached('buy', d('100'), d('98'), d('100')), true)
    assert.equal(restingOrderReached('buy', d('100'), d('99'), d('100.5')), false)
    assert.equal(restingOrderReached('sell', d('100'), d('100'), d('101')), true)
    assert.equal(restingOrderReached('sell', d('100'), d('99.5'), d('101')), false)
  })
  it('locks exactly what the maker fill will cost', () => {
    const makerFee = d('0.0002')
    const lock = restingLock('buy', d('100'), d('1.5'), makerFee)
    assert.equal(lock.asset, 'quote')
    const fill = buildFill(d('100'), d('1.5'), makerFee, 'maker')
    assert.equal(lock.amount, -fillDeltas('buy', fill).quote)
    assert.deepEqual(restingLock('sell', d('100'), d('1.5'), makerFee), { asset: 'base', amount: d('1.5') })
  })
})
