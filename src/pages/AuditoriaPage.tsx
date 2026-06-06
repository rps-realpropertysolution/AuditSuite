import { useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import AuditDashboard from "@/components/AuditDashboard";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditoriaPage() {
  const { selected, selectedObj } = useEmpreendimento();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria de Processos</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores numéricos por sub-processo {selectedObj && `· ${selectedObj.codigo} ${selectedObj.nome}`}
        </p>
      </div>
      {selected ? <AuditDashboard empreendimentoId={selected} /> :
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um empreendimento na barra superior.</CardContent></Card>}
    </div>
  );
}