-- per_app_roles_foundation
-- Roles, permissions and access per app (finance, secretaria, pos) on one shared sign-in.
-- Finance keeps its own allowlist (approved_email_addresses) and its role keys; other apps use app_access_grants.

-- 1. Apps registry --------------------------------------------------------------
create table public.apps (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name_es text not null,
  name_en text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.apps is 'Every church app that shares this sign-in (finance, secretaria, pos). Roles, permissions and access grants each belong to one app.';
alter table public.apps enable row level security;
create policy apps_read on public.apps for select to authenticated using (true);
revoke all on public.apps from anon, authenticated;
grant select on public.apps to authenticated;
insert into public.apps(code, name_es, name_en) values
  ('finance', 'Finanzas', 'Finance'),
  ('secretaria', 'Secretaría', 'Secretary'),
  ('pos', 'Punto de Venta', 'Point of Sale');

-- 2. Roles belong to an app -----------------------------------------------------
alter table public.roles
  add column app_code text references public.apps(code),
  add column code text,
  add column scope_level text,
  add column rank integer,
  add column min_inviter_rank integer;
update public.roles set
  app_code = 'finance',
  code = role::text,
  scope_level = case role
    when 'international' then 'international' when 'national' then 'national' when 'zone' then 'zone'
    when 'local_administration' then 'church' when 'society' then 'society' when 'department' then 'department' end,
  rank = private.role_rank(role);
alter table public.roles
  alter column app_code set not null,
  alter column code set not null,
  alter column scope_level set not null,
  alter column rank set not null,
  alter column role drop not null;
alter table public.roles
  add constraint roles_app_code_code_key unique (app_code, code),
  add constraint roles_scope_level_check check (scope_level in ('international','national','zone','church','society','department','society_or_department')),
  add constraint roles_rank_check check (rank between 1 and 9),
  add constraint roles_finance_key_check check ((app_code = 'finance') = (role is not null));
comment on column public.roles.app_code is 'The app this role belongs to.';
comment on column public.roles.code is 'Role key inside its app (for Finance it equals role).';
comment on column public.roles.role is 'Finance role key. Empty for roles of other apps.';
comment on column public.roles.scope_level is 'What the role is assigned to: international, national, zone, church, society or department.';
comment on column public.roles.rank is 'Level inside its app (higher = more authority). A person can only give access to roles below their own.';
comment on column public.roles.min_inviter_rank is 'If set, only people at this level or above (in the same app) can give this role.';

insert into public.roles(app_code, code, role, display_name_es, display_name_en, scope_level, rank, min_inviter_rank) values
  ('secretaria', 'administrador_maestro', null, 'Administrador Maestro', 'Master Administrator', 'international', 6, null),
  ('secretaria', 'secretario_nacional',   null, 'Secretario Nacional',   'National Secretary',   'national',      5, null),
  ('secretaria', 'secretario_zona',       null, 'Secretario de Zona',    'Zone Secretary',       'zone',          4, null),
  ('secretaria', 'encargado_local',       null, 'Encargado Local',       'Local Leader',         'church',        3, null),
  ('secretaria', 'secretario_local',      null, 'Secretario Local',      'Local Secretary',      'church',        3, null),
  ('secretaria', 'predicador',            null, 'Predicador',            'Preacher',             'church',        2, 4),
  ('secretaria', 'secretario_sociedad_departamento', null, 'Secretario de Sociedad o de Departamento', 'Society or Department Secretary', 'society_or_department', 1, null);

-- 3. Permissions belong to an app -----------------------------------------------
alter table public.permissions add column app_code text references public.apps(code);
update public.permissions set app_code = 'finance';
alter table public.permissions alter column app_code set not null;
comment on column public.permissions.app_code is 'The app this permission belongs to. Codes of apps other than Finance start with the app code.';

create or replace function private.check_role_permission_app() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select app_code from public.roles where id = new.role_id)
     is distinct from (select app_code from public.permissions where id = new.permission_id) then
    raise exception 'A role can only receive permissions of its own app';
  end if;
  return new;
