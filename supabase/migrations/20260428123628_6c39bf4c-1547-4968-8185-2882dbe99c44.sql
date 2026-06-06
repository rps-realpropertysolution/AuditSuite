
CREATE TYPE public.app_role AS ENUM ('diretoria', 'gestor', 'sindico');
CREATE TYPE public.audit_status AS ENUM ('compliant', 'warning', 'critical');
CREATE TYPE public.campanha_status AS ENUM ('planejada', 'em_andamento', 'concluida', 'cancelada');

CREATE TABLE public.empreendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  area_total NUMERIC,
  ativo BOOLEAN NOT NULL DEFAULT true,
  sindico_nome TEXT,
  sindico_cpf TEXT,
  sindico_email TEXT,
  sindico_celular TEXT,
  sindico_mandato_vencimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  cargo TEXT,
  empreendimento_id UUID REFERENCES public.empreendimentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_empreendimento(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT empreendimento_id FROM public.profiles WHERE id = _user_id $$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_empreendimento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_empreendimento(uuid) TO authenticated;

CREATE TABLE public.audit_processes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_processes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_subprocesses (
  id TEXT PRIMARY KEY,
  process_id INTEGER NOT NULL REFERENCES public.audit_processes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  metric TEXT,
  target NUMERIC NOT NULL DEFAULT 100,
  weight NUMERIC NOT NULL DEFAULT 1,
  indicator TEXT,
  recommended_action TEXT,
  ordem INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.audit_subprocesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empreendimento_id UUID NOT NULL REFERENCES public.empreendimentos(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  overall_compliance NUMERIC,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empreendimento_id, period)
);
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  subprocess_id TEXT NOT NULL REFERENCES public.audit_subprocesses(id) ON DELETE CASCADE,
  actual NUMERIC NOT NULL DEFAULT 0,
  status audit_status NOT NULL DEFAULT 'warning',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, subprocess_id)
);
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empreendimento_id UUID NOT NULL REFERENCES public.empreendimentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  canal TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  investimento NUMERIC NOT NULL DEFAULT 0,
  meta NUMERIC NOT NULL DEFAULT 0,
  resultado NUMERIC NOT NULL DEFAULT 0,
  status campanha_status NOT NULL DEFAULT 'planejada',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_emp_upd BEFORE UPDATE ON public.empreendimentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prof_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rep_upd BEFORE UPDATE ON public.audit_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_res_upd BEFORE UPDATE ON public.audit_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_camp_upd BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "auth read empreendimentos" ON public.empreendimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "diretoria full empreendimentos" ON public.empreendimentos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "user le proprio profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "user atualiza proprio profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "diretoria insere profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'diretoria') OR id = auth.uid());

CREATE POLICY "user le proprios roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "diretoria gerencia roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "auth read processes" ON public.audit_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "diretoria gerencia processes" ON public.audit_processes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "auth read subprocesses" ON public.audit_subprocesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "diretoria gerencia subprocesses" ON public.audit_subprocesses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "diretoria full reports" ON public.audit_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "gestor full reports do emp" ON public.audit_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor') AND empreendimento_id = public.get_user_empreendimento(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'gestor') AND empreendimento_id = public.get_user_empreendimento(auth.uid()));
CREATE POLICY "sindico le reports do emp" ON public.audit_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sindico') AND empreendimento_id = public.get_user_empreendimento(auth.uid()));

CREATE POLICY "diretoria full results" ON public.audit_results FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "gestor full results do emp" ON public.audit_results FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.audit_reports r WHERE r.id = report_id AND public.has_role(auth.uid(), 'gestor') AND r.empreendimento_id = public.get_user_empreendimento(auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.audit_reports r WHERE r.id = report_id AND public.has_role(auth.uid(), 'gestor') AND r.empreendimento_id = public.get_user_empreendimento(auth.uid())));
CREATE POLICY "sindico le results do emp" ON public.audit_results FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.audit_reports r WHERE r.id = report_id AND public.has_role(auth.uid(), 'sindico') AND r.empreendimento_id = public.get_user_empreendimento(auth.uid())));

CREATE POLICY "diretoria full campanhas" ON public.campanhas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretoria')) WITH CHECK (public.has_role(auth.uid(), 'diretoria'));
CREATE POLICY "gestor full campanhas do emp" ON public.campanhas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor') AND empreendimento_id = public.get_user_empreendimento(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'gestor') AND empreendimento_id = public.get_user_empreendimento(auth.uid()));
CREATE POLICY "sindico le campanhas do emp" ON public.campanhas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'sindico') AND empreendimento_id = public.get_user_empreendimento(auth.uid()));

