-- Manuales de procesos por rol (21/10/2026): al día con el ciclo quincenal (17/10),
-- el arranque día a día, la dirección creativa de Santi y la «una sola puerta» de Luz.

update positions set
descripcion = $d$Lleva el día a día de sus cuentas: arma el calendario de cada quincena, programa lo aprobado, sube las historias y atiende la comunidad.$d$,
alcance_incluye = $d$- El **calendario de cada quincena** de sus cuentas: cada pieza con su gancho escrito, el llamado a la acción, a quién le habla y cuentas de referencia reales (sin hashtags)
- La **biografía y las historias destacadas** de cada cuenta
- **Programar** lo que ya aprobó el cliente
- Las **historias** de los días que incluye el pack
- Responder **mensajes y comentarios**
- Los **accesos** de Instagram y TikTok de cada cuenta (cargados en la ficha, red por red)
- Pedirle al cliente el **material crudo** que hace falta, con una lista concreta$d$,
alcance_excluye = $d$- Aprobar las piezas (**Dirección Creativa**)
- Diseñar o editar (**Diseño** y **Edición Audiovisual**)
- Repartir el trabajo y poner fechas (**Project Manager**)
- La pauta y la página de Facebook (**Paid Media**)$d$,
kpis = $d$- Calendario entregado el **2** y el **17** de cada mes
- Piezas publicadas **en fecha**
- **Cero** mensajes sin responder al cierre del día
- Historias todos los días que incluye el pack$d$,
procesos = $d$## El ciclo: todo se trabaja por quincenas, con dos semanas de ventaja
**Lo que se publica del 16 a fin de mes**
- Días **1 y 2**: armás el calendario
- Días 3 y 4: lo aprueba la Dirección Creativa · día 5: el cliente (si no contesta, se da por aprobado)
- Hasta el día 7: el cliente manda el material crudo
- Del 5 al 13: Diseño y Edición producen · día 14: aprueba la Dirección Creativa · día 15: el cliente
- Desde el **16**: programás y se publica

**Lo que se publica del 1 al 15 del mes siguiente**
- Días **15 a 17**: armás el calendario · día 19 la Dirección Creativa · día 20 el cliente · material crudo hasta el 22
- Del 20 al 28 se produce · día 29 Dirección Creativa · día 30 el cliente · desde el **1** se publica

## Cuenta nueva (el arranque)
- Día 1: reunión de diagnóstico (ahí se pregunta todo lo del cliente)
- Día 3: biografía, historias destacadas y **primer calendario**
- Día 7: perfiles rediseñados y material crudo del cliente recibido
- Desde el día 15 la cuenta empieza a publicar
- En la ficha: cargá los accesos **red por red** (o marcá «no tiene esta red»)

## Tu día
- A la mañana: mensajes y comentarios de la noche
- Durante el día: historias y respuestas
- Antes de cerrar: ningún mensaje sin responder

## Reglas
- Todo pasa por la plataforma: lo que no está cargado, no existe
- Si algo te frena (falta material, falta un acceso), tocá **«¿Trabada?»** en la tarea: avisa a quien corresponde
- No programes nada que no haya aprobado el cliente
- Dudas de qué hacer o para cuándo: **Luz** (Project Manager)$d$
where area = 'Community Manager';

update positions set
descripcion = $d$Diseña las piezas de sus cuentas (posteos, carruseles y portadas) y el kit de marca de cada cuenta nueva, con la identidad de cada cliente.$d$,
alcance_incluye = $d$- **Posteos y carruseles** del calendario de sus cuentas
- **Portadas** de los reels
- El **kit de marca** de cada cuenta nueva: logo y variaciones, paleta, tipografías, tono de voz, portadas de destacadas y plantillas de historias
- Creatividades para la pauta cuando las pide Paid Media
- Dejar cada pieza con el **link** de Canva o Drive en su tarea$d$,
alcance_excluye = $d$- Qué se publica y cuándo (**Community Manager** y **Project Manager**)
- Editar videos (**Edición Audiovisual**)
- El manual de marca completo con papelería (es el **Pack Marca Real**, se cotiza aparte)$d$,
kpis = $d$- Piezas entregadas a revisión **antes del 14 y del 29**
- Aprobadas en la **primera** revisión
- Coherencia con la marca de cada cliente$d$,
procesos = $d$## El ciclo de cada quincena
- Producís del **5 al 13** (lo que sale desde el 16) y del **20 al 28** (lo que sale desde el 1)
- Cuando una pieza está lista, la pasás a **«En revisión»** con el link de Canva o Drive: la aprueba la **Dirección Creativa** (los días 14 y 29)
- Si pide cambios, vuelve a vos con el comentario
- Aprobada por el cliente, la programa la Community Manager

