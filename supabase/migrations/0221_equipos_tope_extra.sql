-- Equipos de trabajo con tope de cuentas y segundos integrantes (24/10/2026).
-- El dueño quiere que cada equipo llegue a ~8 cuentas (meta: 50 cuentas sin
-- armar muchos equipos más), y hay equipos con dos personas en un mismo rol
-- (Equipo 1: Alejo y Darío en diseño).
alter table public.teams add column if not exists tope integer not null default 8;
alter table public.teams add column if not exists extra_ids uuid[] not null default '{}';
comment on column public.teams.tope is 'Cuántas cuentas puede llevar el equipo (por defecto 8).';
comment on column public.teams.extra_ids is 'Integrantes además de los 4 roles (p. ej. un segundo diseñador).';
