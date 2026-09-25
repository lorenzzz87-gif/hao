revoke insert, update, delete, truncate, references, trigger
on table public.interests
from anon, authenticated;

grant select
on table public.interests
to anon, authenticated;

create policy "Interest catalog is publicly readable"
on public.interests
for select
to anon, authenticated
using (true);
