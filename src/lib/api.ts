import { supabase } from "@/integrations/supabase/client";

// The auto-generated types are empty until schema syncs.
// Cast to `any` for .from() calls against live DB tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Backend API (AI chat endpoints only) ───────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, error.error || "Request failed", error.code);
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Jack (Candidate AI Agent) ──────────────────────────

export async function jackGreeting(): Promise<{ message: string }> {
  return apiRequest("/api/jack/greeting", { method: "POST" });
}

export async function jackChat(message: string, conversationType?: string): Promise<{
  reply: string;
  profileUpdates?: Record<string, unknown> | null;
}> {
  return apiRequest("/api/jack/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversationType }),
  });
}

// ─── Jill (Employer AI Agent) ───────────────────────────

export async function jillGreeting(): Promise<{ message: string }> {
  return apiRequest("/api/jill/greeting", { method: "POST" });
}

export async function jillChat(message: string): Promise<{
  reply: string;
  briefingComplete: boolean;
  briefingData?: Record<string, unknown>;
}> {
  return apiRequest("/api/jill/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ─── Direct DB: Candidate Profile ───────────────────────

export interface CandidateProfile {
  name: string;
  title: string | null;
  skills: string[];
  goals: string | null;
  vibe: string | null;
  experience_years: number | null;
  location: string | null;
}

export async function getCandidateProfile(): Promise<CandidateProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("candidates")
    .select("name, title, skills, goals, vibe, experience_years, location")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as CandidateProfile;
}

// ─── Direct DB: Candidate Matches ───────────────────────

export interface CandidateMatch {
  company: string;
  role: string;
  location: string;
  score: number;
  tags: string[];
}

export async function getCandidateMatches(): Promise<CandidateMatch[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: candidate } = await db
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) return [];

  const { data, error } = await db
    .from("matches")
    .select("score, tags, match_summary, employers(company_name, role_title, location)")
    .eq("candidate_id", candidate.id)
    .order("score", { ascending: false });

  if (error || !data) return [];

  return data.map((m: any) => ({
    company: m.employers?.company_name || "Unknown",
    role: m.employers?.role_title || "Unknown",
    location: m.employers?.location || "Remote",
    score: m.score,
    tags: m.tags || [],
  }));
}

// ─── Direct DB: Transcript ─────────────────────────────

export interface TranscriptLine {
  speaker: string;
  text: string;
}

export async function getTranscript(): Promise<TranscriptLine[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: conversation } = await db
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "jack")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) return [];

  const { data: messages, error } = await db
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error || !messages) return [];

  return messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      speaker: m.role === "assistant" ? "Jack" : "You",
      text: m.content,
    }));
}

// ─── Direct DB: Employer Candidates ─────────────────────

export interface EmployerCandidate {
  id: string;
  initials: string;
  name: string;
  title: string;
  matchSummary: string;
  vibeMatch: string;
  score: number;
  status: "pending" | "approved" | "passed";
}

export async function getEmployerCandidates(): Promise<EmployerCandidate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: employer } = await db
    .from("employers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!employer) return [];

  const { data, error } = await db
    .from("matches")
    .select("id, score, status, match_summary, vibe_match, candidates(id, name, title)")
    .eq("employer_id", employer.id)
    .order("score", { ascending: false });

  if (error || !data) return [];

  return data.map((m: any) => {
    const name = m.candidates?.name || "Unknown";
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return {
      id: m.id,
      initials,
      name,
      title: m.candidates?.title || "",
      matchSummary: m.match_summary || "",
      vibeMatch: m.vibe_match || "",
      score: m.score,
      status: m.status as "pending" | "approved" | "passed",
    };
  });
}

// ─── Direct DB: Update Candidate Status ─────────────────

export async function updateCandidateStatus(
  matchId: string,
  status: "approved" | "passed" | "pending"
): Promise<void> {
  const { error } = await db
    .from("matches")
    .update({ status })
    .eq("id", matchId);

  if (error) throw new Error(error.message);
}
