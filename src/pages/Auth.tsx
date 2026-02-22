import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mic, Users } from "lucide-react";

type Mode = "signin" | "signup";
type Role = "candidate" | "employer";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("candidate");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const { user, userRole, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users based on role
  useEffect(() => {
    if (user && userRole) {
      if (userRole === "candidate") {
        navigate("/candidate/onboarding", { replace: true });
      } else if (userRole === "employer") {
        navigate("/employer/briefing", { replace: true });
      }
    }
  }, [user, userRole, navigate]);

  // Timeout fallback: if user is set but role never loads, stop loading after 8s
  useEffect(() => {
    if (!user || userRole) return;
    const timer = setTimeout(() => {
      setLoading(false);
      setError("Could not determine your account role. Please try signing in again.");
    }, 8000);
    return () => clearTimeout(timer);
  }, [user, userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await signUp(email, password, role);
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        // With auto-confirm, user is logged in immediately.
        // The useEffect redirect will fire once userRole is set by AuthContext.
        // Keep loading=true so the user sees the spinner until redirect happens.
        return;
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        // Same — keep loading=true until redirect fires.
        return;
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <h2 className="font-display text-2xl font-semibold mb-3">Check your email</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We've sent a confirmation link to <span className="text-foreground font-medium">{email}</span>. Click the link to activate your account.
          </p>
          <button
            onClick={() => { setConfirmationSent(false); setMode("signin"); }}
            className="mt-6 text-sm jack-accent hover:underline"
          >
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-jack/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-jill/5 rounded-full blur-3xl" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate("/")} className="font-display text-lg font-bold">
          Jack <span className="text-muted-foreground">&</span> Jill
        </button>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue your journey"
                : "Create an account to meet Jack & Jill"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <Label>I am a…</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as Role)}
                  className="grid grid-cols-2 gap-3"
                >
                  <label
                    htmlFor="role-candidate"
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all ${
                      role === "candidate"
                        ? "border-jack/50 bg-jack-muted/30"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <RadioGroupItem value="candidate" id="role-candidate" className="sr-only" />
                    <Mic className={`w-5 h-5 ${role === "candidate" ? "jack-accent" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${role === "candidate" ? "text-foreground" : "text-muted-foreground"}`}>
                      Candidate
                    </span>
                  </label>

                  <label
                    htmlFor="role-employer"
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all ${
                      role === "employer"
                        ? "border-jill/50 bg-jill-muted/30"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <RadioGroupItem value="employer" id="role-employer" className="sr-only" />
                    <Users className={`w-5 h-5 ${role === "employer" ? "jill-accent" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${role === "employer" ? "text-foreground" : "text-muted-foreground"}`}>
                      Employer
                    </span>
                  </label>
                </RadioGroup>
              </motion.div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              className="jack-accent hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