## Cuenta nueva
- Día 3 del arranque: entregás el **kit de marca** (una sola versión completa)
- Día 4 lo aprueba la Dirección Creativa · día 5 el cliente

## Reglas
- **Sin link no se puede programar**: cada pieza va con su link en la tarea
- Formatos: feed 4:5, historias y portadas 9:16
- Si te falta material o información, tocá **«¿Trabada?»** en la tarea
- Qué hacer y para cuándo: **Luz**. Cómo tiene que verse: **Dirección Creativa**$d$
where area = 'Diseño';

update positions set
descripcion = $d$Edita los reels y videos de sus cuentas a partir del material crudo, con ritmo, subtítulos y la estética de cada marca.$d$,
alcance_incluye = $d$- **Reels y videos** del calendario de sus cuentas
- Subtítulos, música, sonido y textos en pantalla
- Acompañar las **jornadas de producción** cuando se pide
- Ordenar el material: crudo y editado en el Drive del cliente
- Dejar cada video con el **link** en su tarea$d$,
alcance_excluye = $d$- Qué se publica y cuándo (**Community Manager** y **Project Manager**)
- Piezas gráficas y portadas (**Diseño**)
- Hablar con el cliente en el día a día$d$,
kpis = $d$- Videos entregados a revisión **antes del 14 y del 29**
- Aprobados en la **primera** revisión
- Cero videos con errores de audio, subtítulos o formato$d$,
procesos = $d$## El ciclo de cada quincena
- El material crudo del cliente llega hasta el **7** y el **22**
- Editás del **5 al 13** (lo que sale desde el 16) y del **20 al 28** (lo que sale desde el 1)
- Video listo → **«En revisión»** con el link: lo aprueba la **Dirección Creativa** (días 14 y 29)
- Si pide cambios, vuelve a vos con el comentario · aprobado por el cliente, lo programa la Community Manager

## Técnico
- Reels e historias 9:16 (1080×1920); YouTube 16:9
- Subtítulos siempre: legibles, máximo dos líneas
- Gancho en los primeros 3 segundos

## Reglas
- **Sin link no se puede programar**
- Si falta material, tocá **«¿Trabada?»** en la tarea (avisa a la Project Manager y al cliente)
- Qué hacer y para cuándo: **Luz**. Cómo tiene que verse: **Dirección Creativa**$d$
where area = 'Edición Audiovisual';

update positions set
descripcion = $d$Responde por la calidad y la estrategia de todo lo que sale: aprueba los calendarios y todas las piezas, hace la reunión mensual de sus cuentas y cuida que los clientes estén conformes y se queden.$d$,
alcance_incluye = $d$- Aprobar el **calendario** de cada quincena de todas las cuentas
- Aprobar **todas las piezas** de diseño y edición antes de que vayan al cliente
- Aprobar el **kit de marca** de cada cuenta nueva
- La **reunión mensual** de sus cuentas (días 1 al 7: el cliente elige el horario desde su portal)
- La **satisfacción** de los clientes y que renueven
- El criterio estético y estratégico de la agencia$d$,
alcance_excluye = $d$- Repartir tareas y poner fechas (**Project Manager**)
- Diseñar o editar las piezas del día a día
- Precios y condiciones de los clientes (**Dirección**)$d$,
kpis = $d$- **100%** de las piezas pasan por tu aprobación
- Aprobás o pedís cambios en **24 horas hábiles**
- Reunión mensual hecha en **todas** tus cuentas
- **90%** de clientes satisfechos en la encuesta del portal$d$,
procesos = $d$## Tus fechas de cada quincena
- Días **3 y 4**: aprobás el calendario que se publica del 16 a fin de mes · día **19**: el del 1 al 15
- Día **14**: aprobás las piezas que salen desde el 16 · día **29**: las que salen desde el 1
- Lo que tenés para aprobar te aparece en **Mi día** («Para aprobar»)

## Cómo aprobar
- Aprobás, o pedís cambios con un comentario concreto (qué y por qué)
- Chequeá: que cumpla el objetivo de la pieza, la marca (logo, colores, tipografías, tono), que el texto no tenga errores y tenga llamado a la acción, y el formato
- No asignás tareas ni ponés fechas: eso es de Luz

## Cuenta nueva
- Día 4 del arranque: aprobás el **kit de marca** y el **primer calendario**

## Reunión mensual
- Días 1 al 7 de cada mes, de 9 a 21 h: el cliente elige el horario desde su portal y te llega el aviso
- El **guion** de la reunión ya está armado en la tarea
- Registrá la reunión en la plataforma: si no está cargada, no cuenta

