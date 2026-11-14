// Configuração mínima para rodar scripts de manutenção com vite-node
// (resolve o alias "@/" e os imports sem extensão de src/).
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
});
