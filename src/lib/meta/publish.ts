/**
 * Publicación de contenido en Instagram vía Graph API (content publishing).
 *
 * Flujo de la API: crear un "container" con la media (que debe estar en una
 * URL pública) → esperar a que Meta lo procese (videos tardan) → publicarlo.
 *
 * Requiere que el system user token tenga `instagram_content_publish`
 * (además de los permisos de insights que ya usa Resultados). Si falta,
 * la API devuelve un error de permisos que se muestra tal cual.
 *
 * Solo server-side.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function token(): string {
  const t = process.env.META_SYSTEM_USER_TOKEN;
  if (!t) throw new Error("META_NO_TOKEN");
  return t;
}

async function graphPost<T>(
  path: string,
  params: Record<string, string>,
  tokenOverride?: string
): Promise<T> {
  const body = new URLSearchParams({ ...params, access_token: tokenOverride ?? token() });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = (await res.json()) as { error?: { message?: string } } & T;
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

async function graphGet<T>(
  path: string,
  params: Record<string, string> = {},
  tokenOverride?: string
): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: tokenOverride ?? token() }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as { error?: { message?: string } } & T;
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export interface PublishMediaItem {
  /** URL pública del archivo (bucket publish-media). */
  url: string;
  /** true si es video (mp4/mov). */
  isVideo: boolean;
}

export interface PublishInput {
  igUserId: string;
  /** Tipo de la publicación en el calendario. */
  tipo: "post" | "reel" | "carrusel" | "historia" | "video" | "otro";
  caption: string;
  media: PublishMediaItem[];
}

