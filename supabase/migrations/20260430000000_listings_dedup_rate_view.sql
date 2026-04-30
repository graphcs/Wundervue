-- Per-source per-day duplicate rate. Surfaces silent connector regressions
-- like the unstable serpEvents source_id (where re-runs would have produced
-- same-source duplicate rows that the fuzzy clusterer hides). After a few
-- days of healthy crons, baseline dup_rate per source establishes the alert
-- threshold; a sudden jump (e.g. >30%) means a connector probably started
-- emitting unstable ids again.
create view public.listings_dedup_rate_daily as
select
  source,
  date_trunc('day', created_at)::date as day,
  count(*) as seen,
  count(*) filter (where dedup_of is not null) as duplicates,
  (count(*) filter (where dedup_of is not null))::float
    / nullif(count(*), 0) as dup_rate
from public.listings
group by source, day
order by day desc, source;
