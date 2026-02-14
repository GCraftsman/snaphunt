import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { Camera, Gamepad2, User } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [name, setName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { joinHunt, setSessionFromStorage } = useGame();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");
    if (codeFromUrl) {
      setGameCode(codeFromUrl.toUpperCase());
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fresh") === "1") {
      sessionStorage.removeItem("snaphunt_session");
      return;
    }

    const stored = sessionStorage.getItem("snaphunt_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        fetch(`/api/hunts/${session.huntId}`)
          .then(res => {
            if (!res.ok) {
              sessionStorage.removeItem("snaphunt_session");
              return;
            }
            return res.json();
          })
          .then(data => {
            if (!data || data.hunt?.status === "finished") {
              sessionStorage.removeItem("snaphunt_session");
              return;
            }
            const restored = setSessionFromStorage();
            if (restored) {
              if (session.player.isProctor) {
                setLocation("/proctor");
              } else if (data.hunt?.status === "active") {
                setLocation("/game");
              } else {
                setLocation("/lobby");
              }
            }
          });
      } catch {
        sessionStorage.removeItem("snaphunt_session");
      }
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gameCode.trim()) return;
    setJoining(true);
    const success = await joinHunt(gameCode.trim(), name.trim());
    setJoining(false);
    if (success) {
      setLocation("/lobby");
    }
  };

  const handleProctorLogin = () => {
    setLocation("/proctor");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-background to-background" />
      <div className="absolute inset-0 z-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-2xl bg-primary/20 ring-1 ring-primary/50 box-glow">
              <Camera className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-secondary text-glow" data-testid="text-title">
            SNAPHUNT
          </h1>
          <p className="text-muted-foreground text-lg">
            The Ultimate Team Photo Scavenger Hunt
          </p>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Join a Hunt</CardTitle>
            <CardDescription className="text-center">Enter the game code and your name</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <Input
                placeholder="Game Code (e.g. A1B2C3)"
                className="h-12 text-lg text-center tracking-[0.3em] uppercase bg-background/50 border-white/10 focus:border-primary/50 focus:ring-primary/20 font-mono"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                maxLength={6}
                data-testid="input-game-code"
              />
              <Input
                placeholder="Your screen name..."
                className="h-12 text-lg bg-background/50 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-player-name"
              />
              <Button
                type="submit"
                disabled={joining || !name.trim() || !gameCode.trim()}
                className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_hsl(var(--primary))] transition-all hover:scale-[1.02]"
                data-testid="button-join"
              >
                <Gamepad2 className="mr-2 w-5 h-5" />
                {joining ? "Joining..." : "Enter Game"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5">
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-white" onClick={handleProctorLogin} data-testid="button-proctor-login">
                <User className="mr-2 w-4 h-4" />
                Create New Hunt (Proctor)
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
