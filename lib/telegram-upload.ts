import JSZip from "jszip";

export async function readTelegramUpload(file: File) {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);
    const resultEntry = zip.file(/(^|\/)result\.json$/i)[0];

    if (!resultEntry) {
      throw new Error("Telegram ZIP must contain result.json.");
    }

    return {
      filename: file.name,
      json: JSON.parse(await resultEntry.async("string")) as unknown,
    };
  }

  if (!lowerName.endsWith(".json")) {
    throw new Error("Upload a Telegram Desktop result.json or export ZIP.");
  }

  return {
    filename: file.name,
    json: JSON.parse(Buffer.from(buffer).toString("utf8")) as unknown,
  };
}
