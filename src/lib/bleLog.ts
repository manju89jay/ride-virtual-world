import { create } from "zustand";

export type LogEntry = { t: number; dev: "trainer" | "hrm" | "controller" | "app"; dir: "in" | "out" | "info"; msg: string };

const MAX = 200;

export const useBleLog = create<{ entries: LogEntry[] }>(() => ({ entries: [] }));

export function bleLog(dev: LogEntry["dev"], dir: LogEntry["dir"], msg: string) {
  useBleLog.setState((s) => {
    const entries = [...s.entries, { t: Date.now(), dev, dir, msg }];
    if (entries.length > MAX) entries.splice(0, entries.length - MAX);
    return { entries };
  });
}

export const hex = (bytes: ArrayLike<number>) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
