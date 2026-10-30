import { randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const secretsDirectory = resolve(import.meta.dirname, "../.secrets");
const environmentPath = resolve(secretsDirectory, "demo-external.env");

await mkdir(secretsDirectory, { mode: 0o700, recursive: true });
try {
  await writeFile(
    environmentPath,
    [
      "# Generated locally. Never commit or share this file.",
      "NEXT_PUBLIC_APP_URL=https://demo.5o5.sh",
      "NODE_ENV=production",
      "RESURGO_DEMO_EXTERNAL=true",
      `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  await chmod(environmentPath, 0o600);
  console.log(`Created ${environmentPath}`);
  console.log(
    "Place the dashboard connector token in .secrets/cloudflared-token with mode 0600.",
  );
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  ) {
    console.log(`${environmentPath} already exists; it was not overwritten.`);
  } else {
    throw error;
  }
}
