-- Kraków Pocket · sincronización cooperativa Ismael + Laura
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.krakow_adventures (
  code text primary key,
  secret_hash text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.krakow_adventures enable row level security;

-- No damos acceso directo a la tabla desde el navegador.
revoke all on table public.krakow_adventures from anon, authenticated;

create or replace function public.adventure_create(
  p_code text,
  p_secret text,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  clean_code text := upper(trim(p_code));
begin
  if length(clean_code) < 8 or length(p_secret) < 8 then
    raise exception 'El código y el secreto deben tener al menos 8 caracteres';
  end if;

  insert into public.krakow_adventures(code, secret_hash, state)
  values (clean_code, encode(digest(p_secret, 'sha256'),'hex'), coalesce(p_state,'{}'::jsonb));

  return p_state;
exception
  when unique_violation then
    raise exception 'Ese código ya existe';
end;
$$;

create or replace function public.adventure_get(
  p_code text,
  p_secret text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.krakow_adventures%rowtype;
begin
  select * into r
  from public.krakow_adventures
  where code = upper(trim(p_code));

  if not found or r.secret_hash <> encode(digest(p_secret,'sha256'),'hex') then
    raise exception 'Código o secreto incorrectos';
  end if;

  return r.state;
end;
$$;

create or replace function public.adventure_put(
  p_code text,
  p_secret text,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  select exists(
    select 1 from public.krakow_adventures
    where code = upper(trim(p_code))
      and secret_hash = encode(digest(p_secret,'sha256'),'hex')
  ) into ok;

  if not ok then
    raise exception 'Código o secreto incorrectos';
  end if;

  update public.krakow_adventures
  set state = coalesce(p_state,'{}'::jsonb),
      updated_at = now()
  where code = upper(trim(p_code));

  return p_state;
end;
$$;

revoke all on function public.adventure_create(text,text,jsonb) from public;
revoke all on function public.adventure_get(text,text) from public;
revoke all on function public.adventure_put(text,text,jsonb) from public;

grant execute on function public.adventure_create(text,text,jsonb) to anon, authenticated;
grant execute on function public.adventure_get(text,text) to anon, authenticated;
grant execute on function public.adventure_put(text,text,jsonb) to anon, authenticated;
