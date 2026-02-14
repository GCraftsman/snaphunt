import { useGame } from "@/context/GameContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Users, Lock } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Lobby() {
  const { teams, players, joinTeam, currentUser, status, countdownValue, isLocked } = useGame();
  const [_, setLocation] = useLocation();

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <h1 className="text-5xl font-black text-primary mb-8" data-testid="text-game-over">GAME OVER</h1>
        <div className="w-full max-w-md space-y-4">
          {sortedTeams.map((team, idx) => (
            <div key={team.id} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5">
              <div className="font-display text-4xl font-bold text-muted-foreground/30 w-8">#{idx + 1}</div>
              <div className="flex-1">
                <h3 className="font-bold text-lg" style={{ color: team.color }}>{team.name}</h3>
              </div>
              <div className="text-2xl font-black">{team.score}</div>
            </div>
          ))}
        </div>
        <Button onClick={() => setLocation("/")} className="mt-8" variant="outline" data-testid="button-back-home">Back to Home</Button>
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
