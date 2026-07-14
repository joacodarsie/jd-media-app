# JD Media app

App de gestión de la agencia. Next.js 14 (App Router) + Supabase + Vercel.

- Deploy manual: `vercel --prod` (el webhook de git está caído).
- Migrations: crear el `.sql` en `supabase/migrations/` y **las aplica el dueño** en Supabase — avisarle siempre que haya una pendiente. El código debe tolerar que la migración todavía no esté aplicada.
- Antes de deployar: `npx tsc --noEmit`, `npx vitest run` y `npm run build` verdes.
- Rutas de IA: el gateway corta respuestas no-streaming a los 60s (504 en texto plano). Toda ruta que llame a un modelo con inputs potencialmente largos va con **SSE + `maxDuration = 300`** (patrón de `api/diagnostico/generate` / `api/post-meet-message`).

## Regla: aura "sin testear" (`review_flags`)

Toda feature nueva visible en la UI queda marcada "sin testear" hasta que el dueño la aprueba:

- Al crear una pantalla/sección/flujo nuevo, insertar una fila en `review_flags` (`ruta`, `label`, `nota` con qué probar). Si la feature trae migración, poner el insert ahí mismo; si no, insertarla vía service role (script tsx con `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`).
- El banner amarillo del layout `(app)` (`src/components/review-flags-banner.tsx`) se la muestra a los admin en esa ruta (match por prefijo); el botón "Aprobar" la limpia.
- No hace falta flagear fixes chicos ni cambios data-only; sí todo lo que el dueño debería revisar con sus ojos.
