# JD Media app

App de gestión de la agencia. Next.js 14 (App Router) + Supabase + Vercel.

- Deploy: **automático al pushear a `main`** (`.github/workflows/deploy.yml`: tipos + tests + deploy). El proyecto de Vercel no tiene el repo conectado, por eso va por Actions. Necesita el secret `VERCEL_TOKEN` en el repo.
- Para deployar sin esperar al push: pestaña Actions → "Deploy a producción" → Run workflow. A mano desde la máquina también sirve, pero **primero `vercel pull`**: si el CLI se enlaza solo dentro del repo entra en "modo repositorio" y falla con `Error: Not authorized`.
- Migrations: crear el `.sql` en `supabase/migrations/` y **las aplica el dueño** en Supabase — avisarle siempre que haya una pendiente. El código debe tolerar que la migración todavía no esté aplicada.
- Antes de deployar: `npx tsc --noEmit`, `npx vitest run` y `npm run build` verdes.
- Rutas de IA: el gateway corta respuestas no-streaming a los 60s (504 en texto plano). Toda ruta que llame a un modelo con inputs potencialmente largos va con **SSE + `maxDuration = 300`** (patrón de `api/diagnostico/generate` / `api/post-meet-message`).

## Regla: lo prueba Claude, no el dueño (18/9/2026)

El dueño **nunca usó** el aura "sin testear": los carteles amarillos se
acumularon 18 sin aprobar. **No se crean más `review_flags`.** En su lugar, toda
feature nueva se prueba antes de decir que está lista:

- **Lógica de plata y de reglas** → test en `vitest` (hay 1.033 corriendo).
- **Permisos y RLS** → probar con el usuario real: cookie de sesión de esa
  persona y `curl` a la ruta (tiene que redirigir a /dashboard a quien no
  corresponde), y la política con `set_config('request.jwt.claims', ...)` en SQL.
- **Flujo de pantalla** → hacerlo de punta a punta en el navegador, con datos de
  prueba, y **borrar los datos de prueba al terminar**.
- Recién ahí se dice que anda, y se dice QUÉ se probó. Si algo no se pudo
  probar, se avisa en esa misma frase.

Para la cookie de sesión de cualquier usuario en local: magic link de
`/auth/v1/admin/generate_link` → tokens del fragment → cookie
`sb-vjnwswibnrttcljbmysq-auth-token` = `base64-` + base64url del JSON de sesión.
