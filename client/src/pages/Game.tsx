import { useGame } from "@/context/GameContext";
import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Trophy, List, Camera, X, Check, Timer, UploadCloud, ChevronRight, ArrowLeft, Clock, Eye, Bot, RotateCcw, AlertTriangle, Video, Loader2, Square } from "lucide-react";
import { motion } from "framer-motion";
import Confetti from "react-confetti";
import { useLocation } from "wouter";

function useWindowSizeValues() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  return size;
}

export default function Game() {
  const { items, teams, currentUser, timeRemaining, submitPhoto, submitVideo, redoSubmission, completedSubmissions, pendingSubmissions, rejectedSubmissions, uploadingItems, status } = useGame();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ verified: boolean; aiResponse: string } | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const { width, height } = useWindowSizeValues();
  const [showConfetti, setShowConfetti] = useState(false);
  const [_, setLocation] = useLocation();
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [viewingMode, setViewingMode] = useState<"completed" | "pending">("completed");
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingCamera, setRequestingCamera] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);

  const myTeam = teams.find(t => t.id === currentUser?.teamId);
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const totalPoints = items.reduce((a, b) => a + b.points, 0);

  const isVideoItem = selectedItem?.mediaType === "video";
  const videoLength = selectedItem?.videoLengthSeconds || 20;

  useEffect(() => {
    if (status === "finished") {
      setLocation("/lobby");
    }
  }, [status, setLocation]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  const cameraRequestId = useRef(0);

  const handleEnableCamera = async () => {
    if (videoStreamRef.current) {
      setCameraReady(true);
      return;
    }

    let isInIframe = false;
    try { isInIframe = window.self !== window.top; } catch (_) { isInIframe = true; }
    if (isInIframe) {
      setVideoError("Camera access doesn't work in embedded previews. Please open this page in a new browser tab.");
      return;
    }
    if (!window.isSecureContext) {
      setVideoError("Camera access requires a secure connection (HTTPS). Please open this page in a new browser tab.");
      return;
    }

    const requestId = ++cameraRequestId.current;
    setRequestingCamera(true);
    setVideoError(null);
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVideoError("Your browser doesn't support camera access. Try using Safari or Chrome.");
        setRequestingCamera(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      videoStreamRef.current = stream;
      setCameraReady(true);
      setRequestingCamera(false);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        try { await videoPreviewRef.current.play(); } catch (_) {}
      }
    } catch (permErr: any) {
      if (requestId !== cameraRequestId.current) return;
      setRequestingCamera(false);
      console.error("Camera access error:", permErr.name, permErr.message);
      if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
        setVideoError("Camera access was denied. Please tap 'Allow' when your browser asks for camera permission. You may need to go to your browser settings to enable camera access for this site.");
      } else if (permErr.name === "NotFoundError" || permErr.name === "DevicesNotFoundError") {
        setVideoError("No camera found. Please make sure your device has a camera.");
      } else if (permErr.name === "NotReadableError" || permErr.name === "TrackStartError") {
        setVideoError("Camera is in use by another app. Please close other apps using the camera and try again.");
      } else if (permErr.name === "OverconstrainedError") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (requestId !== cameraRequestId.current) {
            fallbackStream.getTracks().forEach(t => t.stop());
            return;
          }
          videoStreamRef.current = fallbackStream;
          setCameraReady(true);
          setRequestingCamera(false);
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = fallbackStream;
            try { await videoPreviewRef.current.play(); } catch (_) {}
          }
          return;
        } catch (_) {
          setVideoError("Could not access camera with the required settings. Try a different browser.");
        }
      } else {
        setVideoError(`Could not access camera: ${permErr.message || permErr.name || "Unknown error"}`);
      }
    }
  };

  const isItemCompleted = (itemId: number) => completedSubmissions.some(s => s.itemId === itemId && s.teamId === currentUser?.teamId);
  const isItemPending = (itemId: number) => pendingSubmissions.some(s => s.itemId === itemId && s.teamId === currentUser?.teamId);
  const isItemUploading = (itemId: number) => uploadingItems.has(itemId);
  const getItemRejection = (itemId: number) => rejectedSubmissions.find(s => s.itemId === itemId && s.teamId === currentUser?.teamId);
  const getCompletedSubmission = (itemId: number) => completedSubmissions.find(s => s.itemId === itemId && s.teamId === currentUser?.teamId);
  const getPendingSubmission = (itemId: number) => pendingSubmissions.find(s => s.itemId === itemId && s.teamId === currentUser?.teamId);

  const handleRedo = async () => {
    if (!viewingItem) return;
    setIsRedoing(true);
    const success = await redoSubmission(viewingItem.id);
    setIsRedoing(false);
    setShowRedoConfirm(false);
    if (success) {
      setViewingItem(null);
      setSelectedItem(viewingItem);
    }
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

  const startVideoRecording = async () => {
    setVideoError(null);
    try {
      if (typeof MediaRecorder === "undefined") {
        setVideoError("Video recording is not supported in this browser. Try opening in Chrome or Safari.");
        return;
      }

      let stream = videoStreamRef.current;
      if (!stream) {
        await handleEnableCamera();
        stream = videoStreamRef.current;
        if (!stream) return;
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : MediaRecorder.isTypeSupported("video/mp4")
            ? "video/mp4"
            : "";

      if (!mimeType) {
        setVideoError("Your browser doesn't support any video recording format. Please try Chrome or Firefox.");
        return;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 500000,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream!.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
        setCameraReady(false);
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setVideoError("Recording failed unexpectedly. Please try again.");
        stream!.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
        setCameraReady(false);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
        if (elapsed >= videoLength) {
          recorder.stop();
        }
      }, 100);
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      setVideoError(`Failed to start recording: ${err.message || "Unknown error"}`);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem || !capturedImage) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    const result = await submitPhoto(selectedItem.id, capturedImage);
    setIsSubmitting(false);

    if (result.status === "pending") {
      setSelectedItem(null);
      setCapturedImage(null);
      setSubmitResult(null);
      return;
    }

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

  const handleVideoSubmit = () => {
    if (!selectedItem || !recordedBlob) return;
    submitVideo(selectedItem.id, recordedBlob);
    closeDialog();
  };

  const closeDialog = () => {
    cameraRequestId.current++;
    setSelectedItem(null);
    setCapturedImage(null);
    setSubmitResult(null);
    setRecordedBlob(null);
    setVideoError(null);
    setCameraReady(false);
    setRequestingCamera(false);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
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
              const pending = isItemPending(item.id);
              const uploading = isItemUploading(item.id);
              const rejection = getItemRejection(item.id);
              return (
                <Card
                  key={item.id}
                  className={`border transition-all cursor-pointer ${
                    uploading ? "bg-blue-500/10 border-blue-500/30 opacity-80" :
                    completed ? "bg-green-500/10 border-green-500/30" :
                    pending ? "bg-yellow-500/10 border-yellow-500/30 opacity-80" :
                    rejection ? "bg-card border-destructive/30 hover:border-destructive/50 active:scale-[0.98]" :
                    "bg-card border-white/5 hover:border-primary/50 active:scale-[0.98]"
                  }`}
                  onClick={() => {
                    if (uploading) return;
                    if (completed) {
                      setViewingMode("completed");
                      setViewingItem(item);
                    } else if (pending) {
                      setViewingMode("pending");
                      setViewingItem(item);
                    } else {
                      setSelectedItem(item);
                    }
                  }}
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium text-lg ${completed ? "line-through text-muted-foreground" : ""}`}>
                          {item.description}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.mediaType === "video" && (
                            <Badge variant="outline" className="border-purple-400/30 text-purple-400 text-[10px]">
                              <Video className="w-2.5 h-2.5 mr-0.5" /> Video
                            </Badge>
                          )}
                          {item.verificationMode === "proctor" && (
                            <Badge variant="outline" className="border-yellow-400/30 text-yellow-400 text-[10px]">
                              <Eye className="w-2.5 h-2.5 mr-0.5" /> Proctor
                            </Badge>
                          )}
                          <Badge variant={completed ? "secondary" : "outline"} className={completed ? "bg-green-500 text-black" : "border-primary text-primary"}>
                            {item.points} PTS
                          </Badge>
                        </div>
                      </div>
                      {uploading && (
                        <div className="text-xs text-blue-400 flex items-center gap-1 mt-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                        </div>
                      )}
                      {completed && !uploading && (
                        <div className="text-xs text-green-400 flex items-center gap-1 mt-2">
                          <Check className="w-3 h-3" /> Completed - tap to view
                        </div>
                      )}
                      {pending && !uploading && (
                        <div className="text-xs text-yellow-400 flex items-center gap-1 mt-2">
                          <Clock className="w-3 h-3" /> Waiting for review - tap to view
                        </div>
                      )}
                      {rejection && !completed && !pending && !uploading && (
                        <div className="text-xs text-destructive flex items-center gap-1 mt-2">
                          <X className="w-3 h-3" /> Rejected: {rejection.proctorFeedback}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="text-muted-foreground" />
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

      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open && !requestingCamera) closeDialog(); }}>
        <DialogContent
          className="sm:max-w-md bg-black border-white/10 p-0 overflow-hidden h-full sm:h-auto max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => { if (requestingCamera || isRecording) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (requestingCamera || isRecording) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isRecording) e.preventDefault(); }}
        >
          <DialogHeader className="p-4 bg-background z-10">
            <DialogTitle className="flex justify-between items-center">
              <span>{selectedItem?.description}</span>
              <div className="flex items-center gap-2">
                {isVideoItem && (
                  <Badge variant="outline" className="border-purple-400/30 text-purple-400">
                    <Video className="w-3 h-3 mr-1" /> {videoLength}s
                  </Badge>
                )}
                <Badge variant="outline">{selectedItem?.points} PTS</Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {isVideoItem ? (
            <>
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
                {recordedUrl ? (
                  <video src={recordedUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <>
                    <video
                      ref={(el) => {
                        (videoPreviewRef as any).current = el;
                        if (el && videoStreamRef.current && !el.srcObject) {
                          el.srcObject = videoStreamRef.current;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {isRecording && (
                      <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-2 z-10">
                        <div className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                          <span className="font-mono text-white text-lg font-bold">
                            {recordingTime}s / {videoLength}s
                          </span>
                        </div>
                        <div className="w-3/4 h-2 bg-white/20 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-red-500 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${(recordingTime / videoLength) * 100}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                      </div>
                    )}
                    {!isRecording && !recordedUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-center space-y-3 px-4">
                          {videoError ? (
                            <>
                              <AlertTriangle className="w-12 h-12 mx-auto text-red-400" />
                              <p className="text-red-400 text-sm">{videoError}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEnableCamera}
                                className="text-white border-white/30 mt-2"
                                data-testid="button-retry-camera"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" /> Try Again
                              </Button>
                            </>
                          ) : requestingCamera ? (
                            <>
                              <Loader2 className="w-12 h-12 mx-auto text-white/60 animate-spin" />
                              <p className="text-white/80 text-sm">Requesting camera access...</p>
                              <p className="text-white/50 text-xs">Tap "Allow" when your browser asks for permission</p>
                            </>
                          ) : cameraReady ? (
                            <>
                              <Video className="w-12 h-12 mx-auto text-green-400" />
                              <p className="text-white/80 text-sm">Camera ready! Tap REC to start</p>
                              <p className="text-white/50 text-xs">Max {videoLength} seconds</p>
                            </>
                          ) : (
                            <>
                              <Camera className="w-16 h-16 mx-auto text-white/70" />
                              <p className="text-white text-base font-medium">Tap to enable your camera</p>
                              <p className="text-white/50 text-xs">Your browser will ask for camera permission</p>
                              <Button
                                onClick={handleEnableCamera}
                                size="lg"
                                className="mt-2 h-14 text-lg font-bold bg-primary hover:bg-primary/90 px-8"
                                data-testid="button-enable-camera"
                              >
                                <Camera className="mr-2 w-5 h-5" /> Enable Camera
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-4 bg-background border-t border-white/10 grid grid-cols-2 gap-4">
                {recordedUrl ? (
                  <>
                    <Button variant="outline" onClick={() => {
                      URL.revokeObjectURL(recordedUrl);
                      setRecordedUrl(null);
                      setRecordedBlob(null);
                    }} data-testid="button-retake-video">
                      <RotateCcw className="mr-2 w-4 h-4" /> Retake
                    </Button>
                    <Button onClick={handleVideoSubmit} className="bg-green-500 hover:bg-green-600 text-black font-bold" data-testid="button-submit-video">
                      <UploadCloud className="mr-2 w-4 h-4" /> Submit
                    </Button>
                  </>
                ) : isRecording ? (
                  <>
                    <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-recording">
                      <X className="mr-2 w-4 h-4" /> Cancel
                    </Button>
                    <Button onClick={stopVideoRecording} className="bg-red-500 hover:bg-red-600 text-white font-bold animate-pulse" data-testid="button-stop-recording">
                      <Square className="mr-2 w-4 h-4 fill-white" /> STOP
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={closeDialog} data-testid="button-back-to-list">
                      <ArrowLeft className="mr-2 w-4 h-4" /> Back
                    </Button>
                    <Button onClick={startVideoRecording} size="lg" disabled={!cameraReady} className="h-14 text-xl font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40" data-testid="button-record">
                      <Video className="mr-2 w-6 h-6" /> REC
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
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
                        {submitResult.aiResponse && (
                          <div className="bg-white/5 rounded-lg p-3 max-w-xs">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                            <p className="text-white text-sm text-center" data-testid="text-ai-reason">{submitResult.aiResponse}</p>
                          </div>
                        )}
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
                    <>
                      <Button variant="outline" onClick={closeDialog} data-testid="button-back-to-list">
                        <ArrowLeft className="mr-2 w-4 h-4" /> Back
                      </Button>
                      <Button onClick={capture} size="lg" className="h-14 text-xl font-bold bg-primary hover:bg-primary/90" data-testid="button-snap">
                        <Camera className="mr-2 w-6 h-6" /> SNAP
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="sm:max-w-md bg-black border-white/10 p-0 overflow-hidden">
          <DialogHeader className="p-4 bg-background z-10">
            <DialogTitle className="flex justify-between items-center">
              <span>{viewingItem?.description}</span>
              <Badge className={viewingMode === "completed" ? "bg-green-500 text-black ml-2" : "bg-yellow-500 text-black ml-2"}>
                {viewingItem?.points} PTS
              </Badge>
            </DialogTitle>
            <DialogDescription className={`flex items-center gap-1 text-sm ${viewingMode === "completed" ? "text-green-400" : "text-yellow-400"}`}>
              {viewingMode === "completed" ? (
                <><Check className="w-4 h-4" /> Approved</>
              ) : (
                <><Clock className="w-4 h-4" /> Awaiting proctor review</>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingItem && (() => {
            const sub = viewingMode === "completed"
              ? getCompletedSubmission(viewingItem.id)
              : getPendingSubmission(viewingItem.id);
            const photoData = sub && "photoData" in sub ? sub.photoData : undefined;
            const subMediaType = sub && "mediaType" in sub ? (sub as any).mediaType : "photo";
            const isVideo = subMediaType === "video" || (photoData && photoData.startsWith("data:video"));
            return (
              <div className="flex flex-col">
                {photoData ? (
                  <div className="relative bg-black flex items-center justify-center max-h-[50vh] overflow-hidden">
                    {isVideo ? (
                      <video src={photoData} controls className="w-full h-full object-contain" />
                    ) : (
                      <img src={photoData} alt="Submitted photo" className="w-full h-full object-contain" />
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Media not available</p>
                  </div>
                )}

                <div className="p-4 bg-background border-t border-white/10 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => setShowRedoConfirm(true)}
                    data-testid="button-redo"
                  >
                    <RotateCcw className="mr-2 w-4 h-4" />
                    {viewingMode === "completed" ? "Redo This Item" : "Withdraw & Redo"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRedoConfirm} onOpenChange={setShowRedoConfirm}>
        <AlertDialogContent className="bg-background border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              {viewingMode === "completed" ? "Redo Submission?" : "Withdraw Submission?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {viewingMode === "completed" ? (
                <>
                  <p>This will remove your previous submission for <strong className="text-white">"{viewingItem?.description}"</strong> and subtract <strong className="text-yellow-400">{viewingItem?.points} points</strong> from your team's score.</p>
                  <p>You'll then be able to take a new photo and resubmit.</p>
                </>
              ) : (
                <>
                  <p>This will withdraw your pending submission for <strong className="text-white">"{viewingItem?.description}"</strong> from the proctor's review queue.</p>
                  <p>No points will be affected since this item hasn't been scored yet. You'll be able to take a new photo and resubmit.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRedoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRedo}
              disabled={isRedoing}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              data-testid="button-confirm-redo"
            >
              {isRedoing ? "Removing..." : viewingMode === "completed" ? "Yes, Redo" : "Yes, Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
