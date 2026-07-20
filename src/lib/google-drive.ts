/**
 * Google Drive helpers — carpetas de clientes desde el onboarding + mover la
 * carpeta al pausar/reactivar una cuenta.
 *
 * Usa el scope COMPLETO de Drive (`auth/drive`) para poder trabajar sobre las
 * carpetas reales de la agencia creadas a mano (estructura esperada:
 * "JD MEDIA" › "Clientes" y "JD MEDIA" › "Clientes pausados" — la segunda se
 * crea sola si falta). Es un scope restringido de Google: misma situación que
 * el Gmail de reclutamiento (app sin verificar → pantalla de advertencia al
 * conectar, alcanza con "Configuración avanzada → ir a la app").
 *
 * Si la conexión vigente solo tiene el scope viejo `drive.file`, la creación
 * cae en la carpeta legacy "Clientes JD Media" (creada por la app) y mover es
 * imposible: la UI pide reconectar.
 *
 * Solo server-side. Reusa las conexiones OAuth de `google_calendar_connections`.
 */
import { createAdmin } from "./supabase/admin";
import {
  getValidAccessToken,
  type GoogleCalendarConnection,
} from "./google-calendar";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
/** Carpeta madre esperada en el Drive real de la agencia. */
export const DRIVE_ROOT_NAME = "JD MEDIA";
export const DRIVE_CLIENTES_NAME = "Clientes";
export const DRIVE_PAUSADOS_NAME = "Clientes pausados";
/** Carpeta legacy (creada por la app) usada si la conexión es drive.file. */
export const DRIVE_PARENT_FOLDER = "Clientes JD Media";
export const DRIVE_SUBFOLDERS = [
  "Identidad visual",
  "Calendario de contenidos",
  "Contenido crudo",
];

/** ¿El scope incluye el Drive completo (no solo drive.file)? */
export function hasFullDriveScope(scope: string | null | undefined): boolean {
  return !!scope && /auth\/drive(\s|$)/.test(scope);
}

/** Saca el id de carpeta de un link de Drive (…/folders/<id>). */
export function extractDriveFolderId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/**
 * Busca una conexión de Google con scope de Drive. Prefiere una con el scope
 * completo; si solo hay drive.file devuelve esa (limitada).
 */
export async function findDriveConnection(): Promise<GoogleCalendarConnection | null> {
  const admin = createAdmin();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("*")
    .ilike("scope", "%auth/drive%")
    .limit(10);
  const conns = (data ?? []) as GoogleCalendarConnection[];
  return conns.find((c) => hasFullDriveScope(c.scope)) ?? conns[0] ?? null;
}

async function driveFetch(
  token: string,
  path: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive API ${res.status}: ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Escapa comillas simples para las queries `q` de la Drive API. */
function q(name: string) {
  return name.replace(/'/g, "\\'");
}

interface DriveFolder {
  id: string;
  name?: string;
  parents?: string[];
  webViewLink?: string;
}

async function listFolders(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder[]> {
  const parts = [
    `name = '${q(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const params = new URLSearchParams({
    q: parts.join(" and "),
    fields: "files(id, name, parents, webViewLink)",
    pageSize: "10",
  });
  const json = await driveFetch(token, `/files?${params.toString()}`);
  return (json.files ?? []) as DriveFolder[];
}

async function createFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder> {
  const json = await driveFetch(token, "/files?fields=id,webViewLink", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return json as unknown as DriveFolder;
}

async function ensureFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder> {
  return (
    (await listFolders(token, name, parentId))[0] ??
    (await createFolder(token, name, parentId))
  );
}

/** Cualquiera con el link puede editar (el cliente sube su contenido crudo). */
async function shareAnyoneWithLink(token: string, fileId: string) {
  await driveFetch(token, `/files/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ role: "writer", type: "anyone" }),
  });
}

/**
 * Encuentra la carpeta real "Clientes" (la que tiene por madre a "JD MEDIA")
 * y asegura "Clientes pausados" al lado. Null si no la encuentra.
 */
async function resolveAgencyFolders(
  token: string
): Promise<{ clientes: DriveFolder; pausadosId: string } | null> {
  const candidates = await listFolders(token, DRIVE_CLIENTES_NAME);
  if (candidates.length === 0) return null;

  let clientes: DriveFolder | null = null;
  let rootId: string | null = null;
  for (const c of candidates) {
    const parentId = c.parents?.[0];
    if (!parentId) continue;
    const parent = (await driveFetch(
      token,
      `/files/${parentId}?fields=id,name`
    )) as { id: string; name?: string };
    if ((parent.name ?? "").trim().toUpperCase() === DRIVE_ROOT_NAME) {
      clientes = c;
      rootId = parent.id;
      break;
    }
  }
  // Si hay una sola carpeta "Clientes" en todo el Drive, la usamos aunque la
  // madre no se llame exactamente "JD MEDIA".
  if (!clientes && candidates.length === 1 && candidates[0].parents?.[0]) {
    clientes = candidates[0];
    rootId = candidates[0].parents[0];
  }
  if (!clientes || !rootId) return null;

  const pausados = await ensureFolder(token, DRIVE_PAUSADOS_NAME, rootId);
  return { clientes, pausadosId: pausados.id };
}

