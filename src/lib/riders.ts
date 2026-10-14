import { create } from "zustand";

/** Other riders in the world, fed by snapshots (virtual peloton now, multiplayer later). */
export type RemoteRider = { id: string; name: string; color: string; s: number; v: number; power: number; at: number };

export const remoteRiders = new Map<string, RemoteRider>();
export const useRiders = create<{ list: RemoteRider[] }>(() => ({ list: [] }));

export function setRemoteRiders(list: Omit<RemoteRider, "at">[]) {
  const at = performance.now();
  const seen = new Set<string>();
  for (const r of list) {
    seen.add(r.id);
    remoteRiders.set(r.id, { ...r, at });
  }
  for (const id of [...remoteRiders.keys()]) if (!seen.has(id)) remoteRiders.delete(id);
  const prev = useRiders.getState().list;
  if (prev.length !== remoteRiders.size || list.length) useRiders.setState({ list: [...remoteRiders.values()] });
}
