/// <reference types="vite/client" />

declare global {
  interface Window {
    __SUPABASE__?: {
      url?: string;
      anonKey?: string;
    };
  }
}

export {};

