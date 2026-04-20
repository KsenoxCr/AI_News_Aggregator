import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DATE_FORMAT, type DateFormat } from "~/config/business";
import z from "zod";

// TODO: -> utils/style.ts

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts an OKLCH color to a hex string.
 *
 * OKLCH → OKLab → linear sRGB → sRGB → hex
 *
 * @param l  Lightness  [0, 1]
 * @param c  Chroma     [0, ~0.4]
 * @param h  Hue        degrees [0, 360)
 * @param alpha  Opacity [0, 1] — when < 1 returns 8-digit hex (#rrggbbaa)
 */

// TODO: -> utils/style.ts

export function oklchToHex(l: number, c: number, h: number, alpha = 1): string {
  // 1. OKLCH → OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // 2. OKLab → LMS (cube roots of cone responses)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lLms = l_ ** 3;
  const mLms = m_ ** 3;
  const sLms = s_ ** 3;

  // 3. LMS → linear sRGB (Björn Ottosson's matrix)
  const lr = 4.0767416621 * lLms - 3.3077115913 * mLms + 0.2309699292 * sLms;
  const lg = -1.2684380046 * lLms + 2.6097574011 * mLms - 0.3413193965 * sLms;
  const lb = -0.0041960863 * lLms - 0.7034186147 * mLms + 1.707614701 * sLms;

  // 4. Linear sRGB → sRGB (gamma encode) then clamp → [0, 255]
  const toU8 = (x: number) => {
    const g = x >= 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x;
    return Math.round(Math.min(1, Math.max(0, g)) * 255);
  };

  const r = toU8(lr);
  const g = toU8(lg);
  const bb = toU8(lb);

  const hex = [r, g, bb].map((v) => v.toString(16).padStart(2, "0")).join("");

  if (alpha < 1) {
    const a8 = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
    return `#${hex}${a8.toString(16).padStart(2, "0")}`;
  }

  return `#${hex}`;
}

// TODO: -> utils/ui.ts

export function formatDate(date: Date, dateFormat: DateFormat): string {
  switch (dateFormat) {
    case DATE_FORMAT.ISO8601:
      return date.toISOString();
    case DATE_FORMAT.ISODATE:
      return date.toISOString().slice(0, 10);
    case DATE_FORMAT.UNIX:
      return String(Math.floor(date.getTime() / 1000));
    case DATE_FORMAT.RFC1123:
      return date.toUTCString();
    case DATE_FORMAT.RFC822:
      return format(date, "dd MMM yyyy HH:mm:ss xx");
    default:
      throw new Error(`Unhandled date format: ${dateFormat satisfies never}`);
  }
}

// TODO: -> utils/general.ts

export function Keys<T extends object>(o: T): (keyof T)[] {
  return Object.keys(o) as (keyof T)[];
}

// TODO: -> utils/general.ts

export function KeysRecord<T extends object>(obj: T): { [K in keyof T]: K } {
  return Object.fromEntries(Object.keys(obj).map((k) => [k, k])) as {
    [K in keyof T]: K;
  };
}

// TODO: -> utils/general.ts

export function ObjectKeysEnum<T extends Record<string, string>>(obj: T) {
  return z.enum(
    Object.keys(obj) as [keyof T & string, ...(keyof T & string)[]],
  );
}
