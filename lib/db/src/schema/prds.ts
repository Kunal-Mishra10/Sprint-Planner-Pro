import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prdsTable = pgTable("prds", {
  id: serial("id").primaryKey(),
  featureId: integer("feature_id").notNull(),
  featureTitle: text("feature_title").notNull(),
  overview: text("overview").notNull(),
  goals: text("goals").notNull(),
  userStories: text("user_stories").notNull(),
  technicalRequirements: text("technical_requirements").notNull(),
  successMetrics: text("success_metrics").notNull(),
  totalTasks: integer("total_tasks").notNull().default(0),
  totalSprints: integer("total_sprints").notNull().default(0),
  totalEffortPoints: integer("total_effort_points").notNull().default(0),
  riskScore: real("risk_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPrdSchema = createInsertSchema(prdsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrd = z.infer<typeof insertPrdSchema>;
export type Prd = typeof prdsTable.$inferSelect;