export interface PublishResult {
  mediaId: string;
  permalink: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a que Meta termine de procesar un container (videos tardan). */
async function waitForContainer(containerId: string, timeoutMs = 240_000) {
  const start = Date.now();
  for (;;) {
    const { status_code } = await graphGet<{ status_code: string }>(containerId, {
      fields: "status_code",
    });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Meta no pudo procesar la media (${status_code}).`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Meta tardó demasiado en procesar el video (timeout).");
    }
    await sleep(5_000);
  }
}

async function createContainer(
  igUserId: string,
  params: Record<string, string>
): Promise<string> {
  const { id } = await graphPost<{ id: string }>(`${igUserId}/media`, params);
  return id;
}

// ── Facebook (cross-posting) ───────────────────────────────────────────────

/**
 * Página de Facebook vinculada a una cuenta de IG Business, con su page
 * token (publicar en páginas requiere page token, no el system token).
 * Null si el system user no tiene acceso a esa página.
 */
export async function getPageForIgUser(
  igUserId: string
): Promise<{ pageId: string; pageName: string; pageToken: string } | null> {
  const res = await graphGet<{
    data: {
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id: string };
    }[];
  }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    limit: "100",
  });
  const page = (res.data ?? []).find(
    (p) => p.instagram_business_account?.id === igUserId && p.access_token
  );
  return page
    ? { pageId: page.id, pageName: page.name ?? "", pageToken: page.access_token! }
    : null;
}

/**
 * Publica en la página de Facebook del cliente. Réplica del contenido de IG:
 * - post: foto simple · carrusel: post multi-foto · reel/video: video
 * - historia: foto como Page Story (video a historia de FB no soportado aún)
 */
export async function publishToFacebook(input: {
  pageId: string;
  pageToken: string;
  tipo: PublishInput["tipo"];
  caption: string;
  media: PublishMediaItem[];
}): Promise<PublishResult> {
  const { pageId, pageToken, tipo, caption, media } = input;
  if (media.length === 0) throw new Error("No hay archivos finales subidos.");

  let postId: string;

  if (tipo === "historia") {
    const m = media[0];
    if (m.isVideo) {
      throw new Error(
        "Historias de VIDEO a Facebook todavía no están soportadas (la de Instagram salió igual)."
      );
    }
    const { id: photoId } = await graphPost<{ id: string }>(
      `${pageId}/photos`,
      { url: m.url, published: "false" },
      pageToken
    );
    const st = await graphPost<{ post_id?: string; success?: boolean }>(
      `${pageId}/photo_stories`,
      { photo_id: photoId },
      pageToken
    );
    postId = st.post_id ?? photoId;
  } else if (tipo === "carrusel" && media.length > 1) {
    const photoIds: string[] = [];
    for (const m of media.slice(0, 10)) {
      if (m.isVideo) continue; // FB multi-foto no acepta videos mezclados
      const { id } = await graphPost<{ id: string }>(
        `${pageId}/photos`,
        { url: m.url, published: "false" },
        pageToken
      );
      photoIds.push(id);
    }
    if (photoIds.length === 0) throw new Error("El carrusel no tiene imágenes para Facebook.");
    const params: Record<string, string> = { message: caption };
    photoIds.forEach((id, i) => {
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });
    const res = await graphPost<{ id: string }>(`${pageId}/feed`, params, pageToken);
    postId = res.id;
  } else {
    const m = media[0];
    if (m.isVideo) {
      const res = await graphPost<{ id: string }>(
        `${pageId}/videos`,
        { file_url: m.url, description: caption },
        pageToken
      );
      postId = res.id;
    } else {
      const res = await graphPost<{ id: string; post_id?: string }>(
        `${pageId}/photos`,
        { url: m.url, caption },
        pageToken
      );
      postId = res.post_id ?? res.id;
    }
  }

  let permalink: string | null = null;
  try {
    const res = await graphGet<{ permalink_url?: string }>(
      postId,
      { fields: "permalink_url" },
      pageToken
    );
    permalink = res.permalink_url ?? null;
  } catch {
    // Permalink cosmético.
  }

  return { mediaId: postId, permalink };
}

/**
 * Test seco: crea un container de imagen SIN publicarlo. Los containers no
 * publicados expiran solos a las 24h y no aparecen en el perfil. Valida
 * permisos del token, la cuenta IG y que Meta pueda descargar la imagen.
 */
export async function createDryRunContainer(igUserId: string, imageUrl: string) {
  const containerId = await createContainer(igUserId, {
    image_url: imageUrl,
    caption: "[test interno JD Media app — no se publica]",
  });
  const st = await graphGet<{ status_code?: string }>(containerId, {
    fields: "status_code",
  });
  return { containerId, containerStatus: st.status_code ?? "unknown" };
}

/**
 * Publica en el Instagram del cliente. Devuelve el id del post y su permalink.
 * Lanza Error con mensaje legible si algo falla.
 */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const { igUserId, tipo, caption, media } = input;
  if (media.length === 0) throw new Error("No hay archivos finales subidos.");

  let containerId: string;

  if (tipo === "historia") {
    const m = media[0];
    containerId = await createContainer(igUserId, {
      media_type: "STORIES",
      ...(m.isVideo ? { video_url: m.url } : { image_url: m.url }),
    });
    if (m.isVideo) await waitForContainer(containerId);
  } else if (tipo === "carrusel" && media.length > 1) {
    const children: string[] = [];
    for (const m of media.slice(0, 10)) {
      const childId = await createContainer(igUserId, {
        is_carousel_item: "true",
        ...(m.isVideo
          ? { media_type: "VIDEO", video_url: m.url }
          : { image_url: m.url }),
      });
      if (m.isVideo) await waitForContainer(childId);
      children.push(childId);
    }
    containerId = await createContainer(igUserId, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    });
  } else {
    // post / reel / video / carrusel de 1 pieza: imagen simple o Reel.
    const m = media[0];
    if (m.isVideo) {
      containerId = await createContainer(igUserId, {
        media_type: "REELS",
        video_url: m.url,
        caption,
      });
      await waitForContainer(containerId);
    } else {
      containerId = await createContainer(igUserId, {
        image_url: m.url,
        caption,
      });
    }
  }

  const { id: mediaId } = await graphPost<{ id: string }>(
    `${igUserId}/media_publish`,
    { creation_id: containerId }
  );

  let permalink: string | null = null;
  try {
    const res = await graphGet<{ permalink?: string }>(mediaId, {
      fields: "permalink",
    });
    permalink = res.permalink ?? null;
  } catch {
    // El permalink es cosmético: si falla no rompemos la publicación.
  }

  return { mediaId, permalink };
}
