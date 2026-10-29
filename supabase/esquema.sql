-- Esquema de Supabase para el Cofre de la Compañía. Pégalo entero en el SQL Editor del proyecto y ejecútalo.
-- Cada party es una fila con todo el estado en JSON; `version` sirve para no pisar cambios simultáneos
-- (la app actualiza con «where version = N» y, si falla, descarga y reaplica; ver src/store/sincro.ts).

create table if not exists public.parties (
  id text primary key,                 -- el código de la party (ABC123)
  estado jsonb not null,
  version bigint not null default 1,
  actualizado timestamptz not null default now(),
  creado timestamptz not null default now()
);

-- Sin cuentas (DECISIONES.md §2): cualquiera con la clave pública puede leer, crear y actualizar parties,
-- pero no borrarlas. El código de la party hace de contraseña: no lo publiques.
alter table public.parties enable row level security;

drop policy if exists "leer parties" on public.parties;
drop policy if exists "crear parties" on public.parties;
drop policy if exists "actualizar parties" on public.parties;
create policy "leer parties" on public.parties for select to anon using (true);
create policy "crear parties" on public.parties for insert to anon with check (true);
create policy "actualizar parties" on public.parties for update to anon using (true) with check (true);

-- Tiempo real: avisa a los demás jugadores de que hay versión nueva
do $$ begin
  alter publication supabase_realtime add table public.parties;
exception when duplicate_object then null;
end $$;

-- Imágenes de personajes y objetos (públicas para poder mostrarlas)
insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do nothing;

drop policy if exists "subir imagenes" on storage.objects;
drop policy if exists "ver imagenes" on storage.objects;
create policy "subir imagenes" on storage.objects for insert to anon with check (bucket_id = 'imagenes');
create policy "ver imagenes" on storage.objects for select to anon using (bucket_id = 'imagenes');
