import { useState } from "react";
import { Archive, ArchiveRestore, Building2, Loader2, Pencil, Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Campo, CampoNumero, CampoSelecao, CampoTexto } from "@/components/campos";
import { useAuth } from "@/contexts/AuthContext";
import {
  useArquivarEmpreendimento,
  useEmpreendimentos,
  useSalvarEmpreendimento,
} from "@/hooks/useEmpreendimentos";
import type { Empreendimento } from "@/lib/types";

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
};

const Empreendimentos = () => {
  const { interno } = useAuth();
  const { data: lista = [], isLoading } = useEmpreendimentos();
  const salvar = useSalvarEmpreendimento();
  const arquivar = useArquivarEmpreendimento();

  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    if (!editando.nome.trim()) return setErro("Informe o nome do empreendimento.");

    setErro(null);
    try {
      await salvar.mutateAsync({ ...editando, nome: editando.nome.trim() });
      setEditando(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  const campo = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) =>
    setEditando((atual) => (atual ? { ...atual, [chave]: valor } : atual));

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
          <button
            type="button"
            onClick={() => {
              setEditando({ ...VAZIO });
              setErro(null);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Novo empreendimento
          </button>
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
                        setEditando({ ...emp });
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

                <dl className="mt-4 space-y-1.5 text-xs">
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
