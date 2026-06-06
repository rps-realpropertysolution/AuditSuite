# Deploy na Vercel — RPS Audit Suite

App **SPA (Vite + React + react-router)**. Deploy direto na Vercel.

## 1. Importar o projeto
1. Vercel → **Add New… → Project** → importe `rps-realpropertysolution/AuditSuite`.
2. A Vercel detecta **Vite** automaticamente. As configs já estão fixadas em `vercel.json`:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Framework: `vite`
   - **Rewrite SPA** (todas as rotas → `index.html`) — essencial para não dar 404 ao
     recarregar páginas como `/auditoria`, `/planos`, etc.

## 2. Variáveis de ambiente (obrigatório)
Em **Settings → Environment Variables**, adicione (Production + Preview):

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://hpntnbqswgkwjzxsufiy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (a anon key do seu `.env` local) |
| `VITE_SUPABASE_PROJECT_ID` | `hpntnbqswgkwjzxsufiy` |

> A anon key está no seu `.env` local (não foi versionada). É pública por design
> (vai no bundle do front, protegida por RLS), então pode colá-la na Vercel sem problema.
> **Quando migrar para o Supabase definitivo da RPS, troque esses 3 valores.**

## 3. Deploy
Clique em **Deploy**. A cada push na branch `main`, a Vercel refaz o deploy automaticamente.

## 4. Checklist pós-deploy
- [ ] Variáveis `VITE_SUPABASE_*` configuradas (senão o login não conecta).
- [ ] No Supabase: **Authentication → URL Configuration** → adicione o domínio da Vercel
      em **Site URL** e **Redirect URLs** (ex.: `https://audit-suite.vercel.app`), senão
      confirmação de e-mail/redirect falham.
- [ ] Rodar `supabase/seed.sql` (do seu PC, não versionado) para criar os 2 usuários.
