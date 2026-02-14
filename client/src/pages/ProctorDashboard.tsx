import { useState } from "react";
import { useGame, ScavengerItem } from "@/context/GameContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, QrCode as QrIcon, Clock, Users, Play, Lock } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";

export default function ProctorDashboard() {
  const { createHunt, status, players, teams, lockTeams, startCountdown, settings, items, isLocked } = useGame();
  const [_, setLocation] = useLocation();

  // Setup State
  const [duration, setDuration] = useState(60);
  const [teamCount, setTeamCount] = useState(4);
  const [countdown, setCountdown] = useState(10);
  const [customItems, setCustomItems] = useState<ScavengerItem[]>(items);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPoints, setNewItemPoints] = useState(100);

  // If already setup, show lobby view
  const isSetup = status !== "setup";

  const handleAddItem = () => {
    if (!newItemText) return;
    const newItem: ScavengerItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: newItemText,
      points: newItemPoints,
      completedByTeamIds: []
    };
    setCustomItems([...customItems, newItem]);
    setNewItemText("");
  };

  const handleRemoveItem = (id: string) => {
    setCustomItems(customItems.filter(i => i.id !== id));
  };

  const handleCreateHunt = () => {
    createHunt(customItems, {
      durationMinutes: duration,
      teamCount: teamCount,
      countdownSeconds: countdown
    });
    // Stay on dashboard but view changes
  };

  if (isSetup) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Proctor Command Center</h1>
            <p className="text-muted-foreground">Manage the active game</p>
          </div>
          <div className="flex gap-4">
             {status === "lobby" && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={lockTeams} 
                    disabled={isLocked}
                    className={`border-destructive/50 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-destructive/20'} text-destructive-foreground`}
                  >
                    <Lock className="mr-2 w-4 h-4" /> {isLocked ? "Teams Locked" : "Lock Teams"}
                  </Button>
                  <Button size="lg" onClick={startCountdown} className="bg-green-500 hover:bg-green-600 text-black font-bold shadow-[0_0_20px_-5px_rgba(34,197,94,0.6)]">
                    <Play className="mr-2 w-5 h-5" /> Start Hunt Countdown
                  </Button>
                </>
             )}
             {status !== "lobby" && (
               <div className="px-4 py-2 bg-secondary/20 rounded-lg border border-secondary/50 text-secondary font-mono font-bold">
                 STATUS: {status.toUpperCase()}
               </div>
             )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* QR Code Card */}
          <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><QrIcon className="w-5 h-5 text-secondary" /> Join Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeCanvas value={window.location.origin} size={200} />
              </div>
              <p className="text-sm text-muted-foreground break-all text-center font-mono">
                {window.location.origin}
              </p>
            </CardContent>
          </Card>

          {/* Player/Team Stats */}
          <Card className="md:col-span-2 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Waiting Room</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {teams.map(team => (
                    <div key={team.id} className="p-4 rounded-lg border border-white/5 bg-white/5">
                      <h3 className="font-bold mb-2" style={{ color: team.color }}>{team.name}</h3>
                      <ul className="space-y-1">
                        {players.filter(p => p.teamId === team.id).map(p => (
                          <li key={p.id} className="text-sm flex items-center gap-2">
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
      </div>
    );
  }

  // SETUP VIEW
  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-primary">Setup New Hunt</h1>
          <p className="text-muted-foreground">Configure the rules, teams, and scavenger list.</p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Game Settings</TabsTrigger>
            <TabsTrigger value="list">Scavenger List ({customItems.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Set the basic parameters for the game.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Clock className="w-4 h-4" /> Duration</Label>
                    <span className="font-mono text-primary text-xl">{duration} min</span>
                  </div>
                  <Slider 
                    value={[duration]} 
                    onValueChange={(v) => setDuration(v[0])} 
                    min={5} 
                    max={180} 
                    step={5} 
                    className="py-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Users className="w-4 h-4" /> Number of Teams</Label>
                    <span className="font-mono text-primary text-xl">{teamCount}</span>
                  </div>
                  <Slider 
                    value={[teamCount]} 
                    onValueChange={(v) => setTeamCount(v[0])} 
                    min={2} 
                    max={10} 
                    step={1} 
                    className="py-4"
                  />
                </div>
                
                 <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-lg flex items-center gap-2"><Play className="w-4 h-4" /> Countdown Length</Label>
                    <span className="font-mono text-primary text-xl">{countdown} sec</span>
                  </div>
                  <Input 
                    type="number" 
                    value={countdown} 
                    onChange={(e) => setCountdown(Number(e.target.value))} 
                    className="max-w-[100px]"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="mt-6 space-y-6">
             <Card>
              <CardHeader>
                <CardTitle>Create List Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input 
                    placeholder="E.g. Take a photo of a sleeping cat" 
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    type="number"
                    placeholder="Pts"
                    value={newItemPoints}
                    onChange={(e) => setNewItemPoints(Number(e.target.value))}
                    className="w-24"
                  />
                  <Button onClick={handleAddItem}><Plus className="w-4 h-4" /></Button>
                </div>

                <ScrollArea className="h-[400px] w-full pr-4 rounded-md border border-white/5 p-4 bg-black/20">
                  <div className="space-y-2">
                    {customItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-white/5 hover:border-primary/30 transition-colors group">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-primary font-bold w-12 text-right">{item.points}</span>
                          <span>{item.description}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
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
          <Button onClick={handleCreateHunt} size="lg" className="w-full md:w-auto text-lg px-8 font-bold bg-gradient-to-r from-primary to-secondary hover:opacity-90">
            Generate Hunt & Open Lobby
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
