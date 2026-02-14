import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// --- Types ---
export type GameStatus = "setup" | "lobby" | "countdown" | "active" | "finished";

export interface Player {
  id: string;
  name: string;
  teamId: string | null;
  isProctor?: boolean;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface ScavengerItem {
  id: string;
  description: string;
  points: number;
  completedByTeamIds: string[]; // List of team IDs that completed this
  photoUrl?: string; // Mock storage for photo
}

export interface GameSettings {
  durationMinutes: number;
  teamCount: number;
  countdownSeconds: number;
}

interface GameState {
  status: GameStatus;
  teams: Team[];
  players: Player[];
  items: ScavengerItem[];
  settings: GameSettings;
  timeRemaining: number;
  isLocked: boolean;
  startTime?: number; // For syncing timers
  countdownStartTime?: number; // For syncing countdown
}

interface GameContextType extends GameState {
  currentUser: Player | null;
  countdownValue: number;
  
  // Actions
  login: (name: string, isProctor?: boolean) => void;
  createHunt: (items: ScavengerItem[], settings: GameSettings) => void;
  joinTeam: (teamId: string) => void;
  lockTeams: () => void;
  startCountdown: () => void;
  submitPhoto: (itemId: string, photo: string) => Promise<boolean>;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// --- Mock Data ---
const MOCK_TEAMS_COLORS = [
  "hsl(326 100% 60%)", // Pink
  "hsl(190 100% 50%)", // Cyan
  "hsl(260 100% 65%)", // Purple
  "hsl(45 100% 55%)",  // Yellow
  "hsl(150 100% 50%)", // Green
];

const INITIAL_ITEMS: ScavengerItem[] = [
  { id: "1", description: "Find a red stapler", points: 100, completedByTeamIds: [] },
  { id: "2", description: "Team high five", points: 200, completedByTeamIds: [] },
  { id: "3", description: "Human pyramid (3 people)", points: 500, completedByTeamIds: [] },
  { id: "4", description: "Something older than you", points: 150, completedByTeamIds: [] },
];

const STORAGE_KEY = "snaphunt_state";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  // Local User State (Not synced across tabs normally, but we want to simulate distinct users)
  // Actually, for this demo to work on one machine with tabs, we need players to be in the shared state, 
  // but currentUser is local to the tab.
  const [currentUser, setCurrentUser] = useState<Player | null>(null);

