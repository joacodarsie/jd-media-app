---
title: JDmedIA (chat con IA)
description: Tu asistente con IA que conoce todo el contexto de la agencia.
category: Día a día
order: 12
roles: [all]
updated: 2026-05-25
---

**JDmedIA** es el chat con IA de la app (en `/jdmedia`, o el ✨ flotante abajo a la derecha). No es un chatbot genérico — tiene acceso a los datos reales de la agencia y puede ejecutar acciones.

## Qué le podés preguntar

### Consultas
- "¿Qué tareas tiene Luz pendientes?"
- "¿Cuántos leads están en propuesta?"
- "Resumime cómo viene la semana"
- "¿Qué publicaciones salen mañana?"
- "¿Cómo viene el mes financieramente?"

### Acciones que ejecuta sola
- **"Creá una tarea: revisar moodboard Nico, asigná a Bri, vence el viernes"** → crea la tarea.
- **"Cambiá el estado de la tarea X a completada"** → la marca.
- **"Agregá un reel sobre 'detrás de cámara' para Nico"** → crea la publicación en estado idea.
- **"Pasá el plan de Nico al calendario"** → aplica todos los temas del plan activo.
- **"Mandalo a aprobación del cliente"** → cambia el estado a revision_cliente.
- **"Marcala como publicada"**.

### Contexto del cliente
- "Resumime quién es Nico Liberto y qué pilares tiene"
- "Qué le toca hacer al equipo con Boxescar esta semana"

## Cómo funciona

JDmedIA tiene **tools** disponibles que puede invocar:
- Lista de tareas, clientes, usuarios, publicaciones, leads
- Crear y actualizar tareas
- Crear y mover publicaciones
- Aplicar planes al calendario
- Resúmenes de tu día
- Detectar sobrecarga del equipo
- Contexto completo de marca de un cliente (diagnóstico + plan)
- Resumen financiero del mes

## Dos chats distintos

- **✨ Flotante** (abajo derecha): efímero, para preguntas rápidas. Se borra al cerrar.
- **/jdmedia** (full-page): conversaciones largas, persistentes, con historial.

## Buenas prácticas

- **Sé específico**: "tarea para Bri que vence viernes" es mejor que "una tarea para alguien".
- **Confirmá las acciones**: JDmedIA hace lo que pedís — releé antes de ejecutar.
- **Si una respuesta es mala**: avisanos en el chat interno. Estamos ajustando los prompts.

## Lo que no hace (todavía)

- No manda mails ni mensajes de WhatsApp.
- No paga ni cobra.
- No edita el diagnóstico ni el plan mensual (esos van por su flujo).

## Tips

> **Hablale en castellano natural.** No hace falta sintaxis especial: "armame una tarea para Bri" funciona igual que "create task assigned to Bri".

> **Si la respuesta es lenta es porque está haciendo varias queries.** Las acciones que tocan muchos datos (resumen del día, finanzas del mes) pueden tardar 10-15 seg. Es normal.

> **Te confirma antes de ejecutar acciones que cambian datos.** Si pedís "borrá la tarea X", primero te muestra qué va a hacer. Releé antes de confirmar.

## Preguntas frecuentes

**Le pedí algo y me respondió texto en vez de hacerlo.**
A veces decide que falta info. Ejemplo: si pedís "creá una tarea" sin título, te pregunta cuál. Respondé con el dato y va a continuar.

**No encuentra a un usuario que sé que existe.**
Probá con el nombre exacto o un nombre parcial más corto. Ejemplo: "Luz" en vez de "Luz Maria". Está usando ILIKE %nombre%.

**Lo cerré sin querer en /jdmedia y perdí la conversación.**
No la perdiste — las conversaciones quedan guardadas en el sidebar izquierdo. Las podés retomar cuando quieras.

## Páginas relacionadas

- [Tareas](/ayuda/tareas) — todo lo que la IA puede crear/modificar en tareas.
- [Calendario de contenidos](/ayuda/contenidos-calendario) — cómo aplica el plan al calendario.
