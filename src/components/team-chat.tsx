"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  FileText,
  Hash,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Send,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  createChannel,
  deleteMessage,
  getOrCreateDM,
  sendMessage,
  setChannelMembers,
} from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  kind: "public" | "dm";
  updated_at: string;
  unread: number;
  peer: { id: string; nombre: string; avatar_url: string | null } | null;
}

export interface ChatAttachment {
  name: string;
  mime_type: string;
  url: string;
  size?: number;
}

export interface ChatMessageRow {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  edited_at: string | null;
  autor: { id: string; nombre: string; avatar_url: string | null } | null;
  attachments: ChatAttachment[];
}

interface PendingFile {
  file: File;
  kind: "image" | "audio" | "video" | "pdf" | "text" | "other";
  previewUrl?: string;
}

const MAX_FILE_MB = 10;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function classifyFile(file: File): PendingFile["kind"] {
  if (ALLOWED_IMAGE.includes(file.type)) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.name.endsWith(".csv")
  )
    return "text";
  return "other";
}

interface UserOption {
  id: string;
  nombre: string;
  avatar_url: string | null;
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const same =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (same) {
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatLayout({
  currentUserId,
  channels,
  activeChannelId,
  initialMessages,
  initialMembers,
  users,
}: {
  currentUserId: string;
  channels: ChatChannel[];
  activeChannelId: string | null;
  initialMessages: ChatMessageRow[];
  initialMembers: string[];
  users: UserOption[];
}) {
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
      {/* Sidebar: en mobile se oculta cuando hay un canal activo */}
      <div
        className={cn(
          "flex w-full shrink-0 flex-col md:flex md:w-64",
          activeChannelId ? "hidden md:flex" : "flex"
        )}
      >
        <ChannelsSidebar
          channels={channels}
          activeId={activeChannelId}
          users={users}
          currentUserId={currentUserId}
        />
      </div>

      {/* ChannelView: en mobile se oculta si no hay canal activo */}
      <div
        className={cn(
          "min-w-0 flex-1 flex-col md:flex",
          activeChannelId ? "flex" : "hidden md:flex"
        )}
      >
        {activeChannelId ? (
          (() => {
            const active = channels.find((c) => c.id === activeChannelId);
            return (
              <ChannelView
                key={activeChannelId}
                channelId={activeChannelId}
                channelName={
                  active?.kind === "dm"
                    ? active.peer?.nombre ?? "Directo"
                    : active?.name ?? "canal"
                }
                channelDescription={active?.description ?? null}
                channelKind={active?.kind ?? "public"}
                peerAvatarUrl={active?.peer?.avatar_url ?? null}
                currentUserId={currentUserId}
                initialMessages={initialMessages}
                initialMembers={initialMembers}
                users={users}
              />
            );
          })()
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            No tenés canales todavía.
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelsSidebar({
  channels,
  activeId,
  users,
  currentUserId,
}: {
  channels: ChatChannel[];
  activeId: string | null;
  users: UserOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    users.filter((u) => u.id !== currentUserId).map((u) => u.id)
  );
  const [pending, setPending] = useState(false);

  function toggleMember(id: string) {
    setMemberIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Falta nombre.");
      return;
    }
    setPending(true);
    const res = await createChannel(name, desc, memberIds);
    setPending(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    setName("");
    setDesc("");
    setMemberIds(users.filter((u) => u.id !== currentUserId).map((u) => u.id));
    if (res.id) router.push(`/chat?c=${res.id}`);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-r bg-card/40 md:w-64">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div className="text-sm font-semibold">Chat interno</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Nuevo canal">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo canal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Nombre</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej: paid-media"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Descripción (opcional)</label>
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="De qué se habla acá"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">
                    Miembros ({memberIds.length + 1})
                  </label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setMemberIds(
                          users.filter((u) => u.id !== currentUserId).map((u) => u.id)
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Todos
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setMemberIds([])}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border bg-card p-1">
                  <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm opacity-70">
                    <input type="checkbox" checked disabled className="h-3.5 w-3.5" />
                    <span>Vos (creador)</span>
                  </div>
                  {users
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => {
                      const active = memberIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleMember(u.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span>{u.nombre}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Creando…" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <SidebarSection
          title="Canales"
          items={channels.filter((c) => c.kind === "public")}
          activeId={activeId}
        />
        <div className="mt-3 flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Directos
          </span>
          <DMPicker
            users={users.filter((u) => u.id !== currentUserId)}
          />
        </div>
        {channels.filter((c) => c.kind === "dm").length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">
            No tenés conversaciones directas.
          </p>
        ) : (
          <SidebarSection
            title=""
            items={channels.filter((c) => c.kind === "dm")}
            activeId={activeId}
          />
        )}
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  items,
  activeId,
}: {
  title: string;
  items: ChatChannel[];
  activeId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      {title && (
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <ul className="space-y-0.5">
        {items.map((c) => {
          const active = c.id === activeId;
          const label = c.kind === "dm" ? c.peer?.nombre ?? "Directo" : c.name;
          return (
            <li key={c.id}>
              <Link
                href={`/chat?c=${c.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-muted font-medium" : "hover:bg-muted/60"
                )}
              >
                {c.kind === "dm" ? (
                  <Avatar className="h-5 w-5">
                    {c.peer?.avatar_url && (
                      <AvatarImage src={c.peer.avatar_url} alt={label} />
                    )}
                    <AvatarFallback className="text-[8px]">
                      {initials(label)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {c.unread > 0 && !active && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DMPicker({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [q, setQ] = useState("");

  async function start(otherId: string) {
    setPending(true);
    const res = await getOrCreateDM(otherId);
    setPending(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    setQ("");
    if (res.id) router.push(`/chat?c=${res.id}`);
  }

  const filtered = q.trim()
    ? users.filter((u) => u.nombre.toLowerCase().includes(q.toLowerCase()))
    : users;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Nuevo directo"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo mensaje directo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona…"
          />
          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border bg-card p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Sin resultados.
              </p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => start(u.id)}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Avatar className="h-6 w-6">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.nombre} />}
                    <AvatarFallback className="text-[10px]">
                      {initials(u.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{u.nombre}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChannelView({
  channelId,
  channelName,
  channelDescription,
  channelKind,
  peerAvatarUrl,
  currentUserId,
  initialMessages,
  initialMembers,
  users,
}: {
  channelId: string;
  channelName: string;
  channelDescription: string | null;
  channelKind: "public" | "dm";
  peerAvatarUrl: string | null;
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  initialMembers: string[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recLevels, setRecLevels] = useState<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCancelledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const accepted: PendingFile[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: supera ${MAX_FILE_MB}MB`);
        continue;
      }
      const kind = classifyFile(f);
      // Para image/audio/video creamos un blob URL así el render optimista
      // tiene contenido para mostrar (img/audio/video) antes de que el server
      // devuelva la signed URL definitiva.
      const needsPreview =
        kind === "image" || kind === "audio" || kind === "video";
      accepted.push({
        file: f,
        kind,
        previewUrl: needsPreview ? URL.createObjectURL(f) : undefined,
      });
    }
    if (accepted.length > 0) setPending((curr) => [...curr, ...accepted]);
  }

  function removePending(idx: number) {
    setPending((curr) => {
      const copy = curr.slice();
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  async function uploadFiles(files: File[]): Promise<
    {
      storage_path: string;
      name: string;
      mime_type: string;
      size: number;
    }[]
  > {
    if (files.length === 0) return [];
    const supabase = createClient();
    const out: {
      storage_path: string;
      name: string;
      mime_type: string;
      size: number;
    }[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() ?? "bin";
      const path = `chat/${currentUserId}/${channelId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, f, {
          contentType: f.type || "application/octet-stream",
        });
      if (error) {
        toast.error(`Subiendo ${f.name}: ${error.message}`);
        continue;
      }
      out.push({
        storage_path: path,
        name: f.name,
        mime_type: f.type || "application/octet-stream",
        size: f.size,
      });
    }
    return out;
  }

  const usersById = useMemo(() => {
    const m = new Map<string, UserOption>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  // Solo los miembros del canal son candidatos a @-mención
  const channelMembers = useMemo(() => {
    const set = new Set(initialMembers);
    return users.filter((u) => set.has(u.id));
  }, [users, initialMembers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime: suscribir a nuevos mensajes de este canal
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`team_messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            channel_id: string;
            user_id: string;
            content: string;
            mentions: string[];
            created_at: string;
            edited_at: string | null;
          };
          // Si es nuestro propio mensaje, ya lo agregamos optimista en send()
          if (newMsg.user_id === currentUserId) return;
          const autor = usersById.get(newMsg.user_id);
          // Fetch adjuntos del nuevo mensaje + signed URLs
          let attachments: ChatAttachment[] = [];
          const { data: atts } = await supabase
            .from("chat_attachments")
            .select("name, mime_type, storage_path, size")
            .eq("message_id", newMsg.id);
          type AttRow = {
            name: string;
            mime_type: string;
            storage_path: string;
            size: number | null;
          };
          const rows = (atts ?? []) as AttRow[];
          if (rows.length > 0) {
            const { data: signed } = await supabase.storage
              .from("documents")
              .createSignedUrls(
                rows.map((r) => r.storage_path),
                60 * 60
              );
            const urls = new Map<string, string>();
            for (const s of signed ?? []) {
              if (s?.signedUrl && s.path) urls.set(s.path, s.signedUrl);
            }
            attachments = rows.map((r) => ({
              name: r.name,
              mime_type: r.mime_type,
              url: urls.get(r.storage_path) ?? "",
              size: r.size ?? undefined,
            }));
          }
          setMessages((curr) => {
            if (curr.some((m) => m.id === newMsg.id)) return curr;
            return [
              ...curr,
              {
                ...newMsg,
                autor: autor
                  ? { id: autor.id, nombre: autor.nombre, avatar_url: autor.avatar_url }
                  : null,
                attachments,
              },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "team_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const oldMsg = payload.old as { id: string };
          setMessages((curr) => curr.filter((m) => m.id !== oldMsg.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, currentUserId, usersById]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setInput(v);
    // Detectar @query justo antes del cursor
    const caret = e.target.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\p{L}\p{N}._-]{0,30})$/u);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }

  function pickMention(name: string) {
    const v = input;
    const caret = inputRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const after = v.slice(caret);
    const replaced = before.replace(
      /@([\p{L}\p{N}._-]{0,30})$/u,
      `@${name.split(" ")[0]} `
    );
    const newVal = replaced + after;
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "audio/webm";
  }

  function cleanupAudioGraph() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recChunksRef.current = [];
      recCancelledRef.current = false;

      // AnalyserNode para waveform en vivo
      const NUM_BARS = 28;
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        setRecLevels(new Array(NUM_BARS).fill(0));

        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          // Reducir a NUM_BARS valores (muestreando rangos de frecuencia)
          const bars: number[] = [];
          const step = Math.floor(data.length / NUM_BARS);
          for (let i = 0; i < NUM_BARS; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
            const avg = sum / step / 255; // 0..1
            // Boost para que se vea más en voz hablada
            bars.push(Math.min(1, Math.pow(avg, 0.7) * 1.6));
          }
          setRecLevels(bars);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Si no hay AnalyserNode disponible, seguimos sin waveform
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recChunksRef.current, { type: mimeType });
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        cleanupAudioGraph();
        if (recTimerRef.current) {
          clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        setRecording(false);
        setRecSeconds(0);
        setRecLevels([]);

        if (recCancelledRef.current) return;
        if (blob.size === 0) {
          toast.error("No se capturó audio.");
          return;
        }
        const ext = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
          ? "m4a"
          : "webm";
        const file = new File([blob], `audio-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        // Auto-send (estilo WhatsApp): se envía solo el audio inmediatamente.
        const previewUrl = URL.createObjectURL(blob);
        const previewMap = new Map<File, string>([[file, previewUrl]]);
        await sendWith("", [file], previewMap);
      };

      recorder.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => {
          if (s + 1 >= 300) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo acceder al micrófono: " + msg);
    }
  }

  function stopRecording() {
    const r = mediaRecorderRef.current;
    if (!r) return;
    recCancelledRef.current = false;
    if (r.state !== "inactive") r.stop();
  }

  function cancelRecording() {
    const r = mediaRecorderRef.current;
    if (!r) return;
    recCancelledRef.current = true;
    if (r.state !== "inactive") r.stop();
  }

  // Cleanup si el user navega o desmonta mientras graba
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      cleanupAudioGraph();
    };
  }, []);

  /**
   * Envía un mensaje al canal. Acepta texto + archivos (sin pasar por pending).
   * Usado por el botón Enviar y por el auto-send después de grabar audio.
   */
  async function sendWith(text: string, files: File[], previewMap?: Map<File, string>) {
    if ((!text && files.length === 0) || sending) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const me = users.find((u) => u.id === currentUserId);
    const optimisticAtts: ChatAttachment[] = files.map((f) => ({
      name: f.name,
      mime_type: f.type,
      url: previewMap?.get(f) ?? "",
      size: f.size,
    }));
    setMessages((curr) => [
      ...curr,
      {
        id: tempId,
        channel_id: channelId,
        user_id: currentUserId,
        content: text,
        mentions: [],
        created_at: new Date().toISOString(),
        edited_at: null,
        autor: me
          ? { id: me.id, nombre: me.nombre, avatar_url: me.avatar_url }
          : null,
        attachments: optimisticAtts,
      },
    ]);

    let uploaded: Awaited<ReturnType<typeof uploadFiles>> = [];
    try {
      uploaded = await uploadFiles(files);
    } catch (e) {
      toast.error("Falló subir adjuntos: " + (e instanceof Error ? e.message : ""));
      setMessages((curr) => curr.filter((m) => m.id !== tempId));
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    const res = await sendMessage(channelId, text, uploaded);
    setSending(false);
    inputRef.current?.focus();
    if (res?.error) {
      toast.error(res.error);
      setMessages((curr) => curr.filter((m) => m.id !== tempId));
      return;
    }
    if (res.id) {
      setMessages((curr) =>
        curr.map((m) => (m.id === tempId ? { ...m, id: res.id! } : m))
      );
    }
    router.refresh();
  }

  async function send() {
    const text = input.trim();
    if ((!text && pending.length === 0) || sending) return;

    const files = pending.map((p) => p.file);
    const previewMap = new Map<File, string>();
    for (const p of pending) if (p.previewUrl) previewMap.set(p.file, p.previewUrl);

    setInput("");
    setMentionQuery(null);
    setPending([]);

    await sendWith(text, files, previewMap);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !mentionQuery) {
      e.preventDefault();
      send();
    }
  }

  async function remove(messageId: string) {
    if (!confirm("¿Borrar este mensaje?")) return;
    const res = await deleteMessage(messageId, channelId);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setMessages((curr) => curr.filter((m) => m.id !== messageId));
  }

  const filteredMentionUsers = mentionQuery !== null
    ? channelMembers
        .filter((u) => u.id !== currentUserId)
        .filter((u) => {
          if (!mentionQuery) return true;
          const n = u.nombre.toLowerCase();
          return n.includes(mentionQuery);
        })
        .slice(0, 6)
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href="/chat"
            className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Volver a canales"
          >
            <ChevronLeft className="h-5 w-5" />
          </a>
          {channelKind === "dm" ? (
            <Avatar className="h-7 w-7">
              {peerAvatarUrl && <AvatarImage src={peerAvatarUrl} alt={channelName} />}
              <AvatarFallback className="text-[10px]">
                {initials(channelName)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="text-sm font-semibold">{channelName}</div>
            {channelKind === "dm" ? (
              <div className="text-[11px] text-muted-foreground">
                Mensaje directo
              </div>
            ) : (
              channelDescription && (
                <div className="text-[11px] text-muted-foreground">
                  {channelDescription}
                </div>
              )
            )}
          </div>
        </div>
        {channelKind === "public" && (
          <MembersButton
            channelId={channelId}
            channelName={channelName}
            users={users}
            initialMembers={initialMembers}
            currentUserId={currentUserId}
          />
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {channelKind === "dm"
              ? `Empezá la conversación con ${channelName}.`
              : `Todavía no hay mensajes en #${channelName}. Empezá vos.`}
          </p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const compact =
              prev &&
              prev.user_id === m.user_id &&
              new Date(m.created_at).getTime() -
                new Date(prev.created_at).getTime() <
                5 * 60 * 1000;
            return (
              <MessageRow
                key={m.id}
                msg={m}
                isMe={m.user_id === currentUserId}
                compact={!!compact}
                onDelete={() => remove(m.id)}
                currentUserId={currentUserId}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t bg-background px-4 py-3">
        {filteredMentionUsers.length > 0 && (
          <div className="absolute bottom-full left-4 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover shadow-md">
            {filteredMentionUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => pickMention(u.nombre)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Avatar className="h-6 w-6">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.nombre} />}
                  <AvatarFallback className="text-[10px]">{initials(u.nombre)}</AvatarFallback>
                </Avatar>
                <span>{u.nombre}</span>
              </button>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((p, idx) => (
              <PendingChip
                key={idx}
                pending={p}
                onRemove={() => removePending(idx)}
              />
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {!recording && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar archivo"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={startRecording}
                title="Grabar audio"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </>
          )}
          {recording ? (
            <div className="flex h-11 flex-1 items-center gap-3 rounded-md border border-red-300 bg-red-50 px-3 dark:border-red-900 dark:bg-red-950/30">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-red-700 hover:bg-red-100 hover:text-red-900 dark:text-red-300 dark:hover:bg-red-900/30"
                onClick={cancelRecording}
                title="Cancelar grabación"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex flex-1 items-center gap-2 overflow-hidden">
                <Mic className="h-4 w-4 shrink-0 animate-pulse text-red-600 dark:text-red-400" />
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-red-800 dark:text-red-300">
                  {Math.floor(recSeconds / 60)}:
                  {String(recSeconds % 60).padStart(2, "0")}
                </span>
                <div className="flex flex-1 items-center justify-center gap-[2px] overflow-hidden">
                  {(recLevels.length > 0
                    ? recLevels
                    : new Array(28).fill(0.1)
                  ).map((lvl, i) => (
                    <span
                      key={i}
                      className="inline-block w-[2px] rounded-full bg-red-500 dark:bg-red-400"
                      style={{
                        height: `${4 + Math.max(0.05, lvl) * 20}px`,
                        transition: "height 60ms linear",
                        opacity: 0.5 + lvl * 0.5,
                      }}
                    />
                  ))}
                </div>
                <span className="hidden shrink-0 text-[10px] text-red-700/70 sm:inline dark:text-red-400/70">
                  Tocá ➤ para enviar
                </span>
              </div>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                onClick={stopRecording}
                title="Terminar y adjuntar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKey}
              onPaste={onPaste}
              placeholder={
                channelKind === "dm"
                  ? `Mensaje a ${channelName}…`
                  : `Mensaje a #${channelName}… (usá @ para mencionar)`
              }
              rows={1}
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-md border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
          {!recording && (
            <Button
              onClick={send}
              disabled={sending || (!input.trim() && pending.length === 0)}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  msg,
  isMe,
  compact,
  onDelete,
  currentUserId,
}: {
  msg: ChatMessageRow;
  isMe: boolean;
  compact: boolean;
  onDelete: () => void;
  currentUserId: string;
}) {
  const mentionsMe = msg.mentions.includes(currentUserId);
  const name = msg.autor?.nombre ?? "Usuario";

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-md px-2 py-1 hover:bg-muted/30",
        compact ? "pt-0.5" : "pt-2",
        mentionsMe && "bg-primary/5"
      )}
    >
      {!compact ? (
        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
          {msg.autor?.avatar_url && (
            <AvatarImage src={msg.autor.avatar_url} alt={name} />
          )}
          <AvatarFallback className="text-[10px]">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-[10px] text-muted-foreground">
              {fmtTime(msg.created_at)}
            </span>
          </div>
        )}
        {msg.content && (
          <div className="whitespace-pre-wrap break-words text-sm">
            {renderContentWithMentions(msg.content)}
          </div>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-1">
            <MessageAttachments items={msg.attachments} />
          </div>
        )}
      </div>
      {isMe && (
        <button
          onClick={onDelete}
          className="self-start rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
          title="Borrar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function MembersButton({
  channelId,
  channelName,
  users,
  initialMembers,
  currentUserId,
}: {
  channelId: string;
  channelName: string;
  users: UserOption[];
  initialMembers: string[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialMembers);
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    if (id === currentUserId) return; // No se puede sacar a uno mismo
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  }

  async function save() {
    setPending(true);
    const res = await setChannelMembers(channelId, selected);
    setPending(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    const added = res.added ?? 0;
    const removed = res.removed ?? 0;
    toast.success(
      added || removed
        ? `Listo. +${added} · -${removed}`
        : "Sin cambios"
    );
    setOpen(false);
    router.refresh();
  }

  const memberCount = selected.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(initialMembers);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" />
          {memberCount}
          <Settings className="h-3 w-3 opacity-60" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Miembros de #{channelName}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Marcá quién participa en este canal. Vos no podés quitarte de un canal
          que estás administrando.
        </p>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            {selected.length} {selected.length === 1 ? "miembro" : "miembros"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(users.map((u) => u.id))}
              className="text-muted-foreground hover:text-foreground"
            >
              Todos
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setSelected([currentUserId])}
              className="text-muted-foreground hover:text-foreground"
            >
              Solo yo
            </button>
          </div>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border bg-card p-1">
          {users.map((u) => {
            const isMe = u.id === currentUserId;
            const active = selected.includes(u.id);
            return (
              <label
                key={u.id}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                  isMe ? "opacity-70" : "cursor-pointer hover:bg-muted"
                )}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={isMe}
                  onChange={() => toggle(u.id)}
                  className="h-3.5 w-3.5"
                />
                <Avatar className="h-6 w-6">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.nombre} />}
                  <AvatarFallback className="text-[10px]">
                    {initials(u.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1">{u.nombre}</span>
                {isMe && (
                  <span className="text-[10px] text-muted-foreground">tú</span>
                )}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingChip({
  pending,
  onRemove,
}: {
  pending: PendingFile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
      {pending.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pending.previewUrl}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      ) : pending.kind === "pdf" ? (
        <FileText className="h-4 w-4 text-red-500" />
      ) : pending.kind === "audio" ? (
        <FileText className="h-4 w-4 text-purple-500" />
      ) : pending.kind === "video" ? (
        <FileText className="h-4 w-4 text-blue-500" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="max-w-[160px] truncate">{pending.file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label="Quitar adjunto"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MessageAttachments({ items }: { items: ChatAttachment[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a, i) => {
        const isImage = a.mime_type.startsWith("image/");
        const isAudio = a.mime_type.startsWith("audio/");
        const isVideo = a.mime_type.startsWith("video/");
        if (isImage && a.url) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="max-h-48 rounded-md object-cover"
              />
            </a>
          );
        }
        if (isAudio && a.url) {
          return (
            <audio
              key={i}
              src={a.url}
              controls
              className="max-w-[280px]"
            />
          );
        }
        if (isVideo && a.url) {
          return (
            <video
              key={i}
              src={a.url}
              controls
              className="max-h-60 max-w-[320px] rounded-md"
            />
          );
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1 text-xs hover:bg-background"
          >
            {a.mime_type === "application/pdf" ? (
              <FileText className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="max-w-[180px] truncate">{a.name}</span>
          </a>
        );
      })}
    </div>
  );
}

function renderContentWithMentions(text: string) {
  const parts: (string | { mention: string })[] = [];
  let last = 0;
  const re = /@([\p{L}][\p{L}\p{N}._-]{1,30})/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ mention: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span
        key={i}
        className="rounded bg-primary/10 px-1 font-medium text-primary"
      >
        @{p.mention}
      </span>
    )
  );
}
