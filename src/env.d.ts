/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** URL /exec del Web App de Apps Script. Pública por diseño (visible en el network tab). */
  readonly PUBLIC_SHEETS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
