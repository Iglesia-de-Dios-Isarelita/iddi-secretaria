-- secretaria_core: Secretaría phase 1 tables, access rules, file storage, search and trends.
-- Tables live in public with the sec_ prefix. Reading goes through row rules; writing only through sec_* functions.

create extension if not exists unaccent with schema extensions;

-- 1. Two more permissions --------------------------------------------------------
insert into public.permissions(code, description, app_code) values
  ('secretaria.letters.approve',   'Aprobar cartas locales para todas las iglesias', 'secretaria'),
  ('secretaria.agreements.local',  'Registrar acuerdos de su sociedad o departamento', 'secretaria');
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on true
where r.app_code = 'secretaria' and (
  (p.code = 'secretaria.letters.approve'  and r.code in ('encargado_local','administrador_maestro')) or
  (p.code = 'secretaria.agreements.local' and r.code = 'secretario_sociedad_departamento'));

-- 2. Helpers used by the row rules ------------------------------------------------
create or replace function private.sec_has(p text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.app_has_permission('secretaria', 'secretaria.' || p)
$$;

create or replace function private.sec_in_scope(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.app_can_view_org('secretaria', p_org)
$$;

create or replace function private.sec_is_master() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_assignments ua
    join public.roles r on r.id = ua.role_id
    join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
    where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
      and r.app_code = 'secretaria' and r.code = 'administrador_maestro')
$$;

-- The caller holds one of these Secretaría roles in the church of p_org (the church itself or one of its societies/departments).
create or replace function private.sec_church_role(p_org uuid, p_codes text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_assignments ua
    join public.roles r on r.id = ua.role_id
    join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
    where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
      and r.app_code = 'secretaria' and r.code = any (p_codes)
      and ua.locality_id is not null
      and ua.locality_id = (select o.locality_id from public.organizations o where o.id = p_org))
$$;

-- The caller is the society/department secretary of exactly this organization.
create or replace function private.sec_own_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_assignments ua
    join public.roles r on r.id = ua.role_id
    join public.user_profiles up on up.id = ua.user_id and up.status = 'active'
    where ua.user_id = (select auth.uid()) and ua.active and (ua.ends_at is null or ua.ends_at > now())
      and r.app_code = 'secretaria' and r.scope_level = 'society_or_department' and ua.organization_id = p_org)
$$;

-- Churches covered by an organization: a church itself, or every church under a zone / national / international administration.
create or replace function private.sec_area_churches(p_org uuid) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id
  from public.organizations o
  join public.localities l on l.id = o.locality_id
  join public.zones z on z.id = l.zone_id
  join public.national_administrations n on n.id = z.national_administration_id
  cross join private.org_path(p_org) p
  where o.kind = 'church' and o.active and (
       (p.o_kind = 'church' and o.id = p_org)
    or (p.o_kind = 'administration' and p.o_level = 'zone' and l.zone_id = p.o_zone)
    or (p.o_kind = 'administration' and p.o_level = 'national' and n.country_id = p.o_country)
    or (p.o_kind = 'administration' and p.o_level = 'international'))
$$;

create or replace function private.sec_tsv(variadic p text[]) returns tsvector
language sql stable set search_path = public, extensions, pg_temp as $$
  select to_tsvector('spanish', extensions.unaccent(coalesce(array_to_string(p, ' '), '')))
$$;

-- 3. Lists: service types and topics ---------------------------------------------
create table public.sec_service_types (
  id uuid primary key default gen_random_uuid(),
  name_es text not null unique check (length(trim(name_es)) > 0),
  name_en text not null check (length(trim(name_en)) > 0),
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.sec_service_types is 'Kinds of service for the sermon form. Managed by the Administrador Maestro.';
insert into public.sec_service_types(name_es, name_en, sort) values
  ('Servicio de Recibimiento', 'Reception Service', 1),
  ('Servicio Vespertino', 'Evening Service', 2),
  ('Servicio Matutino', 'Morning Service', 3);

create table public.sec_topics (
  id uuid primary key default gen_random_uuid(),
  name_es text not null unique check (length(trim(name_es)) > 0),
  name_en text not null check (length(trim(name_en)) > 0),
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.sec_topics is 'Topic tags for sermons (bilingual). Managed by the Administrador Maestro.';
insert into public.sec_topics(name_es, name_en, sort) values
  ('Profético', 'Prophetic', 1),
  ('Evangelismo', 'Evangelism', 2),
  ('Puntos de fe', 'Points of faith', 3),
  ('Parábolas', 'Parables', 4);

-- 4. Services (sermons) -------------------------------------------------------------
create table public.sec_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  service_date date not null,
  service_type_id uuid not null references public.sec_service_types(id),
  preacher_user_id uuid references auth.users(id),
  preacher_name text not null check (length(trim(preacher_name)) > 0),
  title text not null check (length(trim(title)) > 0),
  notes text,
  attendance_men integer not null default 0 check (attendance_men >= 0),
  attendance_women integer not null default 0 check (attendance_women >= 0),
  attendance_youth integer not null default 0 check (attendance_youth >= 0),
  attendance_children integer not null default 0 check (attendance_children >= 0),
  attendance_visitors integer not null default 0 check (attendance_visitors >= 0),
  attendance_total integer generated always as
    (attendance_men + attendance_women + attendance_youth + attendance_children + attendance_visitors) stored,
  presentation_path text,
  status text not null default 'posted' check (status in ('posted','voided')),
  void_reason text, voided_by uuid references auth.users(id), voided_at timestamptz,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz,
  search tsvector
);
comment on table public.sec_services is 'One row per service and its sermon: date, type, preacher, title, attendance (men, women, youth, children, visitors) and presentation. Voided rows are kept with reason.';
create index sec_services_org_date_idx on public.sec_services(organization_id, service_date desc);
create index sec_services_search_idx on public.sec_services using gin(search);

create table public.sec_service_topics (
  service_id uuid not null references public.sec_services(id) on delete cascade,
  topic_id uuid not null references public.sec_topics(id),
  primary key (service_id, topic_id)
);

create table public.sec_service_citations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.sec_services(id) on delete cascade,
  position integer not null check (position >= 1),
  reference text not null check (length(trim(reference)) > 0),
  comment text,
  unique (service_id, position)
);
comment on table public.sec_service_citations is 'Bible citations of a sermon in order. Position 1 is the required first citation.';
create index sec_service_citations_ref_idx on public.sec_service_citations(lower(reference));