  // Shared Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    // Try to load from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      status: "setup",
      teams: [],
      players: [],
      items: INITIAL_ITEMS,
      settings: {
        durationMinutes: 60,
        teamCount: 4,
        countdownSeconds: 10,
      },
      timeRemaining: 0,
      isLocked: false,
    };
  });
  
  // Derived state for local display
  const [countdownValue, setCountdownValue] = useState(0);

  // --- Sync Effect ---
  useEffect(() => {
    // Write to storage whenever state changes
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setGameState(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // --- Timers based on absolute start times for sync ---
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const tick = () => {
      const now = Date.now();

      // Countdown Logic
      if (gameState.status === "countdown" && gameState.countdownStartTime) {
        const elapsed = Math.floor((now - gameState.countdownStartTime) / 1000);
        const remaining = Math.max(0, gameState.settings.countdownSeconds - elapsed);
        setCountdownValue(remaining);
        
        if (remaining <= 0) {
           // Transition to Active is handled by the "Master" (usually the tab that started it),
           // OR we can just handle it locally if we trust the clock.
           // To avoid race conditions in this simple sync, we'll let the logic below update status.
           // Ideally, only the proctor triggers the status change, but for a p2p sync style:
           if (currentUser?.isProctor) {
             updateState({ 
               status: "active", 
               startTime: Date.now(),
               countdownStartTime: undefined 
             });
           }
        }
      }

      // Game Timer Logic
      if (gameState.status === "active" && gameState.startTime) {
        const elapsed = Math.floor((now - gameState.startTime) / 1000);
        const totalDurationSeconds = gameState.settings.durationMinutes * 60;
        const remaining = Math.max(0, totalDurationSeconds - elapsed);
        
        // Only update display state if needed, but here we store it in main state for shared view?
        // No, timeRemaining is derived from startTime usually. 
        // But we put timeRemaining in gameState. Let's update it.
        // Again, to avoid flicker, let's just calculate it for rendering
        // But we want to store it so everyone sees the same "Time Left" approx.
        // A better way for this mock: Just have the Proctor drive the timer? 
        // No, let's just use local derived time for smoothness.
        
        if (currentUser?.isProctor && remaining !== gameState.timeRemaining) {
           // Only proctor writes time updates to storage to avoid conflicts?
           // Actually, writing every second to localStorage is bad for performance/listeners.
           // Let's NOT write timeRemaining to storage constantly.
           // Instead, rely on startTime and calculate locally.
        }
        
        // We will update the exposed timeRemaining for the UI
        setGameState(prev => {
             // Don't trigger storage write for just this field if possible? 
             // React state updates trigger effect.
             // We'll just update it locally? No, we need it in context.
             return { ...prev, timeRemaining: remaining }; 
        });

        if (remaining <= 0 && currentUser?.isProctor) {
           updateState({ status: "finished" });
        }
      }
    };

    interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState.status, gameState.startTime, gameState.countdownStartTime, gameState.settings.durationMinutes, gameState.settings.countdownSeconds, currentUser?.isProctor]);


  // Helper to update state and trigger sync
  const updateState = (updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  };

  // --- Actions ---

  const login = (name: string, isProctor = false) => {
    // Check if player already exists in shared state (rejoining?)
    // For simplicity, always create new, unless we stored ID in sessionStorage?
    // Let's just create new.
    const newUser: Player = {
      id: Math.random().toString(36).substring(7),
      name,
      teamId: null,
      isProctor,
    };
    setCurrentUser(newUser);
    
    // Add to shared players list
    updateState({ players: [...gameState.players, newUser] });
  };

  const createHunt = (newItems: ScavengerItem[], newSettings: GameSettings) => {
    // Generate Teams
    const generatedTeams: Team[] = Array.from({ length: newSettings.teamCount }).map((_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      score: 0,
      color: MOCK_TEAMS_COLORS[i % MOCK_TEAMS_COLORS.length],
    }));

    updateState({
      items: newItems,
      settings: newSettings,
      teams: generatedTeams,
      status: "lobby",
      isLocked: false,
      players: [], // Clear old players on new hunt? Or keep? Let's clear for clean slate.
    });
    
    // Re-add current proctor to players
    if (currentUser) {
       // logic to ensure proctor is in list
       // But wait, createHunt wipes players.
       // We should keep the current user in the list if they are proctor.
       // Actually, let's just keep the proctor.
       const proctor = gameState.players.find(p => p.isProctor) || currentUser;
       if (proctor) {
          updateState({ players: [proctor], teams: generatedTeams, items: newItems, settings: newSettings, status: "lobby", isLocked: false });
       }
    }
  };

  const joinTeam = (teamId: string) => {
    if (!currentUser) return;
    if (gameState.isLocked) {
      toast({ title: "Teams are Locked", description: "The proctor has locked the teams.", variant: "destructive" });
      return;
    }
    
    const updatedUser = { ...currentUser, teamId };
    setCurrentUser(updatedUser);
    
    updateState({
      players: gameState.players.map(p => p.id === currentUser.id ? updatedUser : p)
    });
  };

  const lockTeams = () => {
    updateState({ isLocked: true });
    toast({ title: "Teams Locked!", description: "No more switching allowed." });
  };

  const startCountdown = () => {
    updateState({ 
      status: "countdown",
      countdownStartTime: Date.now()
    });
  };

  const submitPhoto = async (itemId: string, photo: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Optimistic update locally? No, wait for mock result.
      setTimeout(() => {
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess && currentUser?.teamId) {
          // Calculate points
          const item = gameState.items.find(i => i.id === itemId);
          if (!item) { resolve(false); return; }

          // Use functional update to ensure we have latest state even inside closure
          setGameState(prev => {
             // Check if already completed by this team (race condition check)
             const currentItem = prev.items.find(i => i.id === itemId);
             if (currentItem?.completedByTeamIds.includes(currentUser.teamId!)) {
               return prev; // Already done
             }

             const newItems = prev.items.map(i => 
               i.id === itemId 
                 ? { ...i, completedByTeamIds: [...i.completedByTeamIds, currentUser.teamId!] }
                 : i
             );

             const newTeams = prev.teams.map(t => 
               t.id === currentUser.teamId
                 ? { ...t, score: t.score + item.points }
                 : t
             );

             return { ...prev, items: newItems, teams: newTeams };
          });
          
          resolve(true);
        } else {
          resolve(false);
        }
      }, 1500);
    });
  };

  const resetGame = () => {
    updateState({
      status: "setup",
      teams: [],
      players: [],
      items: INITIAL_ITEMS,
      isLocked: false,
      startTime: undefined,
      countdownStartTime: undefined
    });
    setCurrentUser(null);
  };

  return (
    <GameContext.Provider
      value={{
        ...gameState,
        currentUser,
        countdownValue,
        login,
        createHunt,
        joinTeam,
        lockTeams,
        startCountdown,
        submitPhoto,
        resetGame,
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
