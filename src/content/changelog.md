---
title: Novedades
---

## 2026-07-19 — El Drive automático ahora usa las carpetas reales de la agencia

- 📁 Las carpetas de clientes nuevos se crean **dentro de `JD MEDIA › Clientes`** (la carpeta de siempre), ya no en una aparte.
- ⏸️ **Al marcar un cliente inactivo, su carpeta se mueve sola a `JD MEDIA › Clientes pausados`** (la carpeta se crea sola si no existe). Al reactivarlo, vuelve a `Clientes`. Funciona también con las carpetas viejas creadas a mano, siempre que el link esté cargado en la ficha.

## 2026-07-19 — Menú más simple: menos ítems, mismas secciones

- 🧭 **Nada se borró, solo se agrupó.** Todas las URLs siguen funcionando igual; lo que cambió es cómo se llega desde el menú:
  - **Prospección** ahora es una pestaña dentro de **Comercial** (Comercial · Prospección · Post-meet).
  - **Reclutamiento** ahora es una pestaña dentro de **Equipo**.
  - **Objetivos y Productividad** se unieron en **Métricas** (pestañas).
  - **JDmedIA en vivo** se entra desde el botón **"Sesión en vivo"** arriba de JDmedIA.
  - **Director IA** ahora es una pestaña de **Coordinación** (para coordinación sigue en el menú como siempre).

## 2026-07-18 — El Drive del cliente se crea solo (onboarding de redes)

- 📁 **Un botón y listo**: en el paso "Drive del cliente creado" del onboarding de Gestión de Redes hay un botón nuevo **"Crear automáticamente en Drive"**: crea la carpeta del cliente dentro de **Clientes JD Media** en el Drive de la agencia, con sus 3 subcarpetas (**Identidad visual · Calendario de contenidos · Contenido crudo**), la comparte por link y deja el **link listo para mandar al grupo**. El paso queda tildado solo.
- ✍️ **Pegar el link a mano sigue funcionando** igual que siempre, para carpetas que ya existían.
- 🔌 La primera vez hay que **conectar el Drive de la cuenta de Google de JD Media** (botón "Conectar Google Drive" en el mismo paso — se hace una sola vez).
- ⚡ **La app navega más rápido**: se recortaron idas y vueltas a la base en cada cambio de sección.

## 2026-06-27 — Pago de la Coordinación de Diseño (automático en Sueldos)

- 💰 **La coordinación de diseño se paga sola**: Bri cobra **5% del diseño publicado del mes** (posts/carruseles + portadas de reel, sobre las mismas piezas que se les pagan a los diseñadores), + un **plus por cada manual de marca aprobado** de una cuenta nueva (5% del manual). La cuenta interna (JD Media) queda afuera. Aparece como línea automática en Sueldos desde julio, y el % es editable.

## 2026-06-26 — Coordinación de Diseño Gráfico + onboarding de diseño

- 🎨 **Nuevo rol "Coordinación de Diseño"**: distinto de la coordinación de gestión de redes. Coordina el servicio de diseño y aprueba la identidad visual en el arranque de cada cuenta. Figura en el organigrama y **ve todos los clientes**.
- 🗂️ **Onboarding de Diseño Gráfico** (nueva etapa, como redes y publicidad): al arrancar una cuenta el diseñador/a crea **manual de marca, kit de marca, proyecto en Canva y plantillas de historias**; la **Coordinación de Diseño aprueba** antes de mandarlo al grupo (solo el arranque — los posteos del día a día no pasan por acá).
- ✅ **Tareas de diseño completas**: las tareas de diseño que habían quedado sin responsable ahora caen en el diseñador/a de cada cuenta (se corrigieron las que faltaban).

## 2026-06-26 — Roles dobles completos + retoques de onboarding

- 👥 **El segundo rol ahora vale en toda la app**: quien cumple dos funciones (ej. CM + Coordinación) ve y puede usar las secciones de ambos roles en todos lados — fichas de cliente, agenda, clientes, resultados, documentos, análisis de pauta, etc. (antes el rol secundario solo sumaba permisos sueltos).
- ✅ **Pasos AUTO del onboarding ahora se pueden tildar a mano**: los pasos que se marcaban solos (como "Carta acuerdo enviada") ya no te bloquean — podés confirmarlos o destildarlos vos igual.
- 🔓 **La coordinadora de una cuenta puede abrir su ficha** aunque no esté en los puestos de producción (antes el acceso miraba CM/diseño/audiovisual pero no la coordinación).

## 2026-06-26 — Comercial más simple: cerrar un cliente en 2 pasos

- 🧭 **El rol Comercial ahora ve su parte**: quienes tienen rol comercial ven en el menú **Comercial** y **Prospección**, y pueden **crear clientes/propuestas** (antes el menú se los ocultaba aunque tuvieran el rol).
- 💬 **Botón "Pedir datos al cliente"** ahora visible en Comercial: copia el mensaje de siempre para pedirle los datos de la carta acuerdo (nombre, DNI/CUIT, domicilio legal, mail). Antes existía pero no estaba a la vista.
- 📝 **Nueva propuesta**: al crear el cliente podés elegir la **coordinadora de la cuenta**. El resto del equipo lo asigna ella después.
- 👥 **La coordinación asigna los puestos**: en el onboarding de Gestión de Redes hay una tarjeta nueva **"Equipo de la cuenta"** para elegir quién lleva Community Manager, Diseño y Edición Audiovisual. Lo puede hacer el admin o la coordinadora de la cuenta.
- ℹ️ El paso "Carta acuerdo + cobro enviados" se marca **solo** (automático) cuando ya existe el contrato — por eso no se tilda a mano.

