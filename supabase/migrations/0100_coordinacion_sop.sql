-- SOP completo del puesto Coordinador/a de Gestión de Redes (hoy Luz). Era el
-- único puesto que estaba sin alcance / herramientas / KPIs / procesos cargados.
-- Lo completamos para que quede tan claro como el resto y cualquiera entienda
-- exactamente qué hace y qué NO hace. Idempotente: sólo reescribe ese puesto.

update public.positions set
  alcance_incluye = $inc$- Definir la **estrategia y los ejes de contenido del mes** de cada cuenta de gestión de redes (qué se comunica, con qué objetivo)
- Generar y curar el **plan mensual de contenidos** de cada cliente (en la app: *Contenidos → generar plan*), ajustando ideas, copys y formatos
- Repartir el trabajo al equipo: pedir piezas a **Diseño**, reels a **Edición Audiovisual** y coordinar al **Community Manager**
- **Aprobar todas las piezas** antes de que vayan al cliente (estado *Revisión creativa*) y recién ahí pasarlas a *Revisión cliente*
- Cuidar **coherencia con la marca** (tono, identidad visual, manual de cada cliente) y la **calidad** del contenido
- Asegurar los **tiempos**: que el calendario esté lleno y aprobado con anticipación, sin huecos ni urgencias
- Ser el **nexo con el cliente** en lo operativo del contenido (feedback, cambios, expectativas)
- Armar y revisar el **reporte mensual** de gestión de redes antes de enviarlo
- Acompañar el **onboarding de Gestión de Redes** de cada cliente nuevo (accesos, conexión de redes, kit de marca)$inc$,
  alcance_excluye = $exc$- Atención diaria del DM/comentarios y subida de historias del día a día (**Community Manager**)
- Diseño concreto de las piezas (**Diseñador/a**) y edición de los reels (**Edición Audiovisual**)
- Estrategia y operación de la **pauta paga** (**Paid Media**) — sí coordina que orgánico y pauta vayan alineados
- Cierre comercial y precios de los clientes (**Comercial / Director**)
- Decisiones de pack, compensación o hiring del equipo (**Director**)$exc$,
  herramientas = $herr$[
    {"nombre":"App JD Media (Contenidos: plan mensual, calendario, estados)"},
    {"nombre":"Meta Business Suite","url":"https://business.facebook.com"},
    {"nombre":"Drive del cliente (calendario de contenidos + crudos)"},
    {"nombre":"Canva del equipo","url":"https://canva.com"},
    {"nombre":"WhatsApp (grupo interno + grupo del cliente)"},
    {"nombre":"Instagram / TikTok del cliente"}
  ]$herr$::jsonb,
  kpis = $kpis$- Calendario del mes **aprobado y completo** antes de que arranque el mes (0 días sin contenido planificado)
- Piezas aprobadas **en 1ª o 2ª revisión** (pocas idas y vueltas con el equipo)
- Publicaciones que salen **en fecha** (sin atrasos respecto al plan)
- **Retención de clientes** de gestión de redes (que no se vayan por calidad o tiempos)
- **Reporte mensual** de cada cuenta enviado en tiempo y forma
- Equipo (CM, Diseño, Audiovisual) **sin cuellos de botella** ni tareas vencidas$kpis$,
  procesos = $sop$## Ciclo mensual de una cuenta
1. **Fin de mes anterior**: revisar resultados del mes (alcance, interacciones, qué funcionó) en el reporte y en la cuenta
2. Definir los **ejes del mes** según objetivo del cliente, fechas/efemérides y lo que viene rindiendo
3. Generar el **plan mensual** en *Contenidos → generar plan*; curar ideas, copys, formatos y fechas (cargar instrucciones puntuales si hace falta)
4. Repartir: marcar qué necesita **Diseño** y qué **Edición**, con brief + referencias; coordinar con el **CM** historias y reactivos
5. A medida que llegan las piezas → **revisarlas** (estado *Revisión creativa*): si hay ajustes vuelve al equipo; si están OK pasan a *Revisión cliente*
6. Mandar al cliente lo que requiera su OK; cargar su feedback
7. **Programar** lo aprobado en Meta Business Suite y dejar el calendario al día
8. Durante el mes: monitorear que no se atrase nada y resolver imprevistos

## Estándar de aprobación de una pieza
Antes de pasar algo a *Revisión cliente*, chequear:
- [ ] Cumple el **eje/objetivo** del mes
- [ ] **Marca correcta**: logo, colores, tipografías, tono del cliente
- [ ] **Copy** sin errores, con CTA claro y hashtags si corresponde
- [ ] **Formato/medidas** correctos (feed 4:5, reel/historia 9:16)
- [ ] Reels: audio prolijo, subtítulos legibles, buen gancho en los primeros 3s

## Coordinación del equipo
- Una **bajada semanal** clara de prioridades a CM, Diseño y Audiovisual
- Mantener el **calendario adelantado** (idealmente trabajar la semana siguiente, no sobre la hora)
- Destrabar bloqueos rápido; lo que no se puede resolver, **escalar al Director**
- Alinear con **Paid Media** cuando una pieza orgánica también se va a pautar

## Reporte mensual
- Revisar el reporte de la cuenta antes de enviarlo: que los números cuenten una **historia de resultado**, no métricas sueltas
- Sumar aprendizajes y el plan del mes siguiente

## Cuándo escalar al Director
- Cliente disconforme o en **riesgo de irse**
- Pedido del cliente fuera de scope o que cambia el pack
- Falta de capacidad del equipo para sostener la calidad/los tiempos$sop$
where nombre = 'Coordinador/a de Gestión de Redes';
