import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGame, type LocationUpdate, type Team, type Player } from "@/context/GameContext";

function getTeamColor(teamId: number | null, teams: Team[]): string {
  if (!teamId) return "#888888";
  const team = teams.find(t => t.id === teamId);
  return team?.color || "#888888";
}

function getPlayerName(playerId: string, players: Player[]): string {
  const p = players.find(pl => pl.id === playerId);
  return p?.name || "Unknown";
}

export function LiveMap() {
  const { playerLocations, teams, players } = useGame();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const currentMarkers = markersRef.current;
    const bounds: L.LatLngExpression[] = [];

    playerLocations.forEach((loc: LocationUpdate, playerId: string) => {
      const color = getTeamColor(loc.teamId, teams);
      const name = getPlayerName(playerId, players);
      const latLng: L.LatLngExpression = [loc.latitude, loc.longitude];
      bounds.push(latLng);

      if (currentMarkers.has(playerId)) {
        const marker = currentMarkers.get(playerId)!;
        marker.setLatLng(latLng);
        marker.setStyle({ color, fillColor: color });
        marker.setTooltipContent(name);
      } else {
        const marker = L.circleMarker(latLng, {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 2,
        }).addTo(map);
        marker.bindTooltip(name, { permanent: true, direction: "top", offset: [0, -10], className: "player-tooltip" });
        currentMarkers.set(playerId, marker);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds as L.LatLngTuple[]).pad(0.2));
    }
  }, [playerLocations, teams, players]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-white/10">
      <div ref={mapRef} className="w-full h-[500px]" data-testid="live-map" />
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