## 2026-06-26 — Roles dobles y editar el rol de alguien ya cargado

- 👥 **Una persona, dos roles**: al crear (o editar) un usuario podés asignarle un **rol y área secundarios**, para quien cumple dos funciones en la agencia. Suma los **permisos** de los dos roles, lo hace **figurar en las dos áreas** (organigrama y tareas por área) y lo cuenta en **sueldos** donde corresponde (ej. el fijo de comercial).
- ✏️ **Editar rol/área sin recrear**: nuevo botón **"Rol"** en cada persona de Accesos. Antes el rol solo se podía elegir al crear; ahora lo cambiás cuando quieras. Sumar un rol **nunca** le saca accesos que ya le diste a mano.
- 🐛 **Fix**: crear un usuario nuevo tiraba el error "duplicate key… users_pkey". Resuelto.

## 2026-06-26 — Prospección: verificamos el Instagram antes de pasártelo

- ✅ **Chau links de Instagram muertos**: al descubrir empresas, la app ahora **verifica con búsqueda web** que el Instagram exista de verdad y sea de esa empresa **antes de guardarlo**. Si el handle estaba mal, lo **corrige** con el real; si no encuentra ninguno real, lo deja vacío (mejor sin link que con uno que abre una cuenta vacía o inexistente).
- 🟢 **Se nota a simple vista**: el chip de Instagram aparece **verde con tilde** cuando está confirmado, y **ámbar** cuando no se pudo confirmar (revisalo antes de escribir).
- 🔎 **Botón "Verificar IG" / "Buscar IG"** en cada lead: para los que ya tenías cargados, podés verificar (o buscar el que falta) cuando quieras.

## 2026-06-25 — La IA de contenido piensa para viralizar y arma el diseño placa por placa

- 🎯 **Todo el contenido apunta a crecer la cuenta**: tanto el plan mensual como el "Sugerir con IA" del calendario ahora piensan cada pieza con intención de **viralizar**, basándose en el diagnóstico. **Posts y reels** se piensan para atraer gente nueva y pautar (gancho fuerte, alcance frío); **historias** para la audiencia que ya te sigue (cercanía, interacción).
- 🎨 **Briefs de diseño mucho más detallados**: cuando propone un carrusel ya no te tira solo el título — desglosa **placa por placa** qué texto/dato va en cada una y una **idea de diseño** (qué se ve, jerarquía, por qué retiene). La placa 1 es el gancho, la última el CTA. Para posts y reels también da el concepto visual concreto. Así el equipo de diseño arranca sin tener que preguntar.

## 2026-06-24 — Sueldos: más justos, más claros y con recibo

- 🎯 **Diseño y edición se pagan por el contenido REAL del mes** (desde julio): la app cuenta las **publicaciones aprobadas/publicadas** y paga el diseño, la edición y las portadas a **quien hizo cada pieza**. En el calendario, cada reel trae por defecto el **editor** y el **diseñador de portada** del cliente, pero si una pieza la hace otra persona, la marcás ahí y esa persona la cobra. (Junio se liquida por el pack contratado, porque el calendario no reflejó del todo lo producido.) El CM y el media buyer siguen por pack.
- 👥 **Coordinación repartible por mes**: si un mes el rol de coordinación se divide entre dos personas (como en junio: media y media entre Brisa y Luz), lo cargás desde el botón **"Coordinación"** y la app reparte ese 10% como corresponda. Si no tocás nada, va todo a la coordinadora de siempre.
- 🤖 **Ajustes del mes con IA**: escribís en criollo (*"a Brisa sumale 20 mil por carruseles extra, a Guille descontale un adelanto de 50 mil"*) y la app arma los ítems solos. Los revisás y aplicás.
- ✏️ **Editar ítems** ya cargados (concepto, monto, cliente) sin tener que borrar y volver a crear.
- 🧾 **Recibo imprimible / PDF** por persona y mes: el detalle completo de a qué corresponde cada parte del sueldo, con los datos de transferencia. Botón **"Recibo"** en cada tarjeta.
- 💰 Y un acceso directo a **Cuentas por cobrar** desde Sueldos, para ver de un vistazo cuánto te deben y quién.

## 2026-06-24 — Asesor financiero: la app te dice cómo venís y qué hacer

- 🧮 **Nuevo Asesor financiero en Finanzas** (admin): lee tus números del mes —ganancia, margen, concentración de clientes, cobranzas vencidas, deudas y la tendencia de cobranza— y te devuelve un **diagnóstico en criollo**, un **puntaje de salud** y **recomendaciones priorizadas** con link directo a la acción. Lo generás y actualizás con un botón.
- 🧹 Y para no marearte, los análisis detallados (movimientos, rentabilidad, evolución, vencimientos…) quedaron en un **desplegable**. Arriba ves solo lo importante: tu ganancia, el asesor, las alertas y el día a día.

