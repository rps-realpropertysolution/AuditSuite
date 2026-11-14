/**
 * Criar acesso: nome, e-mail e senha — nenhum e-mail é enviado. No fim mostra
 * a mensagem pronta (site, login e senha) para copiar e mandar à pessoa.
 */

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCriarAcesso } from "@/hooks/useAcessos";
import type { Papel } from "@/lib/types";

interface Empreendimento {
  id: string;
  nome: string;
  ativo: boolean;
}

const ROTULO: Partial<Record<Papel, string>> = {
  sindico: "Síndico",
  proprietario: "Proprietário",
  gestor: "Gestor RPS",
  diretoria: "Diretoria",
  administrador: "Administrador",
};

/** Senha legível ao telefone: sem 0/O, 1/l/I. */
const gerarSenha = () => {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digitos = "23456789";
  const todos = letras + digitos;
  const r = crypto.getRandomValues(new Uint32Array(10));
  const s = Array.from(r, (n, i) => (i === 3 || i === 7 ? digitos : todos)[n % (i === 3 || i === 7 ? digitos : todos).length]);
  return s.join("");
};

const campo = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export const CriarAcesso = ({
  empreendimentos,
  ehAdministrador,
}: {
  empreendimentos: Empreendimento[];
  ehAdministrador: boolean;
}) => {
  const criar = useCriarAcesso();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(gerarSenha);
  const [papel, setPapel] = useState<Papel | "">("");
  const [emps, setEmps] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const interno = email.trim().toLowerCase().endsWith("@rpsglobal.com.br");
  const externo = papel === "sindico" || papel === "proprietario";
  const papeis: Papel[] = ["sindico", "proprietario", "gestor", "diretoria", ...(ehAdministrador ? (["administrador"] as Papel[]) : [])];

  const limpar = () => {
    setNome("");
    setEmail("");
    setSenha(gerarSenha());
    setPapel("");
    setEmps([]);
    setErro(null);
    setPronto(null);
    setCopiado(false);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (papel && !externo && !interno) {
      if (!window.confirm(`${email} não é do domínio da RPS. "${ROTULO[papel]}" vê TODOS os empreendimentos. Confirmar?`)) return;
    }
    try {
      await criar.mutateAsync({ nome: nome.trim(), email: email.trim(), senha, papel: papel || null, empreendimentos: externo ? emps : [] });
      setPronto({ nome: nome.trim(), email: email.trim().toLowerCase(), senha });
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível criar o acesso.");
    }
  };

  const mensagem = pronto
    ? `Olá, ${pronto.nome.split(" ")[0]}! Seu acesso ao RGM Insights da RPS:\n\nSite: ${window.location.origin}\nLogin: ${pronto.email}\nSenha: ${pronto.senha}`
    : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          limpar();
          setAberto(true);
        }}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <UserPlus className="h-4 w-4" /> Criar acesso
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          {pronto ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-semaforo-verde" /> Acesso criado
                </DialogTitle>
                <DialogDescription>Nenhum e-mail foi enviado. Copie a mensagem abaixo e mande para a pessoa.</DialogDescription>
              </DialogHeader>
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-sans text-sm">{mensagem}</pre>
              <p className="text-xs text-muted-foreground">
                Copie agora: a senha não aparece de novo depois que esta janela fechar.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={limpar} className="rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-muted">
                  Criar outro
                </button>
                <button
                  type="button"
                  onClick={() => void copiar()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar mensagem"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void enviar(e)} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> Criar acesso
                </DialogTitle>
                <DialogDescription>A pessoa entra direto com o e-mail e a senha. Nenhum e-mail é enviado.</DialogDescription>
              </DialogHeader>

              <label className="block space-y-1">
                <span className="text-xs font-semibold">Nome</span>
                <input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Nome completo" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">E-mail (login)</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="nome@empresa.com.br" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Senha</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} className={`${campo} pl-9 font-mono`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSenha(gerarSenha())}
                    title="Gerar outra senha"
                    className="inline-flex items-center gap-1 rounded-md border border-input px-3 text-xs font-semibold hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Gerar
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">Mínimo 8 caracteres. Já vem uma gerada — pode trocar.</span>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold">Papel</span>
                <select value={papel} onChange={(e) => setPapel(e.target.value as Papel | "")} className={campo}>
                  <option value="">{interno ? "Gestor RPS (automático pelo domínio)" : "Definir depois"}</option>
                  {papeis.map((p) => (
                    <option key={p} value={p}>
                      {ROTULO[p]}
                    </option>
                  ))}
                </select>
              </label>

              {externo ? (
                <fieldset className="space-y-1">
                  <legend className="text-xs font-semibold">Empreendimentos que vai ver</legend>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                    {empreendimentos
                      .filter((x) => x.ativo)
                      .map((x) => (
                        <label key={x.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={emps.includes(x.id)}
                            onChange={(e) => setEmps((l) => (e.target.checked ? [...l, x.id] : l.filter((y) => y !== x.id)))}
                          />
                          {x.nome}
                        </label>
                      ))}
                  </div>
                </fieldset>
              ) : null}

              {erro ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
                  {erro}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criar.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Criar acesso
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
