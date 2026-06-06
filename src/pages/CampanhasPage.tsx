import { useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import CampanhasModule from "@/components/CampanhasModule";
import { Card, CardContent } from "@/components/ui/card";

export default function CampanhasPage() {
  const { selected, selectedObj } = useEmpreendimento();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campanhas e Promoções</h1>
        <p className="text-sm text-muted-foreground">
          Investimento, meta e ROI {selectedObj && `· ${selectedObj.codigo} ${selectedObj.nome}`}
        </p>
      </div>
      {selected ? <CampanhasModule empreendimentoId={selected} /> :
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um empreendimento.</CardContent></Card>}
    </div>
  );
}