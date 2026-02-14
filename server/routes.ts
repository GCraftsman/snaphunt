import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import OpenAI from "openai";
import express from "express";

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

// --- WebSocket Management ---
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
    submissions: subs.filter(s => s.verified).map(s => ({ itemId: s.itemId, teamId: s.teamId, photoData: s.photoData })),
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
  // --- WebSocket Server ---
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let huntId: string | null = null;

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

          const state = await getFullHuntState(huntId);
          if (state) {
            ws.send(JSON.stringify({ type: "full_state", data: state }));
          }
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

  // --- REST API Routes ---

  // Create a new hunt (proctor)
  app.post("/api/hunts", async (req: Request, res: Response) => {
    try {
      const { items, settings, teamNames } = req.body;

      const hunt = await storage.createHunt({
        status: "lobby",
        durationMinutes: settings.durationMinutes || 60,
        countdownSeconds: settings.countdownSeconds || 10,
        teamCount: settings.teamCount || 4,
      });

      // Create teams
      for (let i = 0; i < (settings.teamCount || 4); i++) {
        const name = teamNames?.[i] || `Team ${i + 1}`;
        await storage.createTeam({
          huntId: hunt.id,
          name,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0,
        });
      }

      // Create items
      if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          await storage.createItem({
            huntId: hunt.id,
            description: items[i].description,
            points: items[i].points || 100,
            sortOrder: i,
          });
        }
      }

      // Create proctor player
      const sessionToken = crypto.randomUUID();
      const proctor = await storage.createPlayer({
        huntId: hunt.id,
        name: "Game Proctor",
        isProctor: true,
        sessionToken,
      });

      res.json({ hunt, sessionToken, playerId: proctor.id });
    } catch (error) {
      console.error("Error creating hunt:", error);
      res.status(500).json({ error: "Failed to create hunt" });
    }
  });

  // Get hunt by code
  app.get("/api/hunts/code/:code", async (req: Request, res: Response) => {
    try {
      const hunt = await storage.getHuntByCode(getParam(req.params, "code"));
      if (!hunt) return res.status(404).json({ error: "Hunt not found" });
      res.json(hunt);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  // Get hunt state
  app.get("/api/hunts/:id", async (req: Request, res: Response) => {
    try {
      const state = await getFullHuntState(getParam(req.params, "id"));
      if (!state) return res.status(404).json({ error: "Hunt not found" });
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  // Join a hunt (player)
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

  // Join a team
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

  // Lock teams (proctor)
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

  // Start countdown (proctor)
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

      // Schedule game start
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

        // Schedule game end
        setTimeout(async () => {
          await storage.updateHunt(huntId, { status: "finished" });
          broadcastToHunt(huntId, { type: "game_finished" });
        }, hunt!.durationMinutes * 60 * 1000);
      }, hunt!.countdownSeconds * 1000);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start countdown" });
    }
  });

  // Submit photo for verification
  app.post("/api/hunts/:id/submit", async (req: Request, res: Response) => {
    try {
      const { itemId, teamId, playerId, photoData } = req.body;
      const huntId = getParam(req.params, "id");

      const hunt = await storage.getHunt(huntId);
      if (!hunt || hunt.status !== "active") {
        return res.status(400).json({ error: "Game is not active" });
      }

      // Check if already completed by this team
      const existing = await storage.getSubmissionByTeamAndItem(teamId, itemId);
      if (existing) {
        return res.status(400).json({ error: "Already completed by your team" });
      }

      const item = await storage.getItem(itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });

      // AI Verification
      let verified = false;
      let aiResponse = "";
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system",
              content: `You are a strict but fair judge for a photo scavenger hunt game. Your job is to verify whether a submitted photo genuinely shows the requested item or activity.

IMPORTANT RULES:
- The photo MUST clearly and unmistakably show the specific item or activity described.
- Do NOT accept photos that show something vaguely similar or unrelated.
- If the target is "Lamp" the photo must show an actual lamp. A bedsheet, wall, or random object is NOT a lamp.
- If the target is "Team high five" the photo must show people actually doing a high five.
- Be strict: reject anything that doesn't clearly match. Players should not be able to cheat by submitting random photos.
- Only approve if you are confident the photo genuinely depicts the requested item/activity.

Respond ONLY with a JSON object: {"match": true, "reason": "brief explanation"} or {"match": false, "reason": "brief explanation of what's wrong"}`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `The scavenger hunt item is: "${item.description}". Look at this photo carefully. Does it CLEARLY and UNMISTAKABLY show this specific item/activity? If there is any doubt, reject it. Respond with JSON only.`
                },
                {
                  type: "image_url",
                  image_url: { url: photoData }
                }
              ]
            }
          ],
          max_tokens: 200,
        });

        const responseText = completion.choices[0]?.message?.content || "";
        aiResponse = responseText;

        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            verified = !!parsed.match;
          }
        } catch {
          verified = responseText.toLowerCase().includes("true") || responseText.toLowerCase().includes("match");
        }
      } catch (aiError) {
        console.error("AI verification error:", aiError);
        verified = false;
        aiResponse = "AI verification unavailable - please try again";
      }

      // Save submission
      const submission = await storage.createSubmission({
        huntId,
        itemId,
        teamId,
        playerId,
        photoData: verified ? photoData : "",
        verified,
        aiResponse,
      });

      if (verified) {
        // Update team score
        const team = await storage.updateTeamScore(teamId, item.points);

        // Broadcast to all players
        broadcastToHunt(huntId, {
          type: "item_completed",
          data: {
            itemId,
            teamId,
            points: item.points,
            newScore: team.score,
            photoData,
          },
        });
      }

      res.json({
        verified,
        aiResponse,
        points: verified ? item.points : 0,
      });
    } catch (error) {
      console.error("Error submitting photo:", error);
      res.status(500).json({ error: "Failed to submit photo" });
    }
  });

  return httpServer;
}
