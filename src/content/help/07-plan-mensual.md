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

## Tips

> **Generá entre el 25 y el 31 del mes anterior.** Si esperás al día 1 ya estás atrasado. Si lo hacés a mitad del mes anterior, te falta data fresca.

> **Si un tema no convence, regeneralo con hint específico.** "Que sea más emocional", "que apunte a otra etapa del funnel", "que sea más corto". La IA mejora con instrucciones concretas.

> **El periodo_label tiene que incluir el mes + año.** Ej: "Junio 2026". Si lo escribís raro ("Q2", "el del cumple"), el sistema no detecta que es el plan de junio y el recordatorio del día 25 te va a notificar igual.

## Preguntas frecuentes

**Apliqué todos los temas al calendario y quedaron sin fecha.**
Las publicaciones se crean en estado `idea` y sin fecha. Las distribuís manualmente en el [calendario](/ayuda/contenidos-calendario) según la cadencia que tenga sentido para el cliente.

**Generé el plan pero no se ve en JDmedIA.**
Tiene que estar en estado `active`, no `draft`. Aprobalo desde el botón "Aprobar plan" en la cabecera.

**Quiero un plan para una campaña específica, no para todo el mes.**
Usá `periodo_label` con el nombre de la campaña (ej: "Lanzamiento álbum — septiembre 2026"). Sigue funcionando como plan vigente.

## Páginas relacionadas

- [Diagnóstico inicial](/ayuda/diagnostico) — la capa estratégica que da contexto.
- [Calendario de contenidos](/ayuda/contenidos-calendario) — donde aplicás los temas.
- [Portal del cliente](/ayuda/portal-cliente) — el cliente ve este plan en su link mágico.
