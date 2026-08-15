import { variaveisAusentes } from "@/integrations/supabase/client";

/**
 * Mostrada quando o build saiu sem as variáveis do Supabase.
 *
 * Não depende de Tailwind processado nem de nenhum provider — usa estilo
 * inline de propósito, para funcionar mesmo que o resto da aplicação não suba.
 */
const ConfiguracaoAusente = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "#f3f6f9",
      fontFamily: "Montserrat, system-ui, -apple-system, sans-serif",
      color: "#1b2733",
    }}
  >
    <main
      style={{
        maxWidth: "640px",
        width: "100%",
        background: "#fff",
        border: "1px solid #d5dee6",
        borderRadius: "12px",
        padding: "32px",
        boxShadow: "0 18px 50px -24px rgba(27,39,51,0.35)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#0a4a75",
        }}
      >
        RGM Insights · RPS Global
      </p>

      <h1 style={{ margin: "10px 0 0", fontSize: "24px", lineHeight: 1.25 }}>
        A aplicação subiu sem a configuração do Supabase
      </h1>

      <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: 1.6, color: "#4a5b6b" }}>
        O build foi publicado sem {variaveisAusentes.length === 1 ? "a variável" : "as variáveis"} de
        ambiente {variaveisAusentes.length === 1 ? "necessária" : "necessárias"}. Sem{" "}
        {variaveisAusentes.length === 1 ? "ela" : "elas"} não há como conectar ao banco, então
        nenhuma tela consegue carregar.
      </p>

      <ul
        style={{
          margin: "18px 0 0",
          padding: "14px 16px",
          listStyle: "none",
          background: "#fdf6e7",
          border: "1px solid #e8c877",
          borderRadius: "8px",
        }}
      >
        {variaveisAusentes.map((v) => (
          <li
            key={v}
            style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: "13px", fontWeight: 700, padding: "3px 0" }}
          >
            {v}
          </li>
        ))}
      </ul>

      <h2 style={{ margin: "26px 0 0", fontSize: "15px" }}>Como resolver na Vercel</h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: "20px", fontSize: "14px", lineHeight: 1.75, color: "#4a5b6b" }}>
        <li>
          Abra <strong>Project Settings → Environment Variables</strong>
        </li>
        <li>
          Adicione as chaves acima (valores em <strong>Supabase → Project Settings → API</strong>:
          Project URL e chave <em>anon / publishable</em>)
        </li>
        <li>
          Marque os ambientes <strong>Production</strong>, <strong>Preview</strong> e{" "}
          <strong>Development</strong>
        </li>
        <li>
          Vá em <strong>Deployments</strong> e clique em <strong>Redeploy</strong> — variável nova só
          vale para build novo
        </li>
      </ol>

      <p style={{ margin: "22px 0 0", fontSize: "13px", lineHeight: 1.6, color: "#6b7b8b" }}>
        Rodando local? Copie <code>.env.example</code> para <code>.env</code>, preencha e reinicie o{" "}
        <code>npm run dev</code>.
      </p>

      <p style={{ margin: "16px 0 0", fontSize: "13px", lineHeight: 1.6, color: "#a33" }}>
        Use sempre a chave pública (anon/publishable). A chave <code>service_role</code> ignora todas
        as regras de segurança do banco e nunca deve ir para o frontend.
      </p>
    </main>
  </div>
);

export default ConfiguracaoAusente;
