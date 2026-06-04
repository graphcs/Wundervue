-- Drop the legacy "one basic folder per user" partial unique index.
--
-- It encoded the old free-tier rule (free = 1 basic folder). Folders are now an
-- Insider-only feature with no per-user cap, so this index wrongly blocks an
-- Insider from creating a second folder. (No-op on a fresh DB that never had
-- the index.)

drop index if exists public.saved_folders_one_basic_per_user;
