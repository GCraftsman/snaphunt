import { useGame } from "@/context/GameContext";
import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Trophy, List, Camera, X, Check, Timer, UploadCloud, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Confetti from "react-confetti";
import { useLocation } from "wouter";

function useWindowSizeValues() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  return size;
}

export default function Game() {
  const { items, teams, currentUser, timeRemaining, submitPhoto, completedSubmissions, status } = useGame();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedItem, setSelectedItem] = useState<{ id: number; description: string; points: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ verified: boolean; aiResponse: string } | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const { width, height } = useWindowSizeValues();
  const [showConfetti, setShowConfetti] = useState(false);
  const [_, setLocation] = useLocation();

  const myTeam = teams.find(t => t.id === currentUser?.teamId);
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const totalPoints = items.reduce((a, b) => a + b.points, 0);

  useEffect(() => {
    if (status === "finished") {
      setLocation("/lobby");
    }
  }, [status, setLocation]);

  const isItemCompleted = (itemId: number) => {
    return completedSubmissions.some(s => s.itemId === itemId && s.teamId === currentUser?.teamId);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setCapturedImage(imageSrc);
  }, [webcamRef]);

  const handleSubmit = async () => {
    if (!selectedItem || !capturedImage) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    const result = await submitPhoto(selectedItem.id, capturedImage);

    setIsSubmitting(false);
    setSubmitResult(result);

    if (result.verified) {
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setSelectedItem(null);
        setCapturedImage(null);
        setSubmitResult(null);
      }, 3000);
    }
  };

  const closeDialog = () => {
    setSelectedItem(null);
    setCapturedImage(null);
    setSubmitResult(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden relative">
      {showConfetti && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}

      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Time Left</span>
          <div className={`font-mono text-2xl font-bold flex items-center gap-2 ${timeRemaining < 300 ? "text-destructive animate-pulse" : "text-primary"}`} data-testid="text-time-remaining">
            <Timer className="w-5 h-5" />
            {formatTime(timeRemaining)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">My Team</span>
          <div className="text-xl font-bold" style={{ color: myTeam?.color }} data-testid="text-team-score">
            {myTeam?.score || 0} PTS
          </div>
        </div>
      </header>

      <main className="p-4">
        <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list" className="text-lg py-3" data-testid="tab-missions">
              <List className="w-4 h-4 mr-2" /> Missions
            </TabsTrigger>
            <TabsTrigger value="scoreboard" className="text-lg py-3" data-testid="tab-standings">
              <Trophy className="w-4 h-4 mr-2" /> Standings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {items.map(item => {
              const completed = isItemCompleted(item.id);
              return (
                <Card
                  key={item.id}
                  className={`border transition-all ${completed ? "bg-green-500/10 border-green-500/30 opacity-70" : "bg-card border-white/5 hover:border-primary/50 active:scale-[0.98]"}`}
                  onClick={() => !completed && setSelectedItem(item)}
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium text-lg ${completed ? "line-through text-muted-foreground" : ""}`}>
                          {item.description}
                        </span>
                        <Badge variant={completed ? "secondary" : "outline"} className={completed ? "bg-green-500 text-black" : "border-primary text-primary"}>
                          {item.points} PTS
                        </Badge>
                      </div>
                      {completed && (
                        <div className="text-xs text-green-400 flex items-center gap-1 mt-2">
                          <Check className="w-3 h-3" /> Completed by team
                        </div>
                      )}
                    </div>
                    {!completed && <ChevronRight className="text-muted-foreground" />}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="scoreboard" className="space-y-4">
            {sortedTeams.map((team, index) => (
              <div key={team.id} className="relative" data-testid={`row-team-${team.id}`}>
                <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5">
                  <div className="font-display text-4xl font-bold text-muted-foreground/30 w-8">#{index + 1}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg" style={{ color: team.color }}>{team.name}</h3>
                    <Progress value={totalPoints > 0 ? (team.score / totalPoints) * 100 : 0} className="h-2 mt-2 bg-white/5" />
                  </div>
                  <div className="text-2xl font-black">{team.score}</div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md bg-black border-white/10 p-0 overflow-hidden h-full sm:h-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="p-4 bg-background z-10">
            <DialogTitle className="flex justify-between items-center">
              <span>{selectedItem?.description}</span>
              <Badge variant="outline" className="ml-2">{selectedItem?.points} PTS</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {isSubmitting ? (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-primary font-bold animate-pulse" data-testid="text-analyzing">AI is analyzing your photo...</p>
              </div>
            ) : submitResult ? (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center space-y-4 p-6">
                {submitResult.verified ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-10 h-10 text-green-500" />
                    </div>
                    <p className="text-green-400 font-bold text-xl" data-testid="text-verified">Verified!</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                      <X className="w-10 h-10 text-destructive" />
                    </div>
                    <p className="text-destructive font-bold text-xl" data-testid="text-rejected">Not a match</p>
                    <p className="text-muted-foreground text-sm text-center">{submitResult.aiResponse}</p>
                    <Button onClick={() => { setCapturedImage(null); setSubmitResult(null); }} variant="outline" data-testid="button-try-again">
                      Try Again
                    </Button>
                  </>
                )}
              </div>
            ) : capturedImage ? (
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="w-full h-full object-cover"
              />
            )}

            {!capturedImage && !isSubmitting && !submitResult && (
              <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/30 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary -mt-0.5 -ml-0.5" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary -mt-0.5 -mr-0.5" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary -mb-0.5 -ml-0.5" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary -mb-0.5 -mr-0.5" />
                </div>
              </div>
            )}
          </div>

          {!submitResult && (
            <div className="p-4 bg-background border-t border-white/10 grid grid-cols-2 gap-4">
              {capturedImage ? (
                <>
                  <Button variant="outline" onClick={() => setCapturedImage(null)} disabled={isSubmitting} data-testid="button-retake">
                    <X className="mr-2 w-4 h-4" /> Retake
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-500 hover:bg-green-600 text-black font-bold" data-testid="button-submit-photo">
                    <UploadCloud className="mr-2 w-4 h-4" /> Submit
                  </Button>
                </>
              ) : (
                <Button onClick={capture} size="lg" className="col-span-2 h-14 text-xl font-bold bg-primary hover:bg-primary/90" data-testid="button-snap">
                  <Camera className="mr-2 w-6 h-6" /> SNAP
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
