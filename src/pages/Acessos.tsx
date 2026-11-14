/**
 * Gestão de acessos — substitui o "insere no banco" do README.
 *
 * Liberar um síndico ou proprietário são dois atos deliberados:
 *   1. vincular o usuário ao(s) empreendimento(s);
 *   2. conceder o papel (síndico ou proprietário).
 * Conceder papéis é exclusivo da diretoria (garantido pela RLS no banco);
 * o time interno vê a lista e pode vincular empreendimentos.
 */

import { useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, UserCheck, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import {
  useConcederPapel,
  useDesvincular,
  useRevogarPapel,
  useUsuarios,
  useVincular,
  type UsuarioAcesso,
} from "@/hooks/useAcessos";
import { formatarData } from "@/lib/format";
import type { Papel } from "@/lib/types";

const ROTULO_PAPEL: Record<Papel, string> = {
  diretoria: "Diretoria",
  gestor: "Gestor RPS",
  sindico: "Síndico",
  proprietario: "Proprietário",
};

const ESTILO_PAPEL: Record<Papel, string> = {
  diretoria: "bg-executive text-executive-foreground",
  gestor: "bg-primary/10 text-primary",
  sindico: "bg-secondary/15 text-foreground",
  proprietario: "bg-secondary/15 text-foreground",
};

const Acessos = () => {
  const { interno, papeis, user } = useAuth();
  const ehDiretoria = papeis.includes("diretoria");
  const { data: usuarios = [], isLoading, error } = useUsuarios();
  const { data: empreendimentos = [] } = useEmpreendimentos();
  const conceder = useConcederPapel();
  const revogar = useRevogarPapel();
  const vincular = useVincular();
  const desvincular = useDesvincular();
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  };

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = t
      ? usuarios.filter((u) => `${u.nome ?? ""} ${u.email}`.toLowerCase().includes(t))
      : usuarios;
    // Pendentes primeiro: são eles que alguém precisa liberar
    return [...lista].sort((a, b) => Number(b.papeis.length === 0) - Number(a.papeis.length === 0));
  }, [usuarios, busca]);

  const pendentes = usuarios.filter((u) => u.papeis.length === 0).length;
  const nomeEmp = (id: string) => empreendimentos.find((e) => e.id === id)?.nome ?? "Empreendimento";

  if (!interno) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">A gestão de acessos é feita pela equipe da RPS.</p>
        </main>
      </AppShell>
    );
  }

  const Linha = ({ u }: { u: UsuarioAcesso }) => {
    const externo = u.papeis.some((p) => p === "sindico" || p === "proprietario") || u.papeis.length === 0;
    const disponiveis = (["sindico", "proprietario", "gestor", "diretoria"] as Papel[]).filter((p) => !u.papeis.includes(p));
    return (
      <tr className="border-t border-border align-top">
        <td className="px-4 py-3">
          <p className="font-semibold">{u.nome || u.email.split("@")[0]}</p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
          <p className="text-[11px] text-muted-foreground">cadastro em {formatarData(u.criadoEm)}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {u.papeis.length === 0 ? (
              <span className="rounded-full bg-semaforo-amarelo/15 px-2 py-0.5 text-xs font-bold text-semaforo-amarelo">
                Aguardando liberação
              </span>
            ) : (
              u.papeis.map((p) => (
                <span key={p} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${ESTILO_PAPEL[p]}`}>
                  {ROTULO_PAPEL[p]}
                  {ehDiretoria && !(u.id === user?.id && p === "diretoria") ? (
                    <button
                      type="button"
                      aria-label={`Revogar ${ROTULO_PAPEL[p]}`}
                      onClick={() => void executar(() => revogar.mutateAsync({ userId: u.id, papel: p }))}
                      className="rounded-full opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              ))
            )}
          </div>
          {ehDiretoria && disponiveis.length ? (
            <select
              value=""
              onChange={(e) => {
                const papel = e.target.value as Papel;
                if (!papel) return;
                if ((papel === "gestor" || papel === "diretoria") && !u.email.toLowerCase().endsWith("@rpsglobal.com.br")) {
                  if (!window.confirm(`${u.email} não é do domínio da RPS. Conceder "${ROTULO_PAPEL[papel]}" dá acesso a TODOS os empreendimentos. Confirmar?`)) return;
                }
                void executar(() => conceder.mutateAsync({ userId: u.id, papel }));
              }}
              className="mt-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">+ conceder papel…</option>
              {disponiveis.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
          ) : null}
        </td>
        <td className="px-4 py-3">
          {externo ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {u.empreendimentos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhum empreendimento vinculado</span>
                ) : (
                  u.empreendimentos.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                      {nomeEmp(id)}
                      <button
                        type="button"
                        aria-label={`Desvincular ${nomeEmp(id)}`}
                        onClick={() => void executar(() => desvincular.mutateAsync({ userId: u.id, empreendimentoId: id }))}
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <select
                value=""
                onChange={(e) => e.target.value && void executar(() => vincular.mutateAsync({ userId: u.id, empreendimentoId: e.target.value }))}
                className="mt-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="">+ vincular empreendimento…</option>
                {empreendimentos
                  .filter((e) => e.ativo && !u.empreendimentos.includes(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </select>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Time interno — vê todos os empreendimentos</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1200px] px-5 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShieldCheck className="h-6 w-6 text-primary" /> Acessos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Para liberar um síndico ou proprietário: vincule o empreendimento e conceda o papel.
              {ehDiretoria ? "" : " Conceder papéis é exclusivo da diretoria."}
              {pendentes ? (
                <strong className="ml-1 text-semaforo-amarelo">
                  {pendentes} {pendentes === 1 ? "pessoa aguardando" : "pessoas aguardando"} liberação.
                </strong>
              ) : null}
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-72 rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </header>

        {erro ? (
          <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Não foi possível carregar os usuários.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-soft text-left">
                  {["Pessoa", "Papel", "Empreendimentos"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <Linha key={u.id} u={u} />
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 ? (
              <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" /> Ninguém encontrado.
              </p>
            ) : null}
          </div>
        )}
      </main>
    </AppShell>
  );
};

export default Acessos;
