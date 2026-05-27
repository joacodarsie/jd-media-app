---
title: Novedades
---

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
