import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGame, type LocationUpdate, type Team, type CompletedSubmission } from "@/context/GameContext";

function getTeamColor(teamId: number | null, teams: Team[]): string {
  if (teamId == null) return "#888888";
  const team = teams.find(t => t.id === teamId);
  return team?.color || "#888888";
}

function createSubmissionIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "submission-marker",
    html: `<div style="width:20px;height:16px;background:${color};border:2px solid white;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 16],
    iconAnchor: [10, 8],
  });
}

function createSubmissionPopupHtml(sub: CompletedSubmission, teamColor: string, teamName: string): string {
  const isVideo = sub.mediaType === "video";
  const mediaHtml = isVideo
    ? `<div style="width:140px;height:100px;background:#111;display:flex;align-items:center;justify-content:center;border-radius:4px;margin-bottom:4px;font-size:24px;">📹</div>`
    : sub.photoData
      ? `<div style="position:relative;width:140px;"><img src="${sub.photoData}" style="width:140px;height:auto;border-radius:4px;display:block;" /><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.75);color:gold;font-weight:bold;font-size:13px;padding:2px 6px;border-radius:4px;">+${sub.points || 0}</div></div>`
      : "";
  return `<div style="text-align:center;min-width:140px;">
    ${mediaHtml}
    <div style="font-size:11px;margin-top:2px;"><b style="color:${teamColor}">${teamName}</b></div>
    <div style="font-size:11px;color:#ccc;">${sub.description || ""}</div>
    ${!sub.photoData || isVideo ? `<div style="font-size:12px;color:gold;font-weight:bold;">+${sub.points || 0} pts</div>` : ""}
  </div>`;
}

export function LiveMap() {
  const { playerLocations, teams, completedSubmissions } = useGame();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const submissionMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const seenSubKeysRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const subsWithLocation = completedSubmissions.filter(s => s.latitude != null && s.longitude != null);
    const currentKeys = new Set<string>();
    let newestNewMarker: L.Marker | null = null;

    subsWithLocation.forEach(sub => {
      const subKey = `${sub.itemId}-${sub.teamId}`;
      currentKeys.add(subKey);

      if (!submissionMarkersRef.current.has(subKey)) {
        const teamColor = getTeamColor(sub.teamId, teams);
        const teamName = teams.find(t => t.id === sub.teamId)?.name || "Team";
        const icon = createSubmissionIcon(teamColor);
        const marker = L.marker([sub.latitude!, sub.longitude!], { icon }).addTo(map);
        marker.bindPopup(createSubmissionPopupHtml(sub, teamColor, teamName), { maxWidth: 200 });
        submissionMarkersRef.current.set(subKey, marker);

        if (!seenSubKeysRef.current.has(subKey)) {
          seenSubKeysRef.current.add(subKey);
          newestNewMarker = marker;
        }
      }
    });

    submissionMarkersRef.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        marker.remove();
        submissionMarkersRef.current.delete(key);
      }
    });

    if (newestNewMarker) {
      (newestNewMarker as L.Marker).openPopup();
      setTimeout(() => (newestNewMarker as L.Marker)?.closePopup(), 4000);
    }
  }, [completedSubmissions, teams]);

  return (
    <div ref={mapRef} className="w-full h-full min-h-[300px]" data-testid="live-map" />
  );
}
