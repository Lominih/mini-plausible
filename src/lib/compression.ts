import { gzipSync } from "zlib";

export function compressResponse(body: string | Buffer): { body: Buffer; encoding: string } | null {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  if (buf.length < 1024) return null;
  return { body: gzipSync(buf), encoding: "gzip" };
}