## Reglas
- Ninguna pieza sale sin tu aprobación
- Cliente disconforme o en riesgo de irse: avisale a la Dirección ese mismo día$d$
where area = 'Coordinación de Diseño';

update positions set
descripcion = $d$Es la única puerta del equipo: reparte el trabajo, pone las fechas y cuida que todo salga en tiempo y forma, desde el arranque de cada cuenta nueva hasta la entrega de cada quincena.$d$,
alcance_incluye = $d$- **Repartir** las tareas y poner las **fechas** de todo el equipo
- Que las piezas salgan **en fecha** y que nada quede trabado
- Llevar el **arranque** de cada cuenta nueva (sección Project Manager)
- La **carta acuerdo** de cada mes: el 25 te aparece la tarea con el link para mandársela a cada cliente
- La **encuesta del mes** en el portal: que los clientes la contesten
- Destrabar: lo que se traba en el equipo o con el cliente$d$,
alcance_excluye = $d$- Aprobar piezas (**Dirección Creativa**)
- Ejecutar piezas o calendarios
- Precios y condiciones (**Dirección**)$d$,
kpis = $d$- **90%** de las tareas cerradas a tiempo
- Pocos **cambios de fecha** (cada cambio queda registrado)
- Piezas publicadas en fecha
- Arranques completos en **15 días**$d$,
procesos = $d$## El ciclo de cada quincena (lo que vigilás)
- Calendario: días 1-2 y 15-17 (Community Manager) · aprobado 3-4 y 19 (Dirección Creativa) · cliente 5 y 20
- Material crudo del cliente: hasta el 7 y el 22
- Producción: 5-13 y 20-28 · aprobación de piezas: 14 y 29 · cliente: 15 y 30
- Se publica desde el **16** y desde el **1**
- Si el cliente no aprueba en fecha, se da por aprobado (lo dice su carta acuerdo)

## Cuenta nueva (sección Project Manager)
- Día 1: reunión de diagnóstico (se carga su fecha y desde ahí cuentan los días)
- Día 2: página de Facebook vinculada · día 3: biografía, calendario y kit de marca · día 4: aprueba la Dirección Creativa · día 5: el cliente
- Día 7: material crudo y perfiles rediseñados · día 15: empieza a publicar
- Respondé las preguntas Sí/No de cada cuenta y avisá a quien esté atrasado con un toque

## Fechas
- Toda tarea tiene fecha límite
- **Cada cambio de fecha queda registrado** y cuenta en tus objetivos: mové una fecha solo si de verdad cambió el plan
- Si la demora es del cliente, usá **«¿Trabada?» → espera al cliente**: la fecha se corre sola los días en pausa

## Fin de mes
- El 25: carta acuerdo del mes siguiente a cada cliente (tarea con el link)
- Que cada cliente conteste la encuesta del mes en su portal$d$
where area = 'Coordinación';

update positions set
descripcion = $d$Consigue y cierra clientes nuevos: prospecta todos los días, agenda reuniones, arma la propuesta y acompaña hasta que el cliente paga.$d$,
alcance_incluye = $d$- **Prospectar todos los días** desde la plataforma (la meta diaria la ves en Mi día)
- **Seguimiento** a los 3 días de cada contacto que no respondió
- La **reunión** con el interesado y el diagnóstico de su Instagram
- La **propuesta** en 48 horas y la **carta acuerdo**
- Acompañar hasta el **pago** y pasar la cuenta a la Project Manager$d$,
alcance_excluye = $d$- Precios o descuentos fuera de lo autorizado (**Dirección**)
- El trabajo con el cliente una vez que arrancó (**Project Manager** y el equipo)$d$,
kpis = $d$- Contactos escritos por día, semana y mes (ver «Tus objetivos»)
- Reuniones agendadas · propuestas enviadas · clientes cerrados
- Conversión de propuestas a clientes$d$,
procesos = $d$## Todos los días
1. Entrá a **Prospección** y escribile a los contactos del día
2. **Marcá cada contacto** en la plataforma apenas le escribís: le cuenta a quien lo marca primero, con la fecha de ese día
3. A los 3 días, seguimiento a los que no respondieron (la plataforma te los ofrece)

## Del interés al cierre
1. Interesado → agendá la reunión (la ves en Comercial › Reuniones)
2. Propuesta en **48 horas** (PDF o por link)
3. Seguimiento hasta que confirme
4. Cuando paga: **activar el cliente** y cargar quién lo cerró (**«Cerrado por»** y, si fueron dos, **«La cerró junto con»**: cada uno cobra la mitad)
5. Pasale la cuenta a **Luz** para el arranque

