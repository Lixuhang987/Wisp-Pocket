import sharp from "sharp";
import { crc32 } from "node:zlib";

export type ImageMetadata = { mimeType: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };
const mimeTypes = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;

/** Decode every pixel, not just the header; truncated evidence must never count as success. */
export async function decodeImage(bytes: Buffer, expectedMime?: string, maxDimension = 32768): Promise<ImageMetadata> {
  const image = sharp(bytes, { failOn: "warning", limitInputPixels: 100_000_000 });
  const metadata = await image.metadata();
  const format = metadata.format as keyof typeof mimeTypes;
  const mimeType = mimeTypes[format];
  if (!mimeType || (expectedMime && mimeType !== expectedMime)) throw new Error("invalid_image: 图片实际格式与声明类型不符，支持 PNG/JPEG/WebP");
  if (!metadata.width || !metadata.height || metadata.width > maxDimension || metadata.height > maxDimension || (metadata.pages ?? 1) !== 1) {
    throw new Error(`invalid_image: 仅支持单帧静态图片，宽高不可超过 ${maxDimension}px`);
  }
  if (format === "png") validatePNG(bytes);
  await image.raw().toBuffer();
  return { mimeType, width: metadata.width, height: metadata.height };
}

function validatePNG(bytes: Buffer): void {
  let offset = 8; let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("invalid_image: PNG 数据被截断");
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) throw new Error("invalid_image: PNG 校验失败");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    offset = end;
    if (type === "IEND") { ended = length === 0 && end === bytes.length; break; }
  }
  if (!ended) throw new Error("invalid_image: PNG 缺少完整结束标记");
}
