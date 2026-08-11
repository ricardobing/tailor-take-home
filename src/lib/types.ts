/** Producto tal como lo expone el doGet de Apps Script. Precios en CLP enteros. */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
}

/** Estado del carrito: id de producto → cantidad. Se persiste en localStorage. */
export type CartState = Record<string, number>;

/** Línea de carrito resuelta contra el menú (para render y para la orden). */
export interface CartLine {
  product: Product;
  qty: number;
  subtotal: number;
}

/** Payload que espera el doPost de Apps Script. */
export interface OrderPayload {
  order_id: string;
  name: string;
  email: string;
  items: Array<{ id: string; qty: number }>;
  total: number;
  /** Honeypot anti-bots: los humanos no lo ven, siempre viaja vacío. */
  website: string;
}

export interface SubmitResult {
  ok: boolean;
  order_id?: string;
  total?: number;
  status?: string;
  duplicate?: boolean;
  error?: string;
}
