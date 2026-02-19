import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ReplayMap } from "@/components/ReplayMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  ArrowLeft, Trophy, Users, Camera, Clock, Check, Video, Eye, Bot, Loader2, History, Map,
} from "lucide-react";

interface ResultsTeam {
  id: number;
  name: string;
  color: string;
  score: number;
}

interface ResultsItem {
  id: number;
  description: string;
  points: number;
  verificationMode: string;
  mediaType: string;
}

interface ResultsSubmission {
  id: number;
  itemId: number;
  teamId: number;
  playerId: string;
  description: string;
  points: number;
  bonusPoints?: number;
  photoData: string;
  mediaType: string;
  teamName: string;
  teamColor: string;
  playerName: string;
  createdAt: string;
}

interface ResultsPlayer {
  id: string;
  name: string;
  teamId: number | null;
}

interface ResultsData {
  hunt: {
    id: string;
    name: string;
    code: string;
    gameStartTime: string;
    gameEndTime: string;
    durationMinutes: number;
    trackLocations: boolean;
    showStandings: boolean;
    createdAt: string;
  };
  teams: ResultsTeam[];
  players: ResultsPlayer[];
  items: ResultsItem[];
  submissions: ResultsSubmission[];
}

export default function HuntResults() {
  const [, params] = useRoute("/proctor/hunt/:id");
  const [_, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [viewingSub, setViewingSub] = useState<ResultsSubmission | null>(null);
  const [activeTab, setActiveTab] = useState("standings");

  const huntId = params?.id;

  const { data, isLoading, error } = useQuery<ResultsData>({
    queryKey: [`/api/hunts/${huntId}/results`],
    queryFn: async () => {
      const res = await fetch(`/api/hunts/${huntId}/results`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!huntId && !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please sign in to view game results.</p>
          <a href="/api/login"><Button data-testid="button-login-results">Sign In</Button></a>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Could not load game results.</p>
          <Button variant="outline" onClick={() => setLocation("/proctor")} data-testid="button-back-error">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const sortedTeams = [...data.teams].sort((a, b) => b.score - a.score);
  const winner = sortedTeams[0];
  const gameDurationMs = data.hunt.gameStartTime && data.hunt.gameEndTime
    ? new Date(data.hunt.gameEndTime).getTime() - new Date(data.hunt.gameStartTime).getTime()
    : 0;
  const gameDurationMin = Math.round(gameDurationMs / 60000);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/proctor")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-primary truncate" data-testid="text-hunt-name">{data.hunt.name}</h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(data.hunt.createdAt)} · {data.players.length} players · {gameDurationMin} min played
            </p>
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-400 shrink-0">Finished</Badge>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {winner && winner.score > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-2">
            <Trophy className="w-10 h-10 text-yellow-400 mx-auto" />
            <h2 className="text-2xl font-black" style={{ color: winner.color }} data-testid="text-winner">{winner.name}</h2>
            <p className="text-muted-foreground text-sm">Winner with <span className="font-mono font-bold text-white">{winner.score}</span> points</p>
          </motion.div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="standings" data-testid="tab-standings"><Trophy className="w-3.5 h-3.5 mr-1.5" /> Standings</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items"><Camera className="w-3.5 h-3.5 mr-1.5" /> Items</TabsTrigger>
            <TabsTrigger value="submissions" data-testid="tab-submissions"><Eye className="w-3.5 h-3.5 mr-1.5" /> Photos</TabsTrigger>
            <TabsTrigger value="replay" data-testid="tab-replay"><History className="w-3.5 h-3.5 mr-1.5" /> Replay</TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="mt-6 space-y-4">
            <div className="space-y-3">
              {sortedTeams.map((team, idx) => {
                const teamPlayers = data.players.filter(p => p.teamId === team.id);
                const teamSubs = data.submissions.filter(s => s.teamId === team.id);
                const maxScore = sortedTeams[0]?.score || 1;
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className={`${idx === 0 && team.score > 0 ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-card/30"}`} data-testid={`card-team-result-${team.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-black w-10 text-center ${idx === 0 && team.score > 0 ? "text-yellow-400" : "text-muted-foreground/40"}`}>
                            #{idx + 1}
                          </span>
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold" style={{ color: team.color }}>{team.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {teamPlayers.length} players · {teamSubs.length} submissions
                            </p>
                          </div>
                          <span className="text-2xl font-mono font-black">{team.score}</span>
                        </div>
                        <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(team.score / maxScore) * 100}%`, backgroundColor: team.color }}
                          />
                        </div>
                        {teamPlayers.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {teamPlayers.map(p => (
                              <span key={p.id} className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground">{p.name}</span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="items" className="mt-6">
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  Scavenger Items
                  <span className="text-muted-foreground font-normal ml-auto">{data.items.length} items</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.items.map(item => {
                    const completedBy = data.submissions.filter(s => s.itemId === item.id);
                    const completedTeamIds = completedBy.map(s => s.teamId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg" data-testid={`item-result-${item.id}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="font-mono text-primary font-bold w-12 text-right text-sm shrink-0">{item.points}</span>
                          <span className="text-sm truncate">{item.description}</span>
                          {item.mediaType === "video" && (
                            <Badge variant="outline" className="border-purple-400/30 text-purple-400 text-[10px] shrink-0">
                              <Video className="w-2.5 h-2.5 mr-0.5" /> Video
                            </Badge>
                          )}
                          {item.verificationMode === "proctor" && (
                            <Badge variant="outline" className="border-yellow-400/30 text-yellow-400 text-[10px] shrink-0">
                              <Eye className="w-2.5 h-2.5 mr-0.5" /> Proctor
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          {data.teams.map(t => (
                            <div
                              key={t.id}
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${completedTeamIds.includes(t.id) ? "" : "opacity-20"}`}
                              style={{
                                backgroundColor: completedTeamIds.includes(t.id) ? t.color : "transparent",
                                borderColor: t.color,
                              }}
                              title={t.name}
                            >
                              {completedTeamIds.includes(t.id) && <Check className="w-2.5 h-2.5 text-black" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="mt-6">
            {data.submissions.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>No verified submissions for this game.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {data.submissions.map(sub => (
                  <div
                    key={sub.id}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border border-white/10 hover:border-primary/50 transition-colors bg-card/30"
                    onClick={() => setViewingSub(sub)}
                    data-testid={`submission-card-${sub.id}`}
                  >
                    {sub.mediaType === "video" || sub.photoData?.startsWith("data:video") ? (
                      <div className="w-full aspect-square bg-purple-500/10 flex items-center justify-center">
                        <Video className="w-8 h-8 text-purple-400" />
                      </div>
                    ) : (
                      <img src={sub.photoData} alt={sub.description} className="w-full aspect-square object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs font-medium truncate">{sub.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        <span style={{ color: sub.teamColor }}>{sub.teamName}</span> · {sub.playerName}
                      </p>
                    </div>
                    <div className="absolute top-1.5 right-1.5">
                      <span className="text-[10px] font-mono font-bold bg-black/60 text-yellow-400 px-1.5 py-0.5 rounded">+{(sub.bonusPoints || 0) > 0 ? `${sub.points}+${sub.bonusPoints}b` : sub.points}</span>
                    </div>
                    <div className="absolute top-1.5 left-1.5">
                      <div className="w-3 h-3 rounded-full border border-white/50" style={{ backgroundColor: sub.teamColor }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="replay" className="mt-6">
            {huntId && <ReplayMap huntId={huntId} />}
          </TabsContent>
        </Tabs>
      </div>

      {viewingSub && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewingSub(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-white/10 max-w-lg w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold">{viewingSub.description}</h3>
              <p className="text-sm text-muted-foreground">
                <span style={{ color: viewingSub.teamColor }}>{viewingSub.teamName}</span> · {viewingSub.playerName} · <span className="font-mono text-yellow-400">+{viewingSub.points}</span>
              </p>
            </div>
            <div className="p-4">
              {viewingSub.mediaType === "video" || viewingSub.photoData?.startsWith("data:video") ? (
                <VideoPlayer
                  src={viewingSub.photoData}
                  autoPlay
                  className="w-full rounded-lg max-h-[60vh] object-contain bg-black"
                />
              ) : (
                <img src={viewingSub.photoData} alt={viewingSub.description} className="w-full rounded-lg max-h-[60vh] object-contain bg-black" />
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setViewingSub(null)} data-testid="button-close-submission">
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