## 2026-06-24 — Prospección con IA: salí a buscar clientes

- 🛰️ **Una forma nueva de conseguir clientes sin depender solo de la pauta**: creás una campaña por **cluster** (un rubro en una zona, ej. *"gimnasios de Nueva Córdoba"*) y la IA **busca empresas reales** que nos necesitan, con sus datos de contacto y la fuente de dónde salieron.
- ✍️ Cada lead llega con un **primer mensaje ya escrito**, personalizado con algo concreto de su cuenta y ofreciéndole una idea gratis (engancha mucho más que pedir una llamada). Lo mandás por WhatsApp o Instagram a un toque.
- 🔁 **Seguimiento** a un botón (el segundo toque, donde más se cierra), una sección **"Para seguir"** que te recuerda a quién contactaste hace días y no respondió, y cada campaña muestra su **tasa de respuesta y conversión**. Está en **Prospección** (comercial / coordinación).

## 2026-06-24 — Paid Media ve todas sus cuentas

- 👀 El **gestor de pauta** ahora ve en **Clientes** y en su panel **todas las cuentas donde hace la publicidad**. Antes, si solo figuraba como media buyer de la cuenta (sin ser CM/diseño/edición), no le aparecían — quedó arreglado.

## 2026-06-22 — Comercial más directo + puestos al día

- 🎯 **Comercial enfocado en cerrar**: cuando un prospecto te pasa los datos, tocás **"Nueva propuesta"**, cargás sus datos y armás la carta acuerdo directo — sin pasar por el pipeline. Arriba ves las **propuestas esperando pago**; el pipeline de leads quedó como sección secundaria (colapsada), para quien quiera usarlo.
- 📋 **Puestos y procesos actualizados**: repasé todas las áreas, saqué roles viejos que ya no existen (y referencias a ellos), y completé los que estaban flojos (Paid Media y Coordinación con descripción y herramientas nuevas; Coordinación de Gestión de Redes quedó como dueña de la estrategia de contenido). Esto también afina el análisis de CVs por área en Reclutamiento.

## 2026-06-22 — Reclutamiento: traé los CVs solos desde Gmail

- 📬 **Conexión a Gmail** en Reclutamiento: conectás la casilla de la agencia y, desde cada búsqueda, el botón **"Traer de Gmail"** trae los CVs adjuntos de los mails (filtrás por asunto/fecha) y la IA los analiza solos — sin bajar nada a mano.
- 🔁 Reusa el mismo acceso de Google que ya usa la app. Requiere un setup único en Google Cloud (habilitar Gmail + permiso de lectura); está todo en la guía.

## 2026-06-22 — Reclutamiento: la IA te analiza los CVs

- 🧑‍💼 **Nueva sección Reclutamiento** (Equipo & clientes, admin/coordinación): creás una **búsqueda** (puesto + perfil), cargás los CVs en lote (PDF) y la **IA los lee y analiza solos** — nombre, ubicación, área, experiencia, skills, formación, un resumen y un **puntaje de aptitud** para el puesto.
- 🔎 **Filtrás en vez de abrir mil mails**: por **Córdoba Capital**, experiencia mínima, aptitud y búsqueda libre, ordenando por el candidato más apto. Cada uno muestra fortalezas, dudas y contacto (mail / WhatsApp) a un toque.
- 🧠 **El perfil se arma solo según el área**: al elegir el área, el perfil del puesto (qué hace, qué incluye/excluye, KPIs) se completa automático desde tus Procesos, así la IA sabe qué buscás sin que escribas nada. Respeta el puesto (un editor no es un diseñador) pero reconoce skills transferibles. Arriba de cada búsqueda ves el resumen: total, cuántos de Córdoba y cuántos con aptitud alta.
- 📥 Por ahora se cargan bajando los adjuntos del mail; **pronto se van a traer solos desde Gmail**.

## 2026-06-21 — Conexión de Instagram y TikTok en el onboarding de Redes

- 🔗 **Vincular IG y TikTok ahora está en el onboarding de Gestión de Redes**, con el **paso a paso detallado** de cada red (cuenta profesional, vínculo con la página de Facebook, asignación al system user de JD Media para IG; y autorización del cliente para TikTok). Así se hace fácil y sin errores.
- 🎯 El **onboarding de publicidad** quedó enfocado: solo la **conexión con Meta Ads** (cuenta publicitaria + checklist). Si buscás conectar IG/TikTok, te manda a Redes.

## 2026-06-21 — Enviá el reporte del mes al cliente por WhatsApp

- 📲 **Botón "WhatsApp" en el reporte mensual**: arma un **link público del reporte** (el cliente lo abre desde el celular, sin login) y un mensaje listo. A un toque abrís WhatsApp con el link, o lo copiás.
- 🔗 El link reusa el **token del portal** del cliente: si la cuenta ya tiene su link de portal generado, funciona directo; si no, el botón te avisa para generarlo en la ficha.
- 🔒 El reporte público solo se abre con ese token (nadie ve el reporte de otro cliente).

## 2026-06-20 — Carta acuerdo desde Comercial + comisiones que se cargan solas

