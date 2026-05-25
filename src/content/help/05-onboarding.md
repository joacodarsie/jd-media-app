---
title: Onboarding del cliente
description: Checklist guiado para dar de alta un cliente nuevo.
category: Clientes
order: 21
roles: [all]
updated: 2026-05-25
---

Cuando entra un cliente nuevo, el flujo entero pasa por la sección **Onboarding** de su ficha (`/clientes/[id]/onboarding`).

## Las 3 capas del onboarding

### 1. Guía personalizada del meet de onboarding
Subí el PDF del meet comercial previo (transcripción de Tactiq) o pegá el texto. La IA arma una guía para el meet de onboarding adaptada al cliente: salta preguntas ya respondidas (✅), profundiza gaps (⚠️) y agrega preguntas específicas (💡).

### 2. Datos del contrato
Completá nombre del contacto, DNI/CUIT, fecha de inicio, plazo, día de cobro, descuentos. **Después de tener esto cargado, generás el PDF de la carta acuerdo** (botón "Ver carta acuerdo").

### 3. Checklist de 8 pasos
Los pasos del proceso operativo, con acciones contextuales en cada uno:

1. **Carta acuerdo + cobro enviados** — descargás el PDF y el mensaje de cobro con proporcional autocalculado.
2. **Pago recibido** — confirmá el ingreso antes de seguir.
3. **Equipo asignado** ✨ se auto-marca cuando asignás CM, diseñador o audiovisual.
4. **Grupo de WhatsApp creado**.
5. **Mensajes de bienvenida enviados** — generá la cadena adaptada a los servicios.
6. **Diagnóstico inicial generado** ✨ se auto-marca al aprobar el diagnóstico v1.
7. **Tareas iniciales creadas** ✨ se auto-marca cuando hay tareas vinculadas al cliente.
8. **Reunión kickoff agendada** — link para crear el evento en Calendar.

> Los pasos con badge **Auto** se completan solos a partir de los datos reales del sistema.

## Flujo típico (orden recomendado)

1. Carta acuerdo + cobro → pago → equipo asignado.
2. Grupo de WhatsApp → mensajes de bienvenida.
3. Meet de onboarding (usando la guía personalizada).
4. **Subí el PDF del meet** a la sección Diagnóstico → la IA arma el informe.
5. Aprobás el diagnóstico → desde ahí podés "Convertir Plan de Acción a tareas".
6. Generás el Plan mensual.
7. Calendario de contenidos del primer mes.

Si seguís este flujo en orden, el cliente queda **operando en menos de una semana**.

## Tips

> **No te saltees el "Pago recibido".** Es el único paso que no se auto-marca y es el que separa "cliente que firmó pero no pagó" de "cliente activo". Si avanzás sin esto, te estás comiendo el riesgo.

> **El badge "Auto"** significa que el sistema ya detectó que el paso está hecho a partir de datos reales (ej: hay tareas creadas → "Tareas iniciales" se marca solo). No vas a poder destildarlo manualmente.

## Preguntas frecuentes

**Subí el PDF del meet pero la guía no se generó.**
Verificá que el PDF tenga texto (Tactiq exporta texto). Si es solo imágenes, el sistema no puede leerlo. Probá pegar el texto a mano.

**¿Puedo cambiar los servicios después de generar la carta acuerdo?**
Sí, pero vas a tener que regenerar el PDF de la carta acuerdo. El monto mensual y el cronograma cambian.

**Falta data del contrato y no me deja generar la carta.**
La app muestra un warning ámbar con qué falta exactamente: nombre del contacto, DNI/CUIT, fecha de inicio o plazo. Completá esos campos en "Datos del contrato" y reintentá.

## Páginas relacionadas

- [Diagnóstico inicial](/ayuda/diagnostico) — el próximo paso después de los meets.
- [Plan mensual](/ayuda/plan-mensual) — qué generar después del diagnóstico.
- [Ficha del cliente](/ayuda/clientes-ficha) — datos generales del cliente.