## Reglas
- Solo se ofrecen los servicios que hace la agencia (están en la web)
- Lo que no está marcado en la plataforma no cuenta para tus objetivos ni para tu comisión$d$
where area = 'Comercial';

update positions set
descripcion = $d$Responde por la publicidad paga de todas las cuentas: que cada una tenga su pauta conectada, funcionando y midiendo resultados.$d$,
alcance_incluye = $d$- El **onboarding de pauta** de cada cuenta nueva: accesos, cuenta publicitaria, método de pago, campañas definidas y publicadas
- Que cada cuenta esté **vinculada**: página de Facebook unida al Instagram, y compartidas con el portfolio de JD MEDIA y el usuario del sistema «jdmedia» (así la plataforma trae los datos)
- Crear la **página de Facebook** cuando el cliente no la tiene
- **Campañas activas** y optimizadas en las cuentas con pauta
- Pedir las creatividades a Diseño y Edición con objetivo y texto
- Informar los resultados de la pauta cada mes$d$,
alcance_excluye = $d$- El contenido orgánico (**Community Manager** y **Dirección Creativa**)
- Prometerle resultados al cliente (las expectativas las define la reunión de diagnóstico)
- Precios de la gestión de pauta (**Dirección**)$d$,
kpis = $d$- Todas las cuentas con pauta **corriendo**
- Onboardings de pauta **completos**
- Todas las cuentas **vinculadas y midiendo** en la plataforma
- Resultado de cada campaña contra su objetivo$d$,
procesos = $d$## Cuenta nueva con pauta
1. Día 2 del arranque: **página de Facebook vinculada** al Instagram (si no tiene, la creás)
2. Día 3: **compartir y conectar** el Instagram y la página con JD MEDIA: el cliente las comparte como socio al portfolio (ID 570336019465694) y vos las asignás al usuario del sistema «jdmedia» y a quien las trabaja
3. En la ficha, **Onboarding de pauta**: accesos, cuenta publicitaria, método de pago, campañas definidas y campañas publicadas (los pasos de vinculación se tildan solos cuando llegan los datos)
4. Las campañas arrancan desde la **segunda quincena**: lo sólido se ve entre el mes 2 y el 3

## Todas las semanas
- Revisar gasto y resultados de cada cuenta y optimizar
- Si una cuenta se quedó sin pauta (tarjeta rechazada, cuenta desactivada), avisar al cliente y a la Project Manager ese día

## Reglas
- Nunca uses tu usuario personal de Facebook para trabajar las cuentas: todo va por el portfolio de JD MEDIA
- Las tareas «🔗 Vincular» se cierran solas cuando la plataforma recibe los datos$d$
where area = 'Coordinación de Paid Media';

insert into positions (nombre, area, descripcion, alcance_incluye, alcance_excluye, kpis, procesos)
select 'Coordinación General', 'Coordinación General',
$d$Administración y personas: que los clientes paguen en fecha, que el equipo cobre el 7, que cada puesto tenga su acuerdo claro y que quien entra tenga todo lo que necesita.$d$,
$d$- **Cobranza**: que todos los clientes paguen del **1 al 5** y que cada cobro quede marcado en la plataforma
- **Sueldos** listos para pagar el **7** de cada mes
- Los **acuerdos** de cada puesto (qué hace, qué no y cómo cobra), aprobados por la Dirección
- **Búsquedas y entrevistas** (sección Reclutamiento)
- El **alta** de quien entra: usuario, perfil completo y su primera semana
- **Seguimiento** una vez por mes de que cada rol cumpla lo acordado$d$,
$d$- Precios y condiciones con los clientes (**Dirección**)
- El trabajo de producción (**Project Manager** y el equipo)$d$,
$d$- Cobros del mes **marcados al día 5**
- Sueldos **pagados el 7**
- Todo el equipo con su perfil completo (datos, alias y foto)$d$,
$d$## Cada mes
- Del **1 al 5**: cobrar los abonos y marcar cada cobro en la plataforma (Cobros). Si un cliente no paga, avisarle y avisar a la Dirección
- Días 6 y 7: revisar la nómina del mes anterior (Sueldos) y pagar el **7**
- Una vez por mes: revisar con cada coordinador sus objetivos y lo acordado de su rol

## Cuando entra alguien
- Crear su usuario, que complete **Mi perfil** (datos, alias, foto) y pasarle su acuerdo de rol
- Que haga su primera semana guiada (le aparece en Mi día)$d$
where not exists (select 1 from positions where area = 'Coordinación General');
