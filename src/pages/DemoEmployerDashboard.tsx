import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  matchCandidateToRole,
  extractJsonObject,
  type DemoCandidateProfile,
  type DemoJobDescription,
  type DemoCompanyContext,
  type MatchResult,
  type EngineEvent,
  ApiError,
} from "@/lib/api";

const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const ACTIVE_ROLE = {
  title: "Senior Frontend Engineer",
  company: {
    name: "Ledgerline",
    industry: "Fintech, developer-first finance platform",
    size: "18 people, Series A",
    culture:
      "Async-first, written communication, deep work over meetings, weekly releases",
    location: "Remote (US/EU timezone overlap)",
  },
  responsibilities:
    "Own the web app architecture, lead the design system, and ship reliable product weekly to a growing customer base of high-growth startups.",
  requirements:
    "5+ years senior frontend; React and TypeScript expert; experience leading design systems; comfortable in async startup environments with high autonomy.",
  compensation: "$150k–$180k base, equity, full benefits",
  skills: ["React", "TypeScript", "Design Systems", "Tailwind", "GraphQL"],
  description:
    "We're building a developer-first finance platform for high-growth startups. Looking for a senior engineer to own the web app architecture, lead the design system, and ship reliable product to a growing customer base. Async-first team, weekly releases, small surface area, high ownership.",
};

interface Candidate extends DemoCandidateProfile {
  // No extra display fields; profile is the source of truth.
}

