
-- Create enums (app_role already exists)
CREATE TYPE public.conversation_type AS ENUM ('jack', 'jill');
CREATE TYPE public.match_status AS ENUM ('pending', 'approved', 'passed');
CREATE TYPE public.message_role AS ENUM ('system', 'assistant', 'user');

-- Candidates
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  title text,
  skills text[] DEFAULT '{}',
  goals text,
  vibe text,
  experience_years integer,
  location text,
  remote_ok boolean DEFAULT true,
  salary_min integer,
  salary_max integer,
  onboarding_complete boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employers
CREATE TABLE public.employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text NOT NULL,
  role_title text,
  role_description text,
  required_skills text[] DEFAULT '{}',
  culture_values text,
  location text,
  remote_ok boolean DEFAULT true,
  salary_min integer,
  salary_max integer,
  team_size text,
  briefing_complete boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type conversation_type NOT NULL,
  summary text,
  is_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role message_role NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Matches
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  employer_id uuid REFERENCES public.employers(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL,
  status match_status DEFAULT 'pending',
  match_summary text,
  vibe_match text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(candidate_id, employer_id)
);

-- Enable RLS on all tables
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Candidates policies
CREATE POLICY "Candidates read own" ON candidates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates update own" ON candidates FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates insert own" ON candidates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employers read matched candidates" ON candidates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.candidate_id = candidates.id AND e.user_id = auth.uid())
);
CREATE POLICY "Admins read all candidates" ON candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employers policies
CREATE POLICY "Employers read own" ON employers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers update own" ON employers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers insert own" ON employers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all employers" ON employers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Conversations policies
CREATE POLICY "Users read own conversations" ON conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own conversations" ON conversations FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users read own messages" ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users insert own messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

-- Matches policies
CREATE POLICY "Candidates read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM candidates c WHERE c.id = matches.candidate_id AND c.user_id = auth.uid())
);
CREATE POLICY "Employers read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);
CREATE POLICY "Employers update own match status" ON matches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);

-- Indexes
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_employers_user_id ON employers(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_type ON conversations(user_id, type);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_matches_candidate ON matches(candidate_id);
CREATE INDEX idx_matches_employer ON matches(employer_id);
CREATE INDEX idx_matches_status ON matches(employer_id, status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employers FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
