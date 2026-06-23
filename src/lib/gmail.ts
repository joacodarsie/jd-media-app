/**
 * Conexión a la casilla de Gmail de la agencia para traer CVs al reclutamiento.
 * Reusa el cliente OAuth de Google que la app ya usa para Calendar
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), pero con el scope `gmail.readonly`
 * y su propio redirect URI. La app de Google tiene que tener habilitada la Gmail
 * API + el scope en la pantalla de consentimiento (ver docs/gmail-cv-setup.md).
 */
export { fetchGoogleEmail } from "./google-calendar";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta env var ${name}`);
  return v;
}

export function gmailRedirectUri(): string {
  return (
    process.env.GMAIL_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/gmail/callback`
  );
}

export function gmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeGmailCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token exchange falló: ${res.status} ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

export async function refreshGmailToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail refresh falló: ${res.status} ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

// ── Gmail API ──

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
}
export interface GmailMessage {
  id: string;
  from: string | null;
  subject: string | null;
  date: string | null;
  attachments: GmailAttachment[];
}

/** Lista IDs de mensajes que matchean la query de Gmail (ej: "has:attachment filename:pdf"). */
export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 25
): Promise<string[]> {
  const url = `${API}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail list falló: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { messages?: { id: string }[] };
  return (json.messages ?? []).map((m) => m.id);
}

/**
 * Lista TODOS los IDs de mensajes que matchean la query, paginando con
 * pageToken hasta `limit` (Gmail trae hasta 500 por página). Sirve para el pool
 * de reclutamiento, donde puede haber cientos de CVs. Solo trae IDs (barato);
 * el cuerpo/adjunto se baja después por cada uno.
 */
export async function listMessageIds(
  accessToken: string,
  query: string,
  limit = 1000
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const pageSize = Math.min(500, limit - ids.length);
    let url = `${API}/messages?q=${encodeURIComponent(query)}&maxResults=${pageSize}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Gmail list falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    for (const m of json.messages ?? []) ids.push(m.id);
    pageToken = json.nextPageToken;
  } while (pageToken && ids.length < limit);
  return ids;
}

interface Part {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}

function collectPdfAttachments(part: Part | undefined, out: GmailAttachment[]) {
  if (!part) return;
  const fn = part.filename ?? "";
  const isPdf =
    part.mimeType === "application/pdf" || fn.toLowerCase().endsWith(".pdf");
  if (isPdf && part.body?.attachmentId) {
    out.push({
      attachmentId: part.body.attachmentId,
      filename: fn || "cv.pdf",
      mimeType: part.mimeType ?? "application/pdf",
    });
  }
  for (const p of part.parts ?? []) collectPdfAttachments(p, out);
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await fetch(`${API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get falló: ${res.status}`);
  const json = (await res.json()) as { payload?: Part };
  const headers = json.payload?.headers ?? [];
  const h = (n: string) =>
    headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? null;
  const attachments: GmailAttachment[] = [];
  collectPdfAttachments(json.payload, attachments);
  return {
    id,
    from: h("From"),
    subject: h("Subject"),
    date: h("Date"),
    attachments,
  };
}

/** Descarga un adjunto y devuelve sus bytes. */
export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array> {
  const res = await fetch(`${API}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail attachment falló: ${res.status}`);
  const json = (await res.json()) as { data?: string };
  const b64 = (json.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}
