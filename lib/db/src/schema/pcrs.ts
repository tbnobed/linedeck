import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pcrsTable = pgTable("pcrs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPcrSchema = createInsertSchema(pcrsTable).omit({ id: true, createdAt: true });
export type InsertPcr = z.infer<typeof insertPcrSchema>;
export type Pcr = typeof pcrsTable.$inferSelect;
