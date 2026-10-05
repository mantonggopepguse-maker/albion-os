-- Migration 010: Patient Clinic Client Relationship Alignment
-- Connects patients directly to clinic_clients (pet owners) rather than internal staff profiles.

ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS clinic_client_id UUID REFERENCES public.clinic_clients(id) ON DELETE SET NULL;

ALTER TABLE public.patients 
  ALTER COLUMN owner_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_clinic_client ON public.patients(clinic_client_id);