-- 5. Doctrinal documents -------------------------------------------------------------
create table public.sec_documents (
  id uuid primary key default gen_random_uuid(),
  publisher_organization_id uuid not null references public.organizations(id),
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('temario','manual','guia','estudio','otro')),
  description text,
  language text not null default 'es' check (language in ('es','en')),
  file_path text,
  content_text text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz,
  search tsvector
);
comment on table public.sec_documents is 'Official and doctrinal documents (temarios, manuals, guides) published by zone, national or the Administrador Maestro. content_text holds the searchable text.';
create index sec_documents_search_idx on public.sec_documents using gin(search);

-- 6. Agreements: conciliar (national/international) and society/department -----------
create table public.sec_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  level text not null check (level in ('international','national','society','department')),
  year integer not null,
  seq integer not null,
  number text not null,
  session text,
  session_date date,
  topic text not null check (length(trim(topic)) > 0),
  body text not null check (length(trim(body)) > 0),
  file_path text,
  status text not null default 'vigente' check (status in ('vigente','derogado','anulado')),
  status_reason text,
  replaced_by uuid references public.sec_agreements(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz,
  search tsvector,
  unique (organization_id, year, seq)
);
comment on table public.sec_agreements is 'Agreements. Conciliar (national/international administration) are seen by everyone. Society/department agreements are seen by that secretary, the church''s Secretario Local and Encargado Local, and the Administrador Maestro. Number: CI-2026-001 (international), CN-USA-2026-001 (national), AS-2026-001 (society), AD-2026-001 (department).';
create index sec_agreements_search_idx on public.sec_agreements using gin(search);

-- 7. Local official letters ------------------------------------------------------------
create table public.sec_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  letter_date date not null default current_date,
  kind text not null default 'anuncio' check (kind in ('anuncio','nombramiento','correspondencia','otro')),
  title text not null check (length(trim(title)) > 0),
  body text,
  file_path text,
  audience text not null default 'local' check (audience in ('local','all_churches')),
  status text not null check (status in ('published','pending_approval','rejected','voided')),
  review_note text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  void_reason text, voided_by uuid references auth.users(id), voided_at timestamptz,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz,
  search tsvector
);
comment on table public.sec_letters is 'Local official letters. Local letters: that church''s people. All-churches letters wait for the church''s Encargado Local to approve, then everyone sees them. The Administrador Maestro sees all.';
create index sec_letters_org_idx on public.sec_letters(organization_id, letter_date desc);
create index sec_letters_search_idx on public.sec_letters using gin(search);

