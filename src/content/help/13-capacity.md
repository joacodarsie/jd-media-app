---
title: Capacidad del equipo
description: Quién está sobrecargado, quién disponible, para asignar trabajo nuevo.
category: Operación
order: 31
roles: [admin, coordinador]
updated: 2026-05-25
---

`/equipo/capacity` muestra de un vistazo cuánto tiene en el plato cada persona. Sirve para:

- Detectar quién está al borde del burnout.
- Decidir a quién asignar trabajo nuevo.
- Tener data concreta para hablar 1:1.

## Qué mide

Por cada persona activa:

- **Activas**: tareas que tiene asignadas y no completadas.
- **Vencidas**: las activas que tienen fecha límite pasada.
- **7 días**: las que vencen en la próxima semana.
- **Pubs**: publicaciones en pipeline (donde es audiovisual o creador).

## Cómo se calcula la "Carga %"

Heurística simple: `activas + pubs × 0.5 + vencidas × 2`, normalizado a 10 unidades = 100%.

- 🟢 **Verde** (<50%) → tranqui, puede tomar más.
- 🟡 **Amarillo** (50-80%) → ocupado pero ok.
- 🔴 **Rojo** (>80%) → sobrecargado, no le tires más.

> Es una **aproximación**, no un reemplazo del juicio. Si la persona te dice que está al palo aunque marque verde, creele.

## Cards de resumen

- **Sobrecargadas/os**: ≥80% de carga o ≥2 vencidas.
- **Disponibles**: ≤30% de carga y 0 vencidas.

## Buenas prácticas

- **Mirá esto antes de asignar trabajo importante**, no después.
- **Si alguien está rojo varias semanas seguidas**: hay que hablar (más recursos, redistribuir, decir que no a clientes nuevos).
- **Disponibles ≠ inactivos**. A veces hay capacidad porque está esperando algo bloqueado.
