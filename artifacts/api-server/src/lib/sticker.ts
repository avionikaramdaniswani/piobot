import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";

const execFileAsync = promisify(execFile);

export async function toStickerWebP(
  buffer: Buffer,
  isAnimated: boolean,
  packName: string,
  packAuthor: string,
): Promise<Buffer> {
  const id = randomBytes(8).toString("hex");
  const tmpIn = join(tmpdir(), `sticker_in_${id}`);
  const tmpOut = join(tmpdir(), `sticker_out_${id}.webp`);

  try {
    await writeFile(tmpIn, buffer);

    if (isAnimated) {
      await execFileAsync("ffmpeg", [
        "-i", tmpIn,
        "-vcodec", "libwebp",
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white,fps=15",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0",
        "-t", "8",
        "-y",
        tmpOut,
      ]);
    } else {
      await execFileAsync("ffmpeg", [
        "-i", tmpIn,
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white",
        "-frames:v", "1",
        "-vcodec", "libwebp",
        "-quality", "80",
        "-y",
        tmpOut,
      ]);
    }

    const webpBuffer = await readFile(tmpOut);
    // DEBUG: save raw ffmpeg output for inspection
    await writeFile("/tmp/sticker_debug_raw.webp", webpBuffer).catch(() => {});
    // DIAGNOSTIC: return raw VP8 without EXIF conversion to isolate blank-sticker cause
    return webpBuffer;
  } finally {
    await Promise.all([
      unlink(tmpIn).catch(() => {}),
      unlink(tmpOut).catch(() => {}),
    ]);
  }
}

function buildWebPChunk(fourcc: string, data: Buffer): Buffer {
  const padded = data.length % 2 === 0 ? data : Buffer.concat([data, Buffer.alloc(1)]);
  const chunk = Buffer.alloc(8 + padded.length);
  chunk.write(fourcc.padEnd(4, " "), 0, "ascii");
  chunk.writeUInt32LE(data.length, 4);
  padded.copy(chunk, 8);
  return chunk;
}

function buildExifBuffer(jsonData: Buffer): Buffer {
  const dataOffset = 8 + 2 + 12 + 4;
  const buf = Buffer.alloc(dataOffset + jsonData.length);
  let p = 0;

  buf.write("II", p); p += 2;
  buf.writeUInt16LE(42, p); p += 2;
  buf.writeUInt32LE(8, p); p += 4;

  buf.writeUInt16LE(1, p); p += 2;

  buf.writeUInt16LE(0x5741, p); p += 2;
  buf.writeUInt16LE(1, p); p += 2;
  buf.writeUInt32LE(jsonData.length, p); p += 4;
  buf.writeUInt32LE(dataOffset, p); p += 4;

  buf.writeUInt32LE(0, p); p += 4;

  jsonData.copy(buf, p);
  return buf;
}

export function addStickerMetadata(
  webp: Buffer,
  packName: string,
  packAuthor: string,
): Buffer {
  if (
    webp.length < 20 ||
    webp.toString("ascii", 0, 4) !== "RIFF" ||
    webp.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return webp;
  }

  const meta = JSON.stringify({
    "sticker-pack-id": randomBytes(16).toString("hex"),
    "sticker-pack-name": packName || "Sticker",
    "sticker-pack-publisher": packAuthor || "Bot",
    emojis: ["😊"],
  });

  const exifPayload = buildExifBuffer(Buffer.from(meta, "utf-8"));
  const exifChunk = buildWebPChunk("EXIF", exifPayload);

  const firstFourCC = webp.toString("ascii", 12, 16);

  if (firstFourCC === "VP8X") {
    // Already extended — set the EXIF flag (bit 3) and append EXIF chunk at the end
    const result = Buffer.from(webp);
    const flags = result.readUInt32LE(20);
    result.writeUInt32LE(flags | 0x08, 20);
    const final = Buffer.concat([result, exifChunk]);
    final.writeUInt32LE(final.length - 8, 4);
    return final;
  }

  // Simple VP8 or VP8L: must convert to extended (VP8X) format first.
  // VP8X must be the FIRST chunk; EXIF must come AFTER the image data chunk.
  // Structure: RIFF header | VP8X chunk | VP8/VP8L chunk(s) | EXIF chunk

  // Parse canvas dimensions from the VP8 bitstream if possible
  let width = 512;
  let height = 512;
  if (firstFourCC === "VP8 " && webp.length >= 30) {
    // VP8 key frame: 3-byte frame tag, 3-byte start code (9D 01 2A), then 16-bit w and h
    // Offset 12 = chunk fourcc, 16 = chunk size, 20 = VP8 bitstream start
    // Within bitstream: bytes 3-8 = start_code(3) + width_and_scale(2) + height_and_scale(2)
    const vp8Base = 20; // start of VP8 bitstream
    if (webp.length > vp8Base + 9) {
      const w = webp.readUInt16LE(vp8Base + 6) & 0x3fff;
      const h = webp.readUInt16LE(vp8Base + 8) & 0x3fff;
      if (w > 0) width = w;
      if (h > 0) height = h;
    }
  }

  // Build VP8X chunk (10 bytes of content)
  const vp8xData = Buffer.alloc(10, 0);
  vp8xData.writeUInt32LE(0x08, 0); // flag: EXIF metadata present
  const w1 = width - 1;
  const h1 = height - 1;
  vp8xData[4] = w1 & 0xff;
  vp8xData[5] = (w1 >> 8) & 0xff;
  vp8xData[6] = (w1 >> 16) & 0xff;
  vp8xData[7] = h1 & 0xff;
  vp8xData[8] = (h1 >> 8) & 0xff;
  vp8xData[9] = (h1 >> 16) & 0xff;

  const vp8xChunk = buildWebPChunk("VP8X", vp8xData);

  // originalChunks = everything from offset 12 (the VP8/VP8L chunk and any others)
  const originalChunks = webp.subarray(12);

  // Build: "WEBP" + VP8X + original VP8 data + EXIF
  const riffPayload = Buffer.concat([
    Buffer.from("WEBP", "ascii"),
    vp8xChunk,
    originalChunks,
    exifChunk,
  ]);

  const result = Buffer.alloc(8 + riffPayload.length);
  result.write("RIFF", 0, "ascii");
  result.writeUInt32LE(riffPayload.length, 4);
  riffPayload.copy(result, 8);
  return result;
}