-- 8. Circulars -----------------------------------------------------------------------------
create table public.sec_circulars (
  id uuid primary key default gen_random_uuid(),
  from_organization_id uuid not null references public.organizations(id),
  title text not null check (length(trim(title)) > 0),
  body text,
  file_path text,
  status text not null default 'sent' check (status in ('sent','withdrawn')),
  sent_by uuid not null references auth.users(id), sent_at timestamptz not null default now(),
  search tsvector
);
comment on table public.sec_circulars is 'Circulars from a zone, national or international administration to churches, with acknowledgment per church.';
create table public.sec_circular_recipients (
  circular_id uuid not null references public.sec_circulars(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  primary key (circular_id, organization_id)
);

-- 9. Search text kept up to date ----------------------------------------------------------
create or replace function private.sec_search_letters() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.search := private.sec_tsv(new.title, new.body, new.kind); return new; end $$;
create trigger sec_letters_search before insert or update of title, body, kind on public.sec_letters
  for each row execute function private.sec_search_letters();

create or replace function private.sec_search_documents() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.search := private.sec_tsv(new.title, new.description, new.kind, new.content_text); return new; end $$;
create trigger sec_documents_search before insert or update of title, description, kind, content_text on public.sec_documents
  for each row execute function private.sec_search_documents();

create or replace function private.sec_search_agreements() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.search := private.sec_tsv(new.number, new.session, new.topic, new.body); return new; end $$;
create trigger sec_agreements_search before insert or update of number, session, topic, body on public.sec_agreements
  for each row execute function private.sec_search_agreements();

create or replace function private.sec_search_circulars() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.search := private.sec_tsv(new.title, new.body); return new; end $$;
create trigger sec_circulars_search before insert or update of title, body on public.sec_circulars
  for each row execute function private.sec_search_circulars();

create or replace function private.sec_service_reindex(p_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.sec_services s set search = private.sec_tsv(
    s.title, s.notes, s.preacher_name,
    (select string_agg(c.reference || ' ' || coalesce(c.comment, ''), ' ') from public.sec_service_citations c where c.service_id = s.id),
    (select string_agg(t.name_es || ' ' || t.name_en, ' ') from public.sec_service_topics st join public.sec_topics t on t.id = st.topic_id where st.service_id = s.id))
  where s.id = p_id
$$;

-- 10. Who can read what ----------------------------------------------------------------------
alter table public.sec_service_types enable row level security;
alter table public.sec_topics enable row level security;
alter table public.sec_services enable row level security;
alter table public.sec_service_topics enable row level security;
alter table public.sec_service_citations enable row level security;
alter table public.sec_documents enable row level security;
alter table public.sec_agreements enable row level security;
alter table public.sec_letters enable row level security;
alter table public.sec_circulars enable row level security;
alter table public.sec_circular_recipients enable row level security;

revoke all on public.sec_service_types, public.sec_topics, public.sec_services, public.sec_service_topics,
  public.sec_service_citations, public.sec_documents, public.sec_agreements, public.sec_letters,
  public.sec_circulars, public.sec_circular_recipients from anon, authenticated;
grant select on public.sec_service_types, public.sec_topics, public.sec_services, public.sec_service_topics,
  public.sec_service_citations, public.sec_documents, public.sec_agreements, public.sec_letters,
  public.sec_circulars, public.sec_circular_recipients to authenticated;

create policy sec_service_types_read on public.sec_service_types for select to authenticated using (true);
create policy sec_topics_read on public.sec_topics for select to authenticated using (true);

-- Posted sermons are the shared library; voided ones only inside the church's area.
create policy sec_services_read on public.sec_services for select to authenticated using (
  (status = 'posted' and private.sec_has('services.view'))
  or private.sec_is_master()
  or (private.sec_has('services.view') and private.sec_church_role(organization_id, array['secretario_local','encargado_local'])));
create policy sec_service_topics_read on public.sec_service_topics for select to authenticated using (
  exists (select 1 from public.sec_services s where s.id = service_id));
create policy sec_service_citations_read on public.sec_service_citations for select to authenticated using (
  exists (select 1 from public.sec_services s where s.id = service_id));

create policy sec_documents_read on public.sec_documents for select to authenticated using (
  (status = 'active' and private.sec_has('library.view'))
  or private.sec_is_master()
  or (private.sec_has('doctrine.publish') and private.sec_in_scope(publisher_organization_id)));

create policy sec_agreements_read on public.sec_agreements for select to authenticated using (
  (level in ('international','national') and status <> 'anulado' and private.sec_has('library.view'))
  or private.sec_is_master()
  or (level in ('international','national') and private.sec_has('agreements.publish') and private.sec_in_scope(organization_id))
  or (level in ('society','department') and (
        private.sec_own_org(organization_id)
        or private.sec_church_role(organization_id, array['secretario_local','encargado_local']))));

create policy sec_letters_read on public.sec_letters for select to authenticated using (
  private.sec_is_master()
  or (status = 'published' and audience = 'all_churches' and private.sec_has('letters.view'))
  or (status = 'published' and private.sec_has('letters.view')
      and private.sec_church_role(organization_id, array['predicador','secretario_local','encargado_local','secretario_sociedad_departamento']))
  or (private.sec_church_role(organization_id, array['secretario_local','encargado_local'])));

-- These two helpers read without row rules so the circular and recipient rules don't call each other in a loop.
create or replace function private.sec_circular_received(p_circular uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.sec_circular_recipients r where r.circular_id = p_circular
                 and private.sec_church_role(r.organization_id, array['secretario_local','encargado_local']))
$$;
create or replace function private.sec_circular_sender(p_circular uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.sec_circulars c where c.id = p_circular
                 and private.sec_has('circulars.send') and private.sec_in_scope(c.from_organization_id))
$$;
create policy sec_circulars_read on public.sec_circulars for select to authenticated using (
  private.sec_is_master()
  or (private.sec_has('circulars.send') and private.sec_in_scope(from_organization_id))
  or private.sec_circular_received(id));
create policy sec_circular_recipients_read on public.sec_circular_recipients for select to authenticated using (
  private.sec_is_master()
  or private.sec_church_role(organization_id, array['secretario_local','encargado_local'])
  or private.sec_circular_sender(circular_id));

-- 11. Files (private bucket, 50 MB, documents and images only) --------------------------------
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('secretaria', 'secretaria', false, 52428800, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg','image/png','image/webp']);

-- Paths: <category>/<organization id>/<file>. Category: services, letters, documents, agreements, circulars.
create or replace function private.sec_can_upload(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cat text := split_part(p_name, '/', 1); v_org uuid;
begin
  begin v_org := split_part(p_name, '/', 2)::uuid; exception when others then return false; end;
  return case v_cat
    when 'services' then private.sec_has('services.manage') and private.sec_church_role(v_org, array['secretario_local'])
    when 'letters' then private.sec_has('letters.manage') and (private.sec_is_master() or private.sec_church_role(v_org, array['secretario_local']))
    when 'documents' then private.sec_has('doctrine.publish') and private.sec_in_scope(v_org)
    when 'agreements' then (private.sec_has('agreements.publish') or private.sec_has('agreements.local')) and private.sec_in_scope(v_org)
    when 'circulars' then private.sec_has('circulars.send') and private.sec_in_scope(v_org)
    else false end;
end $$;

-- A file can be opened by whoever can see the record that points to it (row rules apply: security invoker).
create or replace function private.sec_can_read_file(p_name text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from public.sec_services where presentation_path = p_name)
      or exists (select 1 from public.sec_letters where file_path = p_name)
      or exists (select 1 from public.sec_documents where file_path = p_name)
      or exists (select 1 from public.sec_agreements where file_path = p_name)
      or exists (select 1 from public.sec_circulars where file_path = p_name)
$$;

create policy secretaria_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'secretaria' and private.sec_can_upload(name));
create policy secretaria_files_read on storage.objects for select to authenticated
  using (bucket_id = 'secretaria' and (owner = (select auth.uid()) or private.sec_can_read_file(name)));

-- Functions used inside row rules must be callable by signed-in users (they are not exposed through the API).
grant execute on function private.sec_has(text), private.sec_in_scope(uuid), private.sec_is_master(),
  private.sec_church_role(uuid, text[]), private.sec_own_org(uuid), private.sec_can_upload(text),
  private.sec_can_read_file(text), private.sec_circular_received(uuid), private.sec_circular_sender(uuid) to authenticated;
revoke all on function private.sec_area_churches(uuid), private.sec_service_reindex(uuid) from public;

-- 12. Writing: services ---------------------------------------------------------------------------
create or replace function public.sec_service_save(
  p_id uuid, p_org uuid, p_date date, p_type uuid, p_title text, p_preacher_name text, p_preacher_user uuid,
  p_notes text, p_attendance jsonb, p_topics uuid[], p_citations jsonb, p_presentation_path text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  s public.sec_services%rowtype;
  v_att jsonb := coalesce(p_attendance, '{}'::jsonb);
begin
  if v_uid is null or not private.sec_has('services.manage') then raise exception 'Not allowed'; end if;
  if p_org is null or not exists (select 1 from public.organizations where id = p_org and kind = 'church' and active) then
    raise exception 'Choose a church';
  end if;
  if not private.sec_church_role(p_org, array['secretario_local']) then raise exception 'That church is outside your scope'; end if;
  if p_date is null or p_date > current_date + 1 then raise exception 'Enter a valid date'; end if;
  if not exists (select 1 from public.sec_service_types where id = p_type and active) then raise exception 'Choose a service type'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Enter a title'; end if;
  if coalesce(trim(p_preacher_name), '') = '' then raise exception 'Enter the preacher'; end if;
  if p_citations is null or jsonb_typeof(p_citations) <> 'array' or jsonb_array_length(p_citations) = 0
     or coalesce(trim(p_citations->0->>'reference'), '') = '' then
    raise exception 'The first bible citation is required';
  end if;
  if p_presentation_path is not null and p_presentation_path not like 'services/' || p_org::text || '/%' then
    raise exception 'The presentation must be uploaded for this church';
  end if;

  if p_id is null then
    insert into public.sec_services(organization_id, service_date, service_type_id, preacher_user_id, preacher_name, title, notes,
      attendance_men, attendance_women, attendance_youth, attendance_children, attendance_visitors, presentation_path, created_by)
    values (p_org, p_date, p_type, p_preacher_user, trim(p_preacher_name), trim(p_title), p_notes,
      coalesce((v_att->>'men')::int, 0), coalesce((v_att->>'women')::int, 0), coalesce((v_att->>'youth')::int, 0),
      coalesce((v_att->>'children')::int, 0), coalesce((v_att->>'visitors')::int, 0), p_presentation_path, v_uid)
    returning id into v_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'service_created', 'sec_services', v_id, jsonb_build_object('organization_id', p_org, 'date', p_date, 'title', p_title));
  else
    select * into s from public.sec_services where id = p_id for update;
    if not found or s.organization_id <> p_org then raise exception 'Not found'; end if;
    if s.status <> 'posted' then raise exception 'Voided records cannot be changed'; end if;
    update public.sec_services set service_date = p_date, service_type_id = p_type, preacher_user_id = p_preacher_user,
      preacher_name = trim(p_preacher_name), title = trim(p_title), notes = p_notes,
      attendance_men = coalesce((v_att->>'men')::int, 0), attendance_women = coalesce((v_att->>'women')::int, 0),
      attendance_youth = coalesce((v_att->>'youth')::int, 0), attendance_children = coalesce((v_att->>'children')::int, 0),
      attendance_visitors = coalesce((v_att->>'visitors')::int, 0), presentation_path = p_presentation_path,
      updated_by = v_uid, updated_at = now()
    where id = p_id;
    v_id := p_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'service_updated', 'sec_services', v_id, jsonb_build_object('before', to_jsonb(s) - 'search'));
  end if;

  delete from public.sec_service_topics where service_id = v_id;
  insert into public.sec_service_topics(service_id, topic_id)
  select distinct v_id, t.id from unnest(coalesce(p_topics, '{}'::uuid[])) x(tid) join public.sec_topics t on t.id = x.tid and t.active;

  delete from public.sec_service_citations where service_id = v_id;
  insert into public.sec_service_citations(service_id, position, reference, comment)
  select v_id, row_number() over (order by e.ord), trim(e.val->>'reference'), nullif(trim(coalesce(e.val->>'comment', '')), '')
  from jsonb_array_elements(p_citations) with ordinality e(val, ord)
  where coalesce(trim(e.val->>'reference'), '') <> '';

  perform private.sec_service_reindex(v_id);
  return v_id;
end $$;

create or replace function public.sec_service_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); s public.sec_services%rowtype;
begin
  select * into s from public.sec_services where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_uid is null or not private.sec_has('services.manage') or not private.sec_church_role(s.organization_id, array['secretario_local']) then
    raise exception 'Not allowed';
  end if;
  if s.status <> 'posted' then raise exception 'Already voided'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Enter the reason'; end if;
  update public.sec_services set status = 'voided', void_reason = trim(p_reason), voided_by = v_uid, voided_at = now() where id = p_id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'service_voided', 'sec_services', p_id, jsonb_build_object('reason', p_reason));
