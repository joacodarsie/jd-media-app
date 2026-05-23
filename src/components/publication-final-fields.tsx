"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, ExternalLink, Globe, Loader2, Music } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePublicationFinalFields } from "@/app/(app)/contenidos/actions";

export function PublicationFinalFields({
  id,
  initialLinkInstagram,
  initialLinkTiktok,
  initialLinkFacebook,
}: {
  id: string;
  initialLinkInstagram: string | null;
  initialLinkTiktok: string | null;
  initialLinkFacebook: string | null;
}) {
  const router = useRouter();
  const [ig, setIg] = useState(initialLinkInstagram ?? "");
  const [tt, setTt] = useState(initialLinkTiktok ?? "");
  const [fb, setFb] = useState(initialLinkFacebook ?? "");
  const [pending, start] = useTransition();
  const dirty =
    ig !== (initialLinkInstagram ?? "") ||
    tt !== (initialLinkTiktok ?? "") ||
    fb !== (initialLinkFacebook ?? "");

  function save() {
    start(async () => {
      const res = await updatePublicationFinalFields(
        id,
        ig.trim() || null,
        tt.trim() || null,
        fb.trim() || null
      );
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Links guardados");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Links de la publicación
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Pegá el link de cada red donde se publicó. Aparece en el reporte
          mensual del cliente.
        </p>
      </div>
      <NetworkLinkInput
        icon={<Camera className="h-3.5 w-3.5 text-pink-600" />}
        label="Instagram"
        value={ig}
        onChange={setIg}
        placeholder="https://instagram.com/p/…"
      />
      <NetworkLinkInput
        icon={<Music className="h-3.5 w-3.5 text-zinc-900" />}
        label="TikTok"
        value={tt}
        onChange={setTt}
        placeholder="https://tiktok.com/@…/video/…"
      />
      <NetworkLinkInput
        icon={<Globe className="h-3.5 w-3.5 text-blue-600" />}
        label="Facebook"
        value={fb}
        onChange={setFb}
        placeholder="https://facebook.com/…/posts/…"
      />
      {dirty && (
        <Button size="sm" onClick={save} disabled={pending} className="gap-1">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Guardar links
        </Button>
      )}
    </div>
  );
}

function NetworkLinkInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        {value && (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border bg-background px-2 hover:bg-muted"
            title="Abrir"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
