import { useRef, useState } from "react";
import { Camera, Droplets, ImagePlus, Trash2, Truck, Wrench, X } from "lucide-react";
import {
  BadgeSemaforo,
  Campo,
  CampoMoeda,
  CampoNumero,
  CampoPercentual,
  CampoSelecao,
  CampoTexto,
} from "@/components/campos";
import { ComentarioGestor, Secao, TabelaEditavel, type Coluna } from "./blocos";
import { useUploadFotos, useUrlsAssinadas } from "@/hooks/useFotos";
import { novoId } from "@/lib/defaults";
import { formatarNumero, formatarVariacao } from "@/lib/format";
import {
  consumoMedioDiario,
  percentualPreventiva,
  percentualRealizado,
  totalAcessos,
  totalManutencoes,
  vacancia,
  variacaoConsumo,
  variacaoFatura,
} from "@/lib/metrics";
import type {
  DadosRelatorio,
  Foto,
  LinhaDisciplina,
  LinhaFornecedor,
  LinhaOcorrencia,
  LinhaUtilidade,
  Semaforo,
} from "@/lib/types";
import type { PropsSecao } from "./secoes-financeiro";

const CRITICIDADES = [
  { valor: "baixa" as const, rotulo: "Baixa" },
  { valor: "media" as const, rotulo: "Média" },
  { valor: "alta" as const, rotulo: "Alta" },
];

/* ========================================================================== */
/* Operação e manutenção                                                      */
/* ========================================================================== */

const TIPOS_OCORRENCIA = [
  { valor: "preventiva" as const, rotulo: "Preventiva" },
  { valor: "corretiva" as const, rotulo: "Corretiva" },
  { valor: "melhoria" as const, rotulo: "Melhoria" },
];

