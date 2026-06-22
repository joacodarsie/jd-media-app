-- Etapa 96: refresco de los SOPs (positions.procesos) tras el re-análisis de
-- puestos. Saca referencias a roles que ya no existen ("Creativa", "Responsable
-- Operativa") y a personas movidas ("Brisa" coordinaba, hoy es Diseño; la
-- coordinación de gestión de redes es Luz). Alinea con cómo opera la app hoy:
-- estado "Revisión creativa", propuesta → "Activar cliente (pagó)", módulo de
-- Reclutamiento para hiring, tarifas/simuladores en Coordinación, salud/riesgo.
-- Idempotente: sólo reescribe el campo `procesos` de 6 puestos.

update public.positions set procesos = $sop$## Flujo de cierre
1. Lead calificado entra desde prospección o referido
2. Agendar primer meet en máximo 48hs
3. Hacer **Primer meet con lead** (ver SOP en /procesos)
4. Si hay interés → desde **Comercial → Nueva propuesta** generar la carta acuerdo (el cliente queda en estado *propuesta*, todavía no cuenta como activo) y enviarla con los datos de pago dentro de las 24hs
5. Seguimiento día 3 si no respondió
6. Cierre con plantilla de mensaje (ver **Cierre de cliente** en /procesos)
7. Cuando pagó → botón **"Activar cliente (pagó)"** en la ficha de la propuesta: pasa a cliente real (fecha de inicio = hoy) y arranca el onboarding con Coordinación

## Precios autorizados
- Los packs y montos vigentes viven en **Coordinación** (tarifas + simuladores)
- Pack personalizado → usar el cotizador de pack y validar con Director
- Promo 50% primer mes: válida los días 1-5 de cada mes
- Descuento fuera de lo permitido → Director

## Cuándo escalar
- Cliente pide algo fuera de scope → consultar antes de prometer
- Pedido de un servicio que no hacemos → derivar a partner o decir que no$sop$
where nombre = 'Comercial';

update public.positions set procesos = $sop$## Revisión semanal
- Lunes: revisar dashboard global, tareas vencidas, clientes en riesgo (/coordinacion/riesgo) y margen de la agencia (/finanzas/salud)
- Reunión semanal con Coordinación (Luz)
- Revisar reportes mensuales antes de enviarlos al cliente

## Cierre de cliente nuevo
Ver SOP **Cierre de cliente y carta acuerdo** (sección /procesos).

## Decisiones estratégicas
- Cambios de pack/precio del cliente → consultar con Joaquín
- Hiring → shortlist desde el módulo de **Reclutamiento** (análisis de CVs con IA), decisión final acá
- Discusión de compensaciones → siempre 1 a 1, nunca por grupo$sop$
where nombre = 'Director/a';

update public.positions set procesos = $sop$## Flujo de pieza
1. Recibís el pedido de Coordinación de Gestión de Redes con brief + texto + referencias
2. Confirmás materiales y deadline
3. Diseño v1 → subís a Drive carpeta "Calendario de contenidos" y marcás la pieza en la app
4. Aviso en grupo interno → Coordinación revisa (estado **Revisión creativa**)
5. Ajustes si hace falta → v final → Coordinación la pasa a **Revisión cliente** y la programa

## Kit de marca del cliente
- Logo + variantes (color, monocromo, isotipo)
- Paleta primaria + secundaria
- Tipografías (display + texto)
- Espaciados, márgenes, plantillas base
- Vivir en Canva del equipo + backup en Drive

## Para campañas de Paid Media
- Pedir brief de Paid Media: objetivo, audiencia, copy
- Generar 3-5 variantes (formato + ángulo) por campaña
- Etiquetar archivos: `cliente_campaña_variante_formato.png`$sop$
where nombre = 'Diseñador/a';

update public.positions set procesos = $sop$## Flujo de un reel
1. Coordinación de Gestión de Redes te asigna la publicación (en la app, el estado pasa a `edicion`)
2. Si no hay guion → lo escribís en conjunto con Coordinación
3. Bajás el material crudo de Drive
4. Editás v1 (corte fino, música, texto, transiciones)
5. Subís a Drive carpeta del cliente → marcás la pieza como **Revisión creativa** en la app
6. Coordinación revisa → si hay ajustes, vuelve a `edicion`
7. Si OK → pasa a **Revisión cliente**
8. Aprobado → se programa en Meta Business Suite

## Jornada de producción
- Llegar con guion + lista de tomas pre-armada (la define Coordinación)
- Llevar equipo: cámara/celular, micrófono, luz portátil, baterías de repuesto
- Filmar 2-3 takes por escena
- Subir crudos a Drive el mismo día → carpeta "Contenido crudo"

## Buenas prácticas técnicas
- 9:16 (1080×1920) para reels e historias
- 1:1 o 4:5 para posts
- 16:9 para YouTube / horizontal
- Audio normalizado a -14 LUFS
- Subtítulos siempre (legibles, contraste alto, no más de 2 líneas)$sop$
where nombre = 'Editor/a Audiovisual';

update public.positions set procesos = $sop$## Control de calidad antes del cliente
1. Revisar diseño, copy, formato y coherencia visual con la marca
2. Chequear que respete la estrategia y los ejes del mes
3. Aprobar en la app (la pieza pasa de **Revisión creativa** a **Revisión cliente**)
4. Si hay ajustes, devolver al equipo de producción (Diseño / Edición / CM) con feedback concreto

## Coordinación semanal
- Revisar el estado de calendarios de todas las cuentas de gestión de redes
- Detectar cuellos de botella (diseño/edición trabados) y reordenar prioridades
- Reunión corta con el equipo de producción

## Comisión
- El/la coordinador/a de la cuenta cobra la comisión de coordinación recurrente
  sobre el abono de gestión de redes de las cuentas que lleva.$sop$
where nombre = 'Coordinador/a de Gestión de Redes';

update public.positions set procesos = $sop$## Flujo de una campaña
1. Brief con Comercial / Coordinación de Gestión de Redes: objetivo (leads, ventas, alcance), audiencia, presupuesto, oferta
2. Pedir creatividades a Diseño (3-5 variantes) con copy y ángulo
3. Verificar píxel/eventos/conversiones con Desarrollo Web ANTES de lanzar
4. Armar estructura: campaña → conjuntos (audiencias) → anuncios
5. Lanzar con presupuesto de prueba
6. Optimizar (cada 48-72hs los primeros días): pausar lo que no rinde, escalar lo que sí
7. Documentar aprendizajes (qué audiencia/creatividad funcionó)

## Reporte al Director (semanal)
- Armar con la plantilla, con los datos clave de la semana (inversión, resultados, CPL/ROAS)
- Dejar asentadas las consultas / autorizaciones que necesito

## Reporte al cliente (mensual)
- Enviarlo el último día del mes
- Traducir los números a resultado de negocio (no métricas sueltas)
- Conectar pauta con orgánico cuando ambos corren

## Cuándo escalar al Director
- Cambios de presupuesto fuera de lo acordado con el cliente
- Resultados muy por debajo del objetivo dos semanas seguidas
- Cliente pide objetivos no medibles o fuera de scope$sop$
where nombre = 'Paid Media';
