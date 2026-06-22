# Conectar Gmail para traer CVs al reclutamiento — guía

Permite que la app lea la casilla de la agencia (agenciajdmedia@gmail.com) y traiga
sola los CVs adjuntos a Reclutamiento, en vez de bajarlos a mano.

> Reusa el **mismo cliente OAuth de Google** que la app ya usa para Calendar
> (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Solo hay que habilitar Gmail y
> agregar el permiso de lectura. El acceso a Gmail es un scope **restringido**: sin
> verificación de Google funciona en modo prueba (con vos como usuario de prueba),
> con el detalle de que el acceso caduca cada ~7 días y hay que reconectar.

## Paso 1 — Aplicar la migración
En Supabase → SQL editor, corré `supabase/migrations/0095_gmail_account.sql`
(crea la tabla donde se guarda la conexión).

## Paso 2 — Google Cloud Console (mismo proyecto que Calendar)
1. Entrá a https://console.cloud.google.com con la cuenta de la agencia y elegí el
   proyecto que ya usás para el login con Google.
2. **APIs y servicios → Biblioteca** → buscá **Gmail API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - En **Scopes**, agregá `.../auth/gmail.readonly`.
   - En **Usuarios de prueba**, agregá **agenciajdmedia@gmail.com** (y tu cuenta si es otra).
4. **APIs y servicios → Credenciales** → abrí el **ID de cliente OAuth** que ya
   tenés → en **URIs de redireccionamiento autorizados** agregá:
   ```
   https://jd-media-app.vercel.app/api/gmail/callback
   ```
   (en local: `http://localhost:3000/api/gmail/callback`).

## Paso 3 — (Opcional) Variable de entorno
Solo si querés forzar un redirect distinto al default, en Vercel:
```
GMAIL_REDIRECT_URI = https://jd-media-app.vercel.app/api/gmail/callback
```
No hace falta tocar `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (ya están).

## Paso 4 — Conectar desde la app
1. Entrá a **Reclutamiento** → tarjeta **Conexión a Gmail** → **Conectar Gmail**.
2. Iniciá sesión con **agenciajdmedia@gmail.com** y aceptá el permiso de lectura.
   (Si Google muestra "app no verificada", entrá por *Configuración avanzada →
   Ir a JD Media*: es esperado en modo prueba.)
3. Vuelve a la app con "Gmail conectado".

## Paso 5 — Traer CVs
1. Entrá a una búsqueda → botón **Traer de Gmail**.
2. Afiná la búsqueda de Gmail si querés (por defecto trae mails con PDF de los
   últimos 90 días: `has:attachment filename:pdf newer_than:90d`). Podés agregar el
   asunto de la convocatoria, ej: `has:attachment filename:pdf subject:(CV OR búsqueda editor)`.
3. La IA analiza cada CV y lo carga en la búsqueda. Tocá de nuevo para traer más.

## Consejo
Creá un **filtro/etiqueta en Gmail** para los CVs (ej: etiqueta "CVs") y usá
`label:CVs has:attachment filename:pdf` como búsqueda — así traés solo lo de las
convocatorias.
