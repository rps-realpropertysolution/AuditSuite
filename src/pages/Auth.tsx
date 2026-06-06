import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logoRps from "@/assets/logo-rps.svg";

export default function Auth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  const [lEmail, setLEmail] = useState("");
  const [lPass, setLPass] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPass, setSPass] = useState("");
  const [sNome, setSNome] = useState("");

  useEffect(() => { document.title = "Acesso · RPS Auditoria"; }, []);
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: lEmail, password: lPass });
    setBusy(false);
    if (error) return toast({ title: "Falha no login", description: error.message, variant: "destructive" });
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail, password: sPass,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { nome: sNome } },
    });
    setBusy(false);
    if (error) return toast({ title: "Falha no cadastro", description: error.message, variant: "destructive" });
    toast({ title: "Cadastro criado", description: "Você já pode acessar. Solicite à diretoria a atribuição de papel." });
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant p-3">
            <img src={logoRps} alt="RPS" className="h-full w-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">RPS Property Solutions</h1>
            <p className="text-xs text-muted-foreground">Auditoria Operacional Executiva</p>
          </div>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Acesso ao sistema</CardTitle>
            <CardDescription>Entre com sua conta corporativa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="le">E-mail</Label>
                    <Input id="le" type="email" required value={lEmail} onChange={(e) => setLEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="lp">Senha</Label>
                    <Input id="lp" type="password" required value={lPass} onChange={(e) => setLPass(e.target.value)} /></div>
                  <Button type="submit" disabled={busy} className="w-full">{busy ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="sn">Nome completo</Label>
                    <Input id="sn" required value={sNome} onChange={(e) => setSNome(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="se">E-mail</Label>
                    <Input id="se" type="email" required value={sEmail} onChange={(e) => setSEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="sp">Senha</Label>
                    <Input id="sp" type="password" required minLength={6} value={sPass} onChange={(e) => setSPass(e.target.value)} /></div>
                  <Button type="submit" disabled={busy} className="w-full">{busy ? "Criando..." : "Criar conta"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
