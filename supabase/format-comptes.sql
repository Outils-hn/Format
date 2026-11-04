-- Format 2.8 : la modification de la bibliotheque commune passe par le COMPTE Index
-- (connecte + valide) au lieu du code PIN. A coller dans Supabase (projet Index) > SQL Editor > Run.
-- Colle le CONTENU du fichier, pas son nom. Relancer ne casse rien.
-- Les anciennes fonctions a PIN restent en place le temps de la transition.

create or replace function public._check_acces() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'Connectez-vous avec votre compte Index pour modifier.'; end if;
  if not public.is_approved() then return 'Votre compte Index n''est pas encore valide : un administrateur doit l''approuver.'; end if;
  return null;
end $$;
revoke all on function public._check_acces() from public, anon, authenticated;

create or replace function public.format_save_material(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id'; v_data jsonb;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Matériau invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Matériau trop volumineux.'); end if;
  v_data := public._format_retirer_prix(public._format_retirer_prix(p, '{supply,formats}'), '{supplyValues,catalog,formats}');
  insert into public.format_materiaux (id, data, updated_at, deleted_at) values (v_id, v_data, now(), null)
  on conflict (id) do update set data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.format_delete_material(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.format_materiaux set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.format_materiaux where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.format_save_material(jsonb), public.format_delete_material(text) to authenticated;