end $$;

-- 13. Writing: letters ------------------------------------------------------------------------------
create or replace function public.sec_letter_save(
  p_id uuid, p_org uuid, p_date date, p_kind text, p_title text, p_body text, p_audience text, p_file_path text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_master boolean := private.sec_is_master();
  v_status text;
  l public.sec_letters%rowtype;
  v_id uuid;
begin
  if v_uid is null or not private.sec_has('letters.manage') then raise exception 'Not allowed'; end if;
  if p_org is null or not exists (select 1 from public.organizations where id = p_org and kind = 'church' and active) then
    raise exception 'Choose a church';
  end if;
  if not v_master and not private.sec_church_role(p_org, array['secretario_local']) then raise exception 'That church is outside your scope'; end if;
  if coalesce(p_audience, '') not in ('local','all_churches') then raise exception 'Choose who can see the letter'; end if;
  if p_file_path is not null and p_file_path not like 'letters/' || p_org::text || '/%' then
    raise exception 'The file must be uploaded for this church';
  end if;
  v_status := case when p_audience = 'all_churches' and not v_master then 'pending_approval' else 'published' end;

  if p_id is null then
    insert into public.sec_letters(organization_id, letter_date, kind, title, body, file_path, audience, status, created_by)
    values (p_org, coalesce(p_date, current_date), coalesce(p_kind, 'anuncio'), trim(p_title), p_body, p_file_path, p_audience, v_status, v_uid)
    returning id into v_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'letter_created', 'sec_letters', v_id, jsonb_build_object('organization_id', p_org, 'audience', p_audience, 'status', v_status));
  else
    select * into l from public.sec_letters where id = p_id for update;
    if not found or l.organization_id <> p_org then raise exception 'Not found'; end if;
    if l.status = 'voided' then raise exception 'Voided records cannot be changed'; end if;
    update public.sec_letters set letter_date = coalesce(p_date, letter_date), kind = coalesce(p_kind, kind), title = trim(p_title),
      body = p_body, file_path = p_file_path, audience = p_audience, status = v_status,
      review_note = null, reviewed_by = null, reviewed_at = null, updated_by = v_uid, updated_at = now()
    where id = p_id;
    v_id := p_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'letter_updated', 'sec_letters', v_id, jsonb_build_object('before', to_jsonb(l) - 'search', 'status', v_status));
  end if;
  return v_id;
