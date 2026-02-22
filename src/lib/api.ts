import { supabase } from "@/integrations/supabase/client";

// Cast for untyped table access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Engine proxy (SSE backend via edge function) ───────

function stripCodeFence(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

async function engineCall(slug: string, data: Record<string, string>): Promise<string> {
  // Chat endpoints use streaming to avoid platform timeouts
  const isChat = slug.includes("chat");

  if (isChat) {
    return engineCallStream(slug, data);
  }

  const { data: result, error } = await supabase.functions.invoke("engine-proxy", {
    body: { slug, data },
  });

  if (error) throw new ApiError(500, error.message);
  if (result?.error) throw new ApiError(500, result.error);
  return result.content as string;
}

async function engineCallStream(slug: string, data: Record<string, string>): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/engine-proxy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ slug, data, stream: true }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new ApiError(response.status, err);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let tokenContent: string | null = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "token") {
          tokenContent = event.content;
        }
        if (event.type === "error") {
          throw new ApiError(500, event.content);
        }
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
  }

  if (tokenContent === null) {
    throw new ApiError(502, "No token event received from engine");
  }
  return tokenContent;
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

export async function jackGreeting(candidateProfile?: string): Promise<{ message: string }> {
  const content = await engineCall("jack-greeting", {
    candidate_profile: candidateProfile || "none",
  });
  return { message: content };
}

export async function jackChat(
  message: string,
  conversationHistory: string,
  candidateProfile: string
): Promise<{
  reply: string;
  profileUpdates?: Record<string, unknown> | null;
}> {
  const content = await engineCall("jack-chat", {
    message,
    conversation_history: conversationHistory || "none",
    candidate_profile: candidateProfile || "none",
  });

  // Engine may return structured JSON or plain text
  const stripped = stripCodeFence(content);
  try {
    const parsed = JSON.parse(stripped);
    return {
      reply: parsed.reply || stripped,
      profileUpdates: parsed.profileUpdates || null,
    };
  } catch {
    // Plain text response — use as-is
    return { reply: stripped, profileUpdates: null };
  }
}

// ─── Jill (Employer AI Agent) ───────────────────────────

export async function jillGreeting(employerProfile?: string): Promise<{ message: string }> {
  const content = await engineCall("jill-greeting", {
    employer_profile: employerProfile || "none",
  });
  return { message: content };
}

export async function jillChat(
  message: string,
  conversationHistory: string,
  employerProfile: string,
  briefingData: string
): Promise<{
  reply: string;
  briefingComplete: boolean;
  briefingData?: Record<string, unknown>;
}> {
  const content = await engineCall("jill-chat", {
    message,
    conversation_history: conversationHistory || "none",
    employer_profile: employerProfile || "none",
    briefing_data: briefingData || "none",
  });

  const stripped = stripCodeFence(content);
  try {
    const parsed = JSON.parse(stripped);
    return {
      reply: parsed.reply || stripped,
      briefingComplete: parsed.briefingComplete ?? false,
      briefingData: parsed.briefingData || undefined,
    };
  } catch {
    return { reply: stripped, briefingComplete: false };
  }
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
  remote_ok: boolean | null;
  salary_min: number | null;
  salary_max: number | null;
}

export async function getCandidateProfile(): Promise<CandidateProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("candidates")
    .select("name, title, skills, goals, vibe, experience_years, location, remote_ok, salary_min, salary_max")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as CandidateProfile;
}

export function formatCandidateProfile(p: CandidateProfile): string {
  const parts = [`name: ${p.name}`];
  if (p.title) parts.push(`title: ${p.title}`);
  if (p.skills?.length) parts.push(`skills: [${p.skills.join(", ")}]`);
  if (p.goals) parts.push(`goals: ${p.goals}`);
  if (p.vibe) parts.push(`vibe: ${p.vibe}`);
  if (p.experience_years != null) parts.push(`experience_years: ${p.experience_years}`);
  if (p.location) parts.push(`location: ${p.location}`);
  if (p.remote_ok != null) parts.push(`remote_ok: ${p.remote_ok}`);
  if (p.salary_min != null) parts.push(`salary_min: ${p.salary_min}`);
  if (p.salary_max != null) parts.push(`salary_max: ${p.salary_max}`);
  return parts.join(", ");
}

export async function updateCandidateProfile(updates: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await db
    .from("candidates")
    .update(updates)
    .eq("user_id", user.id);

  if (error) console.error("Failed to update candidate profile:", error);
}

// ─── Direct DB: Employer Profile ────────────────────────

export interface EmployerProfile {
  company_name: string;
  role_title: string | null;
  required_skills: string[] | null;
  location: string | null;
  remote_ok: boolean | null;
  team_size: string | null;
  salary_min: number | null;
  salary_max: number | null;
  culture_values: string | null;
  role_description: string | null;
}

export async function getEmployerProfile(): Promise<EmployerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("employers")
    .select("company_name, role_title, required_skills, location, remote_ok, team_size, salary_min, salary_max, culture_values, role_description")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as EmployerProfile;
}

export function formatEmployerProfile(p: EmployerProfile): string {
  const parts = [`company_name: ${p.company_name}`];
  if (p.role_title) parts.push(`role_title: ${p.role_title}`);
  if (p.required_skills?.length) parts.push(`required_skills: [${p.required_skills.join(", ")}]`);
  if (p.location) parts.push(`location: ${p.location}`);
  if (p.remote_ok != null) parts.push(`remote_ok: ${p.remote_ok}`);
  if (p.team_size) parts.push(`team_size: ${p.team_size}`);
  return parts.join(", ");
}

export function formatBriefingData(p: Record<string, unknown>): string {
  return Object.entries(p)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export async function updateEmployerProfile(updates: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await db
    .from("employers")
    .update(updates)
    .eq("user_id", user.id);

  if (error) console.error("Failed to update employer profile:", error);
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

export async function getTranscript(type: "jack" | "jill" = "jack"): Promise<TranscriptLine[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: conversation } = await db
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", type)
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

  const agentName = type === "jack" ? "Jack" : "Jill";
  return messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      speaker: m.role === "assistant" ? agentName : "You",
      text: m.content,
    }));
}

export function formatConversationHistory(lines: TranscriptLine[]): string {
  if (lines.length === 0) return "none";
  return lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
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
