-- Claves de los scripts que leen la app desde afuera (31/10/2026).
--
-- La planilla "Finanzas de Joaquín" baja los números de la agencia con un
-- token. En vez de una variable de entorno en Vercel (que solo el dueño puede
-- cargar), el token se valida contra su sha256 guardado acá: el valor nunca
-- queda en la base y cambiarlo es un UPDATE.
--
-- Sin políticas: con RLS prendida, solo el service role (la app) la lee.

create table if not exists public.claves_api (
  nombre text primary key,
  sha256 text not null,
  creada_at timestamptz not null default now()
);

alter table public.claves_api enable row level security;
revoke all on public.claves_api from anon, authenticated;
