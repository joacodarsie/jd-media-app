# JD Media · Gestión de tareas

App interna de JD Media para gestionar tareas y el seguimiento operativo del
equipo (11/12 personas, 7 áreas, clientes activos).

Stack: **Next.js 14 + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres +
Auth + RLS)**. Despliegue en **Vercel**.

> Esta guía está pensada para alguien que **no programa**. Seguí los pasos en
> orden, copiando y pegando. Si algo no sale, parás y avisás.

---

## Parte A — Crear la base de datos en Supabase

### 1. Crear la cuenta y el proyecto

1. Entrá a **https://supabase.com** y hacé clic en **Start your project**.
2. Registrate (lo más fácil: **Continuar con GitHub** o con tu email).
3. Una vez adentro, clic en **New project**.
4. Completá:
   - **Name**: `jd-media`
   - **Database Password**: poné una contraseña fuerte y **guardala** (la vas a
     necesitar más adelante; anotala en tu gestor de contraseñas).
   - **Region**: elegí **South America (São Paulo)** (es la más cercana a
     Córdoba).
5. Clic en **Create new project** y esperá ~2 minutos a que diga "Project is
   ready".

### 2. Correr las migraciones (crear las tablas)

1. En el menú izquierdo de Supabase, entrá a **SQL Editor**.
2. Clic en **+ New query**.
3. Abrí en tu compu el archivo `supabase/migrations/0001_init.sql` de este
   proyecto, copiá **todo** su contenido y pegalo en el editor de Supabase.
4. Clic en **Run** (o `Ctrl + Enter`). Tiene que decir **Success**.
5. Repetí lo mismo con `supabase/migrations/0002_rls.sql` (copiar todo →
   pegar → Run → Success).
6. Repetí lo mismo con `supabase/seed.sql` (datos de prueba: usuarios,
   clientes y tareas) → Run → Success.

> Si querés volver a empezar de cero, podés correr de nuevo los 3 archivos:
> están hechos para no romperse si ya existían las tablas.

### 3. Anotar las claves de conexión

1. En Supabase, andá a **Project Settings** (el engranaje abajo a la
   izquierda) → **API**.
2. Vas a ver dos datos que necesitás:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public** key (una cadena larga que empieza con `eyJ...`)
3. Dejá esa pestaña abierta, los vas a usar en la Parte B.

---

## Parte B — Correr la app en tu computadora

