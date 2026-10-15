-- Every organization table has timezone and organization_logo except
-- company_sections, so registering, viewing or setting the timezone of a
-- Section workspace failed ("column timezone does not exist").
-- Safe to rerun: columns are added only when missing. No data is changed.
ALTER TABLE public.company_sections
  ADD COLUMN IF NOT EXISTS timezone character varying(255) DEFAULT NULL COLLATE public.audito_ci,
  ADD COLUMN IF NOT EXISTS organization_logo character varying(255) DEFAULT NULL COLLATE public.audito_ci;