end $$;

create or replace function public.sec_letter_review(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); l public.sec_letters%rowtype;
begin
  select * into l from public.sec_letters where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_uid is null or not private.sec_has('letters.approve')
     or not (private.sec_is_master() or private.sec_church_role(l.organization_id, array['encargado_local'])) then
    raise exception 'Not allowed';
  end if;
  if l.status <> 'pending_approval' then raise exception 'This letter is not waiting for approval'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'Enter the reason'; end if;
  update public.sec_letters set status = case when p_approve then 'published' else 'rejected' end,
    review_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = v_uid, reviewed_at = now()
  where id = p_id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, case when p_approve then 'letter_approved' else 'letter_rejected' end, 'sec_letters', p_id, jsonb_build_object('note', p_note));
end $$;

create or replace function public.sec_letter_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); l public.sec_letters%rowtype;
begin
  select * into l from public.sec_letters where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_uid is null or not private.sec_has('letters.manage')
     or not (private.sec_is_master() or private.sec_church_role(l.organization_id, array['secretario_local'])) then
    raise exception 'Not allowed';
  end if;
  if l.status = 'voided' then raise exception 'Already voided'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Enter the reason'; end if;
  update public.sec_letters set status = 'voided', void_reason = trim(p_reason), voided_by = v_uid, voided_at = now() where id = p_id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'letter_voided', 'sec_letters', p_id, jsonb_build_object('reason', p_reason));
end $$;

-- 14. Writing: doctrinal documents ---------------------------------------------------------------------
create or replace function public.sec_document_save(
  p_id uuid, p_org uuid, p_title text, p_kind text, p_description text, p_language text, p_file_path text, p_content_text text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); d public.sec_documents%rowtype; v_id uuid;
