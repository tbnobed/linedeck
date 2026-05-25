import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const linesTable = pgTable("lines", {
  id: text("id").primaryKey(),
  state: text("state").notNull().default("idle"),
  label: text("label").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLineSchema = createInsertSchema(linesTable).omit({ updatedAt: true });
export type InsertLine = z.infer<typeof insertLineSchema>;
export type Line = typeof linesTable.$inferSelect;
