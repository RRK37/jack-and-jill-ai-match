-- ============================================
-- Jack & Jill — Full Database Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Custom Types
CREATE TYPE public.app_role AS ENUM ('candidate', 'employer', 'admin');
CREATE TYPE public.conversation_type AS ENUM ('jack', 'jill');
CREATE TYPE public.match_status AS ENUM ('pending', 'approved', 'passed');
CREATE TYPE public.message_role AS ENUM ('system', 'assistant', 'user');

-- 2. Tables

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

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

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type conversation_type NOT NULL,
  summary text,
  is_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role message_role NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  status match_status DEFAULT 'pending',
  match_summary text,
  vibe_match text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (candidate_id, employer_id)
);

-- 3. Security Definer Helper (must come before RLS policies)

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Enable RLS on all tables

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- user_roles
CREATE POLICY "Users can read own roles" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- candidates
CREATE POLICY "Candidates read own" ON candidates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates update own" ON candidates FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates insert own" ON candidates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employers read matched candidates" ON candidates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.candidate_id = candidates.id AND e.user_id = auth.uid())
);
CREATE POLICY "Admins read all candidates" ON candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- employers
CREATE POLICY "Employers read own" ON employers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers update own" ON employers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers insert own" ON employers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all employers" ON employers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- conversations
CREATE POLICY "Users read own conversations" ON conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own conversations" ON conversations FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- messages
CREATE POLICY "Users read own messages" ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users insert own messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

-- matches
CREATE POLICY "Candidates read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM candidates c WHERE c.id = matches.candidate_id AND c.user_id = auth.uid())
);
CREATE POLICY "Employers read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);
CREATE POLICY "Employers update own match status" ON matches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);

-- 6. Indexes

CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_employers_user_id ON employers(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_type ON conversations(user_id, type);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_matches_candidate ON matches(candidate_id);
CREATE INDEX idx_matches_employer ON matches(employer_id);
CREATE INDEX idx_matches_status ON matches(employer_id, status);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- 7. Updated_at trigger

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

-- 8. Auto-assign role on signup (reads from user metadata set during signUp)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'candidate'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
