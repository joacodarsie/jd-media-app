-- Agrega tipo 'recordatorio' al enum notification_type para recordatorios genéricos
-- (fin de mes sin plan, etc).

alter type notification_type add value if not exists 'recordatorio';
