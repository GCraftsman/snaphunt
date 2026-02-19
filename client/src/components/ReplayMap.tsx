import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw } from "lucide-react";

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
  points: number;
  photoData: string;
  mediaType: "photo" | "video";
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
  if (teamId == null) return "#888888";
  const team = teams.find(t => t.id === teamId);
  return team?.color || "#888888";
}

function getPlayerName(playerId: string, players: ReplayPlayer[]): string {
  const p = players.find(pl => pl.id === playerId);
  return p?.name || "Unknown";
}

function getRunningScores(submissions: ReplaySubmission[], teams: ReplayTeam[], currentTime: number): Map<number, number> {
  const scores = new Map<number, number>();
  teams.forEach(t => scores.set(t.id, 0));
  for (const sub of submissions) {
    const subTime = new Date(sub.createdAt).getTime();
    if (subTime > currentTime) continue;
    const current = scores.get(sub.teamId) || 0;
    scores.set(sub.teamId, current + sub.points);
  }
  return scores;
}

function computeSpeedOptions(gameDurationSec: number): { speeds: number[]; defaultIdx: number } {
  const targetReplaySec = 180;
  const idealSpeed = gameDurationSec / targetReplaySec;
  const defaultSpeed = Math.max(2, Math.round(idealSpeed / 2) * 2);
  const half = Math.max(1, Math.round(defaultSpeed / 4) * 2 || Math.round(defaultSpeed / 2));
  const double = defaultSpeed * 2;
  const quad = defaultSpeed * 4;
  const unique = Array.from(new Set([half, defaultSpeed, double, quad])).sort((a, b) => a - b);
  const defaultIdx = unique.indexOf(defaultSpeed);
  return { speeds: unique, defaultIdx: defaultIdx >= 0 ? defaultIdx : 0 };
}

