-- Flag de "subido a TikTok" para publicaciones. Sirve como checklist visual
-- en el calendario y detalle de pub: la persona marca cuando ya lo subio,
-- aunque el link final venga despues.

alter table public.publications
  add column if not exists tiktok_subido boolean not null default false;

create index if not exists publications_tiktok_subido_idx
  on public.publications(tiktok_subido)
  where tiktok_subido = false;