const CANDIDATES: Candidate[] = [
  {
    name: "Alex Chen",
    title: "Senior Frontend Engineer",
    skills: ["React", "TypeScript", "Design Systems", "Node.js"],
    experience:
      "6 years building web apps at startups; led the design system rebuild at a 50-person Series B fintech",
    preferences:
      "Remote-first, async-friendly teams; values calm focused work and written communication",
    goals:
      "Wants ownership of a meaningful surface area at a small high-trust team",
  },
  {
    name: "Priya Desai",
    title: "Staff Engineer",
    skills: ["React", "Next.js", "GraphQL", "AWS"],
    experience:
      "8 years across consumer and B2B; previously staff engineer at a Series C SaaS company",
    preferences:
      "Hybrid or remote; values fast shipping cadence and strong engineering culture",
    goals: "Looking to lead a small team and influence platform architecture",
  },
  {
    name: "Marcus Okafor",
    title: "Senior UI Engineer",
    skills: ["React", "TypeScript", "Figma", "Storybook"],
    experience:
      "5 years bridging design and engineering; rebuilt a design system from scratch at a healthcare startup",
    preferences:
      "Remote, async, design-engineering-friendly cultures; flexible hours",
    goals:
      "Wants to be the bridge between design and engineering at a small, design-led team",
  },
  {
    name: "Sofia Nakamura",
    title: "Lead Frontend Engineer",
    skills: ["React", "Vue", "Microfrontends", "Kubernetes"],
    experience:
      "9 years; led platform migrations from monolith to microfrontends at a Series D fintech",
    preferences:
      "Open to remote or hybrid; values technical depth and infrastructure ownership",
    goals:
      "Wants to apply systems thinking at a smaller company before founding her own",
  },
  {
    name: "Daniel Park",
    title: "Frontend Engineer",
    skills: ["React", "TypeScript", "Python", "Postgres"],
    experience:
      "4 years full-stack at early-stage startups; comfortable across the stack",
    preferences:
      "Remote, async, generalist environments; loves small teams with broad scope",
    goals:
      "Wants to grow into senior at a place where he can ship across the stack",
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildJobDescription(): DemoJobDescription {
  return {
    title: ACTIVE_ROLE.title,
    responsibilities: ACTIVE_ROLE.responsibilities,
    requirements: ACTIVE_ROLE.requirements,
    compensation: ACTIVE_ROLE.compensation,
  };
}

function buildCompanyContext(): DemoCompanyContext {
  return ACTIVE_ROLE.company;
}

interface AgentStep {
  agent: string;
  status: "running" | "done";
  score?: number;
}

type RowState =
  | { status: "idle" }
  | { status: "loading"; steps: AgentStep[] }
  | { status: "success"; result: MatchResult; steps: AgentStep[] }
  | { status: "error"; steps: AgentStep[]; error: string };

type PageState = "idle" | "matching" | "done" | "noFeature";

function formatAgent(name: string): string {
  return name
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractScore(content: string): number | undefined {
  try {
    const parsed = extractJsonObject(content) as { score?: unknown };
    if (typeof parsed.score === "number") return parsed.score;
  } catch {
    // no JSON object found; no score to extract
  }
  return undefined;
}

export default function DemoEmployerDashboard() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [matches, setMatches] = useState<Map<string, RowState>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const matchAttemptCount = useRef(0);
  const navigate = useNavigate();

  const handleMatch = async () => {
    matchAttemptCount.current += 1;

    // Demo flow: first click simulates "no engine wired up" so we can show the
    // before/after — switch to Fabriq, deploy, come back, click again, it works.
    if (matchAttemptCount.current === 1) {
      setPageState("matching");
      setErrorMessage(null);
      await new Promise((r) => setTimeout(r, 700));
      setPageState("noFeature");
      setErrorMessage(null);
      return;
    }

    setPageState("matching");
    setErrorMessage(null);

    const initial = new Map<string, RowState>();
    CANDIDATES.forEach((c) =>
      initial.set(c.name, { status: "loading", steps: [] })
    );
    setMatches(initial);

    const job = buildJobDescription();
    const company = buildCompanyContext();
    let lastError: string | null = null;
    let successCount = 0;

    await Promise.allSettled(
      CANDIDATES.map(async (c) => {
        const onEvent = (event: EngineEvent) => {
          // status: a new agent has started running. Mark prior running steps done,
          // then append this agent as the new running step.
          if (event.type === "status" && event.agent) {
            const agentName = event.agent;
            setMatches((prev) => {
              const row = prev.get(c.name);
              if (!row || row.status !== "loading") return prev;
              const steps = row.steps.map((s) =>
                s.status === "running" ? { ...s, status: "done" as const } : s
              );
              if (!steps.some((s) => s.agent === agentName && s.status === "done")) {
                steps.push({ agent: agentName, status: "running" });
              }
              const next = new Map(prev);
              next.set(c.name, { ...row, steps });
              return next;
            });
            return;
          }
          // llm_call: agent finished an LLM invocation. Mark its step done and try
          // to extract a numeric score from its output for inline display.
          if (event.type === "llm_call" && event.agent) {
            const agentName = event.agent;
            const score = extractScore(event.content);
            setMatches((prev) => {
              const row = prev.get(c.name);
              if (!row || row.status !== "loading") return prev;
              const steps = row.steps.map((s) =>
                s.agent === agentName && s.status === "running"
                  ? { ...s, status: "done" as const, score }
                  : s
              );
              const next = new Map(prev);
              next.set(c.name, { ...row, steps });
              return next;
            });
          }
        };

        try {
          const result = await matchCandidateToRole(c, job, company, onEvent);
          successCount++;
          setMatches((prev) => {
            const row = prev.get(c.name);
            const steps =
              row && (row.status === "loading" || row.status === "success")
                ? row.steps.map((s) =>
                    s.status === "running"
                      ? { ...s, status: "done" as const }
                      : s
                  )
                : [];
            const next = new Map(prev);
            next.set(c.name, { status: "success", result, steps });
            return next;
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          lastError = errMsg;
          console.error(`[demo] Match failed for ${c.name}:`, e);
          setMatches((prev) => {
            const row = prev.get(c.name);
            const steps =
              row && (row.status === "loading" || row.status === "error")
                ? row.steps
                : [];
            const next = new Map(prev);
            next.set(c.name, { status: "error", steps, error: errMsg });
            return next;
          });
        }
      })
    );

    if (successCount === 0) {
      setPageState("noFeature");
      setErrorMessage(lastError);
    } else {
      setPageState("done");
    }
  };

  const getRow = (name: string): RowState =>
    matches.get(name) ?? { status: "idle" };

  const isMatching = pageState === "matching";

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#F7F5F0", color: "#18181B" }}
    >
      <nav
        className="sticky top-0 z-10"
        style={{
          backgroundColor: "#F7F5F0",
          borderBottom: "1px solid #E8E4DA",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-[17px] leading-none tracking-tight"
            style={{
              color: "#18181B",
              fontFamily: '"Instrument Serif", Georgia, serif',
            }}
          >
            pairwise
          </button>
          <div className="flex items-center gap-5">
            <span
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ color: "#78716C", fontFamily: MONO }}
            >
              Employer
            </span>
            <div
              className="w-8 h-8 flex items-center justify-center text-[11px] font-semibold"
              style={{
                backgroundColor: "#EFEAE0",
                color: "#1C1917",
                border: "1px solid #E0DACD",
                borderRadius: "4px",
                fontFamily: MONO,
              }}
            >
              LL
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <div
            className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "#15803D", fontFamily: MONO }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#15803D" }}
            />
            Active Role
          </div>
          <h1
            className="text-[32px] font-bold tracking-tight leading-[1.1] mb-2"
            style={{ color: "#0C0A09", letterSpacing: "-0.025em" }}
          >
            {ACTIVE_ROLE.title}
          </h1>
          <p className="text-[15px] mb-5" style={{ color: "#44403C" }}>
            <span className="font-semibold" style={{ color: "#0C0A09" }}>
              {ACTIVE_ROLE.company.name}
            </span>
            <span className="mx-2" style={{ color: "#D6D3D1" }}>
              /
            </span>
            {ACTIVE_ROLE.company.industry}
          </p>
          <p
            className="text-[14px] leading-[1.65] max-w-3xl mb-5"
            style={{ color: "#44403C" }}
          >
            {ACTIVE_ROLE.description}
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 max-w-3xl mb-5">
            <div>
              <dt
                className="text-[10px] uppercase tracking-[0.14em] mb-0.5"
                style={{ color: "#78716C", fontFamily: MONO }}
              >
                Location
              </dt>
              <dd className="text-[13px]" style={{ color: "#1C1917" }}>
                {ACTIVE_ROLE.company.location}
              </dd>
            </div>
            <div>
              <dt
                className="text-[10px] uppercase tracking-[0.14em] mb-0.5"
                style={{ color: "#78716C", fontFamily: MONO }}
              >
                Compensation
              </dt>
              <dd className="text-[13px]" style={{ color: "#1C1917" }}>
                {ACTIVE_ROLE.compensation}
              </dd>
            </div>
            <div>
              <dt
                className="text-[10px] uppercase tracking-[0.14em] mb-0.5"
                style={{ color: "#78716C", fontFamily: MONO }}
              >
                Team
              </dt>
              <dd className="text-[13px]" style={{ color: "#1C1917" }}>
                {ACTIVE_ROLE.company.size}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            {ACTIVE_ROLE.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "#EFEAE0",
                  color: "#1C1917",
                  border: "1px solid #E0DACD",
                  borderRadius: "3px",
                  fontFamily: MONO,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </motion.section>

        <div
          className="h-px mb-8"
          style={{ backgroundColor: "#E8E4DA" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h2
              className="text-[20px] font-bold tracking-tight"
              style={{ color: "#0C0A09", letterSpacing: "-0.02em" }}
            >
              Candidate pool
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "#78716C" }}>
              <span style={{ fontFamily: MONO, color: "#1C1917" }}>
                {CANDIDATES.length}
              </span>{" "}
              candidates available to match against this role
            </p>
          </div>
          <button
            onClick={handleMatch}
            disabled={isMatching}
            className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all disabled:cursor-not-allowed"
            style={{
              backgroundColor: isMatching ? "#166534" : "#14532D",
              color: "#F0FDF4",
              borderRadius: "5px",
              boxShadow:
                "0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 1px 2px rgba(20, 83, 45, 0.18)",
              opacity: isMatching ? 0.85 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isMatching) {
                e.currentTarget.style.backgroundColor = "#0F3D20";
              }
            }}
            onMouseLeave={(e) => {
              if (!isMatching) {
                e.currentTarget.style.backgroundColor = "#14532D";
              }
            }}
          >
            {isMatching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Matching candidates
              </>
            ) : (
              <>
                Match candidates against this role
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </motion.div>

        <AnimatePresence>
          {pageState === "noFeature" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-3 px-4 py-3"
              style={{
                backgroundColor: "#FEF7EC",
                border: "1px solid #F5DDB0",
                borderRadius: "5px",
              }}
            >
              <AlertCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "#B45309" }}
              />
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "#78350F" }}
                >
                  Feature not available
                </p>
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: "#92400E" }}
                >
                  This capability has not been deployed to the engine yet.
                  {errorMessage && (
                    <span
                      className="block mt-1 opacity-70"
                      style={{ fontFamily: MONO, fontSize: "11px" }}
                    >
                      {errorMessage}
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E8E4DA",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {CANDIDATES.map((candidate, i) => {
            const row = getRow(candidate.name);
            const isLast = i === CANDIDATES.length - 1;
            return (
              <motion.div
                key={candidate.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
                className="px-5 py-5 transition-colors"
                style={{
                  borderBottom: isLast ? "none" : "1px solid #F0EBE0",
                  backgroundColor:
                    row.status === "success" ? "#FCFAF5" : "#FFFFFF",
                }}
              >
                <div className="flex items-start gap-5">
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0 text-[12px] font-semibold"
                    style={{
                      backgroundColor: "#EFEAE0",
                      color: "#1C1917",
                      border: "1px solid #E0DACD",
                      borderRadius: "4px",
                      fontFamily: MONO,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {getInitials(candidate.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3
                        className="text-[15px] font-semibold tracking-tight"
                        style={{ color: "#0C0A09" }}
                      >
                        {candidate.name}
                      </h3>
                      <span
                        className="text-[13px]"
                        style={{ color: "#57534E" }}
                      >
                        {candidate.title}
                      </span>
                    </div>

                    <p
                      className="text-[13px] mt-1.5 leading-[1.55]"
                      style={{ color: "#57534E" }}
                    >
                      {candidate.experience}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {candidate.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-1.5 py-0.5 text-[10.5px]"
                          style={{
                            backgroundColor: "#F7F5F0",
                            color: "#44403C",
                            border: "1px solid #EDE8DC",
                            borderRadius: "3px",
                            fontFamily: MONO,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {(row.status === "loading" || row.status === "success") &&
                      row.steps.length > 0 && (
                        <div className="mt-3 space-y-1 max-w-sm">
                          <AnimatePresence initial={false}>
                            {row.steps.map((step) => (
                              <motion.div
                                key={step.agent}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25 }}
                                className="flex items-center gap-2"
                              >
                                {step.status === "running" ? (
                                  <Loader2
                                    className="w-3 h-3 animate-spin shrink-0"
                                    style={{ color: "#A8A29E" }}
                                  />
                                ) : (
                                  <Check
                                    className="w-3 h-3 shrink-0"
                                    style={{ color: "#15803D" }}
                                    strokeWidth={3}
                                  />
                                )}
                                <span
                                  className="text-[11.5px]"
                                  style={{
                                    fontFamily: MONO,
                                    color:
                                      step.status === "running"
                                        ? "#78716C"
                                        : "#1C1917",
                                  }}
                                >
                                  {formatAgent(step.agent)}
                                </span>
                                {step.score !== undefined && (
                                  <span
                                    className="ml-auto tabular-nums text-[11.5px] font-semibold"
                                    style={{
                                      fontFamily: MONO,
                                      color: "#15803D",
                                    }}
                                  >
                                    {step.score}
                                  </span>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                    <AnimatePresence>
                      {row.status === "success" && (
                        <motion.div
                          key="reason"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div
                            className="pl-4 py-1"
                            style={{ borderLeft: "2px solid #15803D" }}
                          >
                            <div
                              className="text-[10px] uppercase tracking-[0.14em] mb-1"
                              style={{
                                color: "#15803D",
                                fontFamily: MONO,
                              }}
                            >
                              Match reasoning
                            </div>
                            <p
                              className="text-[13px] leading-[1.6]"
                              style={{ color: "#1C1917" }}
                            >
                              {row.result.reason}
                            </p>
                          </div>
                        </motion.div>
                      )}
                      {row.status === "error" && (
                        <motion.div
                          key="error-detail"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div
                            className="pl-4 py-1"
                            style={{ borderLeft: "2px solid #B45309" }}
                          >
                            <div
                              className="text-[10px] uppercase tracking-[0.14em] mb-1"
                              style={{
                                color: "#B45309",
                                fontFamily: MONO,
                              }}
                            >
                              Match failed
                            </div>
                            <p
                              className="text-[12px] leading-[1.55] break-words"
                              style={{
                                color: "#78350F",
                                fontFamily: MONO,
                              }}
                            >
                              {row.error}
                            </p>
                            <p
                              className="text-[10.5px] mt-1.5"
                              style={{ color: "#A8A29E" }}
                            >
                              Open the browser console for the raw synthesizer output.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="shrink-0 flex flex-col items-end justify-start min-w-[72px] pt-0.5">
                    <AnimatePresence mode="wait">
                      {row.status === "success" && (
                        <motion.div
                          key="score"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="flex flex-col items-end"
                        >
                          <div
                            className="flex items-baseline tabular-nums leading-none"
                            style={{
                              color: "#14532D",
                              letterSpacing: "-0.04em",
                              fontFamily: MONO,
                            }}
                          >
                            <span className="text-[28px] font-bold">
                              {row.result.score}
                            </span>
                            <span
                              className="text-[14px] font-semibold ml-0.5"
                              style={{ color: "#22C55E" }}
                            >
                              %
                            </span>
                          </div>
                          <p
                            className="text-[10px] uppercase tracking-[0.14em] mt-1"
                            style={{
                              color: "#15803D",
                              fontFamily: MONO,
                            }}
                          >
                            Match
                          </p>
                        </motion.div>
                      )}
                      {row.status === "loading" && (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-end"
                        >
                          <Loader2
                            className="w-4 h-4 animate-spin"
                            style={{ color: "#A8A29E" }}
                          />
                          <p
                            className="text-[10px] uppercase tracking-[0.14em] mt-2"
                            style={{
                              color: "#A8A29E",
                              fontFamily: MONO,
                            }}
                          >
                            Scoring
                          </p>
                        </motion.div>
                      )}
                      {row.status === "idle" && (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-end"
                        >
                          <span
                            className="text-[20px] leading-none"
                            style={{
                              color: "#D6D3D1",
                              fontFamily: MONO,
                            }}
                          >
                            —
                          </span>
                          <p
                            className="text-[10px] uppercase tracking-[0.14em] mt-2"
                            style={{
                              color: "#A8A29E",
                              fontFamily: MONO,
                            }}
                          >
                            Unscored
                          </p>
                        </motion.div>
                      )}
                      {row.status === "error" && (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-end"
                        >
                          <AlertCircle
                            className="w-4 h-4"
                            style={{ color: "#B45309" }}
                          />
                          <p
                            className="text-[10px] uppercase tracking-[0.14em] mt-2"
                            style={{
                              color: "#B45309",
                              fontFamily: MONO,
                            }}
                          >
                            Failed
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {pageState === "done" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[11px] mt-6 uppercase tracking-[0.14em]"
            style={{ color: "#A8A29E", fontFamily: MONO }}
          >
            Matches generated by Fabriq
          </motion.p>
        )}
      </div>
    </div>
  );
}
