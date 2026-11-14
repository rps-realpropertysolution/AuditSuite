import { useState } from "react";
import { Archive, ArchiveRestore, Building2, CloudDownload, ImagePlus, Loader2, Pencil, Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Campo, CampoListaBullets, CampoNumero, CampoSelecao, CampoTexto } from "@/components/campos";
import { BUCKET_FOTOS, supabase } from "@/integrations/supabase/client";
import { novoId } from "@/lib/defaults";
import { SincronizarLF } from "@/components/SincronizarLF";
import { useAuth } from "@/contexts/AuthContext";
import {
  useArquivarEmpreendimento,
  useEmpreendimentos,
  useSalvarEmpreendimento,
} from "@/hooks/useEmpreendimentos";
import type { Empreendimento, FichaEmpreendimento } from "@/lib/types";

const TIPOS = [
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "residencial", rotulo: "Residencial" },
  { valor: "misto", rotulo: "Uso misto" },
  { valor: "corporativo", rotulo: "Corporativo" },
  { valor: "cooliving", rotulo: "Coliving" },
  { valor: "industrial", rotulo: "Industrial" },
];

type Rascunho = Partial<Empreendimento> & { nome: string };

const VAZIO: Rascunho = {
  nome: "",
  endereco: "",
  cidade: "",
  tipo: "comercial",
  unidades: null,
  sindico_nome: "",
  proprietario_nome: "",
  gestor_nome: "",
  lf_id_empreendimento: null,
  lf_cd_condominio: "",
  ficha: {},
  foto_path: null,
};

