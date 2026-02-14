import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const hunts = pgTable("hunts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 8 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("setup"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  countdownSeconds: integer("countdown_seconds").notNull().default(10),
  teamCount: integer("team_count").notNull().default(4),
  teamsLocked: boolean("teams_locked").notNull().default(false),
  gameStartTime: timestamp("game_start_time"),
  countdownStartTime: timestamp("countdown_start_time"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  huntId: varchar("hunt_id").notNull().references(() => hunts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 50 }).notNull(),
  score: integer("score").notNull().default(0),
});

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  huntId: varchar("hunt_id").notNull().references(() => hunts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  isProctor: boolean("is_proctor").notNull().default(false),
  sessionToken: varchar("session_token").notNull(),
});

export const scavengerItems = pgTable("scavenger_items", {
  id: serial("id").primaryKey(),
  huntId: varchar("hunt_id").notNull().references(() => hunts.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  points: integer("points").notNull().default(100),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  huntId: varchar("hunt_id").notNull().references(() => hunts.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => scavengerItems.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  photoData: text("photo_data").notNull(),
  verified: boolean("verified").notNull().default(false),
  aiResponse: text("ai_response"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas
export const insertHuntSchema = createInsertSchema(hunts).omit({ id: true, createdAt: true, code: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertScavengerItemSchema = createInsertSchema(scavengerItems).omit({ id: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true });

// Types
export type Hunt = typeof hunts.$inferSelect;
export type InsertHunt = z.infer<typeof insertHuntSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type ScavengerItem = typeof scavengerItems.$inferSelect;
export type InsertScavengerItem = z.infer<typeof insertScavengerItemSchema>;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// Chat models for AI integrations (required by integration)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
