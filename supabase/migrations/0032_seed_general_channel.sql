-- Seed: canal #general + sumar a todos los usuarios activos.
-- (Para reproducibilidad si se aplica todo desde cero.)

insert into public.team_channels (kind, name, description)
values ('public', 'general', 'Canal de toda la agencia. Anuncios y conversación general.')
on conflict do nothing;

insert into public.team_channel_members (channel_id, user_id)
select c.id, u.id
from public.team_channels c
cross join public.users u
where c.name = 'general' and c.kind = 'public' and u.activo = true
on conflict do nothing;
