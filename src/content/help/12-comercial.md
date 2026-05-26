---
title: Comercial / Leads
description: Pipeline de ventas — desde lead nuevo hasta cliente firmado.
category: Operación
order: 30
roles: [admin, coordinador, comercial, prospecting]
updated: 2026-05-26
---

`/comercial` es el pipeline comercial. Acá vivís el día a día de prospección y cierre.

## Stages del pipeline

1. **Nuevo** — recién entró el lead, sin contactar.
2. **Contactado** — primer contacto hecho.
3. **Calificado** — el lead tiene presupuesto/encaja con lo que ofrecemos.
4. **Propuesta** — le mandamos propuesta formal.
5. **Negociación** — discutiendo precio/scope.
6. **Ganado** ✅ — firmó. Se convierte en cliente.
7. **Perdido** ❌ — no se concretó. Registrá el motivo.

## Crear un lead

Botón **Nuevo lead** o sumar desde un formulario externo (próximamente integrado).

Campos clave:
- Nombre + empresa
- Email + teléfono
- Servicio que pide
- Monto estimado + moneda
- Próxima acción + fecha de próxima acción
- Asignado a (comercial/prospecting)

## Mover entre stages

Drag & drop en la vista kanban, o desde el detalle del lead.

## Convertir a cliente

Cuando ganás un lead: botón **"Convertir a cliente"** en el detalle. Crea el cliente con los datos básicos y queda listo para arrancar el [onboarding](/ayuda/onboarding).

## Próxima acción

Cada lead debería tener **próxima acción + fecha**. Si la fecha venció, aparece como "atrasado" en tu dashboard de comercial.

## Buenas prácticas

- **No dejes leads sin próxima acción**. Si no sabés qué hacer, programá un follow-up de 7 días.
- **Loguea cada contacto** en los comentarios del lead.
- **Cerrá los perdidos**: si el lead te dijo que no, registralo como perdido + motivo. No los dejes en limbo.

## Mensaje post-meet (workspace IA integrado)

Después de cada **primera reunión** con un posible cliente, usá el workspace **"Mensaje post-meet"** para generar el follow-up listo para enviar.

- Botón **"Mensaje post-meet"** arriba a la derecha en `/comercial`, o link directo: `/comercial/post-meet`
- Pegá **la transcripción** de la meet (Google Meet → "Notas de IA" o Otter) o tu **resumen escrito** con los puntos clave y dolores que detectaste
- Opcional: nombre del contacto para que el mensaje sea más personalizado
- Tocá **"Generar mensaje"** y la IA devuelve el mensaje listo, con el tono y el contexto de JD Media
- Botón de **copiar** para pegar directo al WhatsApp del cliente

La IA usa un system prompt entrenado con la voz de JD Media: recap, refleja objetivos, propone próximo paso, sin emojis ni formalismos pesados.

Después actualizá el lead: mové a **Contactado** o **Propuesta** según corresponda, y dejale los **comentarios** con los puntos que salieron en la meet.
