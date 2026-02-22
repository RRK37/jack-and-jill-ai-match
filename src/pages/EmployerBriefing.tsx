import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Mic, Paperclip } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jillGreeting, jillChat } from "@/lib/api";

type Message = { from: "user" | "jill"; text: string };

const EmployerBriefing = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    jillGreeting()
      .then((data) => setMessages([{ from: "jill", text: data.message }]))
      .catch(() => {});
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { from: "user", text: userMsg }]);
    setInput("");
    setIsSending(true);

    try {
      const data = await jillChat(userMsg);
      setMessages((prev) => [...prev, { from: "jill", text: data.reply }]);
      if (data.briefingComplete) {
        setTimeout(() => navigate("/employer/dashboard"), 1500);
      }
    } catch {
      setMessages((prev) => [...prev, { from: "jill", text: "Sorry, something went wrong. Try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate("/")} className="font-display text-lg font-bold">
          Jack <span className="text-muted-foreground">&</span> Jill
        </button>
        <span className="text-sm text-muted-foreground">Briefing with Jill</span>
      </nav>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i === messages.length - 1 ? 0.1 : 0 }}
              className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.from === "jill" && (
                <div className="w-8 h-8 rounded-lg bg-jill-muted flex items-center justify-center mr-3 shrink-0 mt-1">
                  <span className="text-xs font-bold jill-accent">J</span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.from === "user"
                  ? "bg-jill text-jill-foreground rounded-br-md"
                  : "glass-card rounded-bl-md"
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2 glass-card p-2 rounded-2xl">
            <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Describe your ideal hire..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled={isSending}
            />
            <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={sendMessage}
              disabled={isSending}
              className="w-10 h-10 rounded-xl bg-jill flex items-center justify-center text-jill-foreground shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Or{" "}
            <button onClick={() => navigate("/employer/dashboard")} className="jill-accent hover:underline">
              skip to dashboard →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmployerBriefing;
