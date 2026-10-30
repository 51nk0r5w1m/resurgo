import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docxodusEntry = fileURLToPath(import.meta.resolve("docxodus"));
const source = resolve(dirname(docxodusEntry), "wasm");
const destination = resolve(import.meta.dirname, "../public/docxodus/wasm");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
