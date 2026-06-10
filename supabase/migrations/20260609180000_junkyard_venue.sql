-- Seed The Junkyard as the venue for the the-junkyard-web source
-- (connector: "jsonLdEvents"), which pins every event to it via defaultVenueSlug.
-- resolveOrCreateVenue() throws on a missing slug, so this must exist first.
--
-- Address + coords from the venue's schema.org JSON-LD (2323 W. Mulberry Pl,
-- Sun Valley, near Empower Field). Idempotent: re-runs leave any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('junkyard', 'The Junkyard', 'An open-air Live Nation concert venue in Denver''s Sun Valley near Empower Field, hosting touring headliners across hip-hop, EDM, rock, and pop.', '2323 W. Mulberry Pl, Denver, CO 80204', 'Sun Valley', 39.73246, -105.01428)
on conflict (slug) do nothing;
