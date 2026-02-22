import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AudioWaveform = ({ active }: { active: boolean }) => (
  <div className="flex items-center justify-center gap-1 h-16">
    {Array.from({ length: 24 }).map((_, i) => (
      <motion.div
        key={i}
        className="w-1 rounded-full bg-jack"
        animate={active ? {
          height: [8, Math.random() * 40 + 8, 8],
        } : { height: 4 }}
        transition={{
          duration: 0.8 + Math.random() * 0.4,
          repeat: Infinity,
          delay: i * 0.05,
          ease: "easeInOut",
        }}
        style={{ opacity: active ? 0.4 + Math.random() * 0.6 : 0.2 }}
      />
    ))}
  </div>
);

interface TranscriptLine {
  speaker: string;
  text: string;
}

const CandidateOnboarding = () => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/jack/transcript")
      .then((res) => res.json())
      .then((data) => setTranscriptLines(data.lines))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate("/")} className="font-display text-lg font-bold">
          Jack <span className="text-muted-foreground">&</span> Jill
        </button>
        <span className="text-sm text-muted-foreground">Talking to Jack</span>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full">
        {/* Avatar + Waveform */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-jack-muted flex items-center justify-center">
              <span className="font-display text-2xl font-bold jack-accent">J</span>
            </div>
            {isActive && (
              <div className="absolute -inset-2 rounded-2xl border-2 border-jack/30 animate-pulse-ring" />
            )}
          </div>
          <h2 className="font-display text-2xl font-semibold mb-1">Jack is listening</h2>
          <p className="text-sm text-muted-foreground">Tell me about your dream role</p>
        </motion.div>

        {/* Waveform */}
        <div className="w-full mb-8">
          <AudioWaveform active={isActive && isMicOn} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isMicOn ? "bg-jack-muted jack-accent" : "bg-secondary text-muted-foreground"
            }`}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={() => { setIsActive(false); navigate("/candidate/dashboard"); }}
            className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Transcript */}
        <div className="w-full glass-card p-5 space-y-4 max-h-64 overflow-y-auto">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Transcript</p>
          {transcriptLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.3 }}
              className="flex gap-3"
            >
              <span className={`text-xs font-medium mt-0.5 shrink-0 ${
                line.speaker === "Jack" ? "jack-accent" : "text-foreground"
              }`}>
                {line.speaker}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{line.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={() => navigate("/candidate/dashboard")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Skip to dashboard <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default CandidateOnboarding;
