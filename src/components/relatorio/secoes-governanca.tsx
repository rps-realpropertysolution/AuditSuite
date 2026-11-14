import { AlertTriangle, FileCheck2, FileSignature, Gavel, ListChecks } from "lucide-react";
import {
  BadgeSemaforo,
  Campo,
  CampoData,
  CampoMoeda,
  CampoNumero,
  CampoSelecao,
  CampoTexto,
} from "@/components/campos";
import { ComentarioGestor, Secao, TabelaEditavel, type Coluna } from "./blocos";
import { novoId } from "@/lib/defaults";
import { formatarMoeda } from "@/lib/format";
import {
  contarContratos,
  contarDocumentos,
  DIAS_ALERTA_DOCUMENTO,
  inadimplenciaDoMes,
  inadimplenciaRecebida,
  inadimplenciaTotal,
  situacaoCertidao,
  situacaoContrato,
  situacaoDocumento,
  totalRubrica,
} from "@/lib/metrics";
import type {
  DadosRelatorio,
  LinhaAcordo,
  LinhaCertidao,
  LinhaContrato,
  LinhaDocumento,
  LinhaProcesso,
  LinhaProximoPasso,
  LinhaRisco,
  LinhaRubricaInadimplencia,
} from "@/lib/types";
import type { PropsSecao } from "./secoes-financeiro";

const PROGNOSTICOS = [
  { valor: "nao_apurado" as const, rotulo: "Não apurado" },
  { valor: "provavel" as const, rotulo: "Provável" },
  { valor: "possivel" as const, rotulo: "Possível" },
  { valor: "remoto" as const, rotulo: "Remoto" },
];

const STATUS_ACAO = [
  { valor: "em_andamento" as const, rotulo: "Em andamento" },
  { valor: "concluida" as const, rotulo: "Concluída" },
  { valor: "outra" as const, rotulo: "Outra situação" },
];

const CRITICIDADES = [
  { valor: "baixa" as const, rotulo: "Baixa" },
  { valor: "media" as const, rotulo: "Média" },
  { valor: "alta" as const, rotulo: "Alta" },
];

/* ========================================================================== */
/* Contratos                                                                  */
/* ========================================================================== */

const SITUACOES_CONTRATO = [
  { valor: "vigente" as const, rotulo: "Vigente" },
  { valor: "vencido" as const, rotulo: "Vencido" },
  { valor: "em_renovacao" as const, rotulo: "Em renovação" },
];

