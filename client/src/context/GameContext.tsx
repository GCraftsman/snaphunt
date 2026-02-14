import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type GameStatus = "setup" | "lobby" | "countdown" | "active" | "finished";

export interface Player {
  id: string;
  name: string;
  teamId: number | null;
  isProctor?: boolean;
}

export interface Team {
  id: number;
  name: string;
  score: number;
  color: string;
  huntId: string;
}

export interface ScavengerItem {
  id: number;
  description: string;
  points: number;
  sortOrder: number;
  huntId: string;
}

export interface CompletedSubmission {
  itemId: number;
  teamId: number;
  photoData: string;
}

export interface GameSettings {
  durationMinutes: number;
  teamCount: number;
  countdownSeconds: number;
}

interface GameContextType {
  huntId: string | null;
  huntCode: string | null;
  status: GameStatus;
  teams: Team[];
  players: Player[];
  items: ScavengerItem[];
  completedSubmissions: CompletedSubmission[];
  settings: GameSettings;
  timeRemaining: number;
  isLocked: boolean;
  currentUser: Player | null;
  sessionToken: string | null;
  countdownValue: number;
  connected: boolean;

  createHunt: (items: { description: string; points: number }[], settings: GameSettings, teamNames?: string[], huntName?: string) => Promise<string | null>;
  joinHunt: (code: string, name: string) => Promise<boolean>;
  joinTeam: (teamId: number) => void;
  lockTeams: () => void;
  startCountdown: () => void;
  stopGame: () => Promise<boolean>;
  submitPhoto: (itemId: number, photoData: string) => Promise<{ verified: boolean; aiResponse: string; points: number }>;
  resetGame: () => void;
  setSessionFromStorage: () => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SESSION_KEY = "snaphunt_session";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const [huntId, setHuntId] = useState<string | null>(null);
  const [huntCode, setHuntCode] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>("setup");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [items, setItems] = useState<ScavengerItem[]>([]);
  const [completedSubmissions, setCompletedSubmissions] = useState<CompletedSubmission[]>([]);
  const [settings, setSettings] = useState<GameSettings>({ durationMinutes: 60, teamCount: 4, countdownSeconds: 10 });
  const [isLocked, setIsLocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [connected, setConnected] = useState(false);

  const [gameStartTime, setGameStartTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [countdownStartTime, setCountdownStartTime] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(10);

  const connectWebSocket = useCallback((hId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join_hunt", huntId: hId }));
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (huntId) connectWebSocket(hId);
      }, 3000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "full_state": {
          const d = msg.data;
          setStatus(d.hunt.status as GameStatus);
          setHuntCode(d.hunt.code);
          setTeams(d.teams);
          setPlayers(d.players);
          setItems(d.items);
          setCompletedSubmissions(d.submissions || []);
          setIsLocked(d.hunt.teamsLocked);
          setSettings({
            durationMinutes: d.hunt.durationMinutes,
            teamCount: d.hunt.teamCount,
            countdownSeconds: d.hunt.countdownSeconds,
          });
          if (d.hunt.gameStartTime) {
            setGameStartTime(d.hunt.gameStartTime);
            setDurationMinutes(d.hunt.durationMinutes);
          }
          if (d.hunt.countdownStartTime) {
            setCountdownStartTime(d.hunt.countdownStartTime);
            setCountdownSeconds(d.hunt.countdownSeconds);
          }
          break;
        }
        case "player_joined":
          setPlayers(prev => [...prev, msg.data]);
          break;
        case "player_team_changed":
          setPlayers(prev => prev.map(p => p.id === msg.data.playerId ? { ...p, teamId: msg.data.teamId } : p));
          if (currentUser?.id === msg.data.playerId) {
            setCurrentUser(prev => prev ? { ...prev, teamId: msg.data.teamId } : prev);
          }
          break;
        case "teams_locked":
          setIsLocked(true);
          toast({ title: "Teams Locked!", description: "No more switching allowed." });
          break;
        case "countdown_started":
          setStatus("countdown");
          setCountdownStartTime(msg.data.countdownStartTime);
          setCountdownSeconds(msg.data.countdownSeconds);
          break;
        case "game_started":
          setStatus("active");
          setGameStartTime(msg.data.gameStartTime);
          setDurationMinutes(msg.data.durationMinutes);
          break;
        case "game_finished":
          setStatus("finished");
          break;
        case "item_completed":
          setCompletedSubmissions(prev => [...prev, {
            itemId: msg.data.itemId,
            teamId: msg.data.teamId,
            photoData: msg.data.photoData,
          }]);
          setTeams(prev => prev.map(t => t.id === msg.data.teamId ? { ...t, score: msg.data.newScore } : t));
          break;
      }
    };
  }, [huntId, toast, currentUser?.id]);

  // Timer effects
  useEffect(() => {
    if (status === "countdown" && countdownStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(countdownStartTime).getTime()) / 1000);
        const remaining = Math.max(0, countdownSeconds - elapsed);
        setCountdownValue(remaining);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [status, countdownStartTime, countdownSeconds]);

  useEffect(() => {
    if (status === "active" && gameStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(gameStartTime).getTime()) / 1000);
        const remaining = Math.max(0, durationMinutes * 60 - elapsed);
        setTimeRemaining(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, gameStartTime, durationMinutes]);

  const saveSession = (hId: string, token: string, player: Player) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ huntId: hId, sessionToken: token, player }));
  };

  const setSessionFromStorage = useCallback((): boolean => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return false;
    try {
      const { huntId: hId, sessionToken: token, player } = JSON.parse(stored);
      setHuntId(hId);
      setSessionToken(token);
      setCurrentUser(player);
      connectWebSocket(hId);
      return true;
    } catch {
      return false;
    }
  }, [connectWebSocket]);

  const createHunt = async (
    itemList: { description: string; points: number }[],
    gameSettings: GameSettings,
    teamNames?: string[],
    huntName?: string
  ): Promise<string | null> => {
    try {
      const res = await fetch("/api/hunts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: itemList,
          settings: gameSettings,
          teamNames,
          huntName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create hunt");

      const hId = data.hunt.id;
      setHuntId(hId);
      setHuntCode(data.hunt.code);
      setSessionToken(data.sessionToken);
      const proctorPlayer = { id: data.playerId, name: "Game Proctor", teamId: null, isProctor: true };
      setCurrentUser(proctorPlayer);
      saveSession(hId, data.sessionToken, proctorPlayer);
      connectWebSocket(hId);
      return hId;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return null;
    }
  };

  const joinHunt = async (code: string, name: string): Promise<boolean> => {
    try {
      const huntRes = await fetch(`/api/hunts/code/${code.toUpperCase()}`);
      const huntData = await huntRes.json();
      if (!huntRes.ok) throw new Error(huntData.error || "Hunt not found");

      const hId = huntData.id;

      const joinRes = await fetch(`/api/hunts/${hId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok) throw new Error(joinData.error);

      setHuntId(hId);
      setSessionToken(joinData.sessionToken);
      setCurrentUser(joinData.player);
      saveSession(hId, joinData.sessionToken, joinData.player);
      connectWebSocket(hId);
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const joinTeam = async (teamId: number) => {
    if (!currentUser || !huntId) return;
    if (isLocked) {
      toast({ title: "Teams Locked", description: "The proctor has locked the teams.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/hunts/${huntId}/join-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentUser.id, teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setCurrentUser(prev => prev ? { ...prev, teamId } : prev);
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        session.player.teamId = teamId;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const lockTeams = async () => {
    if (!huntId) return;
    try {
      await fetch(`/api/hunts/${huntId}/lock-teams`, { method: "POST" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const startCountdown = async () => {
    if (!huntId) return;
    try {
      await fetch(`/api/hunts/${huntId}/start-countdown`, { method: "POST" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const stopGame = async (): Promise<boolean> => {
    if (!huntId) return false;
    try {
      const res = await fetch(`/api/hunts/${huntId}/stop`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const submitPhoto = async (itemId: number, photoData: string): Promise<{ verified: boolean; aiResponse: string; points: number }> => {
    if (!huntId || !currentUser?.teamId) {
      return { verified: false, aiResponse: "Not on a team", points: 0 };
    }
    try {
      const res = await fetch(`/api/hunts/${huntId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          teamId: currentUser.teamId,
          playerId: currentUser.id,
          photoData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return { verified: false, aiResponse: err.message, points: 0 };
    }
  };

  const resetGame = () => {
    if (wsRef.current) wsRef.current.close();
    sessionStorage.removeItem(SESSION_KEY);
    setHuntId(null);
    setHuntCode(null);
    setStatus("setup");
    setTeams([]);
    setPlayers([]);
    setItems([]);
    setCompletedSubmissions([]);
    setIsLocked(false);
    setCurrentUser(null);
    setSessionToken(null);
    setCountdownValue(0);
    setTimeRemaining(0);
    setGameStartTime(null);
    setCountdownStartTime(null);
  };

  return (
    <GameContext.Provider
      value={{
        huntId,
        huntCode,
        status,
        teams,
        players,
        items,
        completedSubmissions,
        settings,
        timeRemaining,
        isLocked,
        currentUser,
        sessionToken,
        countdownValue,
        connected,
        createHunt,
        joinHunt,
        joinTeam,
        lockTeams,
        startCountdown,
        stopGame,
        submitPhoto,
        resetGame,
        setSessionFromStorage,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
