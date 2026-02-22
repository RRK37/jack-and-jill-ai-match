import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MapPin, Building2, TrendingUp, MessageCircle, X, Send, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProfileData {
  name: string;
  title: string;
  skills: string[];
  goals: string;
  vibe: string;
}

interface MatchedJob {
  company: string;
  role: string;
  location: string;
  score: number;
  tags: string[];
}

const CandidateDashboard = () => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [matchedJobs, setMatchedJobs] = useState<MatchedJob[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/candidate/profile")
      .then((res) => res.json())
      .then((data) => setProfileData(data))
      .catch(() => {});

    fetch("/api/candidate/matches")
      .then((res) => res.json())
      .then((data) => setMatchedJobs(data))
      .catch(() => {});

    fetch("/api/jack/greeting")
      .then((res) => res.json())
      .then((data) => setMessages([{ from: "jack", text: data.message }]))
      .catch(() => {});
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { from: "user", text: input }]);
    setInput("");
    fetch("/api/jack/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...messages, { from: "user", text: input }] }),
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages((prev) => [...prev, { from: "jack", text: data.reply }]);
      })
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate("/")} className="font-display text-lg font-bold">
          Jack <span className="text-muted-foreground">&</span> Jill
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Candidate Portal</span>
          <div className="w-8 h-8 rounded-lg bg-jack-muted flex items-center justify-center">
            <span className="text-xs font-semibold jack-accent">AC</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Profile Card */}
        {profileData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-jack-muted flex items-center justify-center shrink-0">
                <span className="font-display text-xl font-bold jack-accent">AC</span>
              </div>
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold mb-1">{profileData.name}</h1>
                <p className="text-muted-foreground mb-4">{profileData.title}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {profileData.skills.map((s) => (
                    <span key={s} className="px-3 py-1 rounded-lg bg-secondary text-xs text-secondary-foreground">{s}</span>
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Goals</p>
                    <p className="text-foreground">{profileData.goals}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Vibe</p>
                    <p className="text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 jack-accent" />
                      {profileData.vibe}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="glass-card p-6 mb-8 text-center text-muted-foreground text-sm">Loading profile...</div>
        )}

        {/* Matches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 jack-accent" />
              Curated Matches
            </h2>
            <span className="text-sm text-muted-foreground">{matchedJobs.length} roles found</span>
          </div>
          <div className="grid gap-4">
            {matchedJobs.map((job, i) => (
              <motion.div
                key={job.company}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-jack/20 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{job.role}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    {job.company} <span className="w-1 h-1 rounded-full bg-muted-foreground" /> <MapPin className="w-3 h-3" /> {job.location}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {job.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-jack-muted/50 text-xs jack-accent">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-display font-bold jack-accent">{job.score}%</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Match
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-jack flex items-center justify-center text-jack-foreground shadow-lg hover:scale-105 transition-transform z-40"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Slide-out Chat */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-jack-muted flex items-center justify-center">
                    <span className="text-xs font-bold jack-accent">J</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Jack</p>
                    <p className="text-xs text-muted-foreground">Your AI Career Partner</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.from === "user"
                        ? "bg-jack text-jack-foreground rounded-br-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask Jack anything..."
                    className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-jack/30"
                  />
                  <button
                    onClick={sendMessage}
                    className="w-10 h-10 rounded-xl bg-jack flex items-center justify-center text-jack-foreground shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CandidateDashboard;
