-- El form de servicios ya ofrece "Branding / estrategia de marca" (SERVICE_TYPE_LABEL),
-- pero el enum service_type no tenía ese valor → al guardar un servicio de branding
-- tiraba "invalid input value for enum service_type: branding".
-- Agregamos el valor faltante. Idempotente.

alter type public.service_type add value if not exists 'branding';
