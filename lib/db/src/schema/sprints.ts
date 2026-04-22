import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sprintsTable = pgTable("sprints", {
  id: serial("id").primaryKey(),
  prdId: integer("prd_id").notNull(),
  sprintNumber: integer("sprint_number").notNull(),
  name: text("name").notNull(),
  goal: text("goal").notNull(),
  totalEffortPoints: integer("total_effort_points").notNull().default(0),
  taskCount: integer("task_count").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSprintSchema = createInsertSchema(sprintsTable).omit({ id: true, createdAt: true });
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type Sprint = typeof sprintsTable.$inferSelect;
