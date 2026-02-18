import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";

interface ReplayPing {
  playerId: string;
  teamId: number | null;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface ReplaySubmission {
  itemId: number;
  teamId: number;
  playerId: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  description: string;
}

interface ReplayTeam {
  id: number;
  name: string;
  color: string;
  score: number;
}

interface ReplayPlayer {
  id: string;
  name: string;
  teamId: number | null;
}

interface ReplayData {
  hunt: {
    id: string;
    name: string;
    gameStartTime: string;
    gameEndTime: string;
    durationMinutes: number;
    trackLocations: boolean;
  };
  players: ReplayPlayer[];
  teams: ReplayTeam[];
  locationPings: ReplayPing[];
  submissions: ReplaySubmission[];
}

function getTeamColor(teamId: number | null, teams: ReplayTeam[]): string {
  if (!teamId) return "#888888";
  const team = teams.find(t => t.id === teamId);
  return team?.color || "#888888";
}

function getPlayerName(playerId: string, players: ReplayPlayer[]): string {
  const p = players.find(pl => pl.id === playerId);
  return p?.name || "Unknown";
}

const SPEED_OPTIONS = [1, 2, 5, 10];

export function ReplayMap({ huntId }: { huntId: string }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const speed = SPEED_OPTIONS[speedIdx];

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const trailPointsRef = useRef<Map<string, L.LatLngTuple[]>>(new Map());
  const submissionMarkersRef = useRef<L.Marker[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    fetch(`/api/hunts/${huntId}/replay`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [huntId]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current || !data) return;

    const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    leafletMapRef.current = map;

    if (data.locationPings.length > 0) {
      const bounds = data.locationPings.map(p => [p.latitude, p.longitude] as L.LatLngTuple);
      map.fitBounds(L.latLngBounds(bounds).pad(0.2));
    }

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [data]);

  const clearMapObjects = useCallback(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    trailsRef.current.forEach(t => t.remove());
    trailsRef.current.clear();
    trailPointsRef.current.clear();
    submissionMarkersRef.current.forEach(m => m.remove());
    submissionMarkersRef.current = [];
  }, []);

  const renderFrame = useCallback((currentProgress: number) => {
    if (!data || !leafletMapRef.current) return;
    const map = leafletMapRef.current;

    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalDuration = endTime - startTime;
    const currentTime = startTime + totalDuration * currentProgress;

    clearMapObjects();

    const playerTrails = new Map<string, L.LatLngTuple[]>();
    const playerLatest = new Map<string, ReplayPing>();

    for (const ping of data.locationPings) {
      const pingTime = new Date(ping.timestamp).getTime();
      if (pingTime > currentTime) break;

      const trail = playerTrails.get(ping.playerId) || [];
      trail.push([ping.latitude, ping.longitude]);
      playerTrails.set(ping.playerId, trail);
      playerLatest.set(ping.playerId, ping);
    }

    playerTrails.forEach((points, playerId) => {
      const ping = playerLatest.get(playerId)!;
      const color = getTeamColor(ping.teamId, data.teams);

      if (points.length > 1) {
        const polyline = L.polyline(points, {
          color,
          weight: 3,
          opacity: 0.6,
          dashArray: "5,5",
        }).addTo(map);
        trailsRef.current.set(playerId, polyline);
      }

      const lastPoint = points[points.length - 1];
      const marker = L.circleMarker(lastPoint, {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);
      const name = getPlayerName(playerId, data.players);
      marker.bindTooltip(name, { permanent: true, direction: "top", offset: [0, -10], className: "player-tooltip" });
      markersRef.current.set(playerId, marker);
    });

    const submissionIcon = L.divIcon({
      className: "submission-marker",
      html: '<div style="width:20px;height:20px;background:gold;border:2px solid #333;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">⭐</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    for (const sub of data.submissions) {
      const subTime = new Date(sub.createdAt).getTime();
      if (subTime > currentTime) continue;
      if (sub.latitude == null || sub.longitude == null) continue;

      const teamName = data.teams.find(t => t.id === sub.teamId)?.name || "Team";
      const marker = L.marker([sub.latitude, sub.longitude], { icon: submissionIcon }).addTo(map);
      marker.bindPopup(`<b>${teamName}</b><br/>${sub.description}`);
      submissionMarkersRef.current.push(marker);
    }
  }, [data, clearMapObjects]);

  useEffect(() => {
    renderFrame(progress);
  }, [progress, renderFrame]);

  useEffect(() => {
    if (!playing || !data) return;

    lastTickRef.current = performance.now();

    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalDuration = endTime - startTime;
    const replayDuration = 120000;

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      const progressDelta = (delta * speed) / replayDuration;

      setProgress(prev => {
        const next = prev + progressDelta;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [playing, speed, data]);

  const formatReplayTime = (prog: number): string => {
    if (!data) return "0:00";
    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalDuration = endTime - startTime;
    const currentMs = totalDuration * prog;
    const totalSec = Math.floor(currentMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalGameTime = data ? (() => {
    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalSec = Math.floor((endTime - startTime) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  })() : "0:00";

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading replay data...</div>;
  }

  if (!data || !data.hunt.trackLocations || data.locationPings.length === 0 || !data.hunt.gameStartTime || !data.hunt.gameEndTime) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {!data?.hunt?.gameStartTime || !data?.hunt?.gameEndTime
          ? "Game timing data is incomplete for replay."
          : "No location data available for this hunt."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-lg overflow-hidden border border-white/10">
        <div ref={mapRef} className="w-full h-[500px]" data-testid="replay-map" />
      </div>

      <div className="flex items-center gap-3 bg-card/50 rounded-lg p-3 border border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setProgress(0); setPlaying(false); clearMapObjects(); }}
          data-testid="button-replay-reset"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPlaying(!playing)}
          data-testid="button-replay-play"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSpeedIdx((speedIdx + 1) % SPEED_OPTIONS.length)}
          className="font-mono text-xs min-w-[48px]"
          data-testid="button-replay-speed"
        >
          {speed}x
        </Button>
        <span className="text-xs font-mono text-muted-foreground w-12">{formatReplayTime(progress)}</span>
        <Slider
          value={[progress * 100]}
          onValueChange={(v) => { setProgress(v[0] / 100); setPlaying(false); }}
          min={0}
          max={100}
          step={0.1}
          className="flex-1"
          data-testid="slider-replay-progress"
        />
        <span className="text-xs font-mono text-muted-foreground w-12">{totalGameTime}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.teams.map(team => (
          <div key={team.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
            <span>{team.name}</span>
          </div>
        ))}
      </div>

      <style>{`
        .player-tooltip {
          background: rgba(0,0,0,0.8) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          color: white !important;
          font-size: 12px !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          box-shadow: none !important;
        }
        .player-tooltip::before {
          border-top-color: rgba(0,0,0,0.8) !important;
        }
      `}</style>
    </div>
  );
}
