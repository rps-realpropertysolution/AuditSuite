
DO $$ BEGIN CREATE TYPE public.criticidade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.answer_status AS ENUM ('conforme','nao_conforme','parcial','nao_aplicavel','pendente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.action_status AS ENUM ('aberto','em_andamento','concluido','vencido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_executive(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('diretoria','administrador','diretor','gerente_regional'))
$$;

CREATE OR REPLACE FUNCTION public.can_view_empreendimento(_user_id uuid, _emp_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_executive(_user_id) OR public.get_user_empreendimento(_user_id) = _emp_id
$$;

CREATE OR REPLACE FUNCTION public.can_edit_empreendimento(_user_id uuid, _emp_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_executive(_user_id)
      OR (public.has_role(_user_id,'gestor') AND public.get_user_empreendimento(_user_id) = _emp_id)
      OR (public.has_role(_user_id,'auditor') AND public.get_user_empreendimento(_user_id) = _emp_id)
$$;

CREATE TABLE public.audit_categories (
  id serial PRIMARY KEY, codigo text NOT NULL UNIQUE, nome text NOT NULL,
  descricao text, ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cats" ON public.audit_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "exec cats" ON public.audit_categories FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

CREATE TABLE public.audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  category_id int NOT NULL REFERENCES public.audit_categories(id) ON DELETE CASCADE,
  pergunta text NOT NULL, descricao text,
  criticidade public.criticidade NOT NULL DEFAULT 'media',
  evidencia_obrigatoria boolean NOT NULL DEFAULT false,
  sla_dias int NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_cat ON public.audit_items(category_id);
ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read items" ON public.audit_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "exec items" ON public.audit_items FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));
CREATE TRIGGER trg_items_upd BEFORE UPDATE ON public.audit_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.audit_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.audit_items(id) ON DELETE CASCADE,
  empreendimento_id uuid NOT NULL,
  status public.answer_status NOT NULL DEFAULT 'pendente',
  comentario text, responsavel text,
  prazo date, data_conclusao date, answered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, item_id)
);
CREATE INDEX idx_ans_rep ON public.audit_answers(report_id);
CREATE INDEX idx_ans_emp ON public.audit_answers(empreendimento_id);
CREATE INDEX idx_ans_status ON public.audit_answers(status);
ALTER TABLE public.audit_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view ans" ON public.audit_answers FOR SELECT TO authenticated
  USING (public.can_view_empreendimento(auth.uid(), empreendimento_id));
CREATE POLICY "edit ans" ON public.audit_answers FOR ALL TO authenticated
  USING (public.can_edit_empreendimento(auth.uid(), empreendimento_id))
  WITH CHECK (public.can_edit_empreendimento(auth.uid(), empreendimento_id));
CREATE TRIGGER trg_ans_upd BEFORE UPDATE ON public.audit_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.audit_answers(id) ON DELETE CASCADE,
  empreendimento_id uuid NOT NULL,
  storage_path text NOT NULL, file_name text NOT NULL,
  mime_type text, size_bytes bigint, uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ev_ans ON public.evidences(answer_id);
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v ev" ON public.evidences FOR SELECT TO authenticated
  USING (public.can_view_empreendimento(auth.uid(), empreendimento_id));
CREATE POLICY "i ev" ON public.evidences FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_empreendimento(auth.uid(), empreendimento_id));
CREATE POLICY "d ev" ON public.evidences FOR DELETE TO authenticated
  USING (public.can_edit_empreendimento(auth.uid(), empreendimento_id));

CREATE TABLE public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid REFERENCES public.audit_answers(id) ON DELETE CASCADE,
  empreendimento_id uuid NOT NULL,
  titulo text NOT NULL, descricao text, acao_corretiva text, responsavel text,
  prioridade public.criticidade NOT NULL DEFAULT 'media',
  status public.action_status NOT NULL DEFAULT 'aberto',
  prazo date, data_conclusao date,
  evidencia_conclusao text, observacoes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_act_emp ON public.action_plans(empreendimento_id);
CREATE INDEX idx_act_st ON public.action_plans(status);
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v act" ON public.action_plans FOR SELECT TO authenticated
  USING (public.can_view_empreendimento(auth.uid(), empreendimento_id));
CREATE POLICY "e act" ON public.action_plans FOR ALL TO authenticated
  USING (public.can_edit_empreendimento(auth.uid(), empreendimento_id))
  WITH CHECK (public.can_edit_empreendimento(auth.uid(), empreendimento_id));
CREATE TRIGGER trg_act_upd BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.auto_create_action_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item public.audit_items%ROWTYPE; sla int;
BEGIN
  IF NEW.status = 'nao_conforme' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO item FROM public.audit_items WHERE id = NEW.item_id;
    sla := CASE item.criticidade WHEN 'critica' THEN 2 WHEN 'alta' THEN 5 WHEN 'media' THEN 10 ELSE 30 END;
    INSERT INTO public.action_plans(answer_id, empreendimento_id, titulo, descricao, prioridade, prazo, status)
    VALUES (NEW.id, NEW.empreendimento_id,
      'NC: '||item.codigo||' - '||item.pergunta, NEW.comentario, item.criticidade,
      CURRENT_DATE + sla, 'aberto');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_act AFTER INSERT OR UPDATE ON public.audit_answers
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_action_plan();

INSERT INTO storage.buckets (id, name, public) VALUES ('audit-evidences','audit-evidences', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "ev bucket view" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='audit-evidences' AND public.can_view_empreendimento(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "ev bucket up" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='audit-evidences' AND public.can_edit_empreendimento(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "ev bucket del" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='audit-evidences' AND public.can_edit_empreendimento(auth.uid(), ((storage.foldername(name))[1])::uuid));

INSERT INTO public.audit_categories (codigo, nome, ordem) VALUES
  ('CTR','Contratos e Documentos',1),('FIN','Financeiro',2),('OPR','Operação',3),
  ('MAN','Manutenção',4),('SPT','Segurança Patrimonial',5),('SST','Segurança do Trabalho',6),
  ('ATD','Atendimento e Governança',7),('LEG','Obrigações Legais',8),
  ('FOR','Prestadores e Fornecedores',9),('EVD','Evidências e Registros',10);

INSERT INTO public.audit_items (codigo, category_id, pergunta, criticidade, evidencia_obrigatoria, sla_dias, ordem) VALUES
  ('CTR-01',1,'Contrato de prestação de serviços vigente e assinado?','critica',true,5,1),
  ('CTR-02',1,'Aditivos e renovações documentados?','alta',true,10,2),
  ('CTR-03',1,'Apólices de seguro válidas?','critica',true,5,3),
  ('FIN-01',2,'Prestação de contas mensal entregue no prazo?','alta',true,5,1),
  ('FIN-02',2,'Inadimplência abaixo de 5%?','alta',false,10,2),
  ('FIN-03',2,'Conciliação bancária do mês concluída?','media',true,10,3),
  ('OPR-01',3,'Rotinas operacionais diárias registradas?','media',true,10,1),
  ('OPR-02',3,'Checklist de portaria/recepção em dia?','media',true,10,2),
  ('MAN-01',4,'Plano de manutenção preventiva em execução?','alta',true,5,1),
  ('MAN-02',4,'Ordens de serviço fechadas no prazo?','media',false,10,2),
  ('SPT-01',5,'CFTV operante e gravações dos últimos 30 dias disponíveis?','critica',true,2,1),
  ('SPT-02',5,'Controle de acesso funcionando?','alta',true,5,2),
  ('SST-01',6,'NRs aplicáveis (NR-10, NR-35) em conformidade?','critica',true,2,1),
  ('SST-02',6,'EPIs entregues e registrados?','alta',true,5,2),
  ('ATD-01',7,'SAC com tempo médio de resposta inferior a 24h?','media',false,10,1),
  ('ATD-02',7,'Atas de reunião com síndico arquivadas?','media',true,10,2),
  ('LEG-01',8,'Certidões negativas (federal, estadual, FGTS) válidas?','critica',true,2,1),
  ('LEG-02',8,'AVCB / Bombeiros vigente?','critica',true,2,2),
  ('FOR-01',9,'Cadastro de fornecedores ativo e auditado?','media',false,10,1),
  ('FOR-02',9,'Documentação trabalhista dos terceiros em dia?','alta',true,5,2),
  ('EVD-01',10,'Fotos e registros das vistorias arquivados?','media',true,10,1),
  ('EVD-02',10,'Relatório mensal de gestão entregue?','alta',true,5,2);

CREATE OR REPLACE VIEW public.v_operational_scores AS
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
