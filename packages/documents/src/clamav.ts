import { connect } from "node:net";

function frame(value: string | Uint8Array) {
  const content =
    typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.byteLength);
  return Buffer.concat([length, content]);
}

export async function scanWithClamAv(
  bytes: Uint8Array,
  input: { host: string; port: number; timeoutMilliseconds?: number },
) {
  const timeoutMilliseconds = input.timeoutMilliseconds ?? 30_000;
  return new Promise<{ clean: true }>((resolve, reject) => {
    const socket = connect({ host: input.host, port: input.port });
    let response = "";
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMilliseconds, () =>
      fail(new Error("Malware scanner timed out")),
    );
    socket.on("error", fail);
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
    });
    socket.on("end", () => {
      if (response.includes(" FOUND")) {
        reject(new Error("Malware scanner rejected the document"));
      } else if (response.includes(" OK")) {
        resolve({ clean: true });
      } else {
        reject(new Error("Malware scanner returned an invalid response"));
      }
    });
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        socket.write(frame(bytes.subarray(offset, offset + chunkSize)));
      }
      socket.end(Buffer.alloc(4));
    });
  });
}
