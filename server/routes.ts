import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import OpenAI from "openai";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const TEAM_COLORS = [
  "hsl(326 100% 60%)",
  "hsl(190 100% 50%)",
  "hsl(260 100% 65%)",
  "hsl(45 100% 55%)",
  "hsl(150 100% 50%)",
  "hsl(15 100% 55%)",
  "hsl(280 100% 70%)",
  "hsl(170 100% 45%)",
  "hsl(340 100% 65%)",
  "hsl(210 100% 60%)",
];

const huntConnections = new Map<string, Set<WebSocket>>();

function broadcastToHunt(huntId: string, message: object) {
  const connections = huntConnections.get(huntId);
  if (!connections) return;
  const data = JSON.stringify(message);
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

async function getFullHuntState(huntId: string) {
  const hunt = await storage.getHunt(huntId);
  if (!hunt) return null;
  const teamsData = await storage.getTeamsByHunt(huntId);
  const playersData = await storage.getPlayersByHunt(huntId);
  const items = await storage.getItemsByHunt(huntId);
  const subs = await storage.getSubmissionsByHunt(huntId);

  return {
    hunt,
    teams: teamsData,
    players: playersData.map(p => ({ id: p.id, name: p.name, teamId: p.teamId, isProctor: p.isProctor })),
    items,
    submissions: subs.filter(s => s.verified).map(s => ({ itemId: s.itemId, teamId: s.teamId, photoData: s.photoData, mediaType: s.mediaType || "photo" })),
    pendingSubmissions: subs.filter(s => s.status === "pending").map(s => ({
      id: s.id, itemId: s.itemId, teamId: s.teamId, playerId: s.playerId, photoData: s.photoData, mediaType: s.mediaType || "photo", createdAt: s.createdAt,
    })),
    rejectedSubmissions: subs.filter(s => s.status === "rejected").map(s => ({
      id: s.id, itemId: s.itemId, teamId: s.teamId, playerId: s.playerId, proctorFeedback: s.proctorFeedback,
    })),
  };
}

function getParam(params: Record<string, string | string[]>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    let huntId: string | null = null;
    let wsPlayerId: string | null = null;
    let wsPlayerTeamId: number | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "join_hunt") {
          huntId = msg.huntId;
          if (!huntId) return;
          if (!huntConnections.has(huntId)) {
            huntConnections.set(huntId, new Set());
          }
          huntConnections.get(huntId)!.add(ws);

          if (msg.sessionToken) {
            const player = await storage.getPlayerByToken(msg.sessionToken);
            if (player && player.huntId === huntId) {
              wsPlayerId = player.id;
              wsPlayerTeamId = player.teamId;
            }
          }

          const state = await getFullHuntState(huntId);
          if (state) {
            ws.send(JSON.stringify({ type: "full_state", data: state }));
          }
        } else if (msg.type === "location_ping" && huntId && wsPlayerId) {
          const { latitude, longitude } = msg;
          if (latitude == null || longitude == null) return;
          const hunt = await storage.getHunt(huntId);
          if (!hunt || !hunt.trackLocations || hunt.status !== "active") return;
          await storage.createLocationPing({
            huntId,
            playerId: wsPlayerId,
            teamId: wsPlayerTeamId,
            latitude,
            longitude,
          });
          broadcastToHunt(huntId, {
            type: "location_update",
            data: { playerId: wsPlayerId, teamId: wsPlayerTeamId, latitude, longitude, timestamp: new Date().toISOString() },
          });
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    });

    ws.on("close", () => {
      if (huntId && huntConnections.has(huntId)) {
        huntConnections.get(huntId)!.delete(ws);
        if (huntConnections.get(huntId)!.size === 0) {
          huntConnections.delete(huntId);
        }
      }
    });
  });

  // --- Proctor routes (require login) ---

  app.post("/api/hunts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub;
      const userName = user?.claims?.first_name || user?.claims?.email || "Proctor";
      const { items, settings, teamNames, huntName } = req.body;

      const hunt = await storage.createHunt({
        name: huntName || "Scavenger Hunt",
        status: "lobby",
        proctorUserId: userId,
        durationMinutes: settings.durationMinutes || 60,
        countdownSeconds: settings.countdownSeconds || 10,
        teamCount: settings.teamCount || 4,
        trackLocations: settings.trackLocations || false,
      });

      for (let i = 0; i < (settings.teamCount || 4); i++) {
        const name = teamNames?.[i] || `Team ${i + 1}`;
        await storage.createTeam({
          huntId: hunt.id,
          name,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0,
        });
      }

      if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const mediaType = items[i].mediaType || "photo";
          await storage.createItem({
            huntId: hunt.id,
            description: items[i].description,
            points: items[i].points || 100,
            sortOrder: i,
            verificationMode: mediaType === "video" ? "proctor" : (items[i].verificationMode || "ai"),
            mediaType,
            videoLengthSeconds: items[i].videoLengthSeconds || 20,
          });
        }
      }

      const sessionToken = crypto.randomUUID();
      const proctor = await storage.createPlayer({
        huntId: hunt.id,
        name: userName,
        userId,
        isProctor: true,
        sessionToken,
      });

      res.json({ hunt, sessionToken, playerId: proctor.id });
    } catch (error) {
      console.error("Error creating hunt:", error);
      res.status(500).json({ error: "Failed to create hunt" });
    }
  });

  app.get("/api/my/hunts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const proctored = await storage.getHuntsByProctor(userId);
      const played = await storage.getHuntsByPlayer(userId);

      const playedFiltered = played.filter(h => !proctored.find(p => p.id === h.id));

      const enrichHunt = async (hunt: any) => {
        const teamsData = await storage.getTeamsByHunt(hunt.id);
        const playersData = await storage.getPlayersByHunt(hunt.id);
        return {
          ...hunt,
          teams: teamsData,
          playerCount: playersData.filter((p: any) => !p.isProctor).length,
        };
      };

      const proctoredEnriched = await Promise.all(proctored.map(enrichHunt));
      const playedEnriched = await Promise.all(playedFiltered.map(enrichHunt));

      res.json({ proctored: proctoredEnriched, played: playedEnriched });
    } catch (error) {
      console.error("Error fetching hunts:", error);
      res.status(500).json({ error: "Failed to fetch hunts" });
    }
  });

  app.delete("/api/hunts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);

      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });

      await storage.deleteHunt(huntId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hunt:", error);
      res.status(500).json({ error: "Failed to delete hunt" });
    }
  });

  app.get("/api/hunts/:id/details", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);

      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });

      const huntItems = await storage.getItemsByHunt(huntId);
      const huntTeams = await storage.getTeamsByHunt(huntId);

      res.json({
        hunt,
        items: huntItems.map(i => ({
          description: i.description,
          points: i.points,
          verificationMode: i.verificationMode || "ai",
          mediaType: i.mediaType || "photo",
          videoLengthSeconds: i.videoLengthSeconds || 20,
        })),
        teamNames: huntTeams.map(t => t.name),
      });
    } catch (error) {
      console.error("Error fetching hunt details:", error);
      res.status(500).json({ error: "Failed to fetch hunt details" });
    }
  });

  app.post("/api/hunts/:id/stop", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);

      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (hunt.status === "finished") return res.status(400).json({ error: "Game already finished" });

      await storage.updateHunt(huntId, { status: "finished", gameEndTime: new Date() });
      broadcastToHunt(huntId, { type: "game_finished" });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop game" });
    }
  });

  app.post("/api/hunts/:id/resume", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);

      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });

      const playersData = await storage.getPlayersByHunt(huntId);
      const proctorPlayer = playersData.find(p => p.isProctor && p.userId === userId);

      if (!proctorPlayer) return res.status(404).json({ error: "Proctor player not found" });

      res.json({
        sessionToken: proctorPlayer.sessionToken,
        player: { id: proctorPlayer.id, name: proctorPlayer.name, teamId: proctorPlayer.teamId, isProctor: true },
        huntId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume hunt" });
    }
  });

  // --- Public routes (no login required) ---

  app.get("/api/hunts/code/:code", async (req: Request, res: Response) => {
    try {
      const hunt = await storage.getHuntByCode(getParam(req.params, "code"));
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      res.json(hunt);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  app.get("/api/hunts/:id", async (req: Request, res: Response) => {
    try {
      const state = await getFullHuntState(getParam(req.params, "id"));
      if (!state) return res.status(404).json({ error: "Hunt not found" });
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  app.post("/api/hunts/:id/join", async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      const huntId = getParam(req.params, "id");

      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });

      const sessionToken = crypto.randomUUID();
      const player = await storage.createPlayer({
        huntId,
        name,
        isProctor: false,
        sessionToken,
      });

      broadcastToHunt(huntId, {
        type: "player_joined",
        data: { id: player.id, name: player.name, teamId: null, isProctor: false },
      });

      res.json({ player: { id: player.id, name: player.name, teamId: null, isProctor: false }, sessionToken });
    } catch (error) {
      res.status(500).json({ error: "Failed to join hunt" });
    }
  });

  app.post("/api/hunts/:id/join-team", async (req: Request, res: Response) => {
    try {
      const { playerId, teamId } = req.body;
      const huntId = getParam(req.params, "id");

      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.teamsLocked) return res.status(400).json({ error: "Teams are locked" });

      const player = await storage.updatePlayerTeam(playerId, teamId);

      broadcastToHunt(huntId, {
        type: "player_team_changed",
        data: { playerId: player.id, teamId: player.teamId },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to join team" });
    }
  });

  app.post("/api/hunts/:id/lock-teams", async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      await storage.updateHunt(huntId, { teamsLocked: true });
      broadcastToHunt(huntId, { type: "teams_locked" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to lock teams" });
    }
  });

  app.post("/api/hunts/:id/start-countdown", async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const now = new Date();
      await storage.updateHunt(huntId, {
        status: "countdown",
        countdownStartTime: now,
      });

      const hunt = await storage.getHunt(huntId);

      broadcastToHunt(huntId, {
        type: "countdown_started",
        data: {
          countdownStartTime: now.toISOString(),
          countdownSeconds: hunt!.countdownSeconds,
        },
      });

      setTimeout(async () => {
        const gameStart = new Date();
        await storage.updateHunt(huntId, {
          status: "active",
          gameStartTime: gameStart,
        });
        broadcastToHunt(huntId, {
          type: "game_started",
          data: {
            gameStartTime: gameStart.toISOString(),
            durationMinutes: hunt!.durationMinutes,
          },
        });

        setTimeout(async () => {
          const currentHunt = await storage.getHunt(huntId);
          if (currentHunt && currentHunt.status === "active") {
            await storage.updateHunt(huntId, { status: "finished", gameEndTime: new Date() });
            broadcastToHunt(huntId, { type: "game_finished" });
          }
        }, hunt!.durationMinutes * 60 * 1000);
      }, hunt!.countdownSeconds * 1000);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start countdown" });
    }
  });

  app.post("/api/hunts/:id/submit", async (req: Request, res: Response) => {
    try {
      const { itemId, teamId, playerId, photoData, mediaType: submissionMediaType } = req.body;
      const huntId = getParam(req.params, "id");

      const hunt = await storage.getHunt(huntId);
      if (!hunt || hunt.status !== "active") {
        return res.status(400).json({ error: "Game is not active" });
      }

      const existing = await storage.getSubmissionByTeamAndItem(teamId, itemId);
      if (existing) {
        return res.status(400).json({ error: "Already completed by your team" });
      }

      const item = await storage.getItem(itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });

      const effectiveMediaType = submissionMediaType || item.mediaType || "photo";
      const isVideoSubmission = effectiveMediaType === "video";

      if (item.verificationMode === "proctor" || isVideoSubmission) {
        const submission = await storage.createSubmission({
          huntId,
          itemId,
          teamId,
          playerId,
          photoData,
          mediaType: effectiveMediaType,
          verified: false,
          aiResponse: "",
          status: "pending",
        });

        broadcastToHunt(huntId, {
          type: "submission_pending",
          data: {
            id: submission.id, itemId, teamId, playerId, photoData, mediaType: effectiveMediaType, createdAt: submission.createdAt,
          },
        });

        res.json({
          verified: false,
          aiResponse: "",
          points: 0,
          status: "pending",
        });
        return;
      }

      let verified = false;
      let aiResponse = "";
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system",
              content: `You are a friendly judge for a photo scavenger hunt game. Players take photos of items from a list and you decide if the photo reasonably shows the requested item.

GUIDELINES:
- Accept the photo if it reasonably shows the requested item or activity, even if the photo quality isn't perfect.
- Photos are taken quickly on phones in real-world settings — they won't be studio quality. Be forgiving of blurriness, angle, or lighting.
- The item just needs to be visible and identifiable in the photo. It doesn't need to be the main focus or perfectly centered.
- Reject only if the photo clearly does NOT contain the requested item at all, or shows something completely unrelated.
- When in doubt, give the player the benefit of the doubt and approve it.

Respond ONLY with a JSON object: {"match": true, "reason": "brief explanation"} or {"match": false, "reason": "brief explanation of what you see instead"}`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `The scavenger hunt item is: "${item.description}". Does this photo show this item or activity? Respond with JSON only.`
                },
                {
                  type: "image_url",
                  image_url: { url: photoData }
                }
              ]
            }
          ],
          max_completion_tokens: 200,
        });

        const responseText = completion.choices[0]?.message?.content || "";
        console.log("AI raw response:", responseText);
        aiResponse = responseText;

        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            verified = !!parsed.match;
            aiResponse = parsed.reason || parsed.explanation || parsed.message || responseText;
          }
        } catch {
          verified = false;
        }
      } catch (aiError) {
        console.error("AI verification error:", aiError);
        verified = false;
        aiResponse = "AI verification unavailable - please try again";
      }

      const submission = await storage.createSubmission({
        huntId,
        itemId,
        teamId,
        playerId,
        photoData: verified ? photoData : "",
        verified,
        aiResponse,
        status: verified ? "approved" : "rejected",
      });

      if (verified) {
        const team = await storage.updateTeamScore(teamId, item.points);
        broadcastToHunt(huntId, {
          type: "item_completed",
          data: {
            itemId,
            teamId,
            points: item.points,
            newScore: team.score,
            photoData,
            mediaType: effectiveMediaType,
          },
        });
      }

      res.json({
        verified,
        aiResponse,
        points: verified ? item.points : 0,
        status: verified ? "approved" : "rejected",
      });
    } catch (error) {
      console.error("Error submitting photo:", error);
      res.status(500).json({ error: "Failed to submit photo" });
    }
  });

  app.post("/api/hunts/:id/redo-submission", async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const { itemId, sessionToken } = req.body;

      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.status !== "active") return res.status(400).json({ error: "Game is not active" });

      const player = await storage.getPlayerByToken(sessionToken);
      if (!player || player.huntId !== huntId) return res.status(403).json({ error: "Not authorized" });
      if (!player.teamId) return res.status(400).json({ error: "Not on a team" });

      const submission = await storage.getSubmissionByTeamAndItem(player.teamId, itemId);
      if (!submission) return res.status(404).json({ error: "No submission found" });
      if (!submission.verified && submission.status !== "pending") {
        return res.status(400).json({ error: "Submission cannot be redone" });
      }

      const item = await storage.getItem(itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });

      const wasPending = submission.status === "pending";
      await storage.deleteSubmission(submission.id);

      let newScore: number;
      if (wasPending) {
        const team = await storage.getTeam(player.teamId);
        newScore = team!.score;
        broadcastToHunt(huntId, {
          type: "submission_withdrawn",
          data: {
            itemId,
            teamId: player.teamId,
            submissionId: submission.id,
          },
        });
      } else {
        const team = await storage.updateTeamScore(player.teamId, -item.points);
        newScore = team.score;
        broadcastToHunt(huntId, {
          type: "submission_redo",
          data: {
            itemId,
            teamId: player.teamId,
            points: item.points,
            newScore: team.score,
          },
        });
      }

      res.json({ success: true, newScore });
    } catch (error) {
      console.error("Error redoing submission:", error);
      res.status(500).json({ error: "Failed to redo submission" });
    }
  });

  app.post("/api/hunts/:id/review-submission", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;

      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });

      const { submissionId, approved, feedback } = req.body;
      const submission = await storage.getSubmission(submissionId);
      if (!submission || submission.huntId !== huntId) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (submission.status !== "pending") {
        return res.status(400).json({ error: "Submission already reviewed" });
      }

      if (approved) {
        const item = await storage.getItem(submission.itemId);
        if (!item) return res.status(404).json({ error: "Item not found" });

        await storage.updateSubmission(submissionId, {
          verified: true,
          status: "approved",
          proctorFeedback: feedback || "Approved by proctor",
        });

        const team = await storage.updateTeamScore(submission.teamId, item.points);
        broadcastToHunt(huntId, {
          type: "item_completed",
          data: {
            itemId: submission.itemId,
            teamId: submission.teamId,
            points: item.points,
            newScore: team.score,
            photoData: submission.photoData,
            mediaType: submission.mediaType || "photo",
          },
        });
        broadcastToHunt(huntId, {
          type: "submission_reviewed",
          data: { submissionId, itemId: submission.itemId, teamId: submission.teamId, approved: true, feedback: feedback || "Approved by proctor" },
        });
      } else {
        await storage.updateSubmission(submissionId, {
          verified: false,
          status: "rejected",
          proctorFeedback: feedback || "Not a match",
          photoData: "",
        });
        broadcastToHunt(huntId, {
          type: "submission_reviewed",
          data: { submissionId, itemId: submission.itemId, teamId: submission.teamId, approved: false, feedback: feedback || "Not a match" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error reviewing submission:", error);
      res.status(500).json({ error: "Failed to review submission" });
    }
  });

  app.get("/api/hunts/:id/replay", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });

      const pings = await storage.getLocationPingsByHunt(huntId);
      const playersData = await storage.getPlayersByHunt(huntId);
      const teamsData = await storage.getTeamsByHunt(huntId);
      const subs = await storage.getSubmissionsByHunt(huntId);
      const items = await storage.getItemsByHunt(huntId);

      const verifiedSubs = subs.filter(s => s.verified).map(s => ({
        itemId: s.itemId,
        teamId: s.teamId,
        playerId: s.playerId,
        latitude: s.latitude,
        longitude: s.longitude,
        createdAt: s.createdAt,
        description: items.find(i => i.id === s.itemId)?.description || "",
      }));

      res.json({
        hunt: {
          id: hunt.id,
          name: hunt.name,
          gameStartTime: hunt.gameStartTime,
          gameEndTime: hunt.gameEndTime,
          durationMinutes: hunt.durationMinutes,
          trackLocations: hunt.trackLocations,
        },
        players: playersData.filter(p => !p.isProctor).map(p => ({
          id: p.id, name: p.name, teamId: p.teamId,
        })),
        teams: teamsData.map(t => ({ id: t.id, name: t.name, color: t.color, score: t.score })),
        locationPings: pings.map(p => ({
          playerId: p.playerId,
          teamId: p.teamId,
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
        })),
        submissions: verifiedSubs,
      });
    } catch (error) {
      console.error("Error fetching replay:", error);
      res.status(500).json({ error: "Failed to fetch replay data" });
    }
  });

  app.get("/api/hunts/:id/locations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const huntId = getParam(req.params, "id");
      const userId = (req as any).user?.claims?.sub;
      const hunt = await storage.getHunt(huntId);
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      if (hunt.proctorUserId !== userId) return res.status(403).json({ error: "Not authorized" });
      const latest = await storage.getLatestLocationPings(huntId);
      res.json(latest);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  return httpServer;
}
