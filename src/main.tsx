import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ConfiguracaoAusente from "./pages/ConfiguracaoAusente.tsx";
import { supabaseConfigurado } from "@/integrations/supabase/client";
import "./index.css";

// Sem configuração de Supabase nada carrega. Melhor explicar o que falta
// do que entregar uma tela branca com o erro escondido no console.
createRoot(document.getElementById("root")!).render(
  supabaseConfigurado ? <App /> : <ConfiguracaoAusente />,
);
