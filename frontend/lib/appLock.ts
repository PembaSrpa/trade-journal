/**
 * Optional PIN lock. This is a privacy screen for casual snooping (someone
 * picking up your phone or sitting at your PC) — it does NOT encrypt the data
 * on disk, so it isn't protection against someone with device-level access.
 */
import { getRepo } from "@/lib/local";

interface LockRecord { id: "app_lock"; salt: string; hash: string }

const ITERATIONS = 150_000;
const toHex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b instanceof Uint8Array ? b.buffer : b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function derive(pin: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

export async function hasPin(): Promise<boolean> {
  return !!(await getRepo().raw.get<LockRecord>("meta", "app_lock"));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  await getRepo().raw.putMany("meta", [{ id: "app_lock", salt, hash: await derive(pin, salt) }]);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const rec = await getRepo().raw.get<LockRecord>("meta", "app_lock");
  if (!rec) return true;
  return (await derive(pin, rec.salt)) === rec.hash;
}

export async function removePin(): Promise<void> {
  await getRepo().raw.deleteMany("meta", ["app_lock"]);
}
