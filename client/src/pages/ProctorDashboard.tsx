import { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, QrCode as QrIcon, Clock, Users, Play, Lock, ArrowLeft } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";

export default function ProctorDashboard() {
  const {
    createHunt, status, players, teams, lockTeams, startCountdown,
    huntCode, isLocked, huntId, currentUser, items, timeRemaining, completedSubmissions,
  } = useGame();
  const [_, setLocation] = useLocation();

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

  useEffect(() => {
    if (status === "active" || status === "countdown" || status === "finished") {
      // stay on dashboard
    }
  }, [status]);

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
    const hId = await createHunt(customItems, {
      durationMinutes: duration,
      teamCount,
      countdownSeconds: countdown,
    }, teamNames);
    setCreating(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const joinUrl = huntCode ? `${window.location.origin}?code=${huntCode}` : window.location.origin;

  if (huntId && status !== "setup") {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const totalPoints = items.reduce((a, b) => a + b.points, 0);

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
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-black text-primary" data-testid="text-setup-title">Setup New Hunt</h1>
            <p className="text-muted-foreground">Configure the rules, teams, and scavenger list.</p>
          </div>
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
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
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
