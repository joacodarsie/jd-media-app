---
title: Plan mensual
description: Plan de contenido operativo que se monta sobre el diagnóstico estratégico.
category: Clientes
order: 23
roles: [all]
updated: 2026-05-25
---

El **plan mensual** es la capa operativa: qué contenido vamos a publicar este mes, en qué redes, qué temas destacados, qué campañas. Cambia mes a mes, mientras que el [diagnóstico](/ayuda/diagnostico) es más estable.

## Cuándo se genera

Idealmente entre el **día 25 y el 31** del mes anterior. Al día 25 te llega un recordatorio automático si quedan clientes sin plan para el mes siguiente.

## Cómo se genera

1. Ir a `/clientes/[id]/plan-mensual`.
2. Opcionalmente: pegar texto o PDF del meet con cliente (lluvia de ideas, campañas, fechas clave).
3. Apretar **Generar plan**.
4. La IA arma el plan en ~30 segundos, considerando:
   - Diagnóstico aprobado del cliente
   - Pack contratado (cantidad de pubs/mes)
   - Historial de los últimos 60 días (para no repetir temas)
   - Publicaciones ya planificadas para el mes
   - Redes sociales activas del cliente

## Estructura del plan

- **Resumen del mes** — qué buscamos lograr.
- **Mix por red** — Instagram principal, Facebook/TikTok réplica, LinkedIn on-demand.
- **Distribución de pilares** — % de contenido por pilar con justificación.
- **Temas destacados** — los temas concretos del mes con red principal + redes réplica.
- **Campañas** — si hay lanzamientos, fechas clave, eventos.
- **Reglas operativas** + **KPIs objetivo** — colapsados, no van al PDF del cliente.

## Aplicar al calendario

Cada tema tiene 3 acciones:

- **Aplicar al calendario**: crea la publicación en `/contenidos` con copy/hashtags/guion auto-sugeridos.
- **Reemplazar**: si un tema no convence, lo regenerás con un hint (ej: "que sea más emocional").
- **Aplicar todos**: aplica todos los temas restantes de una.

También podés pedírselo a JDmedIA: *"pasá el plan de Nico al calendario"*.

## Estados

- **Draft** → todavía no aprobado.
- **Active** → versión vigente del mes.
- **Archived** → versiones viejas.

## Cumplimiento

Al final del mes, el reporte mensual del cliente muestra **plan vs real** por pilar con diferencias en pp. Ahí se ve si cumplimos lo que prometimos.

## PDF para el cliente

Botón **Ver PDF** → versión sin reglas operativas ni KPIs, lista para compartir.
