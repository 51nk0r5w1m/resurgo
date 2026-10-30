import "server-only";

import { parseEnvironment } from "@resurgo/config";
import { createS3PrivateObjectStorage } from "@resurgo/documents";

let storage: ReturnType<typeof createS3PrivateObjectStorage> | undefined;

export function getPrivateObjectStorage() {
  if (storage) return storage;
  const environment = parseEnvironment(process.env);
  storage = createS3PrivateObjectStorage({
    accessKeyId: environment.GARAGE_ACCESS_KEY_ID,
    bucket: environment.GARAGE_BUCKET,
    endpoint: environment.GARAGE_ENDPOINT,
    region: environment.GARAGE_REGION,
    secretAccessKey: environment.GARAGE_SECRET_ACCESS_KEY,
  });
  return storage;
}
