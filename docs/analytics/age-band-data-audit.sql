-- Read-only preflight. Run before applying the age-band migration.
-- Do not update or delete the returned profiles automatically.
select id, birth_date
from public.profiles
where birth_date is null
   or birth_date > current_date
   or birth_date < date '1900-01-01'
   or age(current_date, birth_date) < interval '18 years'
order by id;