- 📝 **Carta acuerdo desde el pipeline**: en una oportunidad (etapas Propuesta / Negociación / Ganado) ahora aparece **"Generar carta acuerdo"**. Crea una ficha en estado **Propuesta** (no cuenta como cliente todavía, no entra a Finanzas ni a Sueldos) para que armes el contrato y la carta, y se la envíes junto con los datos de transferencia.
- ✅ **Cuando el cliente paga, lo activás**: desde su ficha, el botón **"Activar cliente (pagó)"** lo pasa a Activo, arranca su primer mes y recién ahí empieza a contar. Si nunca paga, queda como Propuesta y no ensucia nada. En Clientes hay un filtro nuevo **"Propuestas"**.
- 💬 **Mensaje listo para el cliente**: en la ficha de una Propuesta tenés un mensaje armado solo (resumen de lo contratado + datos para transferir), editable, con **copiar** y **abrir WhatsApp**. Lo mandás junto con la carta acuerdo en PDF.
- ⏳ **Propuestas esperando pago**: en **Comercial** ves la lista de propuestas enviadas que todavía no se activaron, con cuántos días llevan, para seguirlas y cerrar el cobro.
- 💸 **Comisiones de cierre automáticas**: la comisión del **primer mes** de cada cliente nuevo se carga **sola** en Sueldos, para el comercial que figura como **"Cerrado por"** en la ficha. Ya no hace falta cargarla a mano (el botón "Comisión" queda solo para casos especiales: lead referido o ajustes). El bonus por volumen también cuenta estos cierres.
- 📜 **Historial de movimientos**: en Finanzas → Análisis → **"Movimientos"** ves todo lo que entró y salió (cobros, pagos al equipo y gastos), mes a mes, con filtro por Ingresos / Egresos y los totales arriba.

## 2026-06-20 — Tu ganancia del mes, de un vistazo

- 💰 **El inicio de Finanzas ahora muestra "Tu ganancia del mes"**: lo que te queda después de pagar todo = **Ingresos − Sueldos − Plataformas − Publicidad**, con cada parte desglosada.
- 📣 **La publicidad de JD Media** (lo que gastás en Meta promocionando la agencia) se toma automático y se descuenta de la ganancia.
- 🧾 La sección de cobros dejó de hablar de "facturas": ahora son **cobros/abonos** (más simple). Lo más rápido sigue siendo "Generar el mes" y marcar cobrado cuando te pagan.

## 2026-06-20 — Finanzas más simple: todo el mes en el inicio

- 🧹 **Simplificamos Finanzas**: el inicio ahora responde de un vistazo lo importante — **Entró · Salió · Neto** del mes (con selector de mes), qué **falta cobrar/pagar**, y el **costo fijo** (sueldos + plataformas/suscripciones) para que se vea cuánto pesa lo recurrente.
- 🗂️ Las secciones quedaron ordenadas en **"Día a día"** (cobrar, pagar, gastos) y **"Análisis"** (salud, rentabilidad, proyección, evolución, suscripciones, recordatorios). Menos botones, todo más a mano.

## 2026-06-20 — Servicios puntuales y costo por porcentaje

- 🧾 **Servicios que no son gestión de redes** (branding, diseño suelto, web, botly…) ahora pueden definir su **costo de entrega**: un **% de lo que paga el cliente** (ej: branding de $400k con 50% para quien lo hace = $200k de costo) o un monto fijo, y a quién se le paga. Se carga en cada servicio, en la ficha del cliente.
- 📊 **Salud de la agencia más exacta**: los **cobros únicos ya no se cuentan como ingreso mensual** (antes inflaban el MRR). Aparecen en una sección aparte, **"Proyectos puntuales"**, con su ingreso, costo y margen real del mes. Y a las cuentas que no son de gestión de redes ya no se les inventa un costo de CM.
- 💵 **Sueldos**: quien entrega esos servicios entra **automáticamente** a la nómina (los puntuales, en el mes del proyecto).

## 2026-06-20 — Media buyer: incluido en gestión de redes

- 🎯 **La gestión de campañas de Meta ahora se cuenta como parte del servicio de gestión de redes**: el media buyer cobra por **cada cuenta con gestión de redes**, sin tener que marcar "paid media" como un servicio aparte en cada cliente nuevo.
- 💵 Esto corrige el sueldo del media buyer: antes solo figuraban las cuentas con el servicio de pauta cargado a mano; ahora figuran **todas** las que tienen gestión de redes.
- 📊 El margen real (Salud de la agencia) y el panorama de Coordinación reflejan ese costo en todas las cuentas con gestión.
- 🧹 Se limpiaron los servicios de "paid media" que estaban sueltos sin facturación; los que sí facturan un extra de pauta se conservan.

## 2026-06-20 — Tus datos para cobrar, tu sueldo real e historiales

- 🏦 **"Mis datos para cobrar" en Mi perfil**: cada uno carga su propio **alias/CBU** (y titular) sin depender de nadie. Aparece en tu sueldo y donde se registra tu pago. Si te falta, la app te avisa.
- 👤 **Sueldo real del mes en el perfil de cada persona**: además de la compensación pactada (que queda como referencia), ahora se ve el **monto automático del mes** con su desglose — lo que de verdad se cobra/paga según cuentas, piezas, comisiones y jornadas.
- 🧾 **Historiales fáciles de ver**:
  - En el perfil de cada **persona**: su **historial de pagos** (qué se le pagó, cuándo, cuánto, qué está pendiente o atrasado).
  - En la ficha de cada **cliente**: su **historial de cobros** (períodos cobrados, pendientes y vencidos), con el total cobrado.