begin
  if v_uid is null or not private.sec_has('doctrine.publish') then raise exception 'Not allowed'; end if;
  if p_org is null or not exists (select 1 from public.organizations where id = p_org and kind = 'administration' and active) then
    raise exception 'Choose the administration that publishes';
  end if;
  if not private.sec_in_scope(p_org) then raise exception 'That organization is outside your scope'; end if;
  if p_file_path is not null and p_file_path not like 'documents/' || p_org::text || '/%' then
    raise exception 'The file must be uploaded for this administration';
  end if;
  if p_id is null then
    insert into public.sec_documents(publisher_organization_id, title, kind, description, language, file_path, content_text, created_by)
    values (p_org, trim(p_title), p_kind, p_description, coalesce(p_language, 'es'), p_file_path, p_content_text, v_uid)
    returning id into v_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'document_published', 'sec_documents', v_id, jsonb_build_object('title', p_title, 'organization_id', p_org));
  else
    select * into d from public.sec_documents where id = p_id for update;
    if not found or not private.sec_in_scope(d.publisher_organization_id) then raise exception 'Not found'; end if;
    update public.sec_documents set publisher_organization_id = p_org, title = trim(p_title), kind = p_kind, description = p_description,
      language = coalesce(p_language, language), file_path = p_file_path, content_text = p_content_text, updated_by = v_uid, updated_at = now()
    where id = p_id;
    v_id := p_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'document_updated', 'sec_documents', v_id, jsonb_build_object('before', to_jsonb(d) - 'search' - 'content_text'));
  end if;
  return v_id;
end $$;

create or replace function public.sec_document_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); d public.sec_documents%rowtype;
begin
  select * into d from public.sec_documents where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_uid is null or not private.sec_has('doctrine.publish') or not private.sec_in_scope(d.publisher_organization_id) then raise exception 'Not allowed'; end if;
  if p_status not in ('active','archived') then raise exception 'Unknown status'; end if;
  update public.sec_documents set status = p_status, updated_by = v_uid, updated_at = now() where id = p_id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'document_' || p_status, 'sec_documents', p_id, '{}'::jsonb);
end $$;

-- 15. Writing: agreements ---------------------------------------------------------------------------------
create or replace function private.sec_agreement_can_write(p_org uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p record;
begin
  select * into p from private.org_path(p_org);
  if p.o_kind = 'administration' and p.o_level in ('national','international') then
    if private.sec_has('agreements.publish') and private.sec_in_scope(p_org) then return p.o_level; end if;
  elsif p.o_kind in ('society','department') then
    if private.sec_has('agreements.local') and private.sec_own_org(p_org) then return p.o_kind::text; end if;
  end if;
  return null;
end $$;
revoke all on function private.sec_agreement_can_write(uuid) from public;

create or replace function public.sec_agreement_save(
  p_id uuid, p_org uuid, p_session text, p_session_date date, p_topic text, p_body text, p_file_path text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_level text := private.sec_agreement_can_write(p_org);
  v_year integer := extract(year from coalesce(p_session_date, current_date))::int;
  v_seq integer;
  v_prefix text;
  a public.sec_agreements%rowtype;
  v_id uuid;
begin
  if v_uid is null or v_level is null then raise exception 'Not allowed'; end if;
  if p_file_path is not null and p_file_path not like 'agreements/' || p_org::text || '/%' then
    raise exception 'The file must be uploaded for this organization';
  end if;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtext('sec_agreement:' || p_org::text || ':' || v_year));
    select coalesce(max(seq), 0) + 1 into v_seq from public.sec_agreements where organization_id = p_org and year = v_year;
    v_prefix := case v_level
      when 'international' then 'CI'
      when 'national' then 'CN-' || coalesce((select c.code from private.org_path(p_org) p join public.countries c on c.id = p.o_country), 'XX')
      when 'society' then 'AS'
      else 'AD' end;
    insert into public.sec_agreements(organization_id, level, year, seq, number, session, session_date, topic, body, file_path, created_by)
    values (p_org, v_level, v_year, v_seq, v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 3, '0'),
            nullif(trim(coalesce(p_session, '')), ''), p_session_date, trim(p_topic), p_body, p_file_path, v_uid)
    returning id into v_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'agreement_created', 'sec_agreements', v_id, jsonb_build_object('organization_id', p_org, 'level', v_level, 'topic', p_topic));
  else
    select * into a from public.sec_agreements where id = p_id for update;
    if not found or a.organization_id <> p_org then raise exception 'Not found'; end if;
    if a.status <> 'vigente' then raise exception 'Only agreements in force can be changed'; end if;
    update public.sec_agreements set session = nullif(trim(coalesce(p_session, '')), ''), session_date = p_session_date,
      topic = trim(p_topic), body = p_body, file_path = p_file_path, updated_by = v_uid, updated_at = now()
    where id = p_id;
    v_id := p_id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
    values (v_uid, 'agreement_updated', 'sec_agreements', v_id, jsonb_build_object('before', to_jsonb(a) - 'search'));
  end if;
  return v_id;
end $$;