export const SecaoOperacao = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const op = dados.operacao;
  const set = (patch: Partial<DadosRelatorio["operacao"]>) => atualizar("operacao", { ...op, ...patch });

  const colunasDisciplina: Coluna<LinhaDisciplina>[] = [
    {
      chave: "disciplina",
      titulo: "Disciplina",
      largura: "min-w-[220px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.disciplina}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ disciplina: v })}
          placeholder="Ex.: Elétrica"
        />
      ),
    },
    {
      chave: "quantidade",
      titulo: "Finalizadas",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.quantidade} desabilitado={somenteLeitura} onChange={(v) => up({ quantidade: v })} />
      ),
    },
  ];

  const colunas: Coluna<LinhaOcorrencia>[] = [
    {
      chave: "ocorrencia",
      titulo: "Ocorrência",
      largura: "min-w-[220px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.ocorrencia}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ ocorrencia: v })}
          placeholder="Ex.: Iluminação — fitas de LED"
        />
      ),
    },
    {
      chave: "tipo",
      titulo: "Tipo",
      largura: "w-36",
      render: (l, up) => (
        <CampoSelecao
          valor={l.tipo}
          desabilitado={somenteLeitura}
          opcoes={TIPOS_OCORRENCIA}
          onChange={(v) => up({ tipo: v })}
        />
      ),
    },
    {
      chave: "acao",
      titulo: "Ação executada",
      largura: "min-w-[220px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.acao}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ acao: v })}
          placeholder="Ex.: Reparo emergencial e inspeção da alimentação"
        />
      ),
    },
    {
      chave: "resultado",
      titulo: "Resultado",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.resultado}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ resultado: v })}
          placeholder="Ex.: Funcionamento restabelecido"
        />
      ),
    },
    {
      chave: "concluida",
      titulo: "Concluída",
      largura: "w-28",
      alinhar: "centro",
      render: (l, up) => (
        <label className="flex cursor-pointer items-center justify-center pt-2">
          <input
            type="checkbox"
            checked={l.concluida}
            disabled={somenteLeitura}
            onChange={(e) => up({ concluida: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-[hsl(var(--semaforo-verde))]"
          />
          <span className="sr-only">Ocorrência concluída</span>
        </label>
      ),
    },
  ];

  return (
    <Secao
      id="operacao"
      titulo="Operação e manutenção"
      icone={<Wrench className="h-5 w-5" />}
      descricao="Manutenções do mês e fluxo de pessoas no ativo."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Campo label="Taxa de ocupação">
          <CampoPercentual
            valor={op.ocupacao}
            casas={0}
            desabilitado={somenteLeitura}
            onChange={(v) => set({ ocupacao: v })}
          />
        </Campo>
        <Campo label="Acessos de fixos">
          <CampoNumero
            valor={op.acessosFixos}
            desabilitado={somenteLeitura}
            onChange={(v) => set({ acessosFixos: v })}
          />
        </Campo>
        <Campo label="Acessos de visitantes">
          <CampoNumero
            valor={op.acessosVisitantes}
            desabilitado={somenteLeitura}
            onChange={(v) => set({ acessosVisitantes: v })}
          />
        </Campo>
        <div className="rounded-lg border border-border bg-surface-soft p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fluxo total
          </span>
          <strong className="mt-1 block text-xl tabular-nums text-primary">
            {formatarNumero(totalAcessos(dados))}
          </strong>
          <span className="text-xs text-muted-foreground">
            vacância de {formatarNumero(vacancia(dados), 0)}%
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">Volume de manutenções no mês</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          O agregado que hoje sai do sistema de OS. Preencha os números do período — os percentuais
          de preventiva e de execução são calculados.
        </p>
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {(
            [
              ["preventivas", "Preventivas"],
              ["corretivas", "Corretivas"],
              ["acompanhamentos", "Acompanhamentos"],
              ["rondas", "Rondas"],
              ["naoRealizadas", "Não realizadas"],
            ] as const
          ).map(([chave, rotulo]) => (
            <Campo key={chave} label={rotulo}>
              <CampoNumero
                valor={op.resumo[chave]}
                desabilitado={somenteLeitura}
                onChange={(v) => set({ resumo: { ...op.resumo, [chave]: v } })}
              />
            </Campo>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { r: "Total executado", v: formatarNumero(totalManutencoes(dados)), s: "no período" },
            {
              r: "Preventiva",
              v: percentualPreventiva(dados) === null ? "—" : `${percentualPreventiva(dados)!.toFixed(1)}%`,
              s: "sobre preventiva + corretiva",
            },
            {
              r: "Executado do programado",
              v: percentualRealizado(dados) === null ? "—" : `${percentualRealizado(dados)!.toFixed(1)}%`,
              s: op.resumo.naoRealizadas > 0 ? `${op.resumo.naoRealizadas} em aberto` : "sem pendência",
            },
          ].map((k) => (
            <div key={k.r} className="rounded-lg border border-border bg-surface-soft p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {k.r}
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-primary">{k.v}</strong>
              <span className="text-xs text-muted-foreground">{k.s}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">Ordens finalizadas por disciplina</h3>
        <TabelaEditavel
          linhas={op.disciplinas}
          colunas={colunasDisciplina}
          somenteLeitura={somenteLeitura}
          onChange={(disciplinas) => set({ disciplinas })}
          novaLinha={() => ({ id: novoId(), disciplina: "", quantidade: 0 })}
          rotuloAdicionar="Adicionar disciplina"
          vazio={{
            titulo: "Nenhuma disciplina lançada",
            descricao: "Elétrica, hidráulica, civil, CFTV — a lista é herdada pelos próximos meses.",
          }}
        />
      </div>

      <h3 className="text-sm font-bold">Ocorrências detalhadas</h3>
      <TabelaEditavel
        linhas={op.ocorrencias}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(ocorrencias) => set({ ocorrencias })}
        novaLinha={() => ({
          id: novoId(),
          ocorrencia: "",
          tipo: "preventiva" as const,
          acao: "",
          resultado: "",
          concluida: true,
        })}
        rotuloAdicionar="Adicionar ocorrência"
        vazio={{
          titulo: "Nenhuma manutenção registrada",
          descricao: "Registre as manutenções preventivas e corretivas executadas no mês.",
        }}
      />

      <ComentarioGestor
        valor={op.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="Manutenção anual das sirenes concluída. Fornecedor executou preventiva de controle de acesso, CFTV e sistema de incêndio sem pendências."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Fornecedores e SLA                                                         */
/* ========================================================================== */

const semaforoSla = (sla: number): Semaforo =>
  sla === 0 ? "amarelo" : sla >= 95 ? "verde" : sla >= 85 ? "amarelo" : "vermelho";

export const SecaoFornecedores = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["fornecedores"]>) =>
    atualizar("fornecedores", { ...dados.fornecedores, ...patch });

  const colunas: Coluna<LinhaFornecedor>[] = [
    {
      chave: "fornecedor",
      titulo: "Fornecedor",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto valor={l.fornecedor} desabilitado={somenteLeitura} onChange={(v) => up({ fornecedor: v })} />
      ),
    },
    {
      chave: "disciplina",
      titulo: "Disciplina",
      largura: "min-w-[150px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.disciplina}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ disciplina: v })}
          placeholder="Ex.: Limpeza"
        />
      ),
    },
    {
      chave: "realizado",
      titulo: "Volume",
      largura: "w-32",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.realizado} desabilitado={somenteLeitura} onChange={(v) => up({ realizado: v })} />
      ),
    },
    {
      chave: "unidade",
      titulo: "Unidade",
      largura: "w-28",
      render: (l, up) => (
        <CampoTexto
          valor={l.unidade}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ unidade: v })}
          placeholder="OS"
        />
      ),
    },
    {
      chave: "sla",
      titulo: "SLA",
      largura: "w-28",
      alinhar: "direita",
      render: (l, up) => (
        <CampoPercentual valor={l.sla} casas={0} desabilitado={somenteLeitura} onChange={(v) => up({ sla: v })} />
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      largura: "w-32",
      alinhar: "centro",
      render: (l) => (
        <div className="pt-1.5">
          <BadgeSemaforo semaforo={semaforoSla(l.sla)} rotulo={l.sla === 0 ? "sem SLA" : `${l.sla}%`} />
        </div>
      ),
    },
    {
      chave: "criticidade",
      titulo: "Criticidade",
      largura: "w-32",
      render: (l, up) => (
        <CampoSelecao
          valor={l.criticidade}
          desabilitado={somenteLeitura}
          opcoes={CRITICIDADES}
          onChange={(v) => up({ criticidade: v })}
        />
      ),
    },
  ];

  return (
    <Secao
      id="fornecedores"
      titulo="Fornecedores e SLA"
      icone={<Truck className="h-5 w-5" />}
      descricao="Volume entregue e aderência ao SLA contratado por disciplina."
    >
      <TabelaEditavel
        linhas={dados.fornecedores.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({
          id: novoId(),
          fornecedor: "",
          disciplina: "",
          realizado: 0,
          unidade: "OS",
          sla: 0,
          criticidade: "media" as const,
        })}
        rotuloAdicionar="Adicionar fornecedor"
        vazio={{
          titulo: "Nenhum fornecedor avaliado",
          descricao:
            "Cadastre uma vez e o mês seguinte já vem com a lista pronta — só os números mudam.",
        }}
      />
      <ComentarioGestor
        valor={dados.fornecedores.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Utilidades                                                                 */
/* ========================================================================== */

export const SecaoUtilidades = ({
  dados,
  atualizar,
  somenteLeitura,
  competencia,
}: PropsSecao & { competencia: string }) => {
  const set = (patch: Partial<DadosRelatorio["utilidades"]>) =>
    atualizar("utilidades", { ...dados.utilidades, ...patch });

  const semaforoVar = (v: number | null): Semaforo =>
    v === null ? "amarelo" : v > 25 ? "vermelho" : v > 10 ? "amarelo" : "verde";

  const colunas: Coluna<LinhaUtilidade>[] = [
    {
      chave: "utilidade",
      titulo: "Utilidade",
      largura: "min-w-[140px]",
      render: (l, up) => (
        <CampoTexto valor={l.utilidade} desabilitado={somenteLeitura} onChange={(v) => up({ utilidade: v })} />
      ),
    },
    {
      chave: "consumo",
      titulo: "Consumo",
      largura: "w-32",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.consumo} desabilitado={somenteLeitura} onChange={(v) => up({ consumo: v })} />
      ),
    },
    {
      chave: "unidade",
      titulo: "Un.",
      largura: "w-20",
      render: (l, up) => (
        <CampoTexto valor={l.unidade} desabilitado={somenteLeitura} onChange={(v) => up({ unidade: v })} />
      ),
    },
    {
      chave: "anterior",
      titulo: "Mês anterior",
      largura: "w-32",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero
          valor={l.consumoAnterior}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ consumoAnterior: v })}
        />
      ),
    },
    {
      chave: "variacao",
      titulo: "Variação",
      largura: "w-28",
      alinhar: "centro",
      render: (l) => {
        const v = variacaoConsumo(l);
        return (
          <div className="pt-1.5">
            <BadgeSemaforo semaforo={semaforoVar(v)} rotulo={v === null ? "—" : formatarVariacao(v)} />
          </div>
        );
      },
    },
    {
      chave: "fatura",
      titulo: "Fatura",
      largura: "w-36",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.fatura} desabilitado={somenteLeitura} onChange={(v) => up({ fatura: v })} />
      ),
    },
    {
      chave: "ponta",
      titulo: "Ponta",
      largura: "w-28",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.ponta} desabilitado={somenteLeitura} onChange={(v) => up({ ponta: v })} />
      ),
    },
    {
      chave: "foraPonta",
      titulo: "Fora ponta",
      largura: "w-28",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.foraPonta} desabilitado={somenteLeitura} onChange={(v) => up({ foraPonta: v })} />
      ),
    },
    {
      chave: "faltas",
      titulo: "Faltas",
      largura: "w-24",
      alinhar: "direita",
      render: (l, up) => (
        <CampoNumero valor={l.faltas} desabilitado={somenteLeitura} onChange={(v) => up({ faltas: v })} />
      ),
    },
    {
      chave: "detalhamento",
      titulo: "Observação",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.detalhamento}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ detalhamento: v })}
          placeholder="Ex.: leitura de 04/26 a 05/26"
        />
      ),
    },
  ];

  return (
    <Secao
      id="utilidades"
      titulo="Utilidades e sustentabilidade"
      icone={<Droplets className="h-5 w-5" />}
      descricao="Consumo e fatura por utilidade. A variação é calculada — o mês anterior vem preenchido automaticamente quando você duplica o relatório."
    >
      <TabelaEditavel
        linhas={dados.utilidades.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({
          id: novoId(),
          utilidade: "",
          unidade: "",
          consumo: 0,
          consumoAnterior: 0,
          ponta: 0,
          foraPonta: 0,
          faltas: 0,
          detalhamento: "",
          fatura: 0,
          faturaAnterior: 0,
          observacao: "",
        })}
        rotuloAdicionar="Adicionar utilidade"
        vazio={{
          titulo: "Nenhuma utilidade cadastrada",
          descricao: "Cadastre água, energia e gás para acompanhar consumo e custo mês a mês.",
        }}
      />

      {dados.utilidades.linhas.some((l) => l.consumo > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dados.utilidades.linhas
            .filter((l) => l.consumo > 0)
            .map((l) => {
              const vf = variacaoFatura(l);
              return (
                <div key={l.id} className="rounded-lg border border-border bg-surface-soft p-3">
                  <span className="text-xs font-semibold text-muted-foreground">{l.utilidade}</span>
                  <strong className="mt-1 block text-lg tabular-nums text-primary">
                    {formatarNumero(consumoMedioDiario(l, competencia), 1)} {l.unidade}/dia
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    consumo médio diário
                    {vf !== null ? ` · fatura ${formatarVariacao(vf)}` : ""}
                    {l.faltas > 0 ? ` · ${l.faltas} falta${l.faltas > 1 ? "s" : ""} no mês` : ""}
                  </span>
                </div>
              );
            })}
        </div>
      ) : null}

      <ComentarioGestor
        valor={dados.utilidades.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="Consumo de água estabilizado desde dezembro. Sem interrupção de energia no mês."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Evidências fotográficas                                                    */
/* ========================================================================== */

const CATEGORIAS_FOTO = [
  { valor: "melhoria" as const, rotulo: "Melhoria" },
  { valor: "ocorrencia" as const, rotulo: "Ocorrência" },
  { valor: "manutencao" as const, rotulo: "Manutenção" },
  { valor: "geral" as const, rotulo: "Geral" },
];

export const SecaoFotos = ({
  dados,
  atualizar,
  somenteLeitura,
  relatorioId,
}: PropsSecao & { relatorioId: string }) => {
  const { enviar, remover, enviando, progresso } = useUploadFotos(relatorioId);
  const urls = useUrlsAssinadas(dados.fotos);
  const [erros, setErros] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const adicionar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    const { fotos, erros: novosErros } = await enviar(Array.from(arquivos));
    if (fotos.length) atualizar("fotos", [...dados.fotos, ...fotos]);
    setErros(novosErros);
  };

  const excluir = async (foto: Foto) => {
    atualizar("fotos", dados.fotos.filter((f) => f.id !== foto.id));
    await remover(foto.path);
  };

  return (
    <Secao
      id="fotos"
      titulo="Evidências fotográficas"
      icone={<Camera className="h-5 w-5" />}
      descricao="Antes e depois, melhorias e inconformidades. É a parte que o síndico mais olha — e que na versão anterior não saía no PDF."
    >
      {!somenteLeitura ? (
        <div>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void adicionar(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-surface-soft/60 px-6 py-8 text-center transition hover:border-primary hover:bg-surface-soft"
          >
            <ImagePlus className="mb-2 h-8 w-8 text-primary" />
            <strong className="text-sm">Arraste as fotos aqui ou clique para selecionar</strong>
            <span className="mt-1 text-xs text-muted-foreground">
              JPG, PNG ou WebP · até 10 MB por imagem
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void adicionar(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {enviando ? (
            <p className="mt-2 text-sm font-medium text-primary">
              Enviando {progresso.feitos} de {progresso.total}…
            </p>
          ) : null}

          {erros.length > 0 ? (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <ul className="space-y-0.5 text-sm text-destructive">
                  {erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => setErros([])} aria-label="Fechar avisos">
                  <X className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {dados.fotos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-soft/50 px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma evidência anexada nesta competência.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dados.fotos.map((foto, i) => (
            <figure key={foto.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-[4/3] bg-surface-soft">
                {urls[foto.path] ? (
                  <img
                    src={urls[foto.path]}
                    alt={foto.legenda || `Evidência ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    carregando…
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded bg-executive/85 px-2 py-0.5 text-xs font-bold text-executive-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {!somenteLeitura ? (
                  <button
                    type="button"
                    onClick={() => void excluir(foto)}
                    aria-label={`Remover evidência ${i + 1}`}
                    className="absolute right-2 top-2 rounded bg-card/90 p-1.5 text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <figcaption className="space-y-2 p-3">
                {somenteLeitura ? (
                  <p className="text-sm leading-relaxed">{foto.legenda || "—"}</p>
                ) : (
                  <>
                    <CampoTexto
                      valor={foto.legenda}
                      onChange={(v) =>
                        atualizar(
                          "fotos",
                          dados.fotos.map((f) => (f.id === foto.id ? { ...f, legenda: v } : f)),
                        )
                      }
                      placeholder="Descreva a evidência"
                    />
                    <CampoSelecao
                      valor={foto.categoria}
                      opcoes={CATEGORIAS_FOTO}
                      onChange={(v) =>
                        atualizar(
                          "fotos",
                          dados.fotos.map((f) => (f.id === foto.id ? { ...f, categoria: v } : f)),
                        )
                      }
                    />
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Secao>
  );
};
