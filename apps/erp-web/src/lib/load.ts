import { cookies } from "next/headers";
import { serverApi } from "./api";

/** Load a list endpoint; empty on auth/network failure so the shell still renders. */
export async function loadList<T>(path: string): Promise<T[]> {
  const token = (await cookies()).get("access_token")?.value;
  try {
    const data = await serverApi(token).get<T[] | T>(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function loadOne<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get("access_token")?.value;
  try {
    return (await serverApi(token).get<T>(path)) ?? null;
  } catch {
    return null;
  }
}

export async function loadPortal<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get("portal_access_token")?.value;
  try {
    return (await serverApi(token).get<T>(path)) ?? null;
  } catch {
    return null;
  }
}

export function asPaise(value: string | number | bigint | null | undefined): bigint {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}
