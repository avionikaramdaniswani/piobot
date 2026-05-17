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
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0,fps=15",
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
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0",
        "-vcodec", "libwebp",
        "-lossless", "1",
        "-y",
        tmpOut,
      ]);
    }

    const webpBuffer = await readFile(tmpOut);
    return addStickerMetadata(webpBuffer, packName, packAuthor);
  } finally {
    await Promise.all([
      unlink(tmpIn).catch(() => {}),
      unlink(tmpOut).catch(() => {}),
    ]);
  }
}

function buildExifBuffer(data: Buffer): Buffer {
  const dataOffset = 8 + 2 + 12 + 4;
  const buf = Buffer.alloc(dataOffset + data.length);
  let p = 0;

  buf.write("II", p); p += 2;
  buf.writeUInt16LE(42, p); p += 2;
  buf.writeUInt32LE(8, p); p += 4;

  buf.writeUInt16LE(1, p); p += 2;

  buf.writeUInt16LE(0x5741, p); p += 2;
  buf.writeUInt16LE(1, p); p += 2;
  buf.writeUInt32LE(data.length, p); p += 4;
  buf.writeUInt32LE(dataOffset, p); p += 4;

  buf.writeUInt32LE(0, p); p += 4;

  data.copy(buf, p);
  return buf;
}

export function addStickerMetadata(
  webp: Buffer,
  packName: string,
  packAuthor: string,
): Buffer {
  if (
    webp.length < 12 ||
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

  const exifBuf = buildExifBuffer(Buffer.from(meta, "utf-8"));
  const exifPadded =
    exifBuf.length % 2 === 0 ? exifBuf : Buffer.concat([exifBuf, Buffer.alloc(1)]);

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write("EXIF", 0, "ascii");
  chunkHeader.writeUInt32LE(exifBuf.length, 4);

  const exifChunk = Buffer.concat([chunkHeader, exifPadded]);

  const newRiffSize = webp.readUInt32LE(4) + exifChunk.length;
  const result = Buffer.concat([webp.subarray(0, 12), exifChunk, webp.subarray(12)]);
  result.writeUInt32LE(newRiffSize, 4);
  return result;
}
