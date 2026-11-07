import { IMPORT_SOURCES, type ImportSource } from "@/lib/csvImport";
import { error, handle, json, readJson } from "@/lib/http";
import { previewImport, runImport } from "@/lib/importer";

const MAX_BYTES = 2_000_000;

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) return error("Choose a CSV file or paste its contents first");
    if (csv.length > MAX_BYTES) return error("That file is over 2 MB. Split it and import it in parts");
    const source = (IMPORT_SOURCES.some((s) => s.key === body.source) ? body.source : "other") as ImportSource;
    try {
      if (body.commit === true) return json({ result: await runImport(csv, source) });
      return json({ preview: previewImport(csv) });
    } catch (err) {
      return error(err instanceof Error ? err.message : "Could not read that file", 422);
    }
  });
}
