const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** 8990 → "$8.990" (CLP, sin decimales). */
export function formatCLP(amount: number): string {
  return clp.format(amount);
}