## 2026-06-20 — Mirá tu próximo sueldo + recordatorio de cobro automático

- 💰 **"Mi próximo sueldo" en Mi perfil**: cada uno entra a **Mi perfil** y ve, con total claridad, lo que va a cobrar este mes — el desglose por cada cuenta y concepto (CM, diseño, edición, portadas, media buyer, comisiones, jornadas…) y el **total estimado**. Si ya se registró el pago, lo muestra. Podés copiar el detalle con un toque.
- 🔔 **Recordatorio de cobro automático**: arrancado el mes, la app le avisa a Dirección que toca **enviar los recordatorios de cobro** a los clientes, con link directo a la sección donde cada mensaje de WhatsApp sale a un toque. La idea: cobrar el 1° para tener margen de pagarle al equipo en tiempo.

## 2026-06-20 — Cobros más claros y churn que se ve en la proyección

- ⏰ **Días para cobrar en la tabla de Cobros**: cada factura sin cobrar ahora muestra un cartelito al lado del vencimiento — **"vence hoy"**, **"en 3 días"** o **"atrasado 5 días"** (en rojo cuando ya venció). De un vistazo sabés a quién hay que apurar.
- 📉 **El churn se refleja en la Proyección**: la evolución del MRR ahora incluye las cuentas que se dieron de baja, así se ve la **caída** cuando un cliente se va, no solo el crecimiento. Las bajas viejas sin fecha de fin cargada se ubican por aproximación (su última modificación) y la app te avisa para que la cargues si querés que sea exacta.

## 2026-06-17 — Proyección financiera: MRR, LTV y caja a futuro

- 🔮 **Nueva sección Finanzas → "Proyección"** que mira hacia adelante, no solo el mes actual:
  - 📈 **MRR** (ingreso mensual recurrente) y cómo **creció la cartera** mes a mes.
  - 👥 **Valor de cada cuenta**: antigüedad promedio y LTV estimado, más una tabla con el valor acumulado por cliente.
  - 💵 **Proyección de caja a 3 meses**: lo que está por **cobrar** (facturas pendientes) contra lo que hay que **pagar** (equipo + gastos + renovación de suscripciones), con el **neto y el saldo acumulado** de cada mes.
- La idea: anticipar los meses flojos y ver el negocio a futuro, no solo la foto de hoy.

## 2026-06-16 — Alertas de cuentas: te avisamos cuando algo se cae

- 🔔 **La app ahora te avisa solo cuando una cuenta da señales malas**, sin que tengas que revisar una por una:
  - 📉 **Instagram perdiendo seguidores** en la semana (cuando la baja es significativa).
  - 💸 **Pauta gastando sin conversiones** los últimos 3 días (para revisar campañas o confirmar el objetivo).
- Las alertas le llegan por notificación a Dirección y al responsable de la cuenta (CM o media buyer), con link directo a los Resultados del cliente. Sin spam: una por tema por día.

## 2026-06-16 — Comparativa mes a mes en el reporte

- 📈 **Los Resultados de Instagram ahora muestran la evolución** vs el mes anterior: al lado de seguidores, alcance, interacciones y visitas aparece la variación (ej: **▲ +340 vs mes ant.** en verde, o en rojo si bajó).
- Así el cliente ve de un vistazo si la cuenta **viene creciendo**, no solo el número del mes.
- Aparece automáticamente cuando hay datos de dos meses para comparar (se empieza a ver a partir del segundo mes con la cuenta conectada).

## 2026-06-16 — Riesgo de cuentas: detectá churn antes de que pase

- 🛡️ **Nueva pestaña Coordinación → "Riesgo"**: ordena los clientes por **riesgo de irse**, cruzando señales reales — **cobros vencidos**, **producción atrasada** vs el pack, **caída de seguidores** y **cambios pedidos** del mes. Cada cuenta muestra sus señales concretas y un nivel (Alto / Medio / OK).
- La idea: actuar **antes** de perder al cliente, no enterarte cuando ya se fue.

## 2026-06-16 — Vista de agencia + aviso si se cae la conexión con Meta

- 📈 **Salud de la agencia, más completa**: ahora arriba muestra **MRR**, **ingreso promedio por cuenta (ARPA)**, **proyección anual**, costo de producción, margen real y cuentas a revisar — la foto de "cómo viene el negocio" de un vistazo.
- 🛡️ **Aviso automático si se cae Meta**: la app ahora chequea todos los días el token de Meta (el que hace andar Paid Media y Resultados). Si dejó de funcionar, le **faltan permisos** o está **por vencer**, te avisa por notificación y lo muestra con un cartel en la sección Paid Media. Antes, si se caía, te enterabas de casualidad.

## 2026-06-16 — Salud de la agencia: margen REAL por cliente

