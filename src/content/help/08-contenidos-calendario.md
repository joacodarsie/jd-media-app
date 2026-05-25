---
title: Calendario de contenidos
description: Donde planificás y gestionás todas las publicaciones de los clientes.
category: Día a día
order: 11
roles: [all]
updated: 2026-05-25
---

`/contenidos` es el calendario maestro de todas las publicaciones de la agencia. Lo vas a usar todos los días.

## Vistas

- **Mes**: vista calendario tradicional, una card por publicación.
- **Lista**: tabla con filtros, ideal para procesar muchas pubs.
- **Kanban**: por estado (idea → en diseño → revisión → aprobado → publicado).

## Filtros

Cliente, red social, estado, responsable. Combinables.

## Estados de publicación

- `idea` — solo el concepto, sin nada producido.
- `en_diseno` / `guion` / `edicion` — en producción.
- `revision_creativa` — falta aprobación interna.
- `revision_cliente` — esperando OK del cliente (aparece en su [portal](/ayuda/portal-cliente)).
- `aprobado` — listo para programar.
- `publicado` — ya salió.
- `rechazado` — no va.

## Crear una publicación

Botón **Nueva publicación** en cualquier vista. Campos clave:
- Título (la idea/concepto)
- Cliente
- Red (Instagram, Facebook, TikTok, LinkedIn, YouTube)
- Tipo (post, reel, historia, carrusel, video)
- Fecha y hora de publicación
- Copy, hashtags, guion (los podés pedir a la IA con el botón ✨)

## IA: sugerir contenido

Dentro del editor de cualquier pub: botón **✨ Sugerir** abre un diálogo donde la IA propone copy, hashtags y guion considerando:
- El [diagnóstico](/ayuda/diagnostico) del cliente
- El [plan mensual](/ayuda/plan-mensual) vigente
- Lo que ya se publicó en los últimos 90 días (para NO repetir)

Aceptás todo, parte, o pedís otra versión con hints.

## Mandar al cliente para aprobación

Cambiá el estado a **revision_cliente**. La pub aparece automáticamente en el portal del cliente para que apruebe / pida cambios / comente.

## Trucos

- **Click + arrastrar** en la vista mensual para mover una publicación a otra fecha.
- **Auto-replicar** entre redes: cuando creás una pub con red "Instagram" y marcás Facebook/TikTok como réplica, se crean las copias.
- **Tareas vinculadas**: la pub puede generar tareas (diseño, edición). Las ves en su detalle.

## Preguntas frecuentes

**Creé una pub y no aparece en el calendario del mes.**
Probablemente no tiene `fecha_publicacion` cargada todavía. Las pubs sin fecha aparecen en vista Kanban o Lista, pero no en Mes. Asignale fecha desde el detalle de la pub.

**El cliente aprobó la pub pero sigue en "revisión cliente".**
Refrescá la página. Si persiste, verificá en el [portal del cliente](/ayuda/portal-cliente) que efectivamente haya apretado "Aprobar".

**¿Cómo veo solo lo que tengo que diseñar yo?**
Filtros → Responsable → tu nombre, Estado → `en_diseno`. Eso te deja solo lo que está esperando tu trabajo de diseño.

## Páginas relacionadas

- [Plan mensual](/ayuda/plan-mensual) — los temas que aplicás vienen de acá.
- [Portal del cliente](/ayuda/portal-cliente) — donde el cliente ve y aprueba.
- [JDmedIA](/ayuda/jdmedia-ia) — "agregá un reel sobre X para Y" o "marcá como publicada".
