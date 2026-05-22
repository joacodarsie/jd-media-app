-- C9: documentos atados a un cliente puntual (informe diagnóstico, brief, manual marca…).
-- Si cliente_id es NULL, es un documento general de la agencia (lo que ya teníamos).

alter table public.documents
  add column if not exists cliente_id uuid references public.clients(id) on delete cascade,
  add column if not exists usar_en_ia boolean not null default true;

create index if not exists idx_documents_cliente on public.documents(cliente_id);

-- Las RLS existentes ya permiten ver documentos. Igualmente, los del cliente
-- los vamos a mostrar solo a staff por convenir, vía filtros en la query.
