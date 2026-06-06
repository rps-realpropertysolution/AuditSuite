import EmpreendimentosModule from "@/components/EmpreendimentosModule";

export default function EmpreendimentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empreendimentos</h1>
        <p className="text-sm text-muted-foreground">Cadastro e gestão das propriedades sob contrato</p>
      </div>
      <EmpreendimentosModule />
    </div>
  );
}