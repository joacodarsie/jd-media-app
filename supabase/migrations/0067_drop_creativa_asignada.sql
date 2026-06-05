-- Eliminación del puesto "Creativa" (modelo viejo).
--
-- NO-OP a propósito. Originalmente esta migration iba a dropear la columna
-- clients.creativa_asignada_id, pero ~16 políticas RLS (tasks, clients,
-- client_services, client_onboarding, client_diagnostics, client_content_plans,
-- client_portal_tokens, director_reports) la referencian dentro de su lógica de
-- acceso. Dropearla exigiría reescribir todas esas policies, lo cual es
-- riesgoso en producción (un error deja gente sin acceso o expone datos).
--
-- Decisión: dejamos la columna. El dato ya se migró a cm_id y la columna quedó
-- 100% nula, así que las condiciones `creativa_asignada_id = auth.uid()` de las
-- policies dan siempre falso y el acceso se resuelve por cm_id/disenador_id/
-- audiovisual_id, que siguen presentes. El puesto "Creativa" ya no existe en la
-- UI ni en el código de la app.
--
-- Los enum values 'creativa' (user_role) y 'Creativas' (área) también quedan en
-- Postgres (no se pueden eliminar de forma segura) pero sin uso.

-- (sin cambios de esquema)
select 1;
