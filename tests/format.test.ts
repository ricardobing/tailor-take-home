import { describe, expect, it } from 'vitest';
import { formatCLP } from '../src/lib/format';

describe('formatCLP', () => {
  it('formatea CLP sin decimales', () => {
    // Normalizamos NBSP: Intl usa espacio duro entre símbolo y monto según ICU.
    expect(formatCLP(8990).replace(/ /g, '')).toBe('$8.990');
    expect(formatCLP(0).replace(/ /g, '')).toBe('$0');
    expect(formatCLP(1234567).replace(/ /g, '')).toBe('$1.234.567');
  });
});
