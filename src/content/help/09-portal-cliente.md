---
title: Portal del cliente
description: Link mágico sin login para que el cliente vea su plan y apruebe publicaciones.
category: Clientes
order: 24
roles: [all]
updated: 2026-05-25
---

El **portal del cliente** es un link público (sin contraseña) que le mandás al cliente para que pueda ver su plan del mes y aprobar las publicaciones desde el celular, sin tener que crear cuenta ni instalar nada.

## Generar el link

1. Ir a la ficha del cliente.
2. Sección **"Link del cliente"**.
3. Botón **Generar** → se crea un token único de 128 bits.
4. Copialo y mandáselo al cliente.

## Qué ve el cliente al abrirlo

Una página mobile-first con branding JD Media:

### Sección "Necesitamos tu mirada"
Arriba de todo, las publicaciones en estado `revision_cliente`. Cada una tiene 3 botones:
- ✅ **Aprobar** (verde)
- ⚠️ **Pedir cambios** (ámbar) + comentario
- 💬 **Comentar** sin cambiar estado

Cuando el cliente clickea, la publicación cambia de estado en la app y queda registrado quién lo aprobó + comentarios.

### Plan del mes
- Resumen del mes
- Cadencia consolidada (cuántas pubs por red)
- Pilares con barras de distribución
- Temas destacados numerados
- Campañas del mes

### Próximas pubs (8 semanas)
Vista calendario simplificada de lo que viene.

## Seguridad

- El token es único, de 128 bits, imposible de adivinar.
- Tiene **fecha de expiración** (se puede setear).
- **Revocable**: botón **Revocar** invalida el link al instante.
- **Regenerable**: el botón **Regenerar** crea un nuevo token y revoca el anterior.
- Se registra la **última visita** del cliente — así sabés si abrió o no.
- Rate limit de 30 acciones/min por token, para evitar abusos.

## Buenas prácticas

- **No mandes el link por WhatsApp público**. Mandalo por chat privado o por mail.
- **Regenerá el link** si sospechás que se filtró (cliente reenvió a alguien que no debía).
- Si el cliente perdió el link, regenerá uno nuevo en lugar de buscar el viejo.
