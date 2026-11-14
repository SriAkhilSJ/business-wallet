/**
 * Safe filename handling for storage paths and ZIP entries.
 * User-supplied filenames are never trusted as paths.
 */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Extension without the dot, lowercased ("" when there is none). */
export function extensionOf(filename: string): string {
  const clean = filename.split(/[/\\]/).pop() ?? "";
  const dot = clean.lastIndexOf(".");
  if (dot <= 0) return "";
  return clean.slice(dot + 1).toLowerCase();
}

/**
 * Reduce a raw filename to a safe basename:
 * strips directory components, control and reserved characters, leading dots,
 * and Windows-reserved device names. Keeps the original extension.
 */
export function sanitizeFilename(raw: string): string {
  let name = (raw.split(/[/\\]/).pop() ?? "").replace(/[\x00-\x1f\x7f]/g, "");
  name = name.replace(/[<>:"|?*]/g, "_");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "");
  if (!name) return "document";

  const dot = name.lastIndexOf(".");
  let base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  base = base.trim();
  if (!base) base = "document";
  if (WINDOWS_RESERVED.test(base)) base = `_${base}`;
  if (base.length > 120) base = base.slice(0, 120);

  return `${base}${ext}`;
}

/**
 * Pick a unique name within `used` (case-insensitive), inserting ` (2)`,
 * ` (3)`, … before the extension when the name is already taken.
 */
export function uniqueFilename(used: Set<string>, raw: string): string {
  const clean = sanitizeFilename(raw);
  const key = clean.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return clean;
  }
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    const candidateKey = candidate.toLowerCase();
    if (!used.has(candidateKey)) {
      used.add(candidateKey);
      return candidate;
    }
  }
}

/**
 * Server-generated storage object path:
 * `<businessId>/<YYYY>/<MM>/<uuid>.<ext>`.
 * The original filename never becomes part of the storage path.
 */
export function buildStoragePath(
  businessId: string,
  effectiveDateYmd: string,
  ext: string,
  uuid: string,
): string {
  const year = effectiveDateYmd.slice(0, 4);
  const month = effectiveDateYmd.slice(5, 7);
  return `${businessId}/${year}/${month}/${uuid}.${ext}`;
}
