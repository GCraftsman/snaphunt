import { useGame } from "@/context/GameContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Users, Lock, Trophy, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ReplayMap } from "@/components/ReplayMap";
import Confetti from "react-confetti";

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

export default function Lobby() {
  const { teams, players, joinTeam, currentUser, status, countdownValue, isLocked, huntId } = useGame();
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("replay");
  const [replayComplete, setReplayComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (status === "active") {
      setLocation("/game");
    }
  }, [status, setLocation]);

  if (status === "countdown") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-8 animate-pulse">
          <h1 className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-primary to-secondary leading-none" data-testid="text-countdown">
            {countdownValue}
          </h1>
          <p className="text-2xl text-muted-foreground font-display tracking-widest uppercase">Get Ready</p>
        </div>
      </div>
    );
  }

  if (status === "finished") {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

    const handleReplayComplete = () => {
      setReplayComplete(true);
      setShowConfetti(true);
      setActiveTab("results");
      setTimeout(() => setShowConfetti(false), 5000);
    };

    return (
      <div className="min-h-screen bg-background p-4">
        {showConfetti && <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />}
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-black text-primary text-center pt-6" data-testid="text-game-over">GAME OVER</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="replay" className="text-lg py-3" data-testid="tab-replay">
                <PlayCircle className="w-4 h-4 mr-2" /> Replay
              </TabsTrigger>
              <TabsTrigger value="results" className="text-lg py-3" data-testid="tab-results">
                <Trophy className="w-4 h-4 mr-2" /> Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="replay">
              {huntId && (
                <ReplayMap huntId={huntId} onComplete={handleReplayComplete} />
              )}
            </TabsContent>

            <TabsContent value="results">
              {replayComplete ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <h2 className="text-2xl font-bold text-center text-secondary mb-6">Final Standings</h2>
                  {sortedTeams.map((team, idx) => (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.2 }}
                      className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5"
                      data-testid={`result-team-${team.id}`}
                    >
                      <div className="font-display text-4xl font-bold text-muted-foreground/30 w-10">
                        {idx === 0 ? "🏆" : `#${idx + 1}`}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg" style={{ color: team.color }}>{team.name}</h3>
                      </div>
                      <div className="text-2xl font-black">{team.score}</div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
                  <Trophy className="w-16 h-16 opacity-20" />
                  <p className="text-lg font-medium">Watch the replay first!</p>
                  <p className="text-sm">Results will be revealed when the replay finishes.</p>
                  <Button variant="outline" onClick={() => setActiveTab("replay")} data-testid="button-go-to-replay">
                    Go to Replay
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-center pb-8">
            <Button onClick={() => setLocation("/")} variant="outline" data-testid="button-back-home">Back to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        <header className="text-center py-8">
          <div className="flex justify-center mb-4">
            {isLocked ? (
              <Badge variant="destructive" className="border-destructive/50 text-destructive-foreground px-4 py-1 text-lg" data-testid="badge-locked">
                <Lock className="w-4 h-4 mr-2" /> TEAMS LOCKED
              </Badge>
            ) : (
              <Badge variant="outline" className="border-primary text-primary px-4 py-1" data-testid="badge-waiting">WAITING FOR HOST TO START</Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-2" data-testid="text-lobby-title">PICK YOUR SQUAD</h1>
          <p className="text-muted-foreground">Select a team below to join the roster.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team, idx) => {
            const teamPlayers = players.filter(p => p.teamId === team.id);
            const isMyTeam = currentUser?.teamId === team.id;
            const canJoin = !isLocked && !isMyTeam;

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className={`border-2 transition-all h-full ${
                    isMyTeam
                      ? "ring-4 ring-primary ring-offset-2 ring-offset-background border-primary"
                      : canJoin
                        ? "border-white/10 hover:border-primary/50 cursor-pointer hover:scale-105 active:scale-95"
                        : "border-white/5 opacity-80"
                  }`}
                  onClick={() => canJoin && joinTeam(team.id)}
                  data-testid={`card-team-${team.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <span style={{ color: team.color }}>{team.name}</span>
                      {isMyTeam && <Users className="w-5 h-5 text-primary" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Roster</div>
                      {teamPlayers.length === 0 ? (
                        <div className="h-20 flex items-center justify-center text-muted-foreground/30 text-sm border border-dashed border-white/10 rounded">
                          Empty Slot
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {teamPlayers.map(p => (
                            <div key={p.id} className="text-sm px-2 py-1 bg-white/5 rounded flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                              {p.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isMyTeam && (
                      <Button
                        variant="ghost"
                        disabled={isLocked}
                        className="w-full mt-4 hover:bg-primary/20 hover:text-primary disabled:opacity-50"
                        data-testid={`button-join-team-${team.id}`}
                      >
                        {isLocked ? "Locked" : "Join Team"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t border-white/10 text-center text-sm text-muted-foreground">
          Logged in as <span className="text-white font-bold" data-testid="text-current-user">{currentUser?.name}</span>
        </div>
      </div>
    </div>
  );
}
