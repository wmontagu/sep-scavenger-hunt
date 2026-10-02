// Browser-only helpers. No server imports here (keeps answers out of the bundle).

export async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { status: res.status, data };
}

/** localStorage that never throws (private mode, blocked storage, SSR). */
export const local = {
  get(key: string): string | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Downscale a camera photo to a JPEG data URL (longest side `max` px) so uploads
 * are ~200-400KB instead of 5-12MB phone originals.
 */
export function downscaleImage(file: File, max = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image — try taking the photo again."));
    };
    img.src = url;
  });
}

/**
 * Per-device data (shares, pending photo ids, chosen thread) belongs to one run of
 * the hunt. When execs reset the board the epoch changes; drop the stale data.
 * Returns true if anything was cleared (caller should reload so cards remount).
 */
export function syncEpoch(epoch: string, storage: Pick<Storage, "length" | "key" | "removeItem" | "getItem" | "setItem"> | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    const saved = storage.getItem("hunt:epoch");
    if (saved === epoch) return false;
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("hunt:") && k !== "hunt:exec-pass") stale.push(k);
    }
    stale.forEach((k) => storage.removeItem(k));
    storage.setItem("hunt:epoch", epoch);
    return saved !== null && stale.some((k) => k !== "hunt:epoch");
  } catch {
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
