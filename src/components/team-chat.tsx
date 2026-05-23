"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hash, Plus, Send, Settings, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  createChannel,
  deleteMessage,
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
  updated_at: string;
  unread: number;
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
      <ChannelsSidebar
        channels={channels}
        activeId={activeChannelId}
        users={users}
        currentUserId={currentUserId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {activeChannelId ? (
          <ChannelView
            key={activeChannelId}
            channelId={activeChannelId}
            channelName={
              channels.find((c) => c.id === activeChannelId)?.name ?? "canal"
            }
            channelDescription={
              channels.find((c) => c.id === activeChannelId)?.description ?? null
            }
            currentUserId={currentUserId}
            initialMessages={initialMessages}
            initialMembers={initialMembers}
            users={users}
          />
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
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 md:flex">
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
        {channels.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No tenés canales.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {channels.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/chat?c=${c.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-muted font-medium" : "hover:bg-muted/60"
                    )}
                  >
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
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
        )}
      </div>
    </aside>
  );
}

function ChannelView({
  channelId,
  channelName,
  channelDescription,
  currentUserId,
  initialMessages,
  initialMembers,
  users,
}: {
  channelId: string;
  channelName: string;
  channelDescription: string | null;
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  initialMembers: string[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          setMessages((curr) => {
            if (curr.some((m) => m.id === newMsg.id)) return curr;
            return [
              ...curr,
              {
                ...newMsg,
                autor: autor
                  ? { id: autor.id, nombre: autor.nombre, avatar_url: autor.avatar_url }
                  : null,
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

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMentionQuery(null);
    setSending(true);

    // Optimista
    const tempId = `temp-${Date.now()}`;
    const me = users.find((u) => u.id === currentUserId);
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
      },
    ]);

    const res = await sendMessage(channelId, text);
    setSending(false);
    if (res?.error) {
      toast.error(res.error);
      setMessages((curr) => curr.filter((m) => m.id !== tempId));
      return;
    }
    // Reemplazar id temporal con real
    if (res.id) {
      setMessages((curr) =>
        curr.map((m) => (m.id === tempId ? { ...m, id: res.id! } : m))
      );
    }
    router.refresh();
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
          <Hash className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold">{channelName}</div>
            {channelDescription && (
              <div className="text-[11px] text-muted-foreground">
                {channelDescription}
              </div>
            )}
          </div>
        </div>
        <MembersButton
          channelId={channelId}
          channelName={channelName}
          users={users}
          initialMembers={initialMembers}
          currentUserId={currentUserId}
        />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay mensajes en #{channelName}. Empezá vos.
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
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={`Mensaje a #${channelName}… (usá @ para mencionar)`}
            rows={1}
            disabled={sending}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-md border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
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
        <div className="whitespace-pre-wrap break-words text-sm">
          {renderContentWithMentions(msg.content)}
        </div>
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
