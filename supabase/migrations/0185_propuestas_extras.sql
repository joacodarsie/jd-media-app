-- Extras en la propuesta (24/9/2026): servicios que se suman al pack con su
-- propio precio — gestión de WhatsApp, chatter, Google Ads y Google Business.
--
-- Salió de las propuestas armadas a mano (Detersi, Truvari, Ares, Warrior):
-- el prospecto ve el pack solo y "con los extras", y decide. Formato:
--   [{ "slug": "gestion_whatsapp", "precio": 50000 }, ...]

alter table public.proposals
  add column if not exists extras jsonb;
