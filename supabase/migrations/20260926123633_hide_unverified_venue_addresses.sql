-- Unverified, user-entered venues are approximate areas, not shareable addresses.
-- Exact addresses are only retained for externally verified public POIs.

create or replace function private.approximate_venue_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.external_place_id is null then
    new.location := private.approximate_public_location(new.location);
    new.address := null;
  end if;
  return new;
end;
$$;
revoke all on function private.approximate_venue_location() from public, anon, authenticated;

drop trigger if exists venues_approximate_location on public.venues;
create trigger venues_approximate_location
before insert or update of location, address, external_place_id on public.venues
for each row execute function private.approximate_venue_location();

update public.venues
set address = null
where external_place_id is null and address is not null;

-- Venue rows contain location data and must only be exposed through privacy-filtered RPCs.
revoke select on public.venues from anon, authenticated;
drop policy if exists venues_read on public.venues;
