import { setTimeout as delay } from "node:timers/promises";

import { parseDocumentWorkerEnvironment } from "@resurgo/config";
import { createDatabase } from "@resurgo/db";
import {
  createS3PrivateObjectStorage,
  scanWithClamAv,
} from "@resurgo/documents/worker";

import { processNextDocument } from "./worker";

const environment = parseDocumentWorkerEnvironment(process.env);
const database = createDatabase(environment.DATABASE_URL);
const storage = createS3PrivateObjectStorage({
  accessKeyId: environment.GARAGE_ACCESS_KEY_ID,
  bucket: environment.GARAGE_BUCKET,
  endpoint: environment.GARAGE_ENDPOINT,
  region: environment.GARAGE_REGION,
  secretAccessKey: environment.GARAGE_SECRET_ACCESS_KEY,
});

let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

try {
  while (!stopping) {
    const processed = await processNextDocument({
      database: database.db,
      scan: (bytes) =>
        scanWithClamAv(bytes, {
          host: environment.CLAMAV_HOST,
          port: environment.CLAMAV_PORT,
        }),
      storage,
    });
    if (!processed) await delay(1_000);
  }
} finally {
  await database.pool.end();
}
