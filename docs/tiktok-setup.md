# Integración con TikTok — guía de puesta en marcha

Trae los **resultados orgánicos** de TikTok (seguidores, likes, views de los videos
del mes) al reporte del cliente, igual que ya pasa con Instagram.

> **Diferencia clave con Instagram:** con Meta usamos un *system user* que ve todas
> las cuentas que le asignás. **TikTok no tiene eso para datos orgánicos**: cada
> cliente tiene que **autorizar su propia cuenta** una vez (OAuth). Además TikTok
> exige pasar la app por una **revisión** antes de habilitar los permisos de
> analítica en producción.

El código de la app **ya está listo y es inerte**: mientras no estén las
credenciales (`TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`), la conexión de TikTok
ni aparece. Estos son los pasos —en su mayoría afuera de la app— para encenderla.

## Paso 1 — Crear la app en TikTok for Developers
1. Entrá a https://developers.tiktok.com con la cuenta de la agencia y registrate
   como developer.
2. **Create an app**. Completá nombre ("JD Media"), descripción, logo, sitio web y
   políticas (privacidad / términos). TikTok pide links reales.
3. Anotá el **Client Key** y el **Client Secret** (Paso 4).

## Paso 2 — Agregar productos y permisos (scopes)
1. Agregá el producto **Login Kit** (OAuth).
2. Pedí estos **scopes**:
   - `user.info.basic` — usuario / avatar.
   - `user.info.stats` — seguidores, likes totales, cantidad de videos.
   - `video.list` — listado de videos del mes (views, likes, comentarios, shares).
3. En **Redirect URI** registrá exactamente:
   ```
   https://jd-media-app.vercel.app/api/tiktok/callback
   ```
   (en local: `http://localhost:3000/api/tiktok/callback`).

## Paso 3 — Enviar la app a revisión
- Los scopes de analítica (`user.info.stats`, `video.list`) **requieren app review**.
- Completá el formulario explicando el uso (reportes de resultados a clientes de la
  agencia) y, si lo piden, grabá un video corto mostrando el flujo.
- **La aprobación tarda** (de días a un par de semanas). Es la espera más larga, así
  que conviene arrancar este paso cuanto antes; el resto se puede dejar listo en
  paralelo.

## Paso 4 — Cargar las credenciales en Vercel
En Vercel → Project → Settings → Environment Variables (Production):
```
TIKTOK_CLIENT_KEY     = <Client Key del Paso 1>
TIKTOK_CLIENT_SECRET  = <Client Secret del Paso 1>
```
(Opcional `TIKTOK_REDIRECT_URI` si querés forzar una distinta a la default.)
Redeploy. Con esto, en la sección **Pauta** de cada cliente aparece la tarjeta
**"Conexión con TikTok"**.

## Paso 5 — Aplicar la migración de base de datos
En Supabase → SQL editor, corré `supabase/migrations/0093_tiktok_accounts.sql`
(crea la tabla `client_tiktok_accounts` donde se guardan los tokens por cliente).

## Paso 6 — Conectar cada cliente
1. En la ficha del cliente → **Pauta** → tarjeta **Conexión con TikTok**.
2. **"Conectar ahora"** (si estás con el cliente) o **"Copiar link para el cliente"**
   y mandáselo por WhatsApp.
3. El cliente abre el link, inicia sesión en **su** TikTok y autoriza. Listo: la
   cuenta queda vinculada.

## Qué falta del lado del código (próxima sesión, ya con una cuenta conectada)
La **conexión** está completa. Lo que se hace una vez que haya una cuenta real
conectada (para poder verificar las respuestas reales de la API):
- **Sync** periódico de métricas (seguidores + videos del mes) → guardar snapshots.
- **Sección "Resultados de TikTok"** en el reporte mensual (espejo de la de IG, con
  comparativa mes a mes).
- **Refresh** automático del token antes de que venza.

Esto se dejó para después a propósito: conviene calibrarlo contra datos reales y no
contra la documentación, para no adivinar el formato exacto de las respuestas.