export function ReplayMap({ huntId, onComplete, teamFilter }: { huntId: string; onComplete?: () => void; teamFilter?: number }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState<number | null>(null);
  const [runningScores, setRunningScores] = useState<Map<number, number>>(new Map());

  const gameDurationSec = data?.hunt.gameStartTime && data?.hunt.gameEndTime
    ? (new Date(data.hunt.gameEndTime).getTime() - new Date(data.hunt.gameStartTime).getTime()) / 1000
    : 300;
  const { speeds: speedOptions, defaultIdx } = computeSpeedOptions(gameDurationSec);
  const activeSpeedIdx = speedIdx ?? defaultIdx;
  const speed = speedOptions[activeSpeedIdx];
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasCalledComplete = useRef(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const submissionMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const autoPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    const url = teamFilter != null ? `/api/hunts/${huntId}/replay?teamId=${teamFilter}` : `/api/hunts/${huntId}/replay`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [huntId, teamFilter]);

  const hasMap = data && data.hunt.trackLocations && data.locationPings.length > 0;

  useEffect(() => {
    if (!hasMap || !mapRef.current || leafletMapRef.current || !data) return;

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
  }, [data, hasMap]);

  const clearMapObjects = useCallback(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    trailsRef.current.forEach(t => t.remove());
    trailsRef.current.clear();
    submissionMarkersRef.current.forEach(m => m.remove());
    submissionMarkersRef.current.clear();
    if (autoPopupTimerRef.current) clearTimeout(autoPopupTimerRef.current);
  }, []);

  const renderFrame = useCallback((currentProgress: number) => {
    if (!data || !data.hunt.gameStartTime || !data.hunt.gameEndTime) return;

    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalDuration = endTime - startTime;
    const currentTime = startTime + totalDuration * currentProgress;

    const scores = getRunningScores(data.submissions, data.teams, currentTime);
    setRunningScores(scores);

    if (!leafletMapRef.current || !hasMap) return;
    const map = leafletMapRef.current;

    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();
    trailsRef.current.forEach(t => t.remove());
    trailsRef.current.clear();

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

    const activeSubKeys = new Set<string>();
    let newestNewSub: { key: string; marker: L.Marker } | null = null;

    for (const sub of data.submissions) {
      const subTime = new Date(sub.createdAt).getTime();
      if (subTime > currentTime) continue;
      if (sub.latitude == null || sub.longitude == null) continue;

      const subKey = `${sub.itemId}-${sub.teamId}`;
      activeSubKeys.add(subKey);

      if (!submissionMarkersRef.current.has(subKey)) {
        const teamColor = getTeamColor(sub.teamId, data.teams);
        const submissionIcon = L.divIcon({
          className: "submission-marker",
          html: `<div style="width:22px;height:16px;background:${teamColor};border:2px solid white;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
          iconSize: [22, 16],
          iconAnchor: [11, 8],
        });

        const marker = L.marker([sub.latitude, sub.longitude], { icon: submissionIcon }).addTo(map);
        const teamName = data.teams.find(t => t.id === sub.teamId)?.name || "Team";
        const isVideo = sub.mediaType === "video";
        const mediaHtml = isVideo && sub.photoData
          ? `<div style="position:relative;width:140px;"><video src="${sub.photoData}" style="width:140px;height:auto;border-radius:4px;display:block;" muted autoplay loop playsinline></video><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.75);color:gold;font-weight:bold;font-size:13px;padding:2px 6px;border-radius:4px;">+${sub.points}</div></div>`
          : isVideo
            ? `<div style="width:140px;height:100px;background:#111;display:flex;align-items:center;justify-content:center;border-radius:4px;margin-bottom:4px;font-size:24px;">📹</div>`
            : sub.photoData
              ? `<div style="position:relative;width:140px;"><img src="${sub.photoData}" style="width:140px;height:auto;border-radius:4px;display:block;" /><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.75);color:gold;font-weight:bold;font-size:13px;padding:2px 6px;border-radius:4px;">+${sub.points}</div></div>`
              : "";
        marker.bindPopup(
          `<div style="text-align:center;min-width:140px;">${mediaHtml}<div style="font-size:11px;margin-top:2px;"><b style="color:${teamColor}">${teamName}</b></div><div style="font-size:11px;color:#ccc;">${sub.description}</div>${!sub.photoData ? `<div style="font-size:12px;color:gold;font-weight:bold;">+${sub.points} pts</div>` : ""}</div>`,
          { maxWidth: 200 }
        );
        submissionMarkersRef.current.set(subKey, marker);
        newestNewSub = { key: subKey, marker };
      }
    }

    submissionMarkersRef.current.forEach((marker, key) => {
      if (!activeSubKeys.has(key)) {
        marker.remove();
        submissionMarkersRef.current.delete(key);
      }
    });

    if (newestNewSub) {
      if (autoPopupTimerRef.current) clearTimeout(autoPopupTimerRef.current);
      map.closePopup();
      newestNewSub.marker.openPopup();
      const timerKey = newestNewSub.key;
      autoPopupTimerRef.current = setTimeout(() => {
        const m = submissionMarkersRef.current.get(timerKey);
        if (m) m.closePopup();
      }, 3000);
    }
  }, [data, hasMap]);

  useEffect(() => {
    renderFrame(progress);
  }, [progress, renderFrame]);

  useEffect(() => {
    if (!playing || !data || !data.hunt.gameStartTime || !data.hunt.gameEndTime) return;

    lastTickRef.current = performance.now();
    const replayDurationMs = gameDurationSec * 1000;

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      const progressDelta = (delta * speed) / replayDurationMs;

      setProgress(prev => {
        const next = prev + progressDelta;
        if (next >= 1) {
          setPlaying(false);
          if (!hasCalledComplete.current) {
            hasCalledComplete.current = true;
            setTimeout(() => onCompleteRef.current?.(), 500);
          }
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
  }, [playing, speed, data, gameDurationSec]);

  const formatReplayTime = (prog: number): string => {
    if (!data || !data.hunt.gameStartTime || !data.hunt.gameEndTime) return "0:00";
    const startTime = new Date(data.hunt.gameStartTime).getTime();
    const endTime = new Date(data.hunt.gameEndTime).getTime();
    const totalDuration = endTime - startTime;
    const currentMs = totalDuration * prog;
    const totalSec = Math.floor(currentMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalGameTime = data && data.hunt.gameStartTime && data.hunt.gameEndTime ? (() => {
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

  if (!data || !data.hunt.gameStartTime || !data.hunt.gameEndTime) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Game timing data is incomplete for replay.
      </div>
    );
  }

  const sortedTeams = [...data.teams].sort((a, b) => {
    const scoreA = runningScores.get(a.id) || 0;
    const scoreB = runningScores.get(b.id) || 0;
    return scoreB - scoreA;
  });

  return (
    <div className="space-y-4">
      {hasMap ? (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 rounded-lg overflow-hidden border border-white/10">
            <div ref={mapRef} className="w-full h-[500px] lg:h-[600px]" data-testid="replay-map" />
          </div>
          <div className="lg:w-56 space-y-2 lg:max-h-[600px] overflow-y-auto">
            {sortedTeams.map((team, idx) => {
              const score = runningScores.get(team.id) || 0;
              return (
                <div key={team.id} className="flex items-center gap-2 px-3 py-2 bg-card/30 rounded-lg border border-white/5" data-testid={`replay-team-score-${team.id}`}>
                  <span className="text-sm font-bold text-muted-foreground/40">#{idx + 1}</span>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                  <span className="font-medium flex-1 text-xs truncate" style={{ color: team.color }}>{team.name}</span>
                  <span className="font-mono font-bold text-sm">{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTeams.map((team, idx) => {
            const score = runningScores.get(team.id) || 0;
            const maxScore = Math.max(...Array.from(runningScores.values()), 1);
            return (
              <div key={team.id} className="flex items-center gap-3 px-3 py-2 bg-card/30 rounded-lg border border-white/5" data-testid={`replay-team-score-${team.id}`}>
                <span className="text-lg font-bold text-muted-foreground/40 w-6">#{idx + 1}</span>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                <span className="font-medium flex-1 text-sm" style={{ color: team.color }}>{team.name}</span>
                <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(score / maxScore) * 100}%`, backgroundColor: team.color }}
                  />
                </div>
                <span className="font-mono font-bold text-sm w-12 text-right">{score}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 bg-card/50 rounded-lg p-3 border border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setProgress(0); setPlaying(false); setSpeedIdx(null); hasCalledComplete.current = false; if (hasMap) clearMapObjects(); }}
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
          onClick={() => setSpeedIdx((activeSpeedIdx + 1) % speedOptions.length)}
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
