import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Users, Zap, Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"jobs" | "hiring">("jobs");
  const isHiring = mode === "hiring";

  return (
    <div className={isHiring ? "dark" : ""}>
      <div className={`min-h-screen bg-background text-foreground transition-colors duration-300 ${isHiring ? "font-serif" : ""}`}>
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-6 border-b-2 border-border">
          <div className="font-display text-xl font-bold uppercase tracking-tight">
            Jack & Jill
          </div>

          {/* Toggle */}
          <div className="flex items-center border-2 border-border brutal-shadow">
            <button
              onClick={() => setMode("jobs")}
              className={`px-5 py-2 text-sm font-display font-bold uppercase tracking-wider transition-colors ${
                !isHiring
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              Find Jobs
            </button>
            <button
              onClick={() => setMode("hiring")}
              className={`px-5 py-2 text-sm font-display font-bold uppercase tracking-wider transition-colors ${
                isHiring
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              Hiring
            </button>
          </div>
        </nav>

        {/* Hero */}
        <main className="px-6 md:px-12 pt-16 md:pt-24 pb-20 max-w-6xl mx-auto">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {!isHiring ? (
              /* ── FIND JOBS MODE ── */
              <>
                <div className="mb-12">
                  <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold uppercase leading-[0.95] mb-6">
                    Talk.<br />
                    Don't<br />
                    <span className="text-primary">Apply.</span>
                  </h1>
                  <p className="text-lg md:text-xl max-w-xl leading-relaxed text-muted-foreground">
                    Have a real conversation about your career. No forms, no uploads—just talk.
                    Jack finds opportunities that match your vibe.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-20">
                  <button
                    onClick={() => navigate("/candidate/onboarding")}
                    className="brutal-btn bg-primary text-primary-foreground px-8 py-4 text-lg flex items-center gap-3"
                  >
                    <Mic className="w-5 h-5" />
                    Start talking to Jack
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Feature cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    {
                      icon: Mic,
                      title: "Voice-first",
                      desc: "Talk naturally about what you want. No keyword-stuffed resumes.",
                    },
                    {
                      icon: Zap,
                      title: "10x faster",
                      desc: "Skip the application black hole. Get matched in days, not months.",
                    },
                    {
                      icon: Star,
                      title: "94% satisfaction",
                      desc: "Candidates love it. Because it actually works.",
                    },
                  ].map((f) => (
                    <div
                      key={f.title}
                      className="border-2 border-border p-6 brutal-shadow bg-card"
                    >
                      <f.icon className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-display text-lg font-bold uppercase mb-2">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {f.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* ── HIRING MODE ── */
              <>
                <div className="mb-12">
                  <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] mb-6 tracking-tight">
                    Describe.<br />
                    Don't<br />
                    <span className="text-primary italic">Search.</span>
                  </h1>
                  <p className="text-lg md:text-xl max-w-xl leading-relaxed text-muted-foreground font-serif">
                    Tell Jill about your dream hire in plain language. She curates a shortlist
                    of vetted candidates who actually fit your culture.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-20">
                  <button
                    onClick={() => navigate("/employer/briefing")}
                    className="brutal-btn bg-primary text-primary-foreground px-8 py-4 text-lg flex items-center gap-3"
                  >
                    <Users className="w-5 h-5" />
                    Brief your role to Jill
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Feature cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    {
                      icon: Users,
                      title: "Culture match",
                      desc: "Not just skills. Jill understands team dynamics and vibe.",
                    },
                    {
                      icon: Clock,
                      title: "3-day shortlist",
                      desc: "From briefing to vetted candidates in 72 hours.",
                    },
                    {
                      icon: Zap,
                      title: "Zero noise",
                      desc: "No more sifting through hundreds of unqualified applicants.",
                    },
                  ].map((f) => (
                    <div
                      key={f.title}
                      className="border-2 border-border p-6 brutal-shadow-accent bg-card"
                    >
                      <f.icon className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-serif text-lg font-bold mb-2 tracking-tight">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed font-serif">
                        {f.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* Stats bar */}
          <div className="mt-20 border-t-2 border-border pt-10 flex flex-wrap justify-between gap-8">
            {[
              { value: "10x", label: "Faster than traditional hiring" },
              { value: "94%", label: "Candidate satisfaction" },
              { value: "3 days", label: "Average time to shortlist" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-4xl md:text-5xl font-bold text-primary">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Landing;
