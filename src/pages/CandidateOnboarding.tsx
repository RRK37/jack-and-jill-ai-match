import { useState, useEffect, useCallback, useRef } from "react"; // v2
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, ArrowRight, Send, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScribe, type ScribeHookOptions } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import {
  jackGreeting,
  jackChat,
  getCandidateProfile,
  formatCandidateProfile,
  formatConversationHistory,
  updateCandidateProfile,
  type TranscriptLine,
} from "@/lib/api";

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

const CandidateOnboarding = () => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const candidateProfileRef = useRef<string>("none");
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const isSendingRef = useRef(false);
  const navigate = useNavigate();

  // Keep refs in sync
  useEffect(() => { transcriptRef.current = transcriptLines; }, [transcriptLines]);
  useEffect(() => { isSendingRef.current = isSending; }, [isSending]);

  // Load profile and fetch greeting on mount
  useEffect(() => {
    (async () => {
      let profileStr = "none";
      try {
        const profile = await getCandidateProfile();
        if (profile) {
          profileStr = formatCandidateProfile(profile);
          candidateProfileRef.current = profileStr;
        }
      } catch (err) {
        console.error("Failed to load candidate profile:", err);
      }

      try {
        const greeting = await jackGreeting(profileStr);
        const line = { speaker: "Jack", text: greeting.message };
        setTranscriptLines([line]);
        transcriptRef.current = [line];
      } catch (err) {
        console.error("Failed to get Jack greeting:", err);
        const fallback = { speaker: "Jack", text: "Hey! I'm Jack. Tell me about your dream role — what kind of work lights you up?" };
        setTranscriptLines([fallback]);
        transcriptRef.current = [fallback];
      }
    })();
  }, []);

  const sendToJack = useCallback(async (userMessage: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);

    const userLine = { speaker: "You", text: userMessage };
    const updatedLines = [...transcriptRef.current, userLine];
    transcriptRef.current = updatedLines;
    setTranscriptLines(updatedLines);

    try {
      const history = formatConversationHistory(updatedLines);
      const result = await jackChat(userMessage, history, candidateProfileRef.current);
      const jackLine = { speaker: "Jack", text: result.reply };
      transcriptRef.current = [...transcriptRef.current, jackLine];
      setTranscriptLines((prev) => [...prev, jackLine]);

      if (result.profileUpdates) {
        await updateCandidateProfile(result.profileUpdates);
        const refreshed = await getCandidateProfile();
        if (refreshed) {
          candidateProfileRef.current = formatCandidateProfile(refreshed);
        }
      }
    } catch (err) {
      console.error("Jack chat error:", err);
      const errLine = { speaker: "Jack", text: "Sorry, I had trouble processing that. Could you try again?" };
      transcriptRef.current = [...transcriptRef.current, errLine];
      setTranscriptLines((prev) => [...prev, errLine]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, []);

  const sendToJackRef = useRef(sendToJack);
  sendToJackRef.current = sendToJack;

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: "vad" as ScribeHookOptions["commitStrategy"],
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        sendToJackRef.current(data.text.trim());
      }
    },
  });

  const toggleMic = useCallback(async () => {
    if (scribe.isConnected) {
      // Send any buffered partial transcript before disconnecting
      const pending = scribe.partialTranscript?.trim();
      if (pending) {
        sendToJackRef.current(pending);
      }
      scribe.disconnect();
      setIsMicOn(false);
    } else {
      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
        if (error || !data?.token) {
          console.error("Failed to get scribe token:", error);
          return;
        }
        await scribe.connect({
          token: data.token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        setIsMicOn(true);
      } catch (err) {
        console.error("Failed to connect scribe:", err);
      }
    }
  }, [scribe]);

  const sendTextMessage = () => {
    if (!textInput.trim()) return;
    sendToJack(textInput.trim());
    setTextInput("");
  };

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
          <AudioWaveform active={isActive && isMicOn && scribe.isConnected} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={toggleMic}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isMicOn ? "bg-jack-muted jack-accent" : "bg-secondary text-muted-foreground"
            }`}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              showTextInput ? "bg-jack-muted jack-accent" : "bg-secondary text-muted-foreground"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setIsActive(false); navigate("/candidate/dashboard"); }}
            className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-8"
          >
            <div className="flex items-center gap-2 glass-card p-2 rounded-2xl">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
                placeholder="Type your message to Jack..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-3"
                disabled={isSending}
              />
              <button
                onClick={sendTextMessage}
                disabled={isSending}
                className="w-10 h-10 rounded-xl bg-jack flex items-center justify-center text-jack-foreground shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Transcript */}
        <div className="w-full glass-card p-5 space-y-4 max-h-64 overflow-y-auto">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Transcript</p>
          {transcriptLines.length === 0 && !scribe.partialTranscript && (
            <p className="text-sm text-muted-foreground italic">Tap the mic and start speaking…</p>
          )}
          {transcriptLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
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
          {scribe.partialTranscript && isMicOn && (() => {
            const lastUserLine = [...transcriptLines].reverse().find(l => l.speaker === "You");
            const isDuplicate = lastUserLine && scribe.partialTranscript.trim() === lastUserLine.text;
            if (isDuplicate) return null;
            return (
              <div className="flex gap-3 opacity-60">
                <span className="text-xs font-medium mt-0.5 shrink-0 text-foreground">You</span>
                <p className="text-sm text-muted-foreground leading-relaxed italic">{scribe.partialTranscript}…</p>
              </div>
            );
          })()}
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
