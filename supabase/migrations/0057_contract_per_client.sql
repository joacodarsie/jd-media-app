-- Agregar tipo de compensacion 'por_cliente': monto fijo por cada cliente
-- asignado al freelance. El monto efectivo se calcula multiplicando
-- monto_referencia x cantidad de clientes asignados (cm_id / disenador_id /
-- audiovisual_id).

alter type contract_compensation add value if not exists 'por_cliente';