end $$;
revoke all on function private.check_role_permission_app() from public;
create trigger role_permissions_same_app before insert or update on public.role_permissions
  for each row execute function private.check_role_permission_app();

insert into public.permissions(code, description, app_code) values
  ('secretaria.services.view',        'Ver registros de cultos y predicaciones', 'secretaria'),
  ('secretaria.services.manage',      'Registrar cultos, asistencia, citas y presentaciones', 'secretaria'),
  ('secretaria.library.view',         'Consultar predicaciones, documentos doctrinales y acuerdos conciliares', 'secretaria'),
  ('secretaria.doctrine.publish',     'Subir documentos oficiales y doctrinales', 'secretaria'),
  ('secretaria.agreements.publish',   'Publicar acuerdos conciliares', 'secretaria'),
  ('secretaria.letters.view',         'Ver cartas oficiales (las locales de su iglesia y las publicadas para todas las iglesias)', 'secretaria'),
  ('secretaria.letters.manage',       'Gestionar cartas oficiales locales', 'secretaria'),
  ('secretaria.circulars.send',       'Emitir circulares', 'secretaria'),
  ('secretaria.circulars.acknowledge','Acusar recibo de circulares', 'secretaria'),
  ('secretaria.trends.view',          'Ver el panel de tendencias', 'secretaria'),
  ('secretaria.ai.use',               'Consultar IDDI AI', 'secretaria'),
  ('secretaria.users.view',           'Ver accesos de Secretaría', 'secretaria'),
  ('secretaria.users.invite',         'Dar y quitar acceso a Secretaría', 'secretaria'),
  ('secretaria.settings.manage',      'Configuración de Secretaría', 'secretaria');

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from (values
  ('services.view',        array['predicador','secretario_local','encargado_local','secretario_zona','secretario_nacional','administrador_maestro','secretario_sociedad_departamento']),
  ('services.manage',      array['secretario_local']),
  ('library.view',         array['predicador','secretario_local','encargado_local','secretario_zona','secretario_nacional','administrador_maestro','secretario_sociedad_departamento']),
  ('doctrine.publish',     array['secretario_zona','secretario_nacional','administrador_maestro']),
  ('agreements.publish',   array['secretario_nacional','administrador_maestro']),
  ('letters.view',         array['predicador','secretario_local','encargado_local','secretario_zona','secretario_nacional','administrador_maestro','secretario_sociedad_departamento']),
  ('letters.manage',       array['secretario_local','administrador_maestro']),
  ('circulars.send',       array['secretario_zona','secretario_nacional','administrador_maestro']),
  ('circulars.acknowledge',array['secretario_local','encargado_local']),
  ('trends.view',          array['encargado_local','secretario_zona','secretario_nacional','administrador_maestro']),
  ('ai.use',               array['predicador','secretario_local','encargado_local','secretario_zona','secretario_nacional','administrador_maestro','secretario_sociedad_departamento']),
  ('users.view',           array['encargado_local','secretario_local','secretario_zona','secretario_nacional','administrador_maestro']),
  ('users.invite',         array['encargado_local','secretario_local','secretario_zona','secretario_nacional','administrador_maestro']),
  ('settings.manage',      array['administrador_maestro'])
) m(perm, roles)
cross join lateral unnest(m.roles) rc(code)
join public.roles r on r.app_code = 'secretaria' and r.code = rc.code
join public.permissions p on p.code = 'secretaria.' || m.perm;

-- 4. Finance helpers only look at Finance roles ---------------------------------
create or replace function private.caller_top_role()
 returns app_role language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select r.role
  from public.user_assignments ua
  join public.roles r on r.id = ua.role_id
  join public.user_profiles up on up.id = ua.user_id
  where ua.user_id = (select auth.uid()) and ua.active
    and (ua.ends_at is null or ua.ends_at > now()) and up.status = 'active'
    and r.app_code = 'finance'
  order by private.role_rank(r.role) desc
  limit 1
$function$;