export const SecaoContratos = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["contratos"]>) =>
    atualizar("contratos", { ...dados.contratos, ...patch });
  const contagem = contarContratos(dados);

  const colunas: Coluna<LinhaContrato>[] = [
    {
      chave: "fornecedor",
      titulo: "Fornecedor",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto valor={l.fornecedor} desabilitado={somenteLeitura} onChange={(v) => up({ fornecedor: v })} />
      ),
    },
    {
      chave: "objeto",
      titulo: "Objeto",
      largura: "min-w-[160px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.objeto}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ objeto: v })}
          placeholder="Ex.: Lavanderia"
        />
      ),
    },
    {
      chave: "situacao",
      titulo: "Situação",
      largura: "w-40",
      render: (l, up) => {
        // Com data de término a situação é calculada; sem data, vale a escolha do gestor.
        if (l.vencimento) {
          const s = situacaoContrato(l);
          return (
            <div className="flex flex-col items-start gap-1 pt-1.5" title="Calculada pela data de término. Para mudar, altere ou apague a data.">
              <BadgeSemaforo
                semaforo={s.situacao === "vencido" ? "vermelho" : s.situacao === "em_renovacao" ? "amarelo" : "verde"}
                rotulo={s.situacao === "vencido" ? "Vencido" : s.situacao === "em_renovacao" ? "Renovar" : "Vigente"}
              />
              {s.diasRestantes !== null ? (
                <span className="text-[11px] text-muted-foreground">
                  {s.diasRestantes < 0 ? `há ${Math.abs(s.diasRestantes)} dias` : `em ${s.diasRestantes} dias`}
                </span>
              ) : null}
            </div>
          );
        }
        return (
          <CampoSelecao
            valor={l.situacao}
            desabilitado={somenteLeitura}
            opcoes={SITUACOES_CONTRATO}
            onChange={(v) => up({ situacao: v })}
          />
        );
      },
    },
    {
      chave: "vencimento",
      titulo: "Término",
      largura: "w-44",
      render: (l, up) => (
        <CampoData valor={l.vencimento} desabilitado={somenteLeitura} onChange={(v) => up({ vencimento: v })} />
      ),
    },
    {
      chave: "observacao",
      titulo: "Observação",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto valor={l.observacao} desabilitado={somenteLeitura} onChange={(v) => up({ observacao: v })} />
      ),
    },
  ];

  return (
    <Secao
      id="contratos"
      titulo="Contratos"
      icone={<FileSignature className="h-5 w-5" />}
      descricao="Carteira de contratos do ativo. Com a data de término, a situação é calculada (renovação em até 120 dias). Tudo continua editável."
      aviso={
        contagem.vencidos > 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-semaforo-vermelho">
            <AlertTriangle className="h-4 w-4" />
            {contagem.vencidos} contrato{contagem.vencidos > 1 ? "s" : ""} vencido
            {contagem.vencidos > 1 ? "s" : ""} em operação — entra na matriz de riscos.
          </p>
        ) : null
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: "Vigentes", valor: contagem.vigentes, cor: "text-semaforo-verde" },
          { rotulo: "Vencidos", valor: contagem.vencidos, cor: "text-semaforo-vermelho" },
          { rotulo: "Em renovação", valor: contagem.emRenovacao, cor: "text-semaforo-amarelo" },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-lg border border-border bg-surface-soft p-4 text-center">
            <strong className={`block text-3xl tabular-nums ${c.cor}`}>{c.valor}</strong>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.rotulo}
            </span>
          </div>
        ))}
      </div>

      <TabelaEditavel
        linhas={dados.contratos.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({
          id: novoId(),
          fornecedor: "",
          objeto: "",
          situacao: "vigente" as const,
          vencimento: "",
          observacao: "",
        })}
        rotuloAdicionar="Adicionar contrato"
        vazio={{
          titulo: "Nenhum contrato cadastrado",
          descricao: "A carteira de contratos é herdada automaticamente pelos próximos relatórios.",
        }}
      />
      <ComentarioGestor
        valor={dados.contratos.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Documentos e compliance                                                    */
/* ========================================================================== */

export const SecaoDocumentos = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["documentos"]>) =>
    atualizar("documentos", { ...dados.documentos, ...patch });
  const contagem = contarDocumentos(dados);

  const colunas: Coluna<LinhaDocumento>[] = [
    {
      chave: "documento",
      titulo: "Documento",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto valor={l.documento} desabilitado={somenteLeitura} onChange={(v) => up({ documento: v })} />
      ),
    },
    {
      chave: "orgao",
      titulo: "Órgão emissor",
      largura: "min-w-[160px]",
      render: (l, up) => (
        <CampoTexto valor={l.orgao} desabilitado={somenteLeitura} onChange={(v) => up({ orgao: v })} />
      ),
    },
    {
      chave: "validade",
      titulo: "Validade",
      largura: "w-44",
      render: (l, up) => (
        <div className="space-y-1.5">
          {l.permanente ? (
            <span className="block px-1 pt-2 text-xs font-semibold text-muted-foreground">Sem vencimento</span>
          ) : (
            <CampoData valor={l.validade} desabilitado={somenteLeitura} onChange={(v) => up({ validade: v })} />
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(l.permanente)}
              disabled={somenteLeitura}
              onChange={(e) => up({ permanente: e.target.checked })}
              className="h-3.5 w-3.5 accent-primary"
            />
            Permanente
          </label>
        </div>
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      largura: "w-40",
      alinhar: "centro",
      render: (l) => {
        const s = situacaoDocumento(l);
        return (
          <div className="flex flex-col items-center gap-1 pt-1.5">
            <BadgeSemaforo semaforo={s.semaforo} rotulo={s.rotulo} />
            {s.diasRestantes !== null ? (
              <span className="text-[11px] text-muted-foreground">
                {s.diasRestantes < 0
                  ? `há ${Math.abs(s.diasRestantes)} dias`
                  : `em ${s.diasRestantes} dias`}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      chave: "observacao",
      titulo: "Observação",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto valor={l.observacao} desabilitado={somenteLeitura} onChange={(v) => up({ observacao: v })} />
      ),
    },
  ];

  return (
    <Secao
      id="documentos"
      titulo="Documentos e compliance"
      icone={<FileCheck2 className="h-5 w-5" />}
      descricao="O status vem da data de validade — você informa quando vence, o sistema calcula se está vigente, a vencer ou vencido."
      aviso={
        contagem.vencidos > 0 || contagem.aVencer > 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle
              className={`h-4 w-4 ${contagem.vencidos > 0 ? "text-semaforo-vermelho" : "text-semaforo-amarelo"}`}
            />
            <span className={contagem.vencidos > 0 ? "text-semaforo-vermelho" : "text-semaforo-amarelo"}>
              {contagem.vencidos} vencido{contagem.vencidos === 1 ? "" : "s"} · {contagem.aVencer} a
              vencer nos próximos {DIAS_ALERTA_DOCUMENTO} dias
            </span>
          </p>
        ) : null
      }
    >
      <TabelaEditavel
        linhas={dados.documentos.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({ id: novoId(), documento: "", orgao: "", validade: "", permanente: false, observacao: "" })}
        rotuloAdicionar="Adicionar documento"
        vazio={{
          titulo: "Nenhum documento cadastrado",
          descricao: "Cadastre certidões, licenças e laudos — o vencimento passa a se cobrar sozinho.",
        }}
      />
      <ComentarioGestor
        valor={dados.documentos.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="Consulta a cartórios de protesto não apontou registros. Auditoria opinou pela aprovação da prestação de contas."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Jurídico e inadimplência                                                   */
/* ========================================================================== */

export const SecaoJuridico = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const jur = dados.juridico;
  const set = (patch: Partial<DadosRelatorio["juridico"]>) => atualizar("juridico", { ...jur, ...patch });
  const setInad = (patch: Partial<DadosRelatorio["juridico"]["inadimplencia"]>) =>
    set({ inadimplencia: { ...jur.inadimplencia, ...patch } });

  const colunasRubrica: Coluna<LinhaRubricaInadimplencia>[] = [
    {
      chave: "rubrica",
      titulo: "Rubrica",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.rubrica}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ rubrica: v })}
          placeholder="Ex.: Ordinária"
        />
      ),
    },
    {
      chave: "ateAnterior",
      titulo: "Até o mês anterior",
      largura: "w-44",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.ateAnterior} desabilitado={somenteLeitura} onChange={(v) => up({ ateAnterior: v })} />
      ),
    },
    {
      chave: "recebido",
      titulo: "Recebido",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.recebido} desabilitado={somenteLeitura} onChange={(v) => up({ recebido: v })} />
      ),
    },
    {
      chave: "doMes",
      titulo: "Do mês",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.doMes} desabilitado={somenteLeitura} onChange={(v) => up({ doMes: v })} />
      ),
    },
    {
      chave: "total",
      titulo: "Total",
      largura: "w-40",
      alinhar: "direita",
      render: (l) => (
        <span className="block px-3 py-2 text-sm font-bold tabular-nums">
          {formatarMoeda(totalRubrica(l))}
        </span>
      ),
    },
  ];

  const colunasAcordo: Coluna<LinhaAcordo>[] = [
    {
      chave: "unidade",
      titulo: "Unidade",
      largura: "min-w-[120px]",
      render: (l, up) => <CampoTexto valor={l.unidade} desabilitado={somenteLeitura} onChange={(v) => up({ unidade: v })} />,
    },
    {
      chave: "devedor",
      titulo: "Devedor",
      largura: "min-w-[160px]",
      render: (l, up) => <CampoTexto valor={l.devedor} desabilitado={somenteLeitura} onChange={(v) => up({ devedor: v })} />,
    },
    {
      chave: "parcelas",
      titulo: "Parcelas pagas / total",
      largura: "w-44",
      render: (l, up) => (
        <div className="flex items-center gap-1.5">
          <CampoNumero valor={l.parcelasPagas} desabilitado={somenteLeitura} onChange={(v) => up({ parcelasPagas: v })} />
          <span className="text-muted-foreground">/</span>
          <CampoNumero valor={l.parcelas} desabilitado={somenteLeitura} onChange={(v) => up({ parcelas: v })} />
        </div>
      ),
    },
    {
      chave: "valor",
      titulo: "Valor do acordo",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => <CampoMoeda valor={l.valor} desabilitado={somenteLeitura} onChange={(v) => up({ valor: v })} />,
    },
    {
      chave: "valorPago",
      titulo: "Pago",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => <CampoMoeda valor={l.valorPago} desabilitado={somenteLeitura} onChange={(v) => up({ valorPago: v })} />,
    },
    {
      chave: "status",
      titulo: "Status",
      largura: "min-w-[120px]",
      render: (l, up) => <CampoTexto valor={l.status} desabilitado={somenteLeitura} onChange={(v) => up({ status: v })} />,
    },
  ];

  const colunasCertidao: Coluna<LinhaCertidao>[] = [
    {
      chave: "certidao",
      titulo: "Certidão",
      largura: "min-w-[220px]",
      render: (l, up) => <CampoTexto valor={l.certidao} desabilitado={somenteLeitura} onChange={(v) => up({ certidao: v })} />,
    },
    {
      chave: "orgao",
      titulo: "Órgão",
      largura: "min-w-[180px]",
      render: (l, up) => <CampoTexto valor={l.orgao} desabilitado={somenteLeitura} onChange={(v) => up({ orgao: v })} />,
    },
    {
      chave: "validade",
      titulo: "Validade",
      largura: "w-44",
      render: (l, up) => <CampoData valor={l.validade} desabilitado={somenteLeitura} onChange={(v) => up({ validade: v })} />,
    },
    {
      chave: "situacao",
      titulo: "Situação",
      largura: "w-44",
      render: (l, up) => {
        const st = situacaoCertidao(l);
        return (
          <div className="flex flex-col gap-1 pt-1.5">
            <BadgeSemaforo
              semaforo={st === "regular" ? "verde" : st === "nao_informada" ? "amarelo" : "vermelho"}
              rotulo={st === "regular" ? "Regular" : st === "nao_informada" ? "Não informada" : st === "positiva" ? "Positiva" : "Vencida"}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(l.positiva)}
                disabled={somenteLeitura}
                onChange={(e) => up({ positiva: e.target.checked })}
                className="h-3.5 w-3.5 accent-primary"
              />
              Positiva (há pendência)
            </label>
          </div>
        );
      },
    },
  ];

  const colunas: Coluna<LinhaProcesso>[] = [
    {
      chave: "numero",
      titulo: "Processo nº",
      largura: "min-w-[190px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.numero}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ numero: v })}
          placeholder="0000000-00.0000.0.00.0000"
        />
      ),
    },
    {
      chave: "tipo",
      titulo: "Tipo",
      largura: "w-36",
      render: (l, up) => (
        <CampoTexto valor={l.tipo ?? ""} desabilitado={somenteLeitura} onChange={(v) => up({ tipo: v })} placeholder="Trabalhista" />
      ),
    },
    {
      chave: "vara",
      titulo: "Vara / foro",
      largura: "min-w-[140px]",
      render: (l, up) => (
        <CampoTexto valor={l.vara} desabilitado={somenteLeitura} onChange={(v) => up({ vara: v })} />
      ),
    },
    {
      chave: "objeto",
      titulo: "Objeto",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto valor={l.objeto} desabilitado={somenteLeitura} onChange={(v) => up({ objeto: v })} />
      ),
    },
    {
      chave: "andamento",
      titulo: "Andamento",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto valor={l.andamento} desabilitado={somenteLeitura} onChange={(v) => up({ andamento: v })} />
      ),
    },
    {
      chave: "valor",
      titulo: "Valor da causa",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => <CampoMoeda valor={l.valor ?? 0} desabilitado={somenteLeitura} onChange={(v) => up({ valor: v })} />,
    },
    {
      chave: "prognostico",
      titulo: "Prognóstico",
      largura: "w-36",
      render: (l, up) => (
        <CampoSelecao
          valor={l.prognostico ?? "nao_apurado"}
          desabilitado={somenteLeitura}
          opcoes={PROGNOSTICOS}
          onChange={(v) => up({ prognostico: v })}
        />
      ),
    },
    {
      chave: "proximaData",
      titulo: "Próxima data",
      largura: "w-44",
      render: (l, up) => (
        <CampoData valor={l.proximaData} desabilitado={somenteLeitura} onChange={(v) => up({ proximaData: v })} />
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
      id="juridico"
      titulo="Jurídico e inadimplência"
      icone={<Gavel className="h-5 w-5" />}
      descricao="Processos em andamento e evolução da posição de inadimplência."
    >
      <div>
        <h3 className="mb-1 text-sm font-bold">Posição de inadimplência</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Por rubrica, como sai do sistema contábil. O total consolidado é calculado, e a posição de
          fechamento vira a abertura do mês seguinte automaticamente.
        </p>
        <TabelaEditavel
          linhas={jur.inadimplencia.rubricas}
          colunas={colunasRubrica}
          somenteLeitura={somenteLeitura}
          onChange={(rubricas) => setInad({ rubricas })}
          novaLinha={() => ({ id: novoId(), rubrica: "", ateAnterior: 0, recebido: 0, doMes: 0 })}
          rotuloAdicionar="Adicionar rubrica"
          vazio={{
            titulo: "Nenhuma rubrica lançada",
            descricao: "Cadastre Ordinária, Fundo de Reserva e demais rubricas de arrecadação.",
          }}
          rodape={
            <tr className="font-bold">
              <td className="px-3 py-2.5">Totais</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatarMoeda(jur.inadimplencia.rubricas.reduce((s, r) => s + r.ateAnterior, 0))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatarMoeda(inadimplenciaRecebida(dados))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatarMoeda(inadimplenciaDoMes(dados))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatarMoeda(inadimplenciaTotal(dados))}
              </td>
              {!somenteLeitura ? <td /> : null}
            </tr>
          }
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">Acordos de inadimplência</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Acordos em curso seguem para o mês seguinte até a quitação.
        </p>
        <TabelaEditavel
          linhas={jur.acordos}
          colunas={colunasAcordo}
          somenteLeitura={somenteLeitura}
          onChange={(acordos) => set({ acordos })}
          novaLinha={() => ({
            id: novoId(),
            unidade: "",
            devedor: "",
            parcelas: 0,
            parcelasPagas: 0,
            valor: 0,
            valorPago: 0,
            status: "Em andamento",
          })}
          rotuloAdicionar="Adicionar acordo"
          vazio={{
            titulo: "Nenhum acordo em curso",
            descricao: "Os acordos vêm do LiveFacilities na importação, ou podem ser lançados aqui.",
          }}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold">Processos em andamento</h3>
        <TabelaEditavel
          linhas={jur.processos}
          colunas={colunas}
          somenteLeitura={somenteLeitura}
          onChange={(processos) => set({ processos })}
          novaLinha={() => ({
            id: novoId(),
            numero: "",
            vara: "",
            objeto: "",
            andamento: "",
            proximaData: "",
            criticidade: "media" as const,
            tipo: "",
            valor: 0,
            prognostico: "nao_apurado" as const,
          })}
          rotuloAdicionar="Adicionar processo"
          vazio={{
            titulo: "Nenhum processo em andamento",
            descricao: "O relatório informará explicitamente que não há litígios no período.",
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Escritório responsável pelos processos">
          <CampoTexto valor={jur.escritorio} desabilitado={somenteLeitura} onChange={(v) => set({ escritorio: v })} />
        </Campo>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">Certidões do condomínio</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Informe a validade; sem data, aparece como "não informada". A importação preenche as que estiverem
          cadastradas como documento no LiveFacilities.
        </p>
        <TabelaEditavel
          linhas={jur.certidoes}
          colunas={colunasCertidao}
          somenteLeitura={somenteLeitura}
          onChange={(certidoes) => set({ certidoes })}
          novaLinha={() => ({ id: novoId(), certidao: "", orgao: "", validade: "" })}
          rotuloAdicionar="Adicionar certidão"
        />
      </div>

      <ComentarioGestor
        valor={jur.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="Condomínio notificado como parte em reclamação trabalhista de prestador terceirizado. Audiência telepresencial designada. Nomes das partes omitidos por prudência."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Matriz de riscos                                                           */
/* ========================================================================== */

export const SecaoRiscos = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["riscos"]>) =>
    atualizar("riscos", { ...dados.riscos, ...patch });

  const colunas: Coluna<LinhaRisco>[] = [
    {
      chave: "assunto",
      titulo: "Risco / assunto",
      largura: "min-w-[220px]",
      render: (l, up) => (
        <CampoTexto valor={l.assunto} desabilitado={somenteLeitura} onChange={(v) => up({ assunto: v })} />
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
    {
      chave: "consequencia",
      titulo: "Consequência",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.consequencia ?? ""}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ consequencia: v })}
          placeholder="O que acontece se nada for feito"
        />
      ),
    },
    {
      chave: "acao",
      titulo: "Tratamento / ação",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto valor={l.acao} desabilitado={somenteLeitura} onChange={(v) => up({ acao: v })} />
      ),
    },
    {
      chave: "responsavel",
      titulo: "Responsável",
      largura: "min-w-[150px]",
      render: (l, up) => (
        <CampoTexto valor={l.responsavel} desabilitado={somenteLeitura} onChange={(v) => up({ responsavel: v })} />
      ),
    },
    {
      chave: "prazo",
      titulo: "Prazo",
      largura: "w-44",
      render: (l, up) => (
        <CampoData valor={l.prazo} desabilitado={somenteLeitura} onChange={(v) => up({ prazo: v })} />
      ),
    },
    {
      chave: "status",
      titulo: "Situação",
      largura: "w-40",
      render: (l, up) => (
        <CampoSelecao
          valor={l.status ?? "em_andamento"}
          desabilitado={somenteLeitura}
          opcoes={STATUS_ACAO}
          onChange={(v) => up({ status: v })}
        />
      ),
    },
  ];

  return (
    <Secao
      id="riscos"
      titulo="Matriz de riscos e plano de ação"
      icone={<AlertTriangle className="h-5 w-5" />}
      descricao="O action log do empreendimento: cada ação com dono, prazo e situação. O % de ações concluídas vai para o painel executivo; o que fica em aberto é herdado pelo mês seguinte."
    >
      <TabelaEditavel
        linhas={dados.riscos.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({
          id: novoId(),
          assunto: "",
          criticidade: "media" as const,
          consequencia: "",
          acao: "",
          responsavel: "",
          prazo: "",
          status: "em_andamento" as const,
        })}
        rotuloAdicionar="Adicionar ação / risco"
        vazio={{
          titulo: "Matriz de riscos limpa",
          descricao:
            "Use o painel de alertas do editor para transformar pendências detectadas em riscos com responsável.",
        }}
      />
      <ComentarioGestor
        valor={dados.riscos.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Próximos passos e decisões                                                 */
/* ========================================================================== */

export const SecaoProximosPassos = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["proximosPassos"]>) =>
    atualizar("proximosPassos", { ...dados.proximosPassos, ...patch });

  const colunas: Coluna<LinhaProximoPasso>[] = [
    {
      chave: "decisao",
      titulo: "Decisão / pendência",
      largura: "min-w-[260px]",
      render: (l, up) => (
        <CampoTexto valor={l.decisao} desabilitado={somenteLeitura} onChange={(v) => up({ decisao: v })} />
      ),
    },
    {
      chave: "prazo",
      titulo: "Prazo limite",
      largura: "min-w-[150px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.prazo}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ prazo: v })}
          placeholder="Ex.: 30/09 ou a definir"
        />
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      largura: "min-w-[180px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.status}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ status: v })}
          placeholder="Ex.: Aguardando alinhamento"
        />
      ),
    },
    {
      chave: "dependeDoCliente",
      titulo: "Depende do síndico",
      largura: "w-40",
      alinhar: "centro",
      render: (l, up) => (
        <label className="flex cursor-pointer items-center justify-center pt-2">
          <input
            type="checkbox"
            checked={l.dependeDoCliente}
            disabled={somenteLeitura}
            onChange={(e) => up({ dependeDoCliente: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
          />
          <span className="sr-only">Depende de decisão do cliente</span>
        </label>
      ),
    },
  ];

  const doCliente = dados.proximosPassos.linhas.filter((l) => l.dependeDoCliente).length;

  return (
    <Secao
      id="proximosPassos"
      titulo="Próximos passos e decisões"
      icone={<ListChecks className="h-5 w-5" />}
      descricao="O que sai desta reunião. Marque o que depende de decisão do síndico — a apresentação destaca esses itens no fechamento."
      aviso={
        doCliente > 0 ? (
          <p className="text-sm font-semibold text-primary">
            {doCliente} {doCliente === 1 ? "decisão depende" : "decisões dependem"} do síndico ou do
            proprietário.
          </p>
        ) : null
      }
    >
      <TabelaEditavel
        linhas={dados.proximosPassos.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({ id: novoId(), decisao: "", prazo: "", status: "", dependeDoCliente: false })}
        rotuloAdicionar="Adicionar decisão"
        vazio={{
          titulo: "Nenhuma pendência aberta",
          descricao: "Liste aqui o que precisa de decisão para o mês seguinte.",
        }}
      />
      <ComentarioGestor
        valor={dados.proximosPassos.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
      />
    </Secao>
  );
};
