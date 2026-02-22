
-- Fix: All policies were created as RESTRICTIVE (no permissive base).
-- Drop and recreate as PERMISSIVE.

-- ═══ candidates ═══
DROP POLICY IF EXISTS "Admins read all candidates" ON public.candidates;
DROP POLICY IF EXISTS "Candidates insert own" ON public.candidates;
DROP POLICY IF EXISTS "Candidates read own" ON public.candidates;
DROP POLICY IF EXISTS "Candidates update own" ON public.candidates;
DROP POLICY IF EXISTS "Employers read matched candidates" ON public.candidates;

CREATE POLICY "Admins read all candidates" ON public.candidates FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates insert own" ON public.candidates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Candidates read own" ON public.candidates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Candidates update own" ON public.candidates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Employers read matched candidates" ON public.candidates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id
    WHERE m.candidate_id = candidates.id AND e.user_id = auth.uid()
  )
);

-- ═══ employers ═══
DROP POLICY IF EXISTS "Admins read all employers" ON public.employers;
DROP POLICY IF EXISTS "Employers insert own" ON public.employers;
DROP POLICY IF EXISTS "Employers read own" ON public.employers;
DROP POLICY IF EXISTS "Employers update own" ON public.employers;

CREATE POLICY "Admins read all employers" ON public.employers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employers insert own" ON public.employers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employers read own" ON public.employers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Employers update own" ON public.employers FOR UPDATE USING (user_id = auth.uid());

-- ═══ matches ═══
DROP POLICY IF EXISTS "Candidates read own matches" ON public.matches;
DROP POLICY IF EXISTS "Employers read own matches" ON public.matches;
DROP POLICY IF EXISTS "Employers update own match status" ON public.matches;

CREATE POLICY "Candidates read own matches" ON public.matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM candidates c WHERE c.id = matches.candidate_id AND c.user_id = auth.uid())
);
CREATE POLICY "Employers read own matches" ON public.matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);
CREATE POLICY "Employers update own match status" ON public.matches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);

-- ═══ conversations ═══
DROP POLICY IF EXISTS "Users insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users read own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;

CREATE POLICY "Users insert own conversations" ON public.conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own conversations" ON public.conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own conversations" ON public.conversations FOR UPDATE USING (user_id = auth.uid());

-- ═══ messages ═══
DROP POLICY IF EXISTS "Users insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users read own messages" ON public.messages;

CREATE POLICY "Users insert own messages" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users read own messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

-- ═══ user_roles ═══
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
