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

// Defensive JSON extraction. LLM agents sometimes wrap their JSON in markdown
// (headers, prose, code fences) despite prompt instructions. Try direct parse,
// then code-fence stripping, then locate the first balanced object.
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // try next strategy
  }

  const stripped = stripCodeFence(trimmed);
  try {
    return JSON.parse(stripped);
  } catch {
    // try next strategy
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  throw new Error(
    `Could not extract JSON from response: ${raw.slice(0, 200)}${raw.length > 200 ? "..." : ""}`
  );
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

// ─── Direct engine call (bypasses Supabase edge function) ───
// Used by the demo page so we can swap engines via .env without
// redeploying the edge function. Reads VITE_ENGINE_URL and
// VITE_ENGINE_API_KEY from .env.local.

export interface EngineEvent {
  type: string;
  content: string;
  agent?: string;
  thread_id?: string;
  meta?: Record<string, unknown>;
}

interface DirectEngineCallOptions {
  dev?: boolean;
  onEvent?: (event: EngineEvent) => void;
}

async function directEngineCall(
  slug: string,
  data: Record<string, unknown>,
  options: DirectEngineCallOptions = {}
): Promise<string> {
  const engineUrl = import.meta.env.VITE_ENGINE_URL;
  const apiKey = import.meta.env.VITE_ENGINE_API_KEY;

  if (!engineUrl || !apiKey) {
    throw new ApiError(
      500,
      "VITE_ENGINE_URL and VITE_ENGINE_API_KEY must be set in .env.local"
    );
  }

  const path = options.dev ? `dev/run/${slug}` : `run/${slug}`;
  const response = await fetch(`${engineUrl}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fabriq-Key": apiKey,
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new ApiError(response.status, errText || `Engine returned ${response.status}`);
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
        const event = JSON.parse(line.slice(6)) as EngineEvent;
        options.onEvent?.(event);
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

// ─── Demo: Match Candidate to Role ──────────────────────

export interface DemoCandidateProfile {
  name: string;
  title: string;
  skills: string[];
  experience: string;
  preferences: string;
  goals: string;
}

export interface DemoJobDescription {
  title: string;
  responsibilities: string;
  requirements: string;
  compensation: string;
}

export interface DemoCompanyContext {
  name: string;
  culture: string;
  size: string;
  industry: string;
  location: string;
}

export interface MatchResult {
  score: number;
  reason: string;
}

function isMatchResult(v: unknown): v is MatchResult {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { score?: unknown }).score === "number" &&
    typeof (v as { reason?: unknown }).reason === "string"
  );
}

function cleanMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*\u2022]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractReasonFromProse(content: string): string {
  // Prefer labelled sections in order of usefulness for a "match insight" panel.
  const labels = ["Key Strength", "Recommendation", "Assessment Summary"];
  for (const label of labels) {
    const re = new RegExp(
      `\\*{0,2}${label}\\*{0,2}\\s*:?\\s*\\*{0,2}\\s*([^\\n]+(?:\\n(?!\\s*\\n|\\s*\\*\\*[A-Z])[^\\n]+)*)`,
      "i"
    );
    const m = content.match(re);
    if (m && m[1]) {
      const cleaned = cleanMarkdown(m[1]);
      if (cleaned.length >= 20) return cleaned;
    }
  }
  const cleaned = cleanMarkdown(content);
  return cleaned.length > 360 ? cleaned.slice(0, 360).trim() + "..." : cleaned;
}

// If the synthesizer outputs prose instead of JSON (despite the schema),
// rescue the score and reason via regex so the demo still renders.
function rescueFromProse(content: string): MatchResult | null {
  const scorePatterns = [
    /final\s+score[^0-9]{0,20}(\d{1,3})/i,
    /overall\s+score[^0-9]{0,20}(\d{1,3})/i,
    /match\s+score[^0-9]{0,20}(\d{1,3})/i,
    /total\s+score[^0-9]{0,20}(\d{1,3})/i,
    /\b(\d{1,3})\s*\/\s*100\b/,
  ];
  let score: number | null = null;
  for (const re of scorePatterns) {
    const m = content.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 0 && n <= 100) {
        score = n;
        break;
      }
    }
  }
  if (score === null) return null;
  return { score, reason: extractReasonFromProse(content) };
}

export async function matchCandidateToRole(
  candidateProfile: DemoCandidateProfile,
  jobDescription: DemoJobDescription,
  companyContext: DemoCompanyContext,
  onEvent?: (event: EngineEvent) => void
): Promise<MatchResult> {
  const content = await directEngineCall(
    "match-candidate-to-role",
    { candidateProfile, jobDescription, companyContext },
    { dev: true, onEvent }
  );

  // Preferred path: synthesizer respects the schema and emits JSON.
  let parsed: unknown = null;
  try {
    parsed = extractJsonObject(content);
  } catch {
    // No JSON in the response; fall through to prose rescue.
  }
  if (isMatchResult(parsed)) {
    return parsed;
  }

  // Fallback: synthesizer is outputting markdown prose. Rescue via regex
  // so the demo still renders. The synthesizer prompt should be fixed
  // to enforce JSON output; this is a band-aid until then.
  const rescued = rescueFromProse(content);
  if (rescued) {
    console.warn(
      `[match-candidate-to-role] Synthesizer for ${candidateProfile.name} returned prose, not JSON. Rescued via regex (score=${rescued.score}). Fix the synthesizer prompt to enforce schema.`,
      content
    );
    return rescued;
  }

  console.warn(
    `[match-candidate-to-role] Could not extract a score or JSON for ${candidateProfile.name}. Raw synthesizer output:`,
    content
  );
  throw new Error(
    `Synthesizer output unparseable: ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`
  );
}