INSERT INTO public.empreendimentos (codigo, nome) VALUES
('02','RBS700'),('03','SEND'),('04','P500'),('05','JF300'),('06','PNU'),
('07','CDC'),('08','CJB'),('09','GAL703'),('10','ALFREDO BRAZ'),('11','CEAII'),
('12','PORTO BRASILLIS'),('14','FONT VIEILLE'),('15','HABITAT'),('16','PARQUE SANTOS'),
('17','DUO'),('18','ITM'),('19','CLARI'),('20','SPRESSION'),('21','SHARE')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.audit_processes (id, name, weight, ordem) VALUES
(1,'Gestão de Fornecedores',7,1),(2,'Gestão Financeira',8,2),(3,'Gestão de Contratos',7,3),
(4,'Gestão de Manutenção',8,4),(5,'Gestão de Segurança',9,5),(6,'Gestão de Utilidades',6,6),
(7,'Gestão de Documentos Legais',7,7),(8,'Gestão de Seguros',6,8),(9,'Gestão de CAPEX',6,9),
(10,'Gestão de Pessoas / Equipe',7,10),(11,'Atendimento ao Cliente / Síndico',8,11),
(12,'Gestão de Compras',6,12),(13,'Gestão Comercial / Ocupação',7,13),(14,'Sustentabilidade e ESG',5,14);

INSERT INTO public.audit_subprocesses (id, process_id, name, objective, metric, target, weight, indicator, recommended_action, ordem) VALUES
('1.1',1,'Reavaliação dos Fornecedores','% Melhoria na Aprovação','Percentual',90,7,'Avaliação dos Fornecedores','Reuniões periódicas',1),
('1.2',1,'Homologação de Novos Fornecedores','Documentação completa','Percentual',100,5,'Cadastros validados','Checklist documental',2),
('2.1',2,'Inadimplência','Reduzir inadimplência','Percentual',3,8,'% Inadimplência','Cobrança ativa',1),
('2.2',2,'Fechamento Mensal','Tempestividade','Dias úteis',5,6,'Dias para fechar','Cronograma fixo',2),
('3.1',3,'Renovação de Contratos','Antecedência mínima','Dias',60,7,'Vencimentos','Alerta D-60',1),
('3.2',3,'Aditivos Formalizados','% Formalização','Percentual',100,5,'Aditivos x verbal','Padronizar minutas',2),
('4.1',4,'Manutenção Preventiva','Cumprimento do plano','Percentual',95,8,'PMP executado','Cronograma anual',1),
('4.2',4,'Manutenção Corretiva','SLA atendimento','Horas',24,7,'Tempo médio','Plantão técnico',2),
('5.1',5,'AVCB Vigente','Documento ativo','Percentual',100,9,'Status AVCB','Renovação D-90',1),
('5.2',5,'Treinamentos NR','% Equipe treinada','Percentual',100,7,'Certificados','Calendário anual',2),
('6.1',6,'Consumo de Água','Redução vs ano anterior','Percentual',5,6,'m³/mês','Ler hidrômetros',1),
('6.2',6,'Consumo de Energia','Redução vs ano anterior','Percentual',5,6,'kWh/mês','Demanda contratada',2),
('7.1',7,'Habite-se / Alvará','Documentação vigente','Percentual',100,7,'Status legal','Renovar antes vencimento',1),
('7.2',7,'CND e Certidões','Validade','Percentual',100,6,'Certidões','Conferência mensal',2),
('8.1',8,'Apólice Patrimonial','Cobertura adequada','Percentual',100,6,'Status apólice','Renovação anual',1),
('8.2',8,'Sinistros Abertos','Tempo de resolução','Dias',30,5,'Sinistros','Acompanhamento ativo',2),
('9.1',9,'Plano de CAPEX','Aderência ao orçado','Percentual',95,6,'Realizado/Orçado','Reunião mensal',1),
('9.2',9,'Obras em Andamento','Cumprimento de prazo','Percentual',90,5,'Marcos','Cronograma físico-financeiro',2),
('10.1',10,'Turnover','% Saídas/ano','Percentual',10,7,'Turnover','Plano de retenção',1),
('10.2',10,'Treinamento Equipe','Horas/colaborador','Horas',20,5,'Carga horária','Plano de capacitação',2),
('11.1',11,'NPS Síndico','Satisfação','Pontos',8,8,'NPS','Pesquisa trimestral',1),
('11.2',11,'Tempo Resposta Síndico','Horas','Horas',4,6,'SLA','Padrão atendimento',2),
('12.1',12,'Cotações Mínimas','3 cotações','Percentual',100,6,'% conformidade','Política de compras',1),
('12.2',12,'Economia Negociada','Saving','Percentual',8,5,'% saving','Negociação ativa',2),
('13.1',13,'Taxa de Ocupação','Vagas ocupadas','Percentual',95,7,'Ocupação','Marketing local',1),
('13.2',13,'Conversão de Visitas','% conversão','Percentual',30,6,'Visitas/contratos','Treinamento equipe',2),
('14.1',14,'Coleta Seletiva','% adesão','Percentual',80,5,'Coleta','Conscientização',1),
('14.2',14,'Eficiência Energética','Iluminação LED','Percentual',100,5,'% LED','Substituição programada',2);
