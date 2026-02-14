import { useGame, ScavengerItem } from "@/context/GameContext";
import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Trophy, List, Camera, X, Check, Timer, UploadCloud, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";

// Simple hook for window size if I don't want to install react-use just for this
function useWindowSizeValues() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  return size;
}

export default function Game() {
  const { items, teams, currentUser, timeRemaining, submitPhoto } = useGame();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedItem, setSelectedItem] = useState<ScavengerItem | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const { width, height } = useWindowSizeValues();
  const [showConfetti, setShowConfetti] = useState(false);

  const myTeam = teams.find(t => t.id === currentUser?.teamId);
  
  // Sort teams by score
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setCapturedImage(imageSrc);
  }, [webcamRef]);

  const handleSubmit = async () => {
    if (!selectedItem || !capturedImage) return;
    setIsSubmitting(true);
    
    const success = await submitPhoto(selectedItem.id, capturedImage);
    
    setIsSubmitting(false);
    setSelectedItem(null);
    setCapturedImage(null);
    
    if (success) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden relative">
      {showConfetti && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}
      
      {/* Header / HUD */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Time Left</span>
          <div className={`font-mono text-2xl font-bold flex items-center gap-2 ${timeRemaining < 300 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
            <Timer className="w-5 h-5" />
            {formatTime(timeRemaining)}
          </div>
        </div>
        
        <div className="text-right">
           <span className="text-xs text-muted-foreground uppercase tracking-widest">My Team</span>
           <div className="text-xl font-bold" style={{ color: myTeam?.color }}>
             {myTeam?.score || 0} PTS
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list" className="text-lg py-3">
              <List className="w-4 h-4 mr-2" /> Missions
            </TabsTrigger>
            <TabsTrigger value="scoreboard" className="text-lg py-3">
              <Trophy className="w-4 h-4 mr-2" /> Standings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {items.map(item => {
              const isCompleted = item.completedByTeamIds.includes(myTeam?.id || "");
              
              return (
                <Card 
                  key={item.id} 
                  className={`border transition-all ${isCompleted ? 'bg-green-500/10 border-green-500/30 opacity-70' : 'bg-card border-white/5 hover:border-primary/50 active:scale-[0.98]'}`}
                  onClick={() => !isCompleted && setSelectedItem(item)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium text-lg ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {item.description}
                        </span>
                        <Badge variant={isCompleted ? "secondary" : "outline"} className={isCompleted ? "bg-green-500 text-black" : "border-primary text-primary"}>
                          {item.points} PTS
                        </Badge>
                      </div>
                      {isCompleted && (
                        <div className="text-xs text-green-400 flex items-center gap-1 mt-2">
                          <Check className="w-3 h-3" /> Completed by team
                        </div>
                      )}
                    </div>
                    {!isCompleted && <ChevronRight className="text-muted-foreground" />}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="scoreboard" className="space-y-4">
             {sortedTeams.map((team, index) => (
               <div key={team.id} className="relative">
                 <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5">
                   <div className="font-display text-4xl font-bold text-muted-foreground/30 w-8">
                     #{index + 1}
                   </div>
                   <div className="flex-1">
                     <h3 className="font-bold text-lg" style={{ color: team.color }}>{team.name}</h3>
                     <Progress value={(team.score / (items.reduce((a, b) => a + b.points, 0))) * 100} className="h-2 mt-2 bg-white/5" />
                   </div>
                   <div className="text-2xl font-black">{team.score}</div>
                 </div>
               </div>
             ))}
          </TabsContent>
        </Tabs>
      </main>

      {/* Camera Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
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
                 <p className="text-primary font-bold animate-pulse">Analysing Image...</p>
               </div>
             ) : (
                capturedImage ? (
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
                ) : (
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }}
                    className="w-full h-full object-cover"
                  />
                )
             )}
             
             {/* Reticle Overlay */}
             {!capturedImage && !isSubmitting && (
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

          <div className="p-4 bg-background border-t border-white/10 grid grid-cols-2 gap-4">
            {capturedImage ? (
              <>
                <Button variant="outline" onClick={() => setCapturedImage(null)} disabled={isSubmitting}>
                  <X className="mr-2 w-4 h-4" /> Retake
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-500 hover:bg-green-600 text-black font-bold">
                  <UploadCloud className="mr-2 w-4 h-4" /> Submit
                </Button>
              </>
            ) : (
              <Button onClick={capture} size="lg" className="col-span-2 h-14 text-xl font-bold bg-primary hover:bg-primary/90">
                <Camera className="mr-2 w-6 h-6" /> SNAP
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
