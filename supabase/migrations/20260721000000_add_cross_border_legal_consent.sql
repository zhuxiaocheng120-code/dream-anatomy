alter table public.legal_consents
  add column if not exists cross_border_consent_version text,
  add column if not exists cross_border_accepted_at timestamptz;
