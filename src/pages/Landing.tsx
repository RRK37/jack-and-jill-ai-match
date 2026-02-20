import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(220_14%_12%/_0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(220_14%_12%/_0.5)_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-jack/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-jill/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-6">
          <div className="font-display text-xl font-bold tracking-tight">
            Jack <span className="text-muted-foreground">&</span> Jill
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/candidate/onboarding")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              For Candidates
            </button>
            <button
              onClick={() => navigate("/employer/briefing")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              For Employers
            </button>
          </div>
        </nav>

        {/* Hero */}
        <main className="px-6 md:px-12 pt-20 md:pt-32 pb-20 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-secondary/50 text-sm text-muted-foreground mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              AI-powered recruiting, reimagined
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Recruiting that feels
              <br />
              like a <span className="text-gradient-jack">conversation</span>,
              <br />
              not a <span className="text-muted-foreground">transaction</span>.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Meet Jack and Jill—your AI recruiting partners who understand the
              human side of hiring. Talk, don't type. Connect, don't apply.
            </p>
          </motion.div>

          {/* Split CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          >
            {/* Jack CTA */}
            <button
              onClick={() => navigate("/candidate/onboarding")}
              className="group relative glass-card p-8 text-left hover:border-jack/30 transition-all duration-300 jack-glow hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-jack-muted flex items-center justify-center">
                  <Mic className="w-6 h-6 jack-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">For Candidates</p>
                  <h3 className="font-display text-xl font-semibold">Talk to Jack</h3>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Have a real conversation about your career goals. No forms, no uploads—just talk. Jack finds opportunities that match your vibe.
              </p>
              <div className="flex items-center gap-2 jack-accent text-sm font-medium group-hover:gap-3 transition-all">
                Start a conversation <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* Jill CTA */}
            <button
              onClick={() => navigate("/employer/briefing")}
              className="group relative glass-card p-8 text-left hover:border-jill/30 transition-all duration-300 jill-glow hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-jill-muted flex items-center justify-center">
                  <Users className="w-6 h-6 jill-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">For Employers</p>
                  <h3 className="font-display text-xl font-semibold">Meet Jill</h3>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Describe your dream hire in plain language. Jill curates a shortlist of vetted candidates who actually fit your culture.
              </p>
              <div className="flex items-center gap-2 jill-accent text-sm font-medium group-hover:gap-3 transition-all">
                Brief your role <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-12 mt-20 text-center"
          >
            {[
              { value: "10x", label: "Faster than traditional hiring" },
              { value: "94%", label: "Candidate satisfaction" },
              { value: "3 days", label: "Average time to shortlist" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Landing;
