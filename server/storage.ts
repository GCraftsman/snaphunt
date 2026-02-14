import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import {
  hunts, teams, players, scavengerItems, submissions,
  type Hunt, type InsertHunt,
  type Team, type InsertTeam,
  type Player, type InsertPlayer,
  type ScavengerItem, type InsertScavengerItem,
  type Submission, type InsertSubmission,
} from "@shared/schema";
import { randomBytes } from "crypto";

function generateCode(): string {
  return randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

export interface IStorage {
  // Hunts
  createHunt(data: InsertHunt): Promise<Hunt>;
  getHunt(id: string): Promise<Hunt | undefined>;
  getHuntByCode(code: string): Promise<Hunt | undefined>;
  updateHunt(id: string, data: Partial<Hunt>): Promise<Hunt>;

  // Teams
  createTeam(data: InsertTeam): Promise<Team>;
  getTeamsByHunt(huntId: string): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  updateTeamScore(id: number, points: number): Promise<Team>;

  // Players
  createPlayer(data: InsertPlayer): Promise<Player>;
  getPlayersByHunt(huntId: string): Promise<Player[]>;
  getPlayerByToken(token: string): Promise<Player | undefined>;
  updatePlayerTeam(id: string, teamId: number | null): Promise<Player>;

  // Items
  createItem(data: InsertScavengerItem): Promise<ScavengerItem>;
  getItemsByHunt(huntId: string): Promise<ScavengerItem[]>;
  getItem(id: number): Promise<ScavengerItem | undefined>;

  // Submissions
  createSubmission(data: InsertSubmission): Promise<Submission>;
  getSubmissionsByHunt(huntId: string): Promise<Submission[]>;
  getSubmissionByTeamAndItem(teamId: number, itemId: number): Promise<Submission | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createHunt(data: InsertHunt): Promise<Hunt> {
    const code = generateCode();
    const [hunt] = await db.insert(hunts).values({ ...data, code }).returning();
    return hunt;
  }

  async getHunt(id: string): Promise<Hunt | undefined> {
    const [hunt] = await db.select().from(hunts).where(eq(hunts.id, id));
    return hunt;
  }

  async getHuntByCode(code: string): Promise<Hunt | undefined> {
    const [hunt] = await db.select().from(hunts).where(eq(hunts.code, code.toUpperCase()));
    return hunt;
  }

  async updateHunt(id: string, data: Partial<Hunt>): Promise<Hunt> {
    const [hunt] = await db.update(hunts).set(data).where(eq(hunts.id, id)).returning();
    return hunt;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(data).returning();
    return team;
  }

  async getTeamsByHunt(huntId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.huntId, huntId));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async updateTeamScore(id: number, points: number): Promise<Team> {
    const team = await this.getTeam(id);
    if (!team) throw new Error("Team not found");
    const [updated] = await db.update(teams).set({ score: team.score + points }).where(eq(teams.id, id)).returning();
    return updated;
  }

  async createPlayer(data: InsertPlayer): Promise<Player> {
    const [player] = await db.insert(players).values(data).returning();
    return player;
  }

  async getPlayersByHunt(huntId: string): Promise<Player[]> {
    return db.select().from(players).where(eq(players.huntId, huntId));
  }

  async getPlayerByToken(token: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.sessionToken, token));
    return player;
  }

  async updatePlayerTeam(id: string, teamId: number | null): Promise<Player> {
    const [player] = await db.update(players).set({ teamId }).where(eq(players.id, id)).returning();
    return player;
  }

  async createItem(data: InsertScavengerItem): Promise<ScavengerItem> {
    const [item] = await db.insert(scavengerItems).values(data).returning();
    return item;
  }

  async getItemsByHunt(huntId: string): Promise<ScavengerItem[]> {
    return db.select().from(scavengerItems).where(eq(scavengerItems.huntId, huntId));
  }

  async getItem(id: number): Promise<ScavengerItem | undefined> {
    const [item] = await db.select().from(scavengerItems).where(eq(scavengerItems.id, id));
    return item;
  }

  async createSubmission(data: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values(data).returning();
    return submission;
  }

  async getSubmissionsByHunt(huntId: string): Promise<Submission[]> {
    return db.select().from(submissions).where(eq(submissions.huntId, huntId));
  }

  async getSubmissionByTeamAndItem(teamId: number, itemId: number): Promise<Submission | undefined> {
    const [sub] = await db.select().from(submissions).where(
      and(eq(submissions.teamId, teamId), eq(submissions.itemId, itemId), eq(submissions.verified, true))
    );
    return sub;
  }
}

export const storage = new DatabaseStorage();
