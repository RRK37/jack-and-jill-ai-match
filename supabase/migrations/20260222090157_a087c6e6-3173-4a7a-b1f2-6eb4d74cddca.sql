
-- Fix infinite recursion: "Employers read matched candidates" policy on candidates
-- queries matches, whose RLS queries candidates again.
-- Solution: use a security definer function to bypass RLS when checking match membership.

CREATE OR REPLACE FUNCTION public.is_employer_match(_candidate_id uuid, _employer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matches m
    JOIN employers e ON m.employer_id = e.id
    WHERE m.candidate_id = _candidate_id
      AND e.user_id = _employer_user_id
  )
$$;

-- Recreate the problematic policy using the function
DROP POLICY IF EXISTS "Employers read matched candidates" ON public.candidates;
CREATE POLICY "Employers read matched candidates" ON public.candidates
  FOR SELECT
  USING (public.is_employer_match(id, auth.uid()));
