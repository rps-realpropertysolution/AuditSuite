
DROP VIEW IF EXISTS public.v_operational_scores;
CREATE VIEW public.v_operational_scores
WITH (security_invoker = true) AS
SELECT a.empreendimento_id,
  to_char(date_trunc('month', a.created_at), 'YYYY-MM') AS periodo,
  i.category_id,
  COUNT(*) FILTER (WHERE a.status <> 'nao_aplicavel') AS total,
  COUNT(*) FILTER (WHERE a.status='conforme') AS conformes,
  COUNT(*) FILTER (WHERE a.status='nao_conforme') AS nao_conformes,
  COUNT(*) FILTER (WHERE a.status='parcial') AS parciais,
  COUNT(*) FILTER (WHERE a.status='pendente') AS pendentes,
  ROUND((SUM(CASE a.status WHEN 'conforme' THEN 100 WHEN 'parcial' THEN 50 WHEN 'pendente' THEN 25 WHEN 'nao_conforme' THEN 0 ELSE NULL END)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE a.status<>'nao_aplicavel'),0)),1) AS score
FROM public.audit_answers a
JOIN public.audit_items i ON i.id = a.item_id
GROUP BY a.empreendimento_id, periodo, i.category_id;
