import { defineConfig } from "vitest/config";
import path from "path";

// Tests unitarios de la lógica pura (cálculos de plata, fechas, scoring).
// Apuntan a funciones sin efectos (no tocan DB ni red).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
