import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        docs: resolve(__dirname, "docs.html"),
        app: resolve(__dirname, "app/index.html"),
        subscription: resolve(__dirname, "app/subscription.html"),
        login: resolve(__dirname, "auth/login.html"),
        signup: resolve(__dirname, "auth/signup.html"),
        callback: resolve(__dirname, "auth/callback.html"),
      },
    },
  },
});

