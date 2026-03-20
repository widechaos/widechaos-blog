// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://blog.widechaos.cn",
  redirects: {
    "/archive": "/blog",
    "/proyectos": "/projects",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
});
