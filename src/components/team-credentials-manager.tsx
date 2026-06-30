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
  Eye,
  EyeOff,
  Copy,
  UserCog,
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
  updateUserPermissions,
  updateUserRoles,
} from "@/app/(app)/accesos/team-actions";
import { ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import {
  FEATURES,
  FEATURE_LABEL,
  FEATURE_DESCRIPTION,
  type Feature,
} from "@/lib/permissions";
import { ROLE_DEFAULT_FEATURES } from "@/lib/role-defaults";
import { Shield } from "lucide-react";

export interface TeamRow {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  area: string;
  rol_secundario?: UserRole | null;
  area_secundaria?: string | null;
  activo: boolean;
  permisos?: Record<string, boolean> | null;
  password_visible?: string | null;
}

/** Valor centinela para "sin rol/área secundaria" en los Select. */
const NONE = "__none__";

const ROLES: UserRole[] = [
  "admin",
  "coordinador",
  "coordinador_diseno",
  "community_manager",
  "diseno",
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
  "Coordinación de Diseño",
  "Diseño",
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
              <th className="px-3 py-2">Contraseña</th>
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
        <div className="inline-flex items-center gap-1">
          <ChangeEmailPopover user={user} />
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(user.email).then(
                () => toast.success("Email copiado"),
                () => toast.error("No se pudo copiar")
              )
            }
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copiar email"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <PasswordCell pass={user.password_visible ?? null} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {ROLE_LABEL[user.rol] ?? user.rol}
        {user.rol_secundario && (
          <span
            className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
            title="Rol secundario"
          >
            +{ROLE_LABEL[user.rol_secundario] ?? user.rol_secundario}
          </span>
        )}
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
          <EditRolesDialog user={user} />
          <PermissionsDialog user={user} />
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

function PermissionsDialog({ user }: { user: TeamRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isAdmin = user.rol === "admin";

  // Estado local con los flags
  const initial = (user.permisos ?? {}) as Record<string, boolean>;
  const [flags, setFlags] = useState<Record<Feature, boolean>>(
    () =>
      Object.fromEntries(
        FEATURES.map((f) => [f, initial[f] === true])
      ) as Record<Feature, boolean>
  );

  function toggleFlag(f: Feature) {
    setFlags((cur) => ({ ...cur, [f]: !cur[f] }));
  }

  function save() {
    start(async () => {
      const res = await updateUserPermissions(user.id, flags);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Permisos actualizados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2"
          title="Permisos de acceso"
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Permisos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permisos de {user.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {isAdmin && (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Este usuario es <b>admin</b>. Tiene acceso total a todas las
              secciones, sin importar los checkboxes de abajo.
            </p>
          )}
          <p className="rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
            Por defecto un miembro del equipo no ve estas secciones. Marcá las
            que quieras darle acceso individual.
          </p>
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-2 hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={flags[f]}
                  onChange={() => toggleFlag(f)}
                  disabled={isAdmin}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded"
                />
                <div>
                  <div className="text-sm font-medium">{FEATURE_LABEL[f]}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {FEATURE_DESCRIPTION[f]}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || isAdmin}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar permisos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordCell({ pass }: { pass: string | null }) {
  const [shown, setShown] = useState(false);
  if (!pass) {
    return (
      <span className="text-[11px] italic text-muted-foreground">
        — sin registro
      </span>
    );
  }
  function copy() {
    navigator.clipboard.writeText(pass!).then(
      () => toast.success("Contraseña copiada"),
      () => toast.error("No se pudo copiar")
    );
  }
  return (
    <div className="inline-flex items-center gap-1 text-xs">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
        {shown ? pass : "•".repeat(Math.min(pass.length, 10))}
      </code>
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={shown ? "Ocultar" : "Mostrar"}
      >
        {shown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Copiar"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function RoleDefaultsPreview({ rol }: { rol: UserRole }) {
  const features = ROLE_DEFAULT_FEATURES[rol] ?? [];
  if (rol === "admin") {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Shield className="h-3 w-3" /> Admin
        </div>
        <p className="mt-0.5 text-foreground/70">
          Acceso total: todas las secciones (Finanzas, Global, Credenciales,
          Documentos, etc.).
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
      <div className="font-semibold text-foreground">
        Permisos que se asignan por defecto
      </div>
      {features.length === 0 ? (
        <p className="mt-1 text-foreground/70">
          Solo acceso a lo básico (Mi día, Tareas, Contenidos, Agenda, Chat,
          JDmedIA). Podés sumarle más después desde el botón <b>Permisos</b>.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" />
              {FEATURE_LABEL[f]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Editar rol/área (primario y secundario) de un usuario ya creado. */
function EditRolesDialog({ user }: { user: TeamRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rol, setRol] = useState<UserRole>(user.rol);
  const [area, setArea] = useState(user.area);
  const [rolSec, setRolSec] = useState<string>(user.rol_secundario ?? NONE);
  const [areaSec, setAreaSec] = useState<string>(user.area_secundaria ?? NONE);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateUserRoles(user.id, {
        rol,
        area,
        rolSecundario: rolSec === NONE ? null : rolSec,
        areaSecundaria: areaSec === NONE ? null : areaSec,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Roles actualizados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2" title="Rol y área">
          <UserCog className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Rol</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rol y área de {user.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Rol principal</Label>
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
              <Label className="text-xs">Área principal</Label>
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

          <div className="rounded-md border border-dashed p-2">
            <p className="mb-2 text-[11px] text-muted-foreground">
              <b>2º rol (opcional)</b> — para quien cumple dos funciones. Suma sus
              permisos y lo hace figurar también en esa área.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Rol secundario</Label>
                <Select value={rolSec} onValueChange={setRolSec}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ninguno</SelectItem>
                    {ROLES.filter((r) => r !== rol).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Área secundaria</Label>
                <Select value={areaSec} onValueChange={setAreaSec}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ninguna</SelectItem>
                    {AREAS.filter((a) => a !== area).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <p className="rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
            Guardar <b>suma</b> los permisos por defecto de los roles; nunca quita
            accesos que ya le diste a mano desde <b>Permisos</b>.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<UserRole>("community_manager");
  const [area, setArea] = useState(AREAS[3]);
  const [rolSec, setRolSec] = useState<string>(NONE);
  const [areaSec, setAreaSec] = useState<string>(NONE);
  const [pwd, setPwd] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setNombre("");
    setEmail("");
    setRol("community_manager");
    setArea(AREAS[3]);
    setRolSec(NONE);
    setAreaSec(NONE);
    setPwd("");
  }

  function submit() {
    if (!nombre.trim() || !email.trim() || pwd.length < 8) {
      toast.error("Completá todo (pass min 8).");
      return;
    }
    start(async () => {
      const res = await inviteNewUser({
        nombre,
        email,
        rol,
        area,
        rolSecundario: rolSec === NONE ? null : rolSec,
        areaSecundaria: areaSec === NONE ? null : areaSec,
        password: pwd,
      });
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

          <div className="rounded-md border border-dashed p-2">
            <p className="mb-2 text-[11px] text-muted-foreground">
              <b>2º rol (opcional)</b> — si cumple dos funciones en la agencia.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Rol secundario</Label>
                <Select value={rolSec} onValueChange={setRolSec}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ninguno</SelectItem>
                    {ROLES.filter((r) => r !== rol).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Área secundaria</Label>
                <Select value={areaSec} onValueChange={setAreaSec}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ninguna</SelectItem>
                    {AREAS.filter((a) => a !== area).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

          <RoleDefaultsPreview rol={rol} />
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
