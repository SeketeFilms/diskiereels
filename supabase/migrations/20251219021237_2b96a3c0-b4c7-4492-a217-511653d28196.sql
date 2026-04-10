-- Create table for creator verification requests
CREATE TABLE public.creator_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  company_name text,
  business_email text NOT NULL,
  id_document_url text,
  business_document_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.creator_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own verification status"
ON public.creator_verifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can submit verification request"
ON public.creator_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending verification"
ON public.creator_verifications
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all verifications
CREATE POLICY "Admins can view all verifications"
ON public.creator_verifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update verifications (approve/reject)
CREATE POLICY "Admins can update verifications"
ON public.creator_verifications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Add is_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN is_verified boolean DEFAULT false;