create or replace function private.my_role_key()
 returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select coalesce(string_agg(distinct r.role::text, ',' order by r.role::text), '')
  from public.user_assignments ua join public.roles r on r.id = ua.role_id
  where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
    and r.app_code = 'finance';
$function$;

create or replace function public.my_context()
 returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select jsonb_build_object(
    'user_id', up.id,
    'email', up.email,
    'full_name', up.full_name, 'first_name', up.first_name, 'last_name', up.last_name, 'treatment', up.treatment,
    'status', up.status,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', r.role, 'name_es', r.display_name_es, 'name_en', r.display_name_en,
        'organization_id', ua.organization_id, 'zone_id', ua.zone_id, 'country_id', ua.country_id))
      from public.user_assignments ua
      join public.roles r on r.id = ua.role_id
      where ua.user_id = up.id and ua.active and (ua.ends_at is null or ua.ends_at > now())
        and r.app_code = 'finance'
    ), '[]'::jsonb),
    'permissions', case
      when up.status <> 'active' then '[]'::jsonb
      when private.is_international() then coalesce((select jsonb_agg(code order by code) from public.permissions where app_code = 'finance'), '[]'::jsonb)
      else coalesce((
        select jsonb_agg(distinct pe.code)
        from public.user_assignments ua
        join public.role_permissions rp on rp.role_id = ua.role_id
        join public.permissions pe on pe.id = rp.permission_id
        where ua.user_id = up.id and ua.active and (ua.ends_at is null or ua.ends_at > now())
          and pe.app_code = 'finance'
      ), '[]'::jsonb)
    end
  )
  from public.user_profiles up
  where up.id = (select auth.uid());
$function$;

-- 5. Access grants for apps other than Finance ----------------------------------
create table public.app_access_grants (
  id uuid primary key default gen_random_uuid(),
  app_code text not null references public.apps(code) check (app_code <> 'finance'),
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id uuid not null references public.roles(id),
  organization_id uuid references public.organizations(id),
  active boolean not null default true,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_access_grants_app_email_key unique (app_code, email)
);
comment on table public.app_access_grants is 'Who may use each app other than Finance: one row per email per app, with the role and the church or administration. Finance keeps using approved_email_addresses. Changed only through app_grant_access and app_set_grant_active.';
alter table public.app_access_grants enable row level security;
revoke all on public.app_access_grants from anon, authenticated;

create or replace function private.check_grant_role_app() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select app_code from public.roles where id = new.role_id) is distinct from new.app_code then
    raise exception 'The role does not belong to this app';
  end if;
  return new;
end $$;
revoke all on function private.check_grant_role_app() from public;
create trigger app_access_grants_role_app before insert or update on public.app_access_grants
  for each row execute function private.check_grant_role_app();

alter table public.user_assignments add column grant_id uuid references public.app_access_grants(id) on delete set null;
comment on column public.user_assignments.grant_id is 'For apps other than Finance: the access grant this assignment came from.';
create index user_assignments_grant_id_idx on public.user_assignments(grant_id);
create index user_assignments_user_active_idx on public.user_assignments(user_id) where active;

-- 6. Shared helpers ---------------------------------------------------------------
-- Role name as shown to people: the society/department secretary is named after what it was assigned to.
create or replace function public.role_label(p_role uuid, p_org uuid, p_lang text)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when r.scope_level = 'society_or_department' and o.kind = 'society' then case when p_lang = 'en' then 'Society Secretary' else 'Secretario de Sociedad' end
    when r.scope_level = 'society_or_department' and o.kind = 'department' then case when p_lang = 'en' then 'Department Secretary' else 'Secretario de Departamento' end
    when p_lang = 'en' then r.display_name_en else r.display_name_es end
  from public.roles r left join public.organizations o on o.id = p_org
  where r.id = p_role
