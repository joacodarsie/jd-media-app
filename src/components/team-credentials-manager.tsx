"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  KeyRound,
  Send,
  Power,
  UserPlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  inviteNewUser,
  sendPasswordReset,
  setUserPassword,
  toggleUserActive,
  updateUserEmail,
} from "@/app/(app)/accesos/team-actions";
import { ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

export interface TeamRow {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  area: string;
  activo: boolean;
}

const ROLES: UserRole[] = [
  "admin",
  "coordinador",
  "creativa",
  "community_manager",
  "audiovisual",
  "comercial",
  "paid_media",
  "prospecting",
  "web",
  "botly",
];

const AREAS = [
  "Estrategia/Dirección",
  "Coordinación",
  "Diseño",
  "Creativas",
  "Community Manager",
  "Edición Audiovisual",
  "Paid Media",
  "Prospecting",
  "Comercial",
  "Desarrollo Web",
  "Botly",
];

export function TeamCredentialsManager({ users }: { users: TeamRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Equipo (acceso a la app)</h2>
          <p className="text-xs text-muted-foreground">
            Cambiá email o contraseña de cualquiera, mandá un mail de reset o
            invitá a alguien nuevo.
          </p>
        </div>
        <InviteDialog />
      </div>

      <div className="rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user }: { user: TeamRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    if (!confirm(user.activo ? `¿Desactivar a ${user.nombre}?` : `¿Reactivar a ${user.nombre}?`))
      return;
    start(async () => {
      const res = await toggleUserActive(user.id, !user.activo);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(user.activo ? "Desactivado" : "Reactivado");
      router.refresh();
    });
  }

  function reset() {
    start(async () => {
      const res = await sendPasswordReset(user.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Mail de reset enviado");
    });
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-3 py-2 font-medium">{user.nombre}</td>
      <td className="px-3 py-2">
        <ChangeEmailPopover user={user} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {ROLE_LABEL[user.rol] ?? user.rol}
      </td>
      <td className="px-3 py-2 text-xs">
        {user.activo ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Activo
          </span>
        ) : (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Inactivo
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <SetPasswordPopover user={user} />
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={pending}
            title="Mandar mail para que resetee la contraseña"
            className="h-8 gap-1 px-2"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mail reset</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggle}
            disabled={pending}
            title={user.activo ? "Desactivar" : "Reactivar"}
            className="h-8 gap-1 px-2"
          >
            <Power className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ChangeEmailPopover({ user }: { user: TeamRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [pending, start] = useTransition();

  function save() {
    if (email === user.email) {
      setOpen(false);
      return;
    }
    start(async () => {
      const res = await updateUserEmail(user.id, email);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Email actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs hover:underline">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          {user.email}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <Label className="text-xs">Nuevo email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SetPasswordPopover({ user }: { user: TeamRow }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (pwd.length < 8) {
      toast.error("Mínimo 8 caracteres.");
      return;
    }
    if (!confirm(`¿Setear nueva contraseña para ${user.nombre}? Va a poder entrar con ella inmediatamente.`))
      return;
    start(async () => {
      const res = await setUserPassword(user.id, pwd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contraseña actualizada");
      setPwd("");
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2" title="Setear contraseña">
          <KeyRound className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Setear pass</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <div>
          <Label className="text-xs">Nueva contraseña para {user.nombre}</Label>
          <Input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="mínimo 8 caracteres"
            className="h-8 font-mono text-xs"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Compartila por un canal seguro. Mejor: mandale el botón &quot;Mail reset&quot; para que la elija ella.
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={pending || pwd.length < 8}>
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Setear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<UserRole>("creativa");
  const [area, setArea] = useState(AREAS[3]);
  const [pwd, setPwd] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setNombre("");
    setEmail("");
    setRol("creativa");
    setArea(AREAS[3]);
    setPwd("");
  }

  function submit() {
    if (!nombre.trim() || !email.trim() || pwd.length < 8) {
      toast.error("Completá todo (pass min 8).");
      return;
    }
    start(async () => {
      const res = await inviteNewUser({ nombre, email, rol, area, password: pwd });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Usuario creado: ${nombre}`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario del equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@jdmedia.com"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as UserRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Contraseña inicial</Label>
            <Input
              type="text"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="mínimo 8 caracteres"
              className="h-9 font-mono"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Compartila por un canal seguro. La persona la puede cambiar después.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
