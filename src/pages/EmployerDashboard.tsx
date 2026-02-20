import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Sparkles, Filter, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

type CandidateStatus = "pending" | "approved" | "passed";

interface Candidate {
  id: number;
  initials: string;
  name: string;
  title: string;
  matchSummary: string;
  vibeMatch: string;
  score: number;
  status: CandidateStatus;
}

const initialCandidates: Candidate[] = [
  { id: 1, initials: "SR", name: "Sarah R.", title: "Senior Frontend Engineer", matchSummary: "8 years React/TypeScript, fintech background at Plaid. Strong system design skills.", vibeMatch: "Culture-add: values autonomy, ships fast, mentors juniors", score: 95, status: "pending" },
  { id: 2, initials: "MK", name: "Marcus K.", title: "Frontend Engineer", matchSummary: "5 years experience, full-stack leaning. Led migration to Next.js at a Series B startup.", vibeMatch: "Collaborative, thrives in small teams, product-minded", score: 89, status: "pending" },
  { id: 3, initials: "LP", name: "Lisa P.", title: "Staff Engineer", matchSummary: "10+ years, design systems expert. Previous: Stripe, Figma. Strong in accessibility.", vibeMatch: "Meticulous, design-sensitive, strong communicator", score: 87, status: "pending" },
  { id: 4, initials: "JT", name: "James T.", title: "Senior Frontend Developer", matchSummary: "6 years React, mobile-first expertise. Built consumer apps with 1M+ users.", vibeMatch: "Energetic, user-obsessed, startup DNA", score: 82, status: "pending" },
];

const EmployerDashboard = () => {
  const [candidates, setCandidates] = useState(initialCandidates);
  const navigate = useNavigate();

  const updateStatus = (id: number, status: CandidateStatus) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const statusColors: Record<CandidateStatus, string> = {
    pending: "text-muted-foreground",
    approved: "jill-accent",
    passed: "text-muted-foreground/50",
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate("/")} className="font-display text-lg font-bold">
          Jack <span className="text-muted-foreground">&</span> Jill
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Employer Portal</span>
          <div className="w-8 h-8 rounded-lg bg-jill-muted flex items-center justify-center">
            <span className="text-xs font-semibold jill-accent">AC</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-2xl font-bold mb-1">Your Curated Shortlist</h1>
          <p className="text-muted-foreground text-sm">
            Senior Frontend Engineer · Fintech Startup · Remote OK
          </p>
        </motion.div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm text-secondary-foreground hover:bg-accent transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm text-secondary-foreground hover:bg-accent transition-colors">
            Sort by match <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <div className="ml-auto text-sm text-muted-foreground">
            {candidates.filter((c) => c.status === "approved").length} approved · {candidates.filter((c) => c.status === "pending").length} pending
          </div>
        </div>

        {/* Candidate Cards */}
        <div className="grid gap-4">
          {candidates.map((candidate, i) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`glass-card p-6 transition-all ${
                candidate.status === "passed" ? "opacity-50" : "hover:border-jill/20"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-5">
                {/* Avatar + Score */}
                <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-jill-muted flex items-center justify-center">
                    <span className="font-display text-lg font-bold jill-accent">{candidate.initials}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-display font-bold jill-accent">{candidate.score}%</p>
                    <p className="text-xs text-muted-foreground">Match</p>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{candidate.name}</h3>
                    <span className="text-sm text-muted-foreground">· {candidate.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{candidate.matchSummary}</p>
                  <div className="flex items-start gap-2 text-sm">
                    <Sparkles className="w-3.5 h-3.5 jill-accent mt-0.5 shrink-0" />
                    <p className="text-secondary-foreground">{candidate.vibeMatch}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 shrink-0">
                  {candidate.status === "pending" ? (
                    <>
                      <button
                        onClick={() => updateStatus(candidate.id, "approved")}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-jill text-jill-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => updateStatus(candidate.id, "passed")}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-muted-foreground text-sm hover:bg-accent transition-colors"
                      >
                        <X className="w-4 h-4" /> Pass
                      </button>
                    </>
                  ) : (
                    <span className={`text-sm font-medium ${statusColors[candidate.status]}`}>
                      {candidate.status === "approved" ? "✓ Approved" : "Passed"}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;