export type CreateClientDriveResult =
  | { ok: true; url: string; email: string; enCarpetaReal: boolean }
  | { error: string; noConnection?: boolean };

/**
 * Crea (o completa) la carpeta del cliente con sus 3 subcarpetas y la comparte
 * por link. Con scope completo la crea dentro de "JD MEDIA › Clientes"; con el
 * scope viejo drive.file cae en la carpeta legacy de la app. Idempotente.
 */
export async function createClientDriveStructure(
  clientName: string
): Promise<CreateClientDriveResult> {
  const conn = await findDriveConnection();
  if (!conn) {
    return {
      error: "Todavía no hay una cuenta de Google con Drive conectada.",
      noConnection: true,
    };
  }

  try {
    const token = await getValidAccessToken(conn);
    let parentId: string;
    let enCarpetaReal = false;
    if (hasFullDriveScope(conn.scope)) {
      const resolved = await resolveAgencyFolders(token);
      if (resolved) {
        parentId = resolved.clientes.id;
        enCarpetaReal = true;
      } else {
        parentId = (await ensureFolder(token, DRIVE_PARENT_FOLDER)).id;
      }
    } else {
      parentId = (await ensureFolder(token, DRIVE_PARENT_FOLDER)).id;
    }

    const clientFolder = await ensureFolder(token, clientName.trim(), parentId);
    for (const sub of DRIVE_SUBFOLDERS) {
      await ensureFolder(token, sub, clientFolder.id);
    }
    await shareAnyoneWithLink(token, clientFolder.id);

    const url =
      clientFolder.webViewLink ??
      `https://drive.google.com/drive/folders/${clientFolder.id}`;
    return { ok: true, url, email: conn.google_email, enCarpetaReal };
  } catch (e) {
    console.error("createClientDriveStructure:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo crear la carpeta en Drive. ${msg}` };
  }
}

/**
 * Mueve la carpeta del cliente entre "Clientes" y "Clientes pausados" según
 * el estado de la cuenta. Funciona también con carpetas creadas a mano
 * (requiere el scope completo). Best-effort: devuelve mensaje, nunca lanza.
 */
export async function moveClientDriveFolder(
  driveUrl: string,
  destino: "activos" | "pausados"
): Promise<{ ok: true; msg: string } | { error: string }> {
  const folderId = extractDriveFolderId(driveUrl);
  if (!folderId) return { error: "El link de Drive del cliente no es una carpeta." };

  const conn = await findDriveConnection();
  if (!conn) return { error: "No hay una cuenta de Google con Drive conectada." };
  if (!hasFullDriveScope(conn.scope)) {
    return {
      error:
        "La conexión de Drive tiene permisos viejos: reconectá el Drive desde el onboarding para poder mover carpetas.",
    };
  }

  try {
    const token = await getValidAccessToken(conn);
    const resolved = await resolveAgencyFolders(token);
    if (!resolved) {
      return {
        error: `No encontré la carpeta "${DRIVE_CLIENTES_NAME}" dentro de "${DRIVE_ROOT_NAME}" en el Drive de ${conn.google_email}.`,
      };
    }
    const targetId =
      destino === "pausados" ? resolved.pausadosId : resolved.clientes.id;

    const file = (await driveFetch(
      token,
      `/files/${folderId}?fields=id,parents`
    )) as { id: string; parents?: string[] };
    const currentParents = file.parents ?? [];
    if (currentParents.includes(targetId)) {
      return { ok: true, msg: "La carpeta ya estaba en su lugar." };
    }

    const params = new URLSearchParams({
      addParents: targetId,
      ...(currentParents.length
        ? { removeParents: currentParents.join(",") }
        : {}),
      fields: "id, parents",
    });
    await driveFetch(token, `/files/${folderId}?${params.toString()}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    return {
      ok: true,
      msg:
        destino === "pausados"
          ? `Carpeta movida a "${DRIVE_PAUSADOS_NAME}" en Drive.`
          : `Carpeta movida de vuelta a "${DRIVE_CLIENTES_NAME}" en Drive.`,
    };
  } catch (e) {
    console.error("moveClientDriveFolder:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo mover la carpeta en Drive. ${msg}` };
  }
}
