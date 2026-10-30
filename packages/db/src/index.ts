import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export * from "./domain/cases";
export * from "./domain/authorization";
export * from "./domain/audit";
export * from "./domain/memberships";
export * from "./domain/discovery";
export * from "./domain/documents";
export * from "./domain/document-requests";
export * from "./domain/reviews";
export * from "./domain/workspace";
export * from "./schema";