const Empreendimentos = () => {
  const { interno } = useAuth();
  const { data: lista = [], isLoading } = useEmpreendimentos();
  const salvar = useSalvarEmpreendimento();
  const arquivar = useArquivarEmpreendimento();

  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    if (!editando.nome.trim()) return setErro("Informe o nome do empreendimento.");

    const cd = (editando.lf_cd_condominio ?? "").trim();
    if (cd && !/^\d{1,6}$/.test(cd)) return setErro("O código do condomínio no LiveFacilities tem só dígitos (ex.: 0231).");

    setErro(null);
    try {
      const { id: _i, created_at: _c, updated_at: _u, ...campos } = editando as Empreendimento;
      const salvo = await salvar.mutateAsync({
        ...campos,
        id: editando.id,
        nome: editando.nome.trim(),
        lf_cd_condominio: cd || null,
      });

      // Foto de capa: vai para o Storage depois de o ativo ter id.
      if (foto) {
        const extensao = foto.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const caminho = `empreendimento/${salvo.id}/capa-${novoId()}.${extensao}`;
        const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, foto, { contentType: foto.type });
        if (error) throw new Error(`Empreendimento salvo, mas a foto falhou: ${error.message}`);
        await salvar.mutateAsync({ id: salvo.id, nome: salvo.nome, foto_path: caminho });
      }
      setFoto(null);
      setEditando(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  const campo = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) =>
    setEditando((atual) => (atual ? { ...atual, [chave]: valor } : atual));

  const campoFicha = <K extends keyof FichaEmpreendimento>(chave: K, valor: FichaEmpreendimento[K]) =>
    setEditando((atual) => (atual ? { ...atual, ficha: { ...(atual.ficha ?? {}), [chave]: valor } } : atual));

  if (!interno) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O cadastro de empreendimentos é gerenciado pela equipe da RPS.
          </p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1200px] px-5 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Empreendimentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Os ativos sob administração. Cada um gera um relatório por competência.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SincronizarLF existentes={lista} />
            <button
              type="button"
              onClick={() => {
                setEditando({ ...VAZIO });
                setFoto(null);
                setErro(null);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Novo empreendimento
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-bold">Nenhum empreendimento cadastrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre o primeiro ativo para começar.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lista.map((emp) => (
              <article
                key={emp.id}
                className={`rounded-xl border border-border bg-card p-5 ${emp.ativo ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{emp.nome}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[emp.cidade, TIPOS.find((t) => t.valor === emp.tipo)?.rotulo]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando({ ...emp, ficha: emp.ficha ?? {} });
                        setFoto(null);
                        setErro(null);
                      }}
                      aria-label={`Editar ${emp.nome}`}
                      className="rounded p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => arquivar.mutate({ id: emp.id, ativo: !emp.ativo })}
                      aria-label={emp.ativo ? `Arquivar ${emp.nome}` : `Reativar ${emp.nome}`}
                      className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
                    >
                      {emp.ativo ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    emp.lf_cd_condominio
                      ? "bg-semaforo-verde/10 text-semaforo-verde"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <CloudDownload className="h-3 w-3" />
                  {emp.lf_cd_condominio
                    ? `LiveFacilities ${emp.lf_cd_condominio}${emp.lf_id_empreendimento ? ` · id ${emp.lf_id_empreendimento}` : " · só operação"}`
                    : "Sem integração com o LiveFacilities"}
                </p>

                <dl className="mt-3 space-y-1.5 text-xs">
                  {[
                    ["Síndico", emp.sindico_nome],
                    ["Proprietário", emp.proprietario_nome],
                    ["Gestor RPS", emp.gestor_nome],
                    ["Unidades", emp.unidades ? String(emp.unidades) : null],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{rotulo}</dt>
                      <dd className="truncate font-medium">{valor || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Formulário */}
      {editando ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-executive/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Cadastro de empreendimento"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-bold">
                {editando.id ? "Editar empreendimento" : "Novo empreendimento"}
              </h2>
              <button
                type="button"
                onClick={() => setEditando(null)}
                aria-label="Fechar"
                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={submeter} className="space-y-4 p-5">
              <Campo label="Nome do empreendimento" obrigatorio>
                <CampoTexto
                  valor={editando.nome}
                  onChange={(v) => campo("nome", v)}
                  placeholder="Ex.: Condomínio Send Cooliving"
                />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Cidade / UF">
                  <CampoTexto
                    valor={editando.cidade ?? ""}
                    onChange={(v) => campo("cidade", v)}
                    placeholder="Rio de Janeiro/RJ"
                  />
                </Campo>
                <Campo label="Tipo">
                  <CampoSelecao
                    valor={editando.tipo ?? "comercial"}
                    opcoes={TIPOS}
                    onChange={(v) => campo("tipo", v)}
                  />
                </Campo>
              </div>

              <Campo label="Endereço">
                <CampoTexto valor={editando.endereco ?? ""} onChange={(v) => campo("endereco", v)} />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Síndico">
                  <CampoTexto
                    valor={editando.sindico_nome ?? ""}
                    onChange={(v) => campo("sindico_nome", v)}
                  />
                </Campo>
                <Campo label="Proprietário / cliente">
                  <CampoTexto
                    valor={editando.proprietario_nome ?? ""}
                    onChange={(v) => campo("proprietario_nome", v)}
                  />
                </Campo>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Gestor RPS responsável">
                  <CampoTexto
                    valor={editando.gestor_nome ?? ""}
                    onChange={(v) => campo("gestor_nome", v)}
                  />
                </Campo>
                <Campo label="Nº de unidades">
                  <CampoNumero
                    valor={editando.unidades ?? 0}
                    onChange={(v) => campo("unidades", v || null)}
                  />
                </Campo>
              </div>

              <fieldset className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <legend className="px-1 text-sm font-bold text-primary">Integração com o LiveFacilities</legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  Os dois códigos aparecem no sistema e <strong>nem sempre são iguais</strong> — confira um por um.
                  Com eles preenchidos, o relatório puxa financeiro, inadimplência, OS, contratos e documentos.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="id_empreendimento" dica="número interno, ex.: 231">
                    <CampoNumero
                      valor={editando.lf_id_empreendimento ?? 0}
                      onChange={(v) => campo("lf_id_empreendimento", v || null)}
                    />
                  </Campo>
                  <Campo label="cd_condominio" dica="código do topo do sistema, ex.: 0231">
                    <CampoTexto
                      valor={editando.lf_cd_condominio ?? ""}
                      onChange={(v) => campo("lf_cd_condominio", v.replace(/\D/g, ""))}
                      placeholder="0231"
                    />
                  </Campo>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-bold">Ficha técnica (slide "O empreendimento")</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Área construída (m²)">
                    <CampoNumero valor={editando.ficha?.areaConstruida ?? 0} onChange={(v) => campoFicha("areaConstruida", v || null)} />
                  </Campo>
                  <Campo label="Área privativa (m²)">
                    <CampoNumero valor={editando.ficha?.areaPrivativa ?? 0} onChange={(v) => campoFicha("areaPrivativa", v || null)} />
                  </Campo>
                  <Campo label="Torres / blocos">
                    <CampoTexto valor={editando.ficha?.torres ?? ""} onChange={(v) => campoFicha("torres", v)} placeholder="3 (A, B e C)" />
                  </Campo>
                  <Campo label="Pavimentos">
                    <CampoTexto valor={editando.ficha?.pavimentos ?? ""} onChange={(v) => campoFicha("pavimentos", v)} placeholder="7 tipo + térreo" />
                  </Campo>
                  <Campo label="Vagas">
                    <CampoNumero valor={editando.ficha?.vagas ?? 0} onChange={(v) => campoFicha("vagas", v || null)} />
                  </Campo>
                  <Campo label="Elevadores">
                    <CampoNumero valor={editando.ficha?.elevadores ?? 0} onChange={(v) => campoFicha("elevadores", v || null)} />
                  </Campo>
                  <Campo label="Início da gestão RPS">
                    <input
                      type="month"
                      value={editando.ficha?.inicioGestao ?? ""}
                      onChange={(e) => campoFicha("inicioGestao", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </Campo>
                  <Campo label="CNPJ do síndico / cliente">
                    <CampoTexto valor={editando.ficha?.sindicoDocumento ?? ""} onChange={(v) => campoFicha("sindicoDocumento", v)} />
                  </Campo>
                  <Campo label="Foto de capa">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-primary">
                      <ImagePlus className="h-4 w-4 shrink-0" />
                      <span className="truncate">{foto ? foto.name : editando.foto_path ? "Trocar foto" : "Escolher foto"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Campo>
                </div>
                <div className="mt-4">
                  <Campo label="Diferenciais do ativo" dica="aparecem como selos no slide">
                    <CampoListaBullets
                      itens={editando.ficha?.destaques ?? []}
                      onChange={(v) => campoFicha("destaques", v)}
                      placeholder="Ex.: Heliponto homologado"
                    />
                  </Campo>
                </div>
              </fieldset>

              {erro ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {erro}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvar.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
};

export default Empreendimentos;
