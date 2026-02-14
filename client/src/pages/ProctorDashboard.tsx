import { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Plus, QrCode as QrIcon, Clock, Users, Play, Lock, ArrowLeft, LogIn, History, StopCircle, Trophy, Camera, LogOut } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";

function LoginPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-2xl bg-primary/20 ring-1 ring-primary/50">
              <Camera className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-primary" data-testid="text-login-title">Proctor Login</h1>
          <p className="text-muted-foreground">Sign in to create and manage scavenger hunts</p>
        </div>
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <a href="/api/login" className="block">
              <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_hsl(var(--primary))]" data-testid="button-login">
                <LogIn className="mr-2 w-5 h-5" />
                Sign In with Replit
              </Button>
            </a>
            <p className="text-xs text-center text-muted-foreground">Players don't need accounts - they join with a game code</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface HuntHistoryItem {
  id: string;
  code: string;
  name: string;
  status: string;
  durationMinutes: number;
  createdAt: string;
  playerCount: number;
  teams: { id: number; name: string; score: number; color: string }[];
}

function ProctorHome({ onCreateNew }: { onCreateNew: () => void }) {
  const { user, logout } = useAuth();
  const { setSessionFromStorage } = useGame();
  const [_, setLocation] = useLocation();

  const { data: history, isLoading } = useQuery<{ proctored: HuntHistoryItem[]; played: HuntHistoryItem[] }>({
    queryKey: ["/api/my/hunts"],
    queryFn: async () => {
      const res = await fetch("/api/my/hunts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const activeHunts = history?.proctored.filter(h => ["lobby", "active", "countdown"].includes(h.status)) || [];
  const pastHunts = history?.proctored.filter(h => h.status === "finished") || [];

  const handleResumeHunt = async (hunt: HuntHistoryItem) => {
    try {
      const res = await fetch(`/api/hunts/${hunt.id}/resume`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();

      const session = {
        huntId: data.huntId,
        sessionToken: data.sessionToken,
        player: data.player,
      };
      sessionStorage.setItem("snaphunt_session", JSON.stringify(session));
      setSessionFromStorage();
    } catch (err) {
      console.error("Failed to resume hunt:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-card/30 backdrop-blur-sm">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black text-primary" data-testid="text-dashboard-title">SNAPHUNT</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block" data-testid="text-user-name">{user?.firstName || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h2 className="text-3xl font-bold">Welcome back, {user?.firstName || "Proctor"}</h2>
          <p className="text-muted-foreground">Create a new hunt or manage your existing games</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent cursor-pointer hover:border-primary/60 transition-colors group" onClick={onCreateNew} data-testid="card-create-hunt">
            <CardContent className="pt-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Create New Hunt</h3>
              <p className="text-sm text-muted-foreground">Set up items, teams, and rules</p>
            </CardContent>
          </Card>

          <Card className="border-secondary/30 bg-gradient-to-br from-secondary/10 to-transparent cursor-pointer hover:border-secondary/60 transition-colors group" onClick={() => setLocation("/")} data-testid="card-join-game">
            <CardContent className="pt-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-xl bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                <QrIcon className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-bold">Join a Game</h3>
              <p className="text-sm text-muted-foreground">Enter a code to play</p>
            </CardContent>
          </Card>
        </div>

        {activeHunts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Play className="w-5 h-5 text-green-400" /> Active Games
            </h3>
            <div className="grid gap-3">
              {activeHunts.map(hunt => (
                <Card key={hunt.id} className="border-green-500/30 bg-green-500/5 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => handleResumeHunt(hunt)} data-testid={`card-active-hunt-${hunt.id}`}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">{hunt.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Code: <span className="font-mono text-primary">{hunt.code}</span> &middot; {hunt.playerCount} players &middot; {hunt.status.toUpperCase()}
                      </p>
                    </div>
                    <Button variant="outline" className="border-green-500/50 text-green-400" data-testid={`button-resume-${hunt.id}`}>Resume</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pastHunts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" /> Past Games
            </h3>
            <div className="grid gap-3">
              {pastHunts.map(hunt => {
                const winner = [...hunt.teams].sort((a, b) => b.score - a.score)[0];
                return (
                  <Card key={hunt.id} className="border-white/5 bg-card/30" data-testid={`card-past-hunt-${hunt.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold">{hunt.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(hunt.createdAt)} &middot; {hunt.playerCount} players &middot; {hunt.durationMinutes} min
                        </p>
                      </div>
                      {winner && winner.score > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          <span style={{ color: winner.color }} className="font-bold">{winner.name}</span>
                          <span className="font-mono">{winner.score} pts</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {isLoading && <p className="text-center text-muted-foreground">Loading your games...</p>}
      </div>
    </div>
  );
}

export default function ProctorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    createHunt, status, players, teams, lockTeams, startCountdown, stopGame,
    huntCode, isLocked, huntId, currentUser, items, timeRemaining, completedSubmissions, resetGame,
  } = useGame();
  const [_, setLocation] = useLocation();
  const [showSetup, setShowSetup] = useState(false);

  const [huntName, setHuntName] = useState("Scavenger Hunt");
  const [duration, setDuration] = useState(60);
  const [teamCount, setTeamCount] = useState(4);
  const [countdown, setCountdown] = useState(10);
  const [customItems, setCustomItems] = useState<{ description: string; points: number }[]>([
    { description: "Find a red stapler", points: 100 },
    { description: "Team high five", points: 200 },
    { description: "Human pyramid (3 people)", points: 500 },
    { description: "Something older than you", points: 150 },
  ]);
  const [teamNames, setTeamNames] = useState<string[]>(["Team 1", "Team 2", "Team 3", "Team 4"]);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPoints, setNewItemPoints] = useState(100);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const names = Array.from({ length: teamCount }, (_, i) => teamNames[i] || `Team ${i + 1}`);
    setTeamNames(names);
  }, [teamCount]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!user) {
    return <LoginPrompt />;
  }

  const handleAddItem = () => {
    if (!newItemText) return;
    setCustomItems([...customItems, { description: newItemText, points: newItemPoints }]);
    setNewItemText("");
  };

  const handleRemoveItem = (idx: number) => {
    setCustomItems(customItems.filter((_, i) => i !== idx));
  };

  const handleCreateHunt = async () => {
    if (customItems.length === 0) return;
    setCreating(true);
    await createHunt(customItems, {
      durationMinutes: duration,
      teamCount,
      countdownSeconds: countdown,
    }, teamNames, huntName);
    setCreating(false);
    setShowSetup(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const joinUrl = huntCode ? `${window.location.origin}?code=${huntCode}` : window.location.origin;

  if (!showSetup && !huntId) {
    return <ProctorHome onCreateNew={() => setShowSetup(true)} />;
  }

  if (huntId && status !== "setup") {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary" data-testid="text-proctor-title">Proctor Command Center</h1>
            <p className="text-muted-foreground">
              {status === "lobby" && "Waiting for players to join..."}
              {status === "countdown" && "Countdown in progress!"}
              {status === "active" && `Game Active - ${formatTime(timeRemaining)} remaining`}
              {status === "finished" && "Game Over!"}
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            {status === "lobby" && (
              <>
                <Button
                  variant="outline"
                  onClick={lockTeams}
                  disabled={isLocked}
                  className={`border-destructive/50 ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-destructive/20"} text-destructive-foreground`}
                  data-testid="button-lock-teams"
                >
                  <Lock className="mr-2 w-4 h-4" /> {isLocked ? "Teams Locked" : "Lock Teams"}
                </Button>
                <Button
                  size="lg"
                  onClick={startCountdown}
                  className="bg-green-500 hover:bg-green-600 text-black font-bold shadow-[0_0_20px_-5px_rgba(34,197,94,0.6)]"
                  data-testid="button-start-countdown"
                >
                  <Play className="mr-2 w-5 h-5" /> Start Hunt Countdown
                </Button>
              </>
            )}
            {status === "active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="lg" data-testid="button-stop-game">
                    <StopCircle className="mr-2 w-5 h-5" /> Stop Game
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End the game early?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately end the game for all players. Scores will be finalized and the leaderboard will be shown. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Playing</AlertDialogCancel>
                    <AlertDialogAction onClick={() => stopGame()} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-stop">
                      Yes, End Game
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {status === "finished" && (
              <Button
                variant="outline"
                onClick={() => { resetGame(); setLocation("/proctor"); }}
                data-testid="button-new-game"
              >
                New Game
              </Button>
            )}
            {status !== "lobby" && (
              <div className="px-4 py-2 bg-secondary/20 rounded-lg border border-secondary/50 text-secondary font-mono font-bold" data-testid="text-status">
                STATUS: {status.toUpperCase()}
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><QrIcon className="w-5 h-5 text-secondary" /> Join Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl" data-testid="qr-code">
                <QRCodeCanvas value={joinUrl} size={200} />
              </div>
              <div className="text-center">
                <p className="text-4xl font-mono font-black text-primary tracking-[0.3em]" data-testid="text-hunt-code">{huntCode}</p>
                <p className="text-xs text-muted-foreground mt-2">Share this code with players</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                {status === "lobby" ? "Waiting Room" : "Scoreboard"}
                <span className="text-muted-foreground font-normal text-sm ml-auto">{players.filter(p => !p.isProctor).length} players</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {(status === "active" || status === "finished" ? sortedTeams : teams).map((team) => (
                    <div key={team.id} className="p-4 rounded-lg border border-white/5 bg-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold" style={{ color: team.color }}>{team.name}</h3>
                        {(status === "active" || status === "finished") && (
                          <span className="font-mono font-bold text-lg">{team.score} pts</span>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {players.filter(p => p.teamId === team.id).map(p => (
                          <li key={p.id} className="text-sm flex items-center gap-2" data-testid={`text-player-${p.id}`}>
                            <span className="w-2 h-2 rounded-full bg-white/50" />
                            {p.name}
                          </li>
                        ))}
                        {players.filter(p => p.teamId === team.id).length === 0 && (
                          <li className="text-sm text-muted-foreground italic">Empty</li>
                        )}
                      </ul>
                    </div>
                  ))}
                  <div className="p-4 rounded-lg border border-white/5 bg-white/5 opacity-50">
                    <h3 className="font-bold mb-2 text-muted-foreground">Unassigned</h3>
                    <ul className="space-y-1">
                      {players.filter(p => !p.teamId && !p.isProctor).map(p => (
                        <li key={p.id} className="text-sm">{p.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {(status === "active" || status === "finished") && (
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Mission Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map(item => {
                  const completedBy = completedSubmissions.filter(s => s.itemId === item.id).map(s => s.teamId);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-primary font-bold w-12 text-right">{item.points}</span>
                        <span>{item.description}</span>
                      </div>
                      <div className="flex gap-1">
                        {teams.map(t => (
                          <div
                            key={t.id}
                            className={`w-4 h-4 rounded-full border ${completedBy.includes(t.id) ? "" : "opacity-20 border-white/20"}`}
                            style={{ backgroundColor: completedBy.includes(t.id) ? t.color : "transparent", borderColor: t.color }}
                            title={t.name}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setShowSetup(false); setLocation("/proctor"); }} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-black text-primary" data-testid="text-setup-title">Setup New Hunt</h1>
            <p className="text-muted-foreground">Configure the rules, teams, and scavenger list.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-lg">Hunt Name</Label>
          <Input
            value={huntName}
            onChange={(e) => setHuntName(e.target.value)}
            placeholder="Give your hunt a name..."
            className="h-12 text-lg bg-background/50 border-white/10"
            data-testid="input-hunt-name"
          />
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="teams">Teams ({teamCount})</TabsTrigger>
            <TabsTrigger value="list">List ({customItems.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Game Configuration</CardTitle>
                <CardDescription>Set the basic parameters for the game.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Clock className="w-4 h-4" /> Duration</Label>
                    <span className="font-mono text-primary text-xl">{duration} min</span>
                  </div>
                  <Slider value={[duration]} onValueChange={(v) => setDuration(v[0])} min={5} max={180} step={5} className="py-4" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Users className="w-4 h-4" /> Number of Teams</Label>
                    <span className="font-mono text-primary text-xl">{teamCount}</span>
                  </div>
                  <Slider value={[teamCount]} onValueChange={(v) => setTeamCount(v[0])} min={2} max={10} step={1} className="py-4" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Play className="w-4 h-4" /> Countdown Length</Label>
                    <span className="font-mono text-primary text-xl">{countdown} sec</span>
                  </div>
                  <Input type="number" value={countdown} onChange={(e) => setCountdown(Number(e.target.value))} className="max-w-[100px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Names</CardTitle>
                <CardDescription>Customize the name for each team.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {teamNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ["hsl(326 100% 60%)", "hsl(190 100% 50%)", "hsl(260 100% 65%)", "hsl(45 100% 55%)", "hsl(150 100% 50%)", "hsl(15 100% 55%)", "hsl(280 100% 70%)", "hsl(170 100% 45%)", "hsl(340 100% 65%)", "hsl(210 100% 60%)"][i % 10] }} />
                    <Input
                      value={name}
                      onChange={(e) => {
                        const updated = [...teamNames];
                        updated[i] = e.target.value;
                        setTeamNames(updated);
                      }}
                      data-testid={`input-team-name-${i}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scavenger List Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="E.g. Take a photo of a sleeping cat"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                    className="flex-1"
                    data-testid="input-new-item"
                  />
                  <Input
                    type="number"
                    placeholder="Pts"
                    value={newItemPoints}
                    onChange={(e) => setNewItemPoints(Number(e.target.value))}
                    className="w-24"
                    data-testid="input-new-item-points"
                  />
                  <Button onClick={handleAddItem} data-testid="button-add-item"><Plus className="w-4 h-4" /></Button>
                </div>
                <ScrollArea className="h-[400px] w-full pr-4 rounded-md border border-white/5 p-4 bg-black/20">
                  <div className="space-y-2">
                    {customItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-card rounded-lg border border-white/5 hover:border-primary/30 transition-colors group">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-primary font-bold w-12 text-right">{item.points}</span>
                          <span>{item.description}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(idx)}
                          className="md:opacity-0 md:group-hover:opacity-100 hover:text-destructive transition-opacity text-muted-foreground"
                          data-testid={`button-remove-item-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-6 border-t border-white/10">
          <Button
            onClick={handleCreateHunt}
            size="lg"
            disabled={creating || customItems.length === 0}
            className="w-full md:w-auto text-lg px-8 font-bold bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            data-testid="button-create-hunt"
          >
            {creating ? "Creating..." : "Generate Hunt & Open Lobby"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
