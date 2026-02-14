import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Camera, Gamepad2, User } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [name, setName] = useState("");
  const { login, status } = useGame();
  const [_, setLocation] = useLocation();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    login(name);
    setLocation("/lobby");
  };

  const handleProctorLogin = () => {
    // In real app, this would be a secure login
    login("Game Proctor", true);
    if (status === "setup") {
      setLocation("/proctor/setup");
    } else {
      setLocation("/proctor/lobby");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
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
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-secondary text-glow">
            SNAPHUNT
          </h1>
          <p className="text-muted-foreground text-lg">
            The Ultimate Team Photo Scavenger Hunt
          </p>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Join the Hunt</CardTitle>
            <CardDescription className="text-center">Enter your name to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter your screen name..."
                  className="h-12 text-lg bg-background/50 border-white/10 focus:border-primary/50 focus:ring-primary/20"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_hsl(var(--primary))] transition-all hover:scale-[1.02]">
                <Gamepad2 className="mr-2 w-5 h-5" />
                Enter Game
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5">
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-white" onClick={handleProctorLogin}>
                <User className="mr-2 w-4 h-4" />
                Login as Proctor
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