- 💰 **Nueva sección Finanzas → "Salud de la agencia"**: muestra el margen **real** de cada cliente = ingreso mensual contratado **menos el costo de producción**, calculado automáticamente con las **piezas publicadas del mes × tus tarifas internas** (CM por pack + diseño/edición por pieza + media buyer si tiene pauta).
- 🚦 Marca en rojo las cuentas que dan pérdida y en ámbar las de margen bajo (< 30%), para decisiones tipo "¿esta cuenta conviene?".
- 📅 Selector de mes para ver cualquier período cerrado.

## 2026-06-16 — Historias de Instagram en el reporte

- 🟣 **Las historias ahora también figuran en el reporte**: la app captura cada día las historias activas de Instagram (con su alcance y respuestas) y las va acumulando. En el reporte aparece la sección **"Historias publicadas"** con el total del mes, el alcance sumado, las respuestas y una grilla con las miniaturas.
- ⏱️ Como Instagram solo deja ver las historias de las últimas 24 hs, esto **acumula hacia adelante**: empieza a juntar historias desde ahora (las de antes no se pueden recuperar).

## 2026-06-16 — El reporte muestra todo el contenido publicado en Instagram

- 🖼️ **Nueva sección "Contenido publicado en Instagram"** en el reporte mensual: trae **automáticamente** todos los posteos, reels y carruseles que se subieron a Instagram en el mes, con miniatura, fecha, alcance y likes. Arriba muestra el conteo (ej: "8 reels · 5 posts · 2 carruseles").
- Se actualiza solo con el sync diario (o tocando "Actualizar ahora" en Resultados).
- ℹ️ Las **historias** todavía no entran (Instagram solo deja ver las activas de las últimas 24 hs); las sumamos más adelante con captura diaria.

## 2026-06-16 — Resultados en el portal + lectura del mes con IA

- 👀 **El cliente ve sus resultados en el portal**: nueva tarjeta "Resultados de este mes" en el portal del cliente con seguidores, alcance, interacciones y, si hay pauta, inversión, conversiones y clicks — todo en vivo, automático.
- 🧠 **Lectura del mes con IA**: en el reporte mensual hay un botón **"Lectura IA"** (equipo) que interpreta los números reales de Instagram + pauta y escribe un texto cálido para el cliente, conectando lo orgánico con lo pago. Se muestra en el reporte y también en el portal.
- La lectura es **on-demand** (la generás cuando querés) para no gastar tokens de más, y se puede **regenerar**.

## 2026-06-16 — Onboarding de publicidad: guía de accesos + system user

- 🔐 **El onboarding de publicidad ahora es una guía de accesos** ordenada en 3 bloques: **Accesos** (Facebook del cliente, página de FB, y pedirle que nos sume como **socio del Business con administración total**), **Asignar al system user** y **Pauta**.
- ✅ **Checklist de los 3 activos al system user** (resaltado en amarillo, es lo clave): **cuenta publicitaria**, **página de Facebook** y **cuenta de Instagram**. Sin estos 3 asignados al usuario del sistema "jdmedia", la app no puede traer la pauta ni los resultados de Instagram automáticamente. Cada paso te dice exactamente dónde tocar en Meta.
- 💡 Modelo recomendado: el **cliente es dueño** de sus activos y nos da acceso como **socio** (además de tu usuario admin). Más ordenado, escalable y prolijo el día que una cuenta entra o se va.

## 2026-06-16 — Resultados de Instagram (automáticos)

- 📊 **Nueva sección "Resultados"** en cada cliente con gestión de redes: muestra los resultados de Instagram que el cliente quiere ver — **seguidores** (con su crecimiento de los últimos 30 días), **alcance**, **visitas al perfil** e **interacciones** de los últimos 28 días, más las **publicaciones destacadas** del mes.
- 🔌 **Conexión en un click**: tocá "Detectar cuentas" y elegí la cuenta de Instagram del cliente (de las que maneja la agencia). También se puede pegar el ID a mano.
- 🔄 **Se actualizan solos cada día**: la app trae los datos de Instagram automáticamente. Igual tenés el botón **"Actualizar ahora"** para refrescar en el momento.
- 🧾 **Todo entra solo al Reporte mensual**: el reporte que le mandás al cliente ahora muestra los **Resultados de Instagram** (seguidores, alcance, interacciones, visitas) y la **Publicidad / Paid Media** (inversión, conversiones, impresiones, clicks, CTR) **automáticamente**, sin cargar nada a mano. Si un cliente no tiene la cuenta conectada, podés seguir cargando esos números manualmente como antes.
- ℹ️ Requisitos: la cuenta del cliente debe ser **Business/Creator** vinculada a una página de Facebook de la agencia, y el token de Meta tiene que tener los permisos de Instagram (lo configura el admin una sola vez).

## 2026-06-14 — Onboarding en 3 etapas (con responsables)

- 🧭 **Onboarding partido en 3 etapas**, cada una con su responsable y su propio progreso:
  - **1 · Inicial (Dirección):** carta acuerdo, cobro, equipo, grupo de WhatsApp, mensajes de bienvenida y el **documento guía del meet**. Acá termina la parte de Dirección.
  - **2 · Gestión de Redes (Coordinación):** la coordinadora del servicio toma la posta — conduce el meet de onboarding, carga accesos, crea el Drive, rediseña perfiles y deja la cuenta lista para producir.
  - **3 · Publicidad (Paid Media):** acceso directo al onboarding de pauta que lleva el media buyer.
