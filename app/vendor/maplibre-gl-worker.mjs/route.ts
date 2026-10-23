import { readFile } from "node:fs/promises";
import { join } from "node:path";

// MapLibre resolves its module worker next to its own bundle, which does not
// exist once Next.js chunks the library, so the worker is served from here.
// The bundler rewrites module resolution, so read from the project root.
export const dynamic = "force-static";

export async function GET() {
  const source = await readFile(
    join(
      process.cwd(),
      "node_modules",
      "maplibre-gl",
      "dist",
      "maplibre-gl-worker.mjs",
    ),
  );
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
