-- FORMULARIO MEDICIONES INDIRECTAS: roles y visibilidad de reportes.
-- EJECUTAR en Supabase > SQL Editor con permisos de administrador.
-- Antes de ejecutar: crear en Authentication > Users la cuenta de Hazel.

-- Roles administrados por la cooperativa, no por los propios usuarios.
create table if not exists public.roles_usuarios (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('tecnico','hazel'))
);
alter table public.roles_usuarios enable row level security;
revoke all on table public.roles_usuarios from public, anon, authenticated;
grant select on table public.roles_usuarios to authenticated;
drop policy if exists "Leer mi propio rol" on public.roles_usuarios;
create policy "Leer mi propio rol"
  on public.roles_usuarios for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Cada reporte identifica al usuario que lo envió.
alter table public.reportes
  add column if not exists usuario_id uuid references auth.users(id);
alter table public.reportes add column if not exists pdf_ruta text;
alter table public.reportes add column if not exists pdf_estado text not null default 'pendiente';
alter table public.reportes enable row level security;
revoke all on table public.reportes from public, anon, authenticated;
grant select on table public.reportes to authenticated;
create index if not exists idx_reportes_usuario_id
  on public.reportes(usuario_id);

drop policy if exists "Leer reportes propios o Hazel" on public.reportes;
create policy "Leer reportes propios o Hazel"
  on public.reportes for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or exists (
      select 1 from public.roles_usuarios ru
      where ru.usuario_id = (select auth.uid()) and ru.rol = 'hazel'
    )
  );

-- Los archivos PDF nunca se hacen públicos. Los propietarios ven sus PDF;
-- Hazel puede consultar todos los PDF de este bucket.
drop policy if exists "Leer PDFs propios o Hazel" on storage.objects;
create policy "Leer PDFs propios o Hazel"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reportes-pdf'
    and (
      split_part(name,'/',1) = (select auth.uid())::text
      or exists (
        select 1 from public.roles_usuarios ru
        where ru.usuario_id = (select auth.uid()) and ru.rol = 'hazel'
      )
    )
  );

-- IMPORTANTE: A CONTINUACIÓN, en OTRA consulta SQL, asigne Hazel con:
-- insert into public.roles_usuarios (usuario_id,rol)
-- select id,'hazel' from auth.users
-- where lower(email)=lower('CORREO_REAL_DE_HAZEL')
-- on conflict (usuario_id) do update set rol=excluded.rol;
-- Si el correo no existe en auth.users, no se asignará ningún rol.
-- Los demás usuarios sin un rol explícito se consideran técnicos en el HTML.
-- IMPORTANTE: revisar que NO existan otras políticas SELECT permisivas sobre
-- public.reportes ni storage.objects para reportes-pdf.
