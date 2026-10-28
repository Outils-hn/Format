-- Bibliotheque commune de Format : a coller UNE FOIS dans Supabase (projet de Masse)
-- > SQL Editor > New query > Run. Rien d'autre a faire ; relancer le script ne casse rien.
--
-- - Une table « format_materiaux » : un materiau par ligne (formats, epaisseur, trait de coupe...).
-- - LES PRIX NE SONT JAMAIS ENREGISTRES : la base les retire meme si l'appli en envoyait.
-- - Lecture libre ; creation, modification et suppression protegees par le PIN de Masse
--   (meme code, memes 5 essais avant blocage 5 minutes : fonction public._check_pin).
-- - Une suppression met le materiau a la corbeille (deleted_at) : les projets qui
--   l'utilisent encore le gardent sur leur poste.

create table if not exists public.format_materiaux (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.format_materiaux enable row level security;
grant select on public.format_materiaux to anon, authenticated;
grant all on public.format_materiaux to service_role;
drop policy if exists "lecture bibliotheque format" on public.format_materiaux;
create policy "lecture bibliotheque format" on public.format_materiaux for select to anon, authenticated using (true);

-- Retire le champ « price » de chaque format d'un tableau situe a ce chemin du JSON
create or replace function public._format_retirer_prix(p jsonb, chemin text[]) returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p #> chemin) = 'array'
    then jsonb_set(p, chemin, (select coalesce(jsonb_agg(f - 'price'), '[]'::jsonb) from jsonb_array_elements(p #> chemin) f))
    else p end
$$;
revoke all on function public._format_retirer_prix(jsonb, text[]) from public, anon, authenticated;

create or replace function public.format_save_material(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id'; v_data jsonb;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Matériau invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Matériau trop volumineux.'); end if;
  v_data := public._format_retirer_prix(public._format_retirer_prix(p, '{supply,formats}'), '{supplyValues,catalog,formats}');
  insert into public.format_materiaux (id, data, updated_at, deleted_at) values (v_id, v_data, now(), null)
  on conflict (id) do update set data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.format_delete_material(p_pin text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.format_materiaux set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.format_materiaux where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.format_save_material(text, jsonb), public.format_delete_material(text, text) to anon, authenticated;