create or replace function public.sec_agreement_set_status(p_id uuid, p_status text, p_reason text, p_replaced_by uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); a public.sec_agreements%rowtype;
begin
  select * into a from public.sec_agreements where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_uid is null or private.sec_agreement_can_write(a.organization_id) is null then raise exception 'Not allowed'; end if;
  if p_status not in ('vigente','derogado','anulado') then raise exception 'Unknown status'; end if;
  if p_status <> 'vigente' and coalesce(trim(p_reason), '') = '' then raise exception 'Enter the reason'; end if;
  if p_replaced_by is not null and not exists (select 1 from public.sec_agreements where id = p_replaced_by and organization_id = a.organization_id) then
    raise exception 'The replacing agreement must be from the same organization';
  end if;
  update public.sec_agreements set status = p_status, status_reason = nullif(trim(coalesce(p_reason, '')), ''),
    replaced_by = p_replaced_by, updated_by = v_uid, updated_at = now()
  where id = p_id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'agreement_' || p_status, 'sec_agreements', p_id, jsonb_build_object('reason', p_reason, 'replaced_by', p_replaced_by));
end $$;

-- 16. Writing: circulars ------------------------------------------------------------------------------------
create or replace function public.sec_circular_send(p_from_org uuid, p_title text, p_body text, p_file_path text, p_targets uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_n integer;
begin
  if v_uid is null or not private.sec_has('circulars.send') then raise exception 'Not allowed'; end if;
  if p_from_org is null or not exists (select 1 from public.organizations where id = p_from_org and kind = 'administration' and active
                                        and admin_level in ('zone','national','international')) then
    raise exception 'Choose the administration that sends';
  end if;
  if not private.sec_in_scope(p_from_org) then raise exception 'That organization is outside your scope'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Enter a title'; end if;
  if p_targets is not null and exists (select 1 from unnest(p_targets) t(id) where t.id not in (select private.sec_area_churches(p_from_org))) then
    raise exception 'Some churches are outside this administration';
  end if;
  if p_file_path is not null and p_file_path not like 'circulars/' || p_from_org::text || '/%' then
    raise exception 'The file must be uploaded for this administration';
  end if;
  insert into public.sec_circulars(from_organization_id, title, body, file_path, sent_by)
  values (p_from_org, trim(p_title), p_body, p_file_path, v_uid) returning id into v_id;
  insert into public.sec_circular_recipients(circular_id, organization_id)
  select v_id, c from private.sec_area_churches(p_from_org) c where p_targets is null or c = any (p_targets);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'No churches to send to'; end if;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'circular_sent', 'sec_circulars', v_id, jsonb_build_object('from', p_from_org, 'churches', v_n));
  return v_id;
end $$;

create or replace function public.sec_circular_acknowledge(p_circular uuid, p_org uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.sec_has('circulars.acknowledge')
     or not private.sec_church_role(p_org, array['secretario_local','encargado_local']) then
    raise exception 'Not allowed';
  end if;
  update public.sec_circular_recipients set acknowledged_by = v_uid, acknowledged_at = now()
  where circular_id = p_circular and organization_id = p_org and acknowledged_at is null;
  if not found then raise exception 'Nothing to acknowledge'; end if;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'circular_acknowledged', 'sec_circular_recipients', p_circular, jsonb_build_object('organization_id', p_org));
end $$;

-- 17. Writing: lists (service types and topics) -------------------------------------------------------------
create or replace function public.sec_list_save(p_list text, p_id uuid, p_name_es text, p_name_en text, p_sort integer, p_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null or not private.sec_has('settings.manage') then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_name_es), '') = '' or coalesce(trim(p_name_en), '') = '' then raise exception 'Enter the name in Spanish and English'; end if;
  if p_list = 'service_types' then
    if p_id is null then
      insert into public.sec_service_types(name_es, name_en, sort, active) values (trim(p_name_es), trim(p_name_en), coalesce(p_sort, 100), coalesce(p_active, true)) returning id into v_id;
    else
      update public.sec_service_types set name_es = trim(p_name_es), name_en = trim(p_name_en), sort = coalesce(p_sort, sort), active = coalesce(p_active, active)
      where id = p_id returning id into v_id;
    end if;
  elsif p_list = 'topics' then
    if p_id is null then
      insert into public.sec_topics(name_es, name_en, sort, active) values (trim(p_name_es), trim(p_name_en), coalesce(p_sort, 100), coalesce(p_active, true)) returning id into v_id;
    else
      update public.sec_topics set name_es = trim(p_name_es), name_en = trim(p_name_en), sort = coalesce(p_sort, sort), active = coalesce(p_active, active)
      where id = p_id returning id into v_id;
    end if;
  else
    raise exception 'Unknown list';
  end if;
  if v_id is null then raise exception 'Not found'; end if;
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, metadata)
  values (v_uid, 'list_saved', 'sec_' || p_list, v_id, jsonb_build_object('name_es', p_name_es, 'active', p_active));
  return v_id;
end $$;

