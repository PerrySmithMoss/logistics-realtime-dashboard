import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDirectory = new URL("../src/app/", import.meta.url);
const iconsDirectory = new URL("../public/icons/", import.meta.url);
const source = await readFile(new URL("icon.svg", appDirectory));
const background = "#0f172a";

await mkdir(iconsDirectory, { recursive: true });

// Render each size directly from the SVG to preserve detail at tab sizes.
const render = (size) => sharp(source, { density: (size / 64) * 72 }).resize(size, size);

await render(180)
  .flatten({ background })
  .png()
  .toFile(fileURLToPath(new URL("apple-icon.png", appDirectory)));

for (const size of [192, 512]) {
  await render(size)
    .png()
    .toFile(fileURLToPath(new URL(`fleet-${size}.png`, iconsDirectory)));
}

// Opaque, full-bleed background with extra room for launcher masks.
await render(410)
  .flatten({ background })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background })
  .png()
  .toFile(fileURLToPath(new URL("fleet-maskable-512.png", iconsDirectory)));

// ICO directory with three PNG-encoded images for non-SVG clients.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => render(size).png().toBuffer()));
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2); // Image type: icon.
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;

for (const [index, image] of images.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4); // Color planes.
  directory.writeUInt16LE(32, entry + 6); // Bits per pixel.
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
}

await writeFile(new URL("favicon.ico", appDirectory), Buffer.concat([directory, ...images]));
console.log("Generated favicon.ico, apple-icon.png, and home-screen icons from icon.svg.");
