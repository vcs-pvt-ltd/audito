-- Organization link verification fields belong to schema migrations, not
-- request-time SQL. Safe to rerun on databases that already have the fields.
ALTER TABLE public.organization_links
  ADD COLUMN IF NOT EXISTS verification_key_hash varchar(64),
  ADD COLUMN IF NOT EXISTS verification_key_verified_at timestamp without time zone;