$$;
revoke all on function public.role_label(uuid, uuid, text) from public, anon;
grant execute on function public.role_label(uuid, uuid, text) to authenticated;
create or replace function private.org_path(p_org uuid,
  out o_kind public.organization_kind, out o_level text, out o_locality uuid,
  out o_zone uuid, out o_national uuid, out o_country uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  select o.kind, o.admin_level, o.locality_id, o.zone_id, o.national_administration_id
    into o_kind, o_level, o_locality, o_zone, o_national
  from public.organizations o where o.id = p_org and o.active;
  if not found then o_kind := null; return; end if;
  if o_zone is null and o_locality is not null then
    select l.zone_id into o_zone from public.localities l where l.id = o_locality;
  end if;
  if o_national is null and o_zone is not null then
    select z.national_administration_id into o_national from public.zones z where z.id = o_zone;
  end if;
  if o_national is not null then
    select n.country_id into o_country from public.national_administrations n where n.id = o_national;
  end if;
end $$;
revoke all on function private.org_path(uuid) from public;

-- Creates one assignment for a person, with the scope columns Finance already uses.
create or replace function private.provision_assignment(p_user uuid, p_role_id uuid, p_org uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.roles%rowtype; p record; v_id uuid;
begin
  select * into r from public.roles where id = p_role_id;
  if not found then raise exception 'Role not found'; end if;
  if r.scope_level = 'international' then
    insert into public.user_assignments(user_id, role_id, active) values (p_user, p_role_id, true) returning id into v_id;
    return v_id;
  end if;
  if p_org is null then raise exception 'An organization is required for this role'; end if;
  select * into p from private.org_path(p_org);
  if p.o_kind is null then raise exception 'The organization is missing or inactive'; end if;
  if r.scope_level = 'national' then
    if p.o_country is null then raise exception 'The organization does not resolve to a country'; end if;
    insert into public.user_assignments(user_id, role_id, country_id, active) values (p_user, p_role_id, p.o_country, true) returning id into v_id;
  elsif r.scope_level = 'zone' then
    if p.o_zone is null then raise exception 'The organization does not resolve to a zone'; end if;
    insert into public.user_assignments(user_id, role_id, zone_id, active) values (p_user, p_role_id, p.o_zone, true) returning id into v_id;
  elsif r.scope_level = 'church' then
    if p.o_kind <> 'church' or p.o_locality is null then raise exception 'This role must be assigned to a church'; end if;
    insert into public.user_assignments(user_id, role_id, locality_id, organization_id, active) values (p_user, p_role_id, p.o_locality, p_org, true) returning id into v_id;
  elsif r.scope_level = 'society_or_department' then
    if p.o_kind not in ('society','department') then raise exception 'This role must be assigned to a society or a department'; end if;
    insert into public.user_assignments(user_id, role_id, locality_id, organization_id, active) values (p_user, p_role_id, p.o_locality, p_org, true) returning id into v_id;
  else
    if p.o_kind::text <> r.scope_level then raise exception 'This role must be assigned to a %', r.scope_level; end if;
    insert into public.user_assignments(user_id, role_id, locality_id, organization_id, active) values (p_user, p_role_id, p.o_locality, p_org, true) returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function private.provision_assignment(uuid, uuid, uuid) from public;

-- Brings a person's assignment in line with one grant (replaces the old one).
create or replace function private.apply_grant(p_grant uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.app_access_grants%rowtype; v_user uuid; v_ua uuid;
begin
  select * into g from public.app_access_grants where id = p_grant;
  if not found then return; end if;
  update public.user_assignments set active = false, ends_at = now() where grant_id = p_grant and active;
  if not g.active then return; end if;
  select id into v_user from auth.users where lower(email) = g.email;
  if v_user is null then return; end if;  -- provisioned at first sign-in
  update public.user_profiles set status = 'active', updated_at = now() where id = v_user and status = 'suspended';
  v_ua := private.provision_assignment(v_user, g.role_id, g.organization_id);
  update public.user_assignments set grant_id = p_grant where id = v_ua;
end $$;
revoke all on function private.apply_grant(uuid) from public;

create or replace function private.app_has_permission(p_app text, p_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.user_assignments ua
    join public.roles r on r.id = ua.role_id
    join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
    join public.role_permissions rp on rp.role_id = ua.role_id
    join public.permissions pe on pe.id = rp.permission_id
    where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
      and r.app_code = p_app and pe.app_code = p_app and pe.code = p_code)
$$;
revoke all on function private.app_has_permission(text, text) from public;

create or replace function private.app_top_rank(p_app text)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(max(r.rank), 0)
  from public.user_assignments ua
  join public.roles r on r.id = ua.role_id
  join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
  where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
    and r.app_code = p_app
$$;
revoke all on function private.app_top_rank(text) from public;

create or replace function private.app_can_view_org(p_app text, p_org uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p record;
begin
  select * into p from private.org_path(p_org);
  if p.o_kind is null then return false; end if;
  return exists (
    select 1
    from public.user_assignments ua
    join public.roles r on r.id = ua.role_id
    join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
    where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
      and r.app_code = p_app
      and case r.scope_level
        when 'international' then true
        when 'national' then p.o_country is not null and ua.country_id = p.o_country
        when 'zone' then p.o_zone is not null and ua.zone_id = p.o_zone
        when 'church' then p.o_kind <> 'administration' and ua.locality_id = p.o_locality
        when 'society' then ua.organization_id = p_org
        when 'department' then ua.organization_id = p_org
        when 'society_or_department' then ua.organization_id = p_org
        else false
      end);
end $$;
revoke all on function private.app_can_view_org(text, uuid) from public;

-- 7. Sign-in: invited to Finance OR to any other app -----------------------------
create or replace function public.validate_approved_auth_user()
 returns trigger language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  normalized_email text;
  normalized_domain text;
  auth_provider text;
begin
  normalized_email := lower(trim(coalesce(new.email, '')));
  auth_provider := lower(coalesce(new.raw_app_meta_data->>'provider', ''));
  if auth_provider <> 'google' then
    raise exception 'Only Google sign-in is permitted for this application';
  end if;
  if normalized_email = '' or position('@' in normalized_email) < 2 then
    raise exception 'A valid email address is required for this application';
  end if;
  normalized_domain := split_part(normalized_email, '@', 2);

  if not exists (
    select 1
    from public.approved_email_addresses a
    join public.approved_email_domains d on lower(d.domain) = normalized_domain and d.active
    where lower(a.email) = normalized_email and a.active
  ) and not exists (
    select 1
    from public.app_access_grants g
    join public.approved_email_domains d on lower(d.domain) = normalized_domain and d.active
    join public.apps ap on ap.code = g.app_code and ap.active
    where g.email = normalized_email and g.active
  ) then
    raise exception 'This email address has not been invited to any IDDI app';
  end if;

  return new;
end;
$function$;

-- Finance's first-sign-in step now steps aside for people who are not Finance users.
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.create_user_profile_after_auth()'::regprocedure);
  v_new := replace(v_def,
    $old$  if not found or v_role_id is null or v_role is null then
    raise exception 'No active role assignment is configured for this approved email';
  end if;$old$,
    $new$  if not found or v_role_id is null or v_role is null then
    -- Not a Finance user: the profile and other apps' access come from provision_app_grants_after_auth.
    return new;
  end if;$new$);
  if v_new = v_def then raise exception 'create_user_profile_after_auth did not match the expected text'; end if;
  execute v_new;
end $do$;

create or replace function public.provision_app_grants_after_auth()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text := lower(trim(coalesce(new.email, ''))); v_new int; g record;
begin
  insert into public.user_profiles(id, email, full_name, status)
  values (new.id, v_email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 'active')
  on conflict (id) do nothing;
  get diagnostics v_new = row_count;
  if v_new > 0 then
    insert into public.authentication_events(user_id, email, provider, event_type)
    values (new.id, v_email, 'google', 'approved_google_account_provisioned');
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (new.id, 'auth_account_provisioned', 'app_access_grants', null, jsonb_build_object('email', v_email));
  end if;
  for g in select id from public.app_access_grants where email = v_email and active loop
    perform private.apply_grant(g.id);
  end loop;
  return new;
end $$;
revoke all on function public.provision_app_grants_after_auth() from public, anon, authenticated;
-- Runs after create_profile_after_auth (triggers fire in name order).
create trigger provision_app_grants_after_auth after insert on auth.users
  for each row execute function public.provision_app_grants_after_auth();

-- A person who already signed in through another app and is then invited to Finance gets their Finance role right away.
create or replace function private.provision_finance_on_approval()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_user uuid;
begin
  if new.active and new.role_id is not null then
    select id into v_user from auth.users where lower(email) = lower(new.email);
    if v_user is not null and not exists (
      select 1 from public.user_assignments ua where ua.user_id = v_user and ua.role_id = new.role_id and ua.active
    ) then
      perform private.provision_assignment(v_user, new.role_id, new.organization_id);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.provision_finance_on_approval() from public;
create trigger approved_email_provision_existing_user after insert or update of active, role_id, organization_id on public.approved_email_addresses
  for each row execute function private.provision_finance_on_approval();

-- Turning off someone's Finance access no longer turns off their other apps.
do $do$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.set_access_active(uuid, boolean)'::regprocedure);
  v_new := replace(v_def,
    $old$  update public.approved_email_addresses set active = p_active where id = p_id;
  if v_has_profile then
    update public.user_profiles
       set status = case when p_active then 'active'::public.user_status else 'suspended'::public.user_status end,
           updated_at = now()
     where lower(email) = lower(a.email);
  end if;$old$,
    $new$  update public.approved_email_addresses set active = p_active where id = p_id;
  if v_has_profile then
    if not p_active then
      -- Finance roles end here; the account stays open only if the person has another app.
      update public.user_assignments ua set active = false, ends_at = now()
       from public.roles r, public.user_profiles up
       where r.id = ua.role_id and r.app_code = 'finance' and up.id = ua.user_id
         and lower(up.email) = lower(a.email) and ua.active;
    end if;
    update public.user_profiles up
       set status = case when p_active then 'active'::public.user_status else 'suspended'::public.user_status end,
           updated_at = now()
     where lower(up.email) = lower(a.email)
       and (p_active or not exists (
         select 1 from public.user_assignments ua join public.roles r on r.id = ua.role_id
         where ua.user_id = up.id and ua.active and r.app_code <> 'finance'));
  end if;$new$);
  if v_new = v_def then raise exception 'set_access_active did not match the expected text'; end if;
  execute v_new;
end $do$;

-- 8. Managing access to the other apps -------------------------------------------
create or replace function public.app_grant_access(p_app text, p_email text, p_role text, p_org uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(coalesce(p_email, '')));
  v_creator boolean := private.is_international();
  v_rank integer;
  r public.roles%rowtype;
  p record;
  g public.app_access_grants%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not allowed'; end if;
  if p_app is null or p_app = 'finance' or not exists (select 1 from public.apps where code = p_app and active) then
    raise exception 'Unknown app';
  end if;
  v_rank := private.app_top_rank(p_app);
  if not v_creator and not private.app_has_permission(p_app, p_app || '.users.invite') then raise exception 'Not allowed'; end if;
  select * into r from public.roles where app_code = p_app and code = p_role;
  if not found then raise exception 'Unknown role'; end if;
  if not v_creator and (r.rank >= v_rank or v_rank < coalesce(r.min_inviter_rank, 0)) then
    raise exception 'Your role cannot invite this kind of user';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if v_email = lower(coalesce((select email from public.user_profiles where id = v_uid), '')) and not v_creator then
    raise exception 'You cannot change your own access';
  end if;
  if not exists (select 1 from public.approved_email_domains d where d.active and lower(d.domain) = split_part(v_email, '@', 2)) then
    raise exception 'This email domain is not approved';
  end if;

  if r.scope_level = 'international' then
    p_org := null;
  else
    if p_org is null then raise exception 'Choose an organization'; end if;
    select * into p from private.org_path(p_org);
    if p.o_kind is null then raise exception 'Organization not found'; end if;
    if r.scope_level = 'national' and not (p.o_kind = 'administration' and p.o_level = 'national') then raise exception 'Choose a national administration'; end if;
    if r.scope_level = 'zone' and not (p.o_kind = 'administration' and p.o_level = 'zone') then raise exception 'Choose a zone administration'; end if;
    if r.scope_level = 'church' and not (p.o_kind = 'church' and p.o_locality is not null) then raise exception 'Choose a church'; end if;
    if r.scope_level in ('society','department') and p.o_kind::text <> r.scope_level then raise exception 'Choose a %', r.scope_level; end if;
    if r.scope_level = 'society_or_department' and p.o_kind not in ('society','department') then raise exception 'Choose a society or a department'; end if;
    if not v_creator and not private.app_can_view_org(p_app, p_org) then raise exception 'That organization is outside your scope'; end if;
  end if;

  select * into g from public.app_access_grants where app_code = p_app and email = v_email for update;
  if found then
    if not v_creator and ((select rank from public.roles where id = g.role_id) >= v_rank
        or v_rank < coalesce((select min_inviter_rank from public.roles where id = g.role_id), 0)
        or g.organization_id is null or not private.app_can_view_org(p_app, g.organization_id)) then
      raise exception 'Not allowed';
    end if;
    update public.app_access_grants
       set role_id = r.id, organization_id = p_org, active = true, granted_by = v_uid, updated_at = now()
     where id = g.id returning id into v_id;
  else
    insert into public.app_access_grants(app_code, email, role_id, organization_id, active, granted_by)
    values (p_app, v_email, r.id, p_org, true, v_uid) returning id into v_id;
  end if;

  perform private.apply_grant(v_id);
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'app_access_granted', 'app_access_grants', v_id,
          jsonb_build_object('app', p_app, 'email', v_email, 'role', r.code, 'organization_id', p_org));
  return v_id;
end $$;

create or replace function public.app_set_grant_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_creator boolean := private.is_international();
  g public.app_access_grants%rowtype;
  v_role public.roles%rowtype;
begin
  if v_uid is null then raise exception 'Not allowed'; end if;
  select * into g from public.app_access_grants where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  select * into v_role from public.roles where id = g.role_id;
  if g.email = lower(coalesce((select email from public.user_profiles where id = v_uid), '')) then
    raise exception 'You cannot change your own access';
  end if;
  if not v_creator then
    if not private.app_has_permission(g.app_code, g.app_code || '.users.invite')
       or v_role.rank >= private.app_top_rank(g.app_code)
       or private.app_top_rank(g.app_code) < coalesce(v_role.min_inviter_rank, 0)
       or g.organization_id is null or not private.app_can_view_org(g.app_code, g.organization_id) then
      raise exception 'Not allowed';
    end if;
  end if;
  update public.app_access_grants set active = p_active, updated_at = now() where id = p_id;
  perform private.apply_grant(p_id);
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, case when p_active then 'app_access_enabled' else 'app_access_disabled' end, 'app_access_grants', p_id,
          jsonb_build_object('app', g.app_code, 'email', g.email, 'role', v_role.code, 'organization_id', g.organization_id));
end $$;

create or replace function public.app_list_access(p_app text)
returns table(id uuid, email text, role text, role_name_es text, role_name_en text, organization_id uuid, organization_name text,
              active boolean, signed_in boolean, status user_status, created_at timestamptz,
              first_name text, last_name text, treatment text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_creator boolean := private.is_international(); v_rank integer := private.app_top_rank(p_app);
begin
  if not v_creator and not private.app_has_permission(p_app, p_app || '.users.view') then raise exception 'Not allowed'; end if;
  return query
  select g.id, g.email, r.code, public.role_label(r.id, g.organization_id, 'es'), public.role_label(r.id, g.organization_id, 'en'), g.organization_id,
         case when o.id is null then null else coalesce(o.display_name, o.name || coalesce(' — ' || l.name, '')) end,
         g.active, (up.id is not null), up.status, g.created_at,
         up.first_name, up.last_name, up.treatment,
         (select max(ae.created_at) from public.authentication_events ae where ae.user_id = up.id)
  from public.app_access_grants g
  join public.roles r on r.id = g.role_id
  left join public.organizations o on o.id = g.organization_id
  left join public.localities l on l.id = o.locality_id
  left join public.user_profiles up on lower(up.email) = g.email
  where g.app_code = p_app
    and (v_creator or (r.rank < v_rank and g.organization_id is not null and private.app_can_view_org(p_app, g.organization_id)))
  order by g.created_at desc;
end $$;

-- What an app needs to know about the person signed in.
create or replace function public.app_context(p_app text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'app', p_app,
    'user_id', up.id, 'email', up.email,
    'full_name', up.full_name, 'first_name', up.first_name, 'last_name', up.last_name, 'treatment', up.treatment,
    'status', up.status,
    'is_creator', private.is_international(),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', r.code, 'name_es', public.role_label(r.id, ua.organization_id, 'es'), 'name_en', public.role_label(r.id, ua.organization_id, 'en'),
        'rank', r.rank, 'scope_level', r.scope_level,
        'organization_id', ua.organization_id, 'locality_id', ua.locality_id, 'zone_id', ua.zone_id, 'country_id', ua.country_id))
      from public.user_assignments ua join public.roles r on r.id = ua.role_id
      where ua.user_id = up.id and ua.active and (ua.ends_at is null or ua.ends_at > now()) and r.app_code = p_app
    ), '[]'::jsonb),
    'permissions', case when up.status <> 'active' then '[]'::jsonb else coalesce((
      select jsonb_agg(distinct pe.code)
      from public.user_assignments ua
      join public.roles r on r.id = ua.role_id
      join public.role_permissions rp on rp.role_id = ua.role_id
      join public.permissions pe on pe.id = rp.permission_id
      where ua.user_id = up.id and ua.active and (ua.ends_at is null or ua.ends_at > now())
        and r.app_code = p_app and pe.app_code = p_app
    ), '[]'::jsonb) end
  )
  from public.user_profiles up
  where up.id = (select auth.uid());
