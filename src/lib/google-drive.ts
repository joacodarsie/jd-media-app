/**
 * Google Drive helpers — crea la estructura de carpetas de cada cliente
 * (carpeta del cliente + Identidad visual / Calendario de contenidos /
 * Contenido crudo) desde el onboarding de Gestión de Redes.
 *
 * Usa el scope `drive.file` (NO sensible para Google: la app solo ve y
 * administra los archivos que ella misma creó — no requiere re-verificación
 * del OAuth publicado). Consecuencia: la carpeta madre "Clientes" que usa la
 * app es una carpeta creada POR la app en el Drive de la cuenta conectada;
 * no puede reusar una carpeta "Clientes" creada a mano.
 *
 * Solo server-side. Reusa las conexiones OAuth de `google_calendar_connections`
 * (la conexión de Drive es una conexión de Google más, con el scope extra).
 */
import { createAdmin } from "./supabase/admin";
import {
  getValidAccessToken,
  type GoogleCalendarConnection,
} from "./google-calendar";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/** Carpeta madre (creada por la app) donde viven las carpetas de clientes. */
export const DRIVE_PARENT_FOLDER = "Clientes JD Media";
export const DRIVE_SUBFOLDERS = [
  "Identidad visual",
  "Calendario de contenidos",
  "Contenido crudo",
];

/**
 * Busca una conexión de Google que tenga el scope de Drive.
 * Devuelve null si nadie conectó Drive todavía.
 */
export async function findDriveConnection(): Promise<GoogleCalendarConnection | null> {
  const admin = createAdmin();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("*")
    .ilike("scope", "%auth/drive.file%")
    .limit(1);
  return (data?.[0] as GoogleCalendarConnection | undefined) ?? null;
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
  webViewLink?: string;
}

async function findChildFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder | null> {
  const parts = [
    `name = '${q(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const params = new URLSearchParams({
    q: parts.join(" and "),
    fields: "files(id, webViewLink)",
    pageSize: "1",
  });
  const json = await driveFetch(token, `/files?${params.toString()}`);
  const files = (json.files ?? []) as DriveFolder[];
  return files[0] ?? null;
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
  return (await findChildFolder(token, name, parentId)) ?? (await createFolder(token, name, parentId));
}

/** Cualquiera con el link puede editar (el cliente sube su contenido crudo). */
async function shareAnyoneWithLink(token: string, fileId: string) {
  await driveFetch(token, `/files/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ role: "writer", type: "anyone" }),
  });
}

export type CreateClientDriveResult =
  | { ok: true; url: string; email: string }
  | { error: string; noConnection?: boolean };

/**
 * Crea (o completa, si se corre de nuevo) la carpeta del cliente con sus 3
 * subcarpetas y la comparte por link. Idempotente: si la carpeta ya existía
 * la reusa y solo crea lo que falte.
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
    const parent = await ensureFolder(token, DRIVE_PARENT_FOLDER);
    const clientFolder = await ensureFolder(token, clientName.trim(), parent.id);
    for (const sub of DRIVE_SUBFOLDERS) {
      await ensureFolder(token, sub, clientFolder.id);
    }
    await shareAnyoneWithLink(token, clientFolder.id);

    const url =
      clientFolder.webViewLink ??
      `https://drive.google.com/drive/folders/${clientFolder.id}`;
    return { ok: true, url, email: conn.google_email };
  } catch (e) {
    console.error("createClientDriveStructure:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo crear la carpeta en Drive. ${msg}` };
  }
}
