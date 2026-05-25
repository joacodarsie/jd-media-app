---
title: Diagnóstico inicial
description: Informe estratégico del cliente generado con IA a partir del meet de onboarding.
category: Clientes
order: 22
roles: [all]
updated: 2026-05-25
---

El **diagnóstico** es el documento estratégico de cada cliente: quiénes son, qué los hace únicos, a quién le hablan, qué pilares de contenido tienen sentido. Es la base que después usa el Plan mensual y JDmedIA para razonar sobre el cliente.

## Cuándo se genera

Después del **meet de onboarding** con el cliente. Idealmente al día siguiente, mientras está fresco.

## Cómo se genera

1. Ir a `/clientes/[id]/diagnostico`.
2. Subir el **PDF de la transcripción del meet** (lo bajás de Tactiq, la extensión de Chrome que graba Google Meet).
3. Apretar **Generar**.
4. La IA arma el informe en ~30-60 segundos, streaming en vivo.

## Estructura del diagnóstico

14 secciones:

1. Resumen ejecutivo
2. Contexto del cliente
3. Público objetivo (buyer persona)
4. Marca (esencia, propósito, personalidad)
5. Diferenciales
6. Pilares de contenido
7. Análisis del mercado/competencia
8. Análisis de redes actuales
9. Objetivos
10. Estrategia general
11. Plan de acción inicial
12. KPIs
13. Tono de comunicación
14. Riesgos y consideraciones

## Edición por bloques

Cada sección es editable. La IA es buena pero no perfecta — leelo entero y ajustá lo que esté flojo antes de aprobarlo.

## Estados

- **Draft**: borrador, editable libremente.
- **Approved**: aprobado, queda como la versión vigente. Se puede generar una v2, v3, etc cuando cambia algo de fondo (rebrand, nuevo objetivo).

## Después de aprobar

- Se desbloquea el botón **"Convertir Plan de Acción a tareas"** que crea tareas reales del cliente para arrancar.
- Se auto-marca el step "Diagnóstico generado" en el onboarding.
- JDmedIA empieza a usar el diagnóstico como contexto en cualquier conversación sobre el cliente.

## PDF para el cliente

Botón **Ver PDF** abre la versión print-friendly con branding JD Media (`/diagnostico/cliente/[id]`). Listo para mandar al cliente.

## Feedback de la IA

Abajo del diagnóstico aprobado tenés los botones 👍 / 👎. Si la salida fue floja, votá negativo + comentá qué falló. Esa data la usamos para ajustar los prompts.

## Tips

> **Editá antes de aprobar.** El diagnóstico generado es un buen primer borrador, no la versión final. Tomate 15-30 min para leerlo entero y ajustar lo que esté flojo. Eso te ahorra trabajo después.

> **Más contexto, mejor output.** Si en el PDF del meet hay solo 10 minutos transcriptos, la IA va a inventar mucho. Conviene meetings de 45+ minutos, con preguntas abiertas.

## Preguntas frecuentes

**El diagnóstico tiene errores fácticos sobre el cliente.**
Es esperable cuando el meet fue corto. Editá las secciones afectadas a mano y aprobá la v1 con los datos corregidos. La próxima versión partirá de esa base.

**¿Cuándo genero una v2?**
Cuando cambia algo de fondo del cliente: rebrand, nuevo público objetivo, nuevo servicio principal. El diagnóstico no se actualiza mes a mes — para eso está el [plan mensual](/ayuda/plan-mensual).

**Subí el PDF y no arrancó la generación.**
Refrescá la página y reintentá. Si persiste: avisá en `#general` con el nombre del cliente.

## Páginas relacionadas

- [Onboarding](/ayuda/onboarding) — el paso anterior (meet de onboarding).
- [Plan mensual](/ayuda/plan-mensual) — la capa operativa que se apoya en este.
- [JDmedIA](/ayuda/jdmedia-ia) — el asistente usa este diagnóstico como contexto del cliente.
