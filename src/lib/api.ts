import { supabase } from "@/integrations/supabase/client";

// TODO: Set this to your backend URL
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

// ─── Jack (Candidate Agent) ─────────────────────────────

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

export async function jackTranscript(): Promise<{
  lines: Array<{ speaker: string; text: string }>;
}> {
  return apiRequest("/api/jack/transcript", { method: "POST" });
}

// ─── Jill (Employer Agent) ──────────────────────────────

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

// ─── Candidate Data ─────────────────────────────────────

export async function getCandidateProfile(): Promise<{
  name: string;
  title: string;
  skills: string[];
  goals: string;
  vibe: string;
  experience_years?: number;
  location_preference?: string;
}> {
  return apiRequest("/api/candidate/profile");
}

export async function getCandidateMatches(): Promise<Array<{
  company: string;
  role: string;
  location: string;
  score: number;
  tags: string[];
}>> {
  return apiRequest("/api/candidate/matches");
}

// ─── Employer Data ──────────────────────────────────────

export async function getEmployerCandidates(): Promise<Array<{
  id: number;
  initials: string;
  name: string;
  title: string;
  matchSummary: string;
  vibeMatch: string;
  score: number;
  status: string;
}>> {
  return apiRequest("/api/employer/candidates");
}

export async function updateCandidateStatus(
  candidateId: number,
  status: "approved" | "passed" | "pending"
): Promise<{ success: boolean; matchId: string; newStatus: string }> {
  return apiRequest("/api/employer/candidate-status", {
    method: "POST",
    body: JSON.stringify({ candidateId, status }),
  });
}
