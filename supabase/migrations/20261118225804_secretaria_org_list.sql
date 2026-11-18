-- Church and administration names for the Secretaría app. Every Secretaría user can read the names
-- (letters for all churches, the library and circulars mention churches everywhere); in_scope says which
-- ones the person works with. Finance keeps its own narrower organization rules.
create or replace function public.sec_orgs()
returns table(id uuid, kind public.organization_kind, name text, display_name text, locality_id uuid, locality_name text,
              parent_organization_id uuid, admin_level text, zone_id uuid, zone_name text, national_administration_id uuid,
              national_name text, country_id uuid, country_name text, country_code text, in_scope boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id, o.kind, o.name, o.display_name, o.locality_id, l.name, o.parent_organization_id, o.admin_level,
         p.o_zone, z.name, p.o_national, n.name, p.o_country, c.name, c.code,
         (private.sec_is_master() or private.sec_in_scope(o.id))
  from public.organizations o
  cross join lateral private.org_path(o.id) p
  left join public.localities l on l.id = o.locality_id
  left join public.zones z on z.id = p.o_zone
  left join public.national_administrations n on n.id = p.o_national
  left join public.countries c on c.id = p.o_country
  where o.active and private.sec_has('services.view')
  order by c.name nulls first, z.name nulls first, o.kind, coalesce(l.name, o.name)
$$;
revoke all on function public.sec_orgs() from public, anon;
grant execute on function public.sec_orgs() to authenticated;
