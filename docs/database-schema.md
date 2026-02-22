# Database Creation Prompt — Jack & Jill Recruitment Platform

You are building a PostgreSQL database on Supabase for **Jack & Jill**, an AI-powered recruitment platform with two AI agents: **Jack** (candidate-facing) and **Jill** (employer-facing). Jack conducts conversational onboarding with candidates to understand their skills, goals, and culture preferences. Jill conducts briefings with employers to understand their hiring needs. The platform then matches candidates to employer roles.

---

## 1. Custom Types

```sql
CREATE TYPE public.app_role AS ENUM ('candidate', 'employer', 'admin');
CREATE TYPE public.conversation_type AS ENUM ('jack', 'jill');
CREATE TYPE public.match_status AS ENUM ('pending', 'approved', 'passed');
CREATE TYPE public.message_role AS ENUM ('system', 'assistant', 'user');
```

---

## 2. Tables

### `user_roles`
Stores user roles separately from profiles (security requirement — never store roles on the profile table).

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL |
| role | app_role | NOT NULL |
| | | UNIQUE(user_id, role) |

### `candidates`
Stores candidate profile data, populated/updated by Jack during onboarding conversations.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL, UNIQUE |
| name | text | NOT NULL |
| title | text | |
| skills | text[] | DEFAULT '{}' |
| goals | text | |
| vibe | text | e.g. "Collaborative builder who thrives in fast-paced environments" |
| experience_years | integer | |
| location | text | |
| remote_ok | boolean | DEFAULT true |
| salary_min | integer | in thousands |
| salary_max | integer | |
| onboarding_complete | boolean | DEFAULT false |
| metadata | jsonb | DEFAULT '{}' — extensible structured data extracted by Jack |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### `employers`
Stores employer/company profile data, populated/updated by Jill during briefing conversations.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL, UNIQUE |
| company_name | text | NOT NULL |
| role_title | text | the role they're hiring for |
| role_description | text | |
| required_skills | text[] | DEFAULT '{}' |
| culture_values | text | e.g. "Move fast, ship often, learn together" |
| location | text | |
| remote_ok | boolean | DEFAULT true |
| salary_min | integer | |
| salary_max | integer | |
| team_size | text | |
| briefing_complete | boolean | DEFAULT false |
| metadata | jsonb | DEFAULT '{}' — extensible structured data extracted by Jill |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### `conversations`
Tracks chat sessions between users and their AI agent (Jack or Jill).

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL |
| type | conversation_type | NOT NULL — 'jack' or 'jill' |
| summary | text | AI-generated conversation summary |
| is_complete | boolean | DEFAULT false |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### `messages`
Individual messages within conversations. Stores full chat history for context.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| conversation_id | uuid | FK → `conversations(id)` ON DELETE CASCADE, NOT NULL |
| role | message_role | NOT NULL — 'system', 'assistant', or 'user' |
| content | text | NOT NULL |
| metadata | jsonb | DEFAULT '{}' — AI-extracted structured data (e.g. detected skills, salary expectations) |
| created_at | timestamptz | DEFAULT now() |

### `matches`
Links candidates to employers with a match score and employer decision status.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| candidate_id | uuid | FK → `candidates(id)` ON DELETE CASCADE, NOT NULL |
| employer_id | uuid | FK → `employers(id)` ON DELETE CASCADE, NOT NULL |
| score | integer | NOT NULL, CHECK (score >= 0 AND score <= 100) |
| status | match_status | DEFAULT 'pending' |
| match_summary | text | AI-generated explanation of why this is a good match |
| vibe_match | text | AI-generated culture/vibe fit summary |
| tags | text[] | DEFAULT '{}' — e.g. ['React', 'Remote', 'Series A'] |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |
| | | UNIQUE(candidate_id, employer_id) |

---

## 3. Security Definer Helper Function

Create this **before** any RLS policies. It checks user roles without triggering recursive RLS.

```sql
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
```

---

## 4. Row-Level Security Policies

Enable RLS on **all** tables. Then create these policies:

### `user_roles`
Users can read their own roles only.
```sql
CREATE POLICY "Users can read own roles" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### `candidates`
Candidates can read/update their own row. Employers can read candidates they're matched with. Admins can read all.
```sql
CREATE POLICY "Candidates read own" ON candidates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates update own" ON candidates FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Candidates insert own" ON candidates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Employers read matched candidates" ON candidates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.candidate_id = candidates.id AND e.user_id = auth.uid())
);
CREATE POLICY "Admins read all candidates" ON candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### `employers`
Employers can read/update their own row. Admins can read all.
```sql
CREATE POLICY "Employers read own" ON employers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers update own" ON employers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employers insert own" ON employers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all employers" ON employers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### `conversations`
Users can only access their own conversations.
```sql
CREATE POLICY "Users read own conversations" ON conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own conversations" ON conversations FOR UPDATE TO authenticated USING (user_id = auth.uid());
```

### `messages`
Users can access messages belonging to their conversations.
```sql
CREATE POLICY "Users read own messages" ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users insert own messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
```

### `matches`
Candidates see their own matches. Employers see matches for their roles.
```sql
CREATE POLICY "Candidates read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM candidates c WHERE c.id = matches.candidate_id AND c.user_id = auth.uid())
);
CREATE POLICY "Employers read own matches" ON matches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);
CREATE POLICY "Employers update own match status" ON matches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employers e WHERE e.id = matches.employer_id AND e.user_id = auth.uid())
);
```

---

## 5. Indexes

```sql
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_employers_user_id ON employers(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_type ON conversations(user_id, type);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_matches_candidate ON matches(candidate_id);
CREATE INDEX idx_matches_employer ON matches(employer_id);
CREATE INDEX idx_matches_status ON matches(employer_id, status);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

---

## 6. Triggers

Create an `updated_at` trigger function and apply it to all tables with an `updated_at` column:

```sql
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
```

---

## 7. Execution Order

1. Create custom types (`app_role`, `conversation_type`, `match_status`, `message_role`)
2. Create `user_roles` table
3. Create `has_role` security definer function
4. Create `candidates`, `employers`, `conversations`, `messages`, `matches` tables
5. Enable RLS on all tables
6. Create all RLS policies
7. Create all indexes
8. Create `handle_updated_at` function and triggers

---

This spec is designed for a Supabase PostgreSQL database. All UUIDs reference `auth.users(id)` from Supabase Auth. The `service_role` key should be used by edge functions to bypass RLS when needed (e.g., creating matches).
