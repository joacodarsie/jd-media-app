-- Rol "diseno" (Diseño): hasta ahora no existía un rol propio para diseño y la
-- diseñadora figuraba con rol community_manager aunque su área es Diseño. Esto
-- la mostraba mal en los lugares que rotulan por rol (sidebar, sueldos, etc.).
-- Agregamos el valor al enum. Después se actualiza el rol de la persona.
--
-- Nota: ALTER TYPE ... ADD VALUE no puede correr dentro de una transacción junto
-- con un uso del valor nuevo; por eso esta migración SOLO agrega el valor. El
-- update del usuario se hace aparte.

alter type public.user_role add value if not exists 'diseno';