- 📁 **Drive del cliente en el onboarding**: nuevo paso para crear la carpeta del cliente (con sus 3 subcarpetas: *Identidad visual · Calendario de contenidos · Contenido crudo*) y pegar el link. Ese link **aparece en el calendario de contenidos** para abrir el Drive con un click.
- 🔑 **Accesos del cliente**: cargá ahí mismo, dentro del onboarding, los accesos que pase el cliente (Instagram, TikTok, Facebook y lo que haga falta). Es la misma lista que figura en la ficha.
- 🎨 **Rediseño de perfiles y biografías**: paso nuevo para dejar registrado cuando ya se actualizaron foto, bio, links, portadas e historias destacadas.
- 📈 **Onboarding de Publicidad ↔ Paid Media**: el media buyer ahora carga el **ID de la cuenta publicitaria de Meta (act_XXXX)** desde el onboarding de pauta y queda conectada con la sección **Paid Media** (métricas y análisis diario). También arreglamos un error al entrar a esa sección.

## 2026-06-14 — Menú más ordenado + ficha del cliente renovada

- 🧭 **Menú más corto y ordenado**: agrupamos secciones que iban sueltas en secciones con **pestañas**:
  - **Equipo** ahora junta Directorio · Organigrama · Personas · Capacidad.
  - **Coordinación** junta Panel · Sueldos · Jornadas.
  - **Documentos** junta Documentos · Procesos · Templates · Agencia.
  - "Por área" pasó a llamarse **"Tareas por área"** y está junto a Tareas (es el tablero de tareas por área).
- 🪪 **Ficha del cliente renovada**: la barra de botones de arriba ya no se deforma, la info quedó ordenada en dos columnas (trabajo a la izquierda, datos y links a la derecha) y el **link del portal del cliente ahora es clickeable** (se abre solo en una pestaña nueva).

## 2026-06-13 — Vista tabla, organigrama y plan con historias

- 🗂️ **Calendario — nueva vista "Tabla"**: en **Contenidos** sumamos un botón **Tabla** (al lado de Mes / Kanban / Lista / Agenda) con la vista clásica tipo planilla: Fecha · Formato · Contenido · Desarrollo · Copy · Estado · Referencias · TikTok · Canva/Drive. Para las que prefieren leer el mes como lista ordenada por fecha. Se acuerda de la vista que elegiste.
- 🌳 **Organigrama**: nueva sección en el menú (**Equipo & clientes → Organigrama**) con la estructura de la agencia y quién está en cada área. Se actualiza solo.
- 📅 **Plan mensual ahora incluye historias**: al generar el plan de un cliente, la IA propone también los temas de **historias** del mes (según los días de stories del pack), no solo reels y posteos.

- 📝 **Instrucciones puntuales en el plan mensual**: antes de generar el plan de un cliente, ahora podés agregar una nota de *"¿Algo puntual a tener en cuenta este mes?"* (un lanzamiento, una fecha clave, un cambio de foco). La IA lo toma como prioridad máxima al armar el plan.
- 📣 **Onboarding de Publicidad por cliente**: en la ficha de los clientes con servicio de pauta aparece una sección **Publicidad** con el checklist de pasos para dejar la cuenta de anuncios lista (accesos de Facebook, administrador de Meta, Dólar App, tarjeta, campañas). Con barra de progreso, notas de campañas y las credenciales del cliente a mano ahí mismo.
- 💬 **Chat — ya podés iniciar mensajes directos**: arreglamos un problema que impedía a algunos integrantes arrancar un DM o crear un canal nuevo. Ahora todos pueden escribir primero.

## 2026-06-08 — Finanzas y coordinación

- 💰 **Sueldos (administración)**: nuevo módulo en Coordinación que arma la nómina del mes por persona en forma automática desde el modelo de tarifas, suma las comisiones de venta y permite registrar el pago (y copiar el mensaje de aviso para cada uno).
- 🧮 **Coordinación más completa**: el simulador ahora calcula la comisión de venta como % del pack, y sumamos un **cotizador de pack personalizado** — elegís posts / reels / historias y un margen objetivo y te sugiere el precio.
- 🧾 **Suscripciones y plataformas**: nueva sección en **Finanzas** para llevar el control de las herramientas que se pagan (Canva, IA, etc.): costo mensual, próxima renovación y botón **"Pagué"** que lo registra como gasto automáticamente.
- 📈 **Evolución financiera**: nueva vista en **Finanzas** con los últimos 12 meses (ingresos vs egresos y margen mes a mes) para ver la salud del negocio de un vistazo.

## 2026-05-27 — Templates de mensajes + más UX

- 📄 **Templates**: snippets reusables de texto. Crealos en `/templates` y usalos directo desde el chat interno con el botón 📄 al lado del clip. Soporta scope **propio** (solo vos) y **global** (toda la agencia).
- ✅ **Quick actions en la campana**: hover sobre una notif y aparece "Completar tarea" + "Marcar leída" — sin abrir la tarea.
- 📱 **Mobile mejorado en `/equipo/personas`**: cards apiladas en pantallas chicas. Los selects de puesto y compensación ya no se desbordan.
- 🤖 **Post-meet integrado**: el botón "Mensaje post-meet" ahora abre un workspace dentro de la app (no más GPT externo). Pegás transcripción, IA genera mensaje con voz JD Media, copiás y mandás.
- 🔔 **Notificaciones de DM funcionando**: arreglamos un bug de RLS que silenciaba los avisos en la campana cuando alguien te escribía por DM o te mencionaba en comentarios.
- 🎨 **Scrollbar del sidebar**: ya no se ve gris claro contra el fondo oscuro.