$$;

-- What apps the person can open (for the apps hub).
create or replace function public.my_apps()
returns table(code text, name_es text, name_en text)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct ap.code, ap.name_es, ap.name_en
  from public.user_assignments ua
  join public.roles r on r.id = ua.role_id
  join public.apps ap on ap.code = r.app_code and ap.active
  join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
  where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
  order by ap.code
$$;

revoke all on function public.app_grant_access(text, text, text, uuid) from public, anon;
revoke all on function public.app_set_grant_active(uuid, boolean) from public, anon;
revoke all on function public.app_list_access(text) from public, anon;
revoke all on function public.app_context(text) from public, anon;
revoke all on function public.my_apps() from public, anon;
grant execute on function public.app_grant_access(text, text, text, uuid) to authenticated;
grant execute on function public.app_set_grant_active(uuid, boolean) to authenticated;
grant execute on function public.app_list_access(text) to authenticated;
grant execute on function public.app_context(text) to authenticated;
grant execute on function public.my_apps() to authenticated;

-- 9. The creator account is the first Administrador Maestro of Secretaría --------
do $do$
declare v_owner uuid := (select id from auth.users where lower(email) = 'superuser@iddioakland.org'); v_grant uuid;
begin
  insert into public.app_access_grants(app_code, email, role_id, organization_id, active, granted_by)
  values ('secretaria', 'superuser@iddioakland.org',
          (select id from public.roles where app_code = 'secretaria' and code = 'administrador_maestro'), null, true, v_owner)
  returning id into v_grant;
  perform private.apply_grant(v_grant);
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_owner, 'app_access_granted', 'app_access_grants', v_grant,
          jsonb_build_object('app', 'secretaria', 'email', 'superuser@iddioakland.org', 'role', 'administrador_maestro', 'note', 'set up with the per-app roles'));
end $do$;
