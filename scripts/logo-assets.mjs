/**
 * Genera los assets del logotipo a partir de los archivos de marca en brand/.
 *
 *   node scripts/logo-assets.mjs
 *
 * Los SVG de la marca son en realidad PNG incrustados, no vectores, así que
 * hay que extraer las capas y recomponerlas.
 *
 * Salidas:
 *   public/logo-light.png    lockup con el lettering en tinta, fondo claro
 *   public/logo-dark.png     lockup con el lettering en crema, fondo oscuro
 *   public/flame-white.png   la llama en blanco, para la pestaña de esquina
 *   src/app/icon.png         la llama a color, favicon
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const INK = [25, 22, 16];
const CREAM = [247, 242, 236];

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Saca los PNG incrustados en un SVG de la marca. */
async function layers(file) {
  const svg = await readFile(file, "utf8");
  const found = [...svg.matchAll(/xlink:href="data:image\/png;base64,([^"]+)"/g)];
  if (!found.length) throw new Error(`Sin imágenes incrustadas en ${file}`);
  return found.map((m) => Buffer.from(m[1], "base64"));
}

/** Caja del contenido no negro, con margen. */
async function bbox(input, threshold, padRatio = 0.02) {
  const img = sharp(input);
  const { width, height } = await img.metadata();
  const { data, info } = await img
    .resize(400, 400, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (luminance(data[i], data[i + 1], data[i + 2]) > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const sx = width / info.width;
  const sy = height / info.height;
  const pad = Math.round(Math.min(width, height) * padRatio);
  const left = Math.max(0, Math.round(x0 * sx) - pad);
  const top = Math.max(0, Math.round(y0 * sy) - pad);
  return {
    left,
    top,
    width: Math.min(width - left, Math.round((x1 - x0) * sx) + pad * 2),
    height: Math.min(height - top, Math.round((y1 - y0) * sy) + pad * 2),
  };
}

const rawCrop = (input, crop) =>
  sharp(input).extract(crop).removeAlpha().raw().toBuffer({ resolveWithObject: true });

/**
 * El lockup se reconstruye en dos capas: la llama aporta su color y el texto
 * es lo que queda de la máscara, así se puede teñir según el fondo.
 */
async function lockup(maskLayer, flameLayer, crop, textColor, out) {
  const mask = await rawCrop(maskLayer, crop);
  const flame = await rawCrop(flameLayer, crop);
  const pixels = mask.info.width * mask.info.height;
  const result = Buffer.alloc(pixels * 4);

  for (let p = 0; p < pixels; p++) {
    const i = p * mask.info.channels;
    // El alfa sale solo de la máscara: así el rojo oscuro del borde de la
    // llama queda opaco en vez de desvanecerse.
    const alpha = luminance(mask.data[i], mask.data[i + 1], mask.data[i + 2]) / 255;
    const fr = flame.data[i], fg = flame.data[i + 1], fb = flame.data[i + 2];
    // En la capa de la llama el texto es negro puro, así que cualquier canal
    // con señal marca zona de llama.
    const presence = Math.min(1, Math.max(fr, fg, fb) / 45);

    const o = p * 4;
    if (alpha <= 0) continue;
    const mix = (f, t) => Math.round(f * presence + t * (1 - presence));
    result[o] = mix(fr, textColor[0]);
    result[o + 1] = mix(fg, textColor[1]);
    result[o + 2] = mix(fb, textColor[2]);
    result[o + 3] = Math.round(alpha * 255);
  }

  await sharp(result, {
    raw: { width: mask.info.width, height: mask.info.height, channels: 4 },
  })
    .resize({ width: 1400 })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(out);
}

/** Recorta la llama a un cuadrado y le pone alfa. `tint` la pinta de un color. */
async function flameIcon(source, out, { size, tint }) {
  const crop = await bbox(source, 20, 0.05);
  const side = Math.max(crop.width, crop.height);
  const square = {
    left: Math.max(0, crop.left - Math.round((side - crop.width) / 2)),
    top: Math.max(0, crop.top - Math.round((side - crop.height) / 2)),
    width: side,
    height: side,
  };
  const { data, info } = await rawCrop(source, square);
  const pixels = info.width * info.height;
  const result = Buffer.alloc(pixels * 4);
  for (let p = 0; p < pixels; p++) {
    const i = p * info.channels, o = p * 4;
    const alpha = Math.min(255, Math.round((Math.max(data[i], data[i+1], data[i+2]) / 45) * 255));
    if (tint) {
      result[o] = tint[0]; result[o + 1] = tint[1]; result[o + 2] = tint[2];
    } else {
      result[o] = data[i]; result[o + 1] = data[i + 1]; result[o + 2] = data[i + 2];
    }
    result[o + 3] = alpha;
  }
  await sharp(result, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(out);
}

// brand/logotipo.svg → [máscara del lockup, capa de color de la llama]
const [lockMask, lockFlame] = await layers("brand/logotipo.svg");
const crop = await bbox(lockMask, 28);
await lockup(lockMask, lockFlame, crop, INK, "public/logo-light.png");
await lockup(lockMask, lockFlame, crop, CREAM, "public/logo-dark.png");

// brand/isotipo.svg trae la llama sola a 2160×2700, bastante mejor que la del
// lockup, que solo da 776 px útiles.
const isotipo = (await layers("brand/isotipo.svg")).at(-1);
await flameIcon(isotipo, "src/app/icon.png", { size: 512 });
await flameIcon(isotipo, "public/flame-white.png", { size: 320, tint: [255, 255, 255] });
