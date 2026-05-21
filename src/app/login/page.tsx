"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        shouldCreateUser: false,
      },
    });
    setLoading(false);
    if (error) {
      setError(
        "No se pudo enviar el link. Verificá el email o pedile al admin que te de de alta."
      );
      return;
    }
    setInfo("Te mandamos un link a tu email. Revisá la bandeja.");
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      setError("Poné tu email arriba y volvé a tocar.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError("No se pudo enviar el mail de recuperación.");
      return;
    }
    setInfo("Te enviamos un mail para resetear la contraseña.");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(255,212,0,0.18) 0%, rgba(255,212,0,0) 60%), radial-gradient(40% 40% at 80% 90%, rgba(255,212,0,0.10) 0%, rgba(255,212,0,0) 60%)",
        }}
      />
      <Card className="relative w-full max-w-sm border-none shadow-2xl">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFD400] shadow-[0_4px_24px_-4px_rgba(255,212,0,0.5)]">
              <span className="text-2xl font-extrabold text-black">JD</span>
            </div>
            <h1 className="text-xl font-bold">JD Media</h1>
            <p className="text-sm text-muted-foreground">
              Operación interna del equipo
            </p>
          </div>

          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              <TabsTrigger value="magic">Link al mail</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={onPasswordSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vos@jdmedia.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Ingresando…" : "Ingresar"}
                </Button>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Olvidé mi contraseña
                </button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form onSubmit={onMagicLink} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vos@jdmedia.com"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Te mandamos un link al mail y entrás sin contraseña.
                </p>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando…" : "Enviarme el link"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
          )}
          {info && (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {info}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
