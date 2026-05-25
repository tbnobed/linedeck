import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vmsTable = pgTable("vms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  phoneNumber: text("phone_number").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVmSchema = createInsertSchema(vmsTable).omit({ id: true, createdAt: true });
export type InsertVm = z.infer<typeof insertVmSchema>;
export type Vm = typeof vmsTable.$inferSelect;
