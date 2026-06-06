import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ModulePlaceholder({ title, fase, descricao }: { title: string; fase: string; descricao: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-3">
          <Construction className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">Disponível na próxima fase</p>
            <p className="text-sm text-muted-foreground">Este módulo será entregue na <strong>{fase}</strong>.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}