-- 18. Search across everything the person can see (row rules apply) ------------------------------------------
create or replace function public.sec_search(p_query text, p_limit integer default 30)
returns table(kind text, id uuid, title text, detail text, organization_id uuid, item_date date, rank real)
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare q tsquery := websearch_to_tsquery('spanish', extensions.unaccent(coalesce(p_query, '')));
begin
  if numnode(q) = 0 then return; end if;
  return query
  select * from (
    select 'service'::text, s.id, s.title, s.preacher_name, s.organization_id, s.service_date, ts_rank(s.search, q)
      from public.sec_services s where s.search @@ q and s.status = 'posted'
    union all
    select 'document', d.id, d.title, d.kind, d.publisher_organization_id, d.created_at::date, ts_rank(d.search, q)
      from public.sec_documents d where d.search @@ q and d.status = 'active'
    union all
    select 'agreement', a.id, a.number || ' — ' || a.topic, a.status, a.organization_id, coalesce(a.session_date, a.created_at::date), (ts_rank(a.search, q) * 1.5)::real
      from public.sec_agreements a where a.search @@ q and a.status <> 'anulado'
    union all
    select 'letter', l.id, l.title, l.kind, l.organization_id, l.letter_date, ts_rank(l.search, q)
      from public.sec_letters l where l.search @@ q and l.status = 'published'
    union all
    select 'circular', c.id, c.title, null::text, c.from_organization_id, c.sent_at::date, ts_rank(c.search, q)
      from public.sec_circulars c where c.search @@ q and c.status = 'sent'
  ) r(kind, id, title, detail, organization_id, item_date, rank)
  order by r.rank desc, r.item_date desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

-- 19. Trends for a church or an administration's area -----------------------------------------------------------
create or replace function public.sec_trends(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := (select auth.uid()); v_churches uuid[];
begin
  if v_uid is null or not private.sec_has('trends.view') then raise exception 'Not allowed'; end if;
  if not (private.sec_is_master() or private.sec_in_scope(p_org) or private.sec_church_role(p_org, array['encargado_local'])) then
    raise exception 'That organization is outside your scope';
  end if;
  select array_agg(c) into v_churches from private.sec_area_churches(p_org) c;
  return jsonb_build_object(
    'services', (select count(*) from public.sec_services s where s.organization_id = any (v_churches) and s.status = 'posted'
                 and s.service_date between p_from and p_to),
    'attendance', (select jsonb_build_object('men', coalesce(sum(attendance_men), 0), 'women', coalesce(sum(attendance_women), 0),
                     'youth', coalesce(sum(attendance_youth), 0), 'children', coalesce(sum(attendance_children), 0),
                     'visitors', coalesce(sum(attendance_visitors), 0), 'total', coalesce(sum(attendance_total), 0),
                     'average', coalesce(round(avg(attendance_total), 1), 0))
                   from public.sec_services s where s.organization_id = any (v_churches) and s.status = 'posted'
                     and s.service_date between p_from and p_to),
    'by_month', coalesce((select jsonb_agg(m order by m->>'month') from (
                   select jsonb_build_object('month', to_char(date_trunc('month', s.service_date), 'YYYY-MM'),
                     'services', count(*), 'attendance', sum(s.attendance_total), 'average', round(avg(s.attendance_total), 1)) m
                   from public.sec_services s where s.organization_id = any (v_churches) and s.status = 'posted'
                     and s.service_date between p_from and p_to
                   group by date_trunc('month', s.service_date)) x), '[]'::jsonb),
    'by_type', coalesce((select jsonb_agg(jsonb_build_object('type_es', t.name_es, 'type_en', t.name_en, 'services', x.n, 'average', x.avg_att))
                 from (select s.service_type_id, count(*) n, round(avg(s.attendance_total), 1) avg_att from public.sec_services s
                       where s.organization_id = any (v_churches) and s.status = 'posted' and s.service_date between p_from and p_to
                       group by s.service_type_id) x join public.sec_service_types t on t.id = x.service_type_id), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('topic_es', t.name_es, 'topic_en', t.name_en, 'services', x.n) order by x.n desc)
                 from (select st.topic_id, count(*) n from public.sec_service_topics st join public.sec_services s on s.id = st.service_id
                       where s.organization_id = any (v_churches) and s.status = 'posted' and s.service_date between p_from and p_to
                       group by st.topic_id) x join public.sec_topics t on t.id = x.topic_id), '[]'::jsonb)
  );
end $$;

-- 20. Who can call the write functions -----------------------------------------------------------------------------
do $do$
declare f text;
begin
  foreach f in array array[
    'public.sec_service_save(uuid, uuid, date, uuid, text, text, uuid, text, jsonb, uuid[], jsonb, text)',
    'public.sec_service_void(uuid, text)',
    'public.sec_letter_save(uuid, uuid, date, text, text, text, text, text)',
    'public.sec_letter_review(uuid, boolean, text)',
    'public.sec_letter_void(uuid, text)',
    'public.sec_document_save(uuid, uuid, text, text, text, text, text, text)',
    'public.sec_document_set_status(uuid, text)',
    'public.sec_agreement_save(uuid, uuid, text, date, text, text, text)',
    'public.sec_agreement_set_status(uuid, text, text, uuid)',
    'public.sec_circular_send(uuid, text, text, text, uuid[])',
    'public.sec_circular_acknowledge(uuid, uuid)',
    'public.sec_list_save(text, uuid, text, text, integer, boolean)',
    'public.sec_search(text, integer)',
    'public.sec_trends(uuid, date, date)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $do$;
grant execute on function private.sec_tsv(text[]) to authenticated;
