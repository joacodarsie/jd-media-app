-- El estado "propuesta" (cliente cerrado, esperando que pague; no cuenta como
-- activo) se usa en el código desde el flujo comercial, pero el enum
-- client_status nunca lo incluyó: se creó como ('activo','at_risk','perdido').
-- Por eso crear una propuesta tiraba "invalid input value for enum
-- client_status: 'propuesta'". Lo agregamos.
alter type public.client_status add value if not exists 'propuesta';
