import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  prdId: integer("prd_id").notNull(),
  sprintId: integer("sprint_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("engineering"),
  priority: text("priority").notNull().default("medium"),
  effortPoints: integer("effort_points").notNull().default(3),
  priorityScore: real("priority_score").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("medium"),
  dependencies: text("dependencies").notNull().default("[]"),
  status: text("status").notNull().default("backlog"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
