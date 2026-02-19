import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGame, type LocationUpdate, type Team } from "@/context/GameContext";

function getTeamColor(teamId: number | null, teams: Team[]): string {
  if (teamId == null) return "#888888";
  const team = teams.find(t => t.id === teamId);
  return team?.color || "#888888";
}

export function LiveMap() {
  const { playerLocations, teams } = useGame();
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
      const latLng: L.LatLngExpression = [loc.latitude, loc.longitude];
      bounds.push(latLng);

      if (currentMarkers.has(playerId)) {
        const marker = currentMarkers.get(playerId)!;
        marker.setLatLng(latLng);
        marker.setStyle({ color, fillColor: color });
      } else {
        const marker = L.circleMarker(latLng, {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        currentMarkers.set(playerId, marker);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds as L.LatLngTuple[]).pad(0.2));
    }
  }, [playerLocations, teams]);

  return (
    <div ref={mapRef} className="w-full h-full min-h-[300px]" data-testid="live-map" />
  );
}
