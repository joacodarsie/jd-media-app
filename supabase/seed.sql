-- =====================================================================
-- JD Media · Datos de prueba (seed)
-- Ejecutar TERCERO, después de 0001_init.sql y 0002_rls.sql
--
-- Crea los 11 usuarios reales del equipo con login real.
-- Contraseña inicial para TODOS:  jdmedia2026
-- (cambiala desde Supabase > Authentication apenas puedas)
-- Emails: nombre@jdmedia.com
-- =====================================================================

-- ---------- 1) Usuarios de Auth (el perfil se crea solo por trigger) ----------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, crypt('jdmedia2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre', u.nombre, 'rol', u.rol, 'area', u.area),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid,'Joaquín Darsie','joaquin@jdmedia.com','admin','Estrategia/Dirección'),
  ('00000000-0000-0000-0000-000000000002'::uuid,'Brisa Tejada','brisa@jdmedia.com','coordinador','Coordinación'),
  ('00000000-0000-0000-0000-000000000003'::uuid,'Guillermo García','guille@jdmedia.com','paid_media','Paid Media'),
  ('00000000-0000-0000-0000-000000000004'::uuid,'Sol Britos','sol@jdmedia.com','prospecting','Prospecting'),
  ('00000000-0000-0000-0000-000000000005'::uuid,'Gonzalo Díaz Perrín','gonzalo@jdmedia.com','comercial','Comercial'),
  ('00000000-0000-0000-0000-000000000006'::uuid,'Luz Torres','luz@jdmedia.com','creativa','Creativas'),
  ('00000000-0000-0000-0000-000000000007'::uuid,'Belén Gastardelli','belen@jdmedia.com','community_manager','Community Manager'),
  ('00000000-0000-0000-0000-000000000008'::uuid,'Franco Calderón','franco@jdmedia.com','audiovisual','Edición Audiovisual'),
  ('00000000-0000-0000-0000-000000000009'::uuid,'Germán Simian','german@jdmedia.com','web','Desarrollo Web'),
  ('00000000-0000-0000-0000-000000000010'::uuid,'Valentín','valentin@jdmedia.com','web','Desarrollo Web'),
  ('00000000-0000-0000-0000-000000000011'::uuid,'Tomás Garbellotto','garbe@jdmedia.com','botly','Botly')
) as u(id, nombre, email, rol, area)
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider,
   last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@jdmedia.com'
on conflict do nothing;

-- ---------- 2) Clientes (cuentas repartidas entre Luz y Belén) ----------
insert into public.clients (id, nombre, rubro, pack, creativa_asignada_id, estado, fecha_inicio, monto_mensual)
values
  ('10000000-0000-0000-0000-000000000001','Desafío Ansenuza','Turismo / Eventos','Crecimiento','00000000-0000-0000-0000-000000000006','activo','2025-01-10',180000),
  ('10000000-0000-0000-0000-000000000002','Dr Humberto','Salud','Presencia','00000000-0000-0000-0000-000000000007','activo','2025-03-01',95000),
  ('10000000-0000-0000-0000-000000000003','Boxescar','Automotor','Escala','00000000-0000-0000-0000-000000000006','activo','2024-09-15',320000),
  ('10000000-0000-0000-0000-000000000004','La Azotea','Gastronomía','Crecimiento','00000000-0000-0000-0000-000000000007','activo','2025-02-20',175000),
  ('10000000-0000-0000-0000-000000000005','Seba Gramigna','Marca personal','Presencia','00000000-0000-0000-0000-000000000006','at_risk','2025-04-05',90000),
  ('10000000-0000-0000-0000-000000000006','La tiendita de Paula','Retail','Presencia','00000000-0000-0000-0000-000000000007','activo','2025-05-01',88000),
  ('10000000-0000-0000-0000-000000000007','Meb Studio','Arquitectura','Crecimiento','00000000-0000-0000-0000-000000000006','activo','2024-11-11',165000),
  ('10000000-0000-0000-0000-000000000008','VA Uniformes','Indumentaria','Escala','00000000-0000-0000-0000-000000000007','activo','2024-08-01',300000),
  ('10000000-0000-0000-0000-000000000009','Turismo Explora','Turismo','Crecimiento','00000000-0000-0000-0000-000000000006','activo','2025-03-18',190000),
  ('10000000-0000-0000-0000-000000000010','Sierravista','Inmobiliaria','Presencia','00000000-0000-0000-0000-000000000007','activo','2025-04-22',100000)
on conflict (id) do nothing;

-- ---------- 3) Tareas de ejemplo (fechas relativas a hoy) ----------
insert into public.tasks
  (titulo, descripcion, asignado_a_id, creado_por_id, cliente_id, area, prioridad, estado, fecha_limite)
values
  ('Calendario de contenido junio - Desafío Ansenuza','Armar grilla mensual de **12 posteos** + 8 historias.','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Creativas','alta','en_progreso', current_date + 3),
  ('Reels semana - Dr Humberto','Guion + edición de 3 reels educativos.','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Creativas','media','pendiente', current_date + 1),
  ('Edición video institucional - Boxescar','Editar el material de la sesión y entregar máster + cortes para redes.','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Edición Audiovisual','alta','en_progreso', current_date + 2),
  ('Optimizar campaña conversiones - Boxescar','Revisar públicos y bajar CPA. Está por encima del objetivo.','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Paid Media','urgente','en_progreso', current_date - 1),
  ('Sesión de fotos - La Azotea','Coordinar producción de fotos de los nuevos platos.','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','Edición Audiovisual','alta','pendiente', current_date + 5),
  ('Reunión de retención - Seba Gramigna','Cliente en riesgo. Preparar propuesta de mejora.','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','Comercial','urgente','pendiente', current_date),
  ('Setup catálogo Instagram - La tiendita de Paula','Cargar productos y conectar el catálogo.','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006','Creativas','media','en_revision', current_date + 2),
  ('Render 3D para campaña - Meb Studio','Pieza destacada para lanzamiento.','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000007','Diseño','alta','bloqueada', current_date + 4),
  ('Landing nueva colección - VA Uniformes','Desarrollar landing con formulario de pedido mayorista.','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000008','Desarrollo Web','alta','en_progreso', current_date + 7),
  ('Bot de reservas - Turismo Explora','Flujo de WhatsApp para consultas de paquetes.','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000009','Botly','media','pendiente', current_date + 6),
  ('Prospección inmobiliarias Córdoba','Armar lista de 30 leads para Sierravista.','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','Prospecting','media','en_progreso', current_date + 2),
  ('Informe mensual de resultados - Boxescar','Consolidar métricas de abril y armar PDF.','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Creativas','media','completada', current_date - 4),
  ('Propuesta comercial pack Escala','Actualizar pricing y armar one-pager de ventas.','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',null,'Comercial','alta','en_progreso', current_date + 1),
  ('Migrar sitio a Next.js - Meb Studio','Pasar el sitio actual a Next + mejorar performance.','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','Desarrollo Web','media','pendiente', current_date + 14),
  ('Onboarding nuevo cliente - checklist','Definir checklist estándar de alta de cuentas.','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',null,'Coordinación','media','pendiente', current_date + 8);