> Necesitás tener instalado **Node.js 18 o superior**
> (descargá de https://nodejs.org, opción "LTS"). Para verificar, abrí una
> terminal y escribí `node --version`.

### 4. Configurar las variables de entorno

1. En la carpeta del proyecto vas a ver un archivo llamado
   **`.env.local.example`**.
2. Hacé una **copia** y renombrala a **`.env.local`** (mismo lugar, sin el
   `.example`).
3. Abrí `.env.local` con el Bloc de notas y completá:

   ```
   NEXT_PUBLIC_SUPABASE_URL=acá pegás el Project URL del paso 3
   NEXT_PUBLIC_SUPABASE_ANON_KEY=acá pegás la anon public key del paso 3
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. Guardá el archivo.

### 5. Instalar y arrancar

Abrí una terminal **dentro de la carpeta del proyecto** y corré:

```bash
npm install
npm run dev
```

Cuando diga `Ready`, abrí el navegador en **http://localhost:3000**.

### 6. Entrar a la app

El seed creó los 11 usuarios del equipo. Para entrar:

- **Email**: `nombre@jdmedia.com` (en minúscula, sin tilde).
  Ej.: `joaquin@jdmedia.com`, `brisa@jdmedia.com`, `german@jdmedia.com`.
- **Contraseña** (la misma para todos al principio):
  **`jdmedia2026`**

Usuarios disponibles:

| Persona             | Email                | Rol               |
|---------------------|----------------------|-------------------|
| Joaquín Darsie      | joaquin@jdmedia.com  | Admin             |
| Brisa Tejada        | brisa@jdmedia.com    | Coordinación      |
| Guillermo García    | guille@jdmedia.com   | Paid Media        |
| Sol Britos          | sol@jdmedia.com      | Prospecting       |
| Gonzalo Díaz Perrín | gonzalo@jdmedia.com  | Comercial         |
| Luz Torres          | luz@jdmedia.com      | Creativa          |
| Belén Gastardelli   | belen@jdmedia.com    | Community Manager |
| Franco Calderón     | franco@jdmedia.com   | Editor Audiovisual |
| Germán Simian       | german@jdmedia.com   | Desarrollo Web    |
| Valentín            | valentin@jdmedia.com | Desarrollo Web    |
| Tomás Garbellotto   | garbe@jdmedia.com    | Botly             |

> **Importante de seguridad:** cambiá esa contraseña inicial cuanto antes desde
> Supabase → **Authentication** → usuario → "Reset password" (o que cada uno
> use "¿Olvidaste tu contraseña?" cuando ese flujo esté activo).

---

## Parte C — Subir la app a internet (Vercel)

Esto lo hacemos cuando ya probaste todo en local y estés conforme.

1. Subí esta carpeta a un repositorio en **GitHub** (privado).
2. Entrá a **https://vercel.com** y registrate con tu cuenta de GitHub.
3. Clic en **Add New… → Project**, elegí el repositorio de la app e
   **Import**.
4. En **Environment Variables** cargá las mismas 3 variables del paso 4
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `NEXT_PUBLIC_SITE_URL`; esta última con la URL que te dé Vercel, ej.
   `https://jd-media.vercel.app`).
5. Clic en **Deploy** y esperá unos minutos.
6. En Supabase → **Authentication → URL Configuration**, agregá tu dominio de
   Vercel en **Site URL** y en **Redirect URLs**.

---

## Estado del desarrollo

- [x] **Etapa 1** — Estructura, base de datos, RLS, login, identidad visual.
- [x] **Etapa 2** — CRUD de tareas: Lista, Kanban, Calendario, comentarios con
      `@menciones`, links externos, Markdown.
- [x] **Etapa 3** — Dashboards: Mi día · Por área · Por cliente · Global (KPIs).
- [x] **Etapa 4** — Notificaciones in-app (campana + página), `docs/USO.md`.

## Email de notificaciones (TODO opcional)

Las notificaciones funcionan **dentro de la app** (campana). Si querés que
además llegue un mail cuando te asignan algo o te mencionan, se agrega así
(no está implementado para no complicar el deploy inicial):

1. Crear cuenta en **https://resend.com**, sacar la API key y el dominio
   verificado de envío.
2. Crear una **Supabase Edge Function** que escuche el `INSERT` en la tabla
   `notifications` (vía Database Webhook) y llame a la API de Resend.
3. Cargar `RESEND_API_KEY` como secret en Supabase.

Estimado: ~2 horas. Avisame si querés que lo hagamos como Etapa 5.

## Estructura del proyecto

```
src/app           → páginas (login, dashboard, tareas, área, …)
src/components     → componentes de interfaz
src/lib            → conexión a Supabase, tipos, helpers
supabase/migrations→ scripts SQL para crear la base
supabase/seed.sql  → datos de prueba
docs/USO.md        → cómo usa la app cada rol (lenguaje no técnico)
```

## Decisiones de diseño tomadas durante el desarrollo

Para que las revises y ajustes si algo no calza:

1. **Stack**: Next.js 14 App Router + Server Actions (sin API REST aparte) +
   shadcn/ui clásico (Radix) + Tailwind v3. Más estándar y mantenible que la
   versión nueva de shadcn con base-ui.
2. **Equipo: 11 personas reales** (sacadas del sitio jdmedia.com.ar + tus
   correcciones). Belén entró como `Community Manager`, Franco como
   `Editor Audiovisual` con área propia `Edición Audiovisual`. Valentín
   queda aunque no aparezca en el sitio.
3. **Clientes: 10** (los listados en el brief). Montos / packs / rubros son
   inventados para el demo — editalos desde Supabase.
4. **Permisos (RLS)**:
   - `admin` y `coordinador` ven y editan todo.
   - El resto ve sus tareas, las de su área y las de los clientes que tiene
     asignados.
   - Todos pueden ver la lista de personas y clientes (para los dropdowns).
5. **Notificaciones**: 100% in-app por ahora (campana + página
   `/notificaciones`). Email queda como TODO documentado.
6. **Notificaciones automáticas**:
   - **Asignación** la genera un trigger de Postgres.
   - **Comentarios y menciones** las genera la app cuando se postea un
     comentario (un solo round-trip).
   - **Vencidas / próximas a vencer** se generan "perezosamente" cuando el
     usuario abre cualquier página de la app (idempotente, una por día).
7. **Zona horaria** fija en `America/Argentina/Cordoba` (constante en
   `src/lib/constants.ts`). No hay nada hardcodeado por país en otros lados.
8. **Drag & drop** sólo en Kanban (no entre listas o calendario).
9. **Eliminar** tarea/comentario usa el confirm nativo del browser (sin
   instalar componente extra).
10. **Menciones** en comentarios matchean por **primer nombre**, insensible a
    mayúsculas (`@belén` o `@Belén` funcionan igual).
11. **Login** sólo con email + contraseña. No hay "olvidé mi contraseña"
    todavía — se resetea desde Supabase manualmente.
12. **Identidad visual**: negro `#000000` + amarillo `#FFD400` + blanco,
    fuente Inter. Sidebar negro en ambos temas (claro/oscuro), porque ese es
    el look de la marca.
