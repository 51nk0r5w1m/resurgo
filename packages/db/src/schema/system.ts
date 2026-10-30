import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const resurgoSchema = pgSchema("resurgo");

export const systemMetadata = resurgoSchema.table("system_metadata", {
  key: text("key").primaryKey(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  value: text("value").notNull(),
});