## 2026-05-26 — Bloque de mejoras y fixes

- ✨ **Comercial — Mensaje post-meet**: botón directo al GPT "JD Closer" en `/comercial` para generar el mensaje de follow-up listo después de cada primera reunión.
- 🔒 **Auditoría de roles**: cerramos fugas — `/comercial`, `/equipo/capacity` y `/clientes/[id]` ahora chequean rol/asignación en el servidor (antes solo en el menú).
- 🔑 **Accesos — Contraseñas visibles**: ahora podés ver y copiar la contraseña de cada usuario que crees desde el admin.
- 👥 **Nuevo usuario más simple**: al crear un usuario, los permisos por sección se asignan automáticamente según el rol elegido. Preview en el form.
- 💬 **Chat equipo**: cuando alguien te manda un DM, te llega notificación en la campana (antes solo si te mencionaba con @).
- 🎤 **JDmedIA con dictado**: agregamos botón de micrófono en `/jdmedia` para dictar mensajes por voz (igual que el flotante).
- 🛠 **JDmedIA con más poder**: ahora puede mover la fecha de una tarea, cambiar su prioridad y reasignarla.
- 🎨 **Chat equipo**: mensajes propios se distinguen visualmente con fondo de color.
- 🐛 **Tour**: el botón "Siguiente" ya no se sale del cuadro en mobile.
- 🔔 **Novedades**: el badge del sidebar desaparece al entrar a la sección.

## 2026-05-25 — Ayuda enriquecida + guías por rol

- 📘 Cada página de **Ayuda** suma sección **Preguntas frecuentes** y **Tips** con casos reales.
- 👥 Tres nuevas guías por rol: **Para CMs**, **Para Diseñadores**, **Para Audiovisual** con flujo del día típico.
- ❓ Botón `(?)` ahora visible en: Mi día, ficha de cliente, onboarding, diagnóstico, plan mensual, calendario, capacity, comercial, finanzas y agenda. Cada uno linkea directo a su guía.
- 🛡 El tour interactivo solo se auto-abre desde `/dashboard` — no interrumpe deep links.

## 2026-05-25 — Centro de ayuda + Tour interactivo

- 📖 Nueva sección **Ayuda** en el sidebar con guías cortas de cada herramienta. Buscador integrado, agrupadas por categoría.
- ✨ **Tour interactivo** para el primer login: recorre las pantallas clave según tu rol. Lo podés repetir desde Mi perfil cuando quieras.
- 📣 Esta página de **Novedades** donde vas a ver siempre qué cambió.

## 2026-05-25 — Pasada UX + acciones contextuales

- 💬 **Chat interno**: rediseño visual completo (sidebar, mensajes, composer). Más prolijo, más cómodo.
- 🤖 **JDmedIA** ahora ejecuta acciones contextuales: *"agregá un reel sobre X para Nico"*, *"mandalo a aprobación"*, *"pasá el plan al calendario"*.
- 🌅 **Mi día** suma una sección **Por cliente** con la próxima acción urgente de cada cliente que llevás.
- 📅 **Recordatorio fin de mes**: el día 25 te llega notificación in-app si faltan planes para el mes siguiente.
- 👥 **Equipo → Capacidad** para ver de un vistazo quién está sobrecargado y quién disponible.
- ✅ **Onboarding**: los pasos *Equipo asignado*, *Carta enviada*, *Tareas iniciales* y *Diagnóstico generado* ahora se auto-marcan desde los datos del sistema.
- 👍 **Feedback de IA**: botones 👍/👎 abajo del diagnóstico y plan aprobados.

## 2026-05-25 — Plan de contenido + Portal del cliente

- 📊 **Plan mensual** de contenido por cliente, generado con IA a partir del diagnóstico + pack + historial.
- 📋 **Aplicar plan al calendario**: cada tema se convierte en una publicación con copy/hashtags/guion auto-sugeridos.
- 🔗 **Portal del cliente**: link mágico sin login donde el cliente ve su plan y aprueba publicaciones desde el celular.
- 📈 Reporte mensual ahora incluye **cumplimiento del plan** (real vs planificado por pilar).

## 2026-05-25 — Diagnóstico inicial con IA

- 🧠 **Diagnóstico**: subís el PDF del meet de onboarding (Tactiq) y la IA arma un informe estratégico de 14 secciones.
- 📄 PDF para cliente con branding JD Media.
- 🎯 Botón "Convertir Plan de Acción a tareas" crea las tareas iniciales del cliente.
- 🤝 **Guía personalizada** del meet de onboarding: la IA arma una guía basada en lo ya conversado en el meet comercial.

---

> Sugerencia: cada vez que cambiamos algo relevante, lo escribimos acá arriba.
> Si querés ver los detalles de cada cosa, hay una página por feature en [Ayuda](/ayuda).
