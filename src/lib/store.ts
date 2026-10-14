import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Status = "disconnected" | "connecting" | "connected";

type DeviceState = {
  trainer: {
    status: Status;
    name?: string | undefined;
    control: boolean;
    virtual?: boolean | undefined;
    /** Which handshake step failed, in plain words */
    error?: string | undefined;
    protocol?: "FTMS" | "Wahoo" | "power only" | undefined;
  };
  hrm: { status: Status; name?: string | undefined };
  controller: { status: Status; name?: string | undefined; lastBit: number | null };
  power: number;
  cadence: number;
  heartRate: number;
  trainerSpeed: number;
  lastPowerAt: number;
};

export const useDevices = create<DeviceState>(() => ({
  trainer: { status: "disconnected", control: false },
  hrm: { status: "disconnected" },
  controller: { status: "disconnected", lastBit: null },
  power: 0,
  cadence: 0,
  heartRate: 0,
  trainerSpeed: 0,
  lastPowerAt: 0,
}));

export type Settings = {
  ftp: number;
  weight: number;
  bikeWeight: number;
  difficulty: number; // 0..1 trainer gradient scaling
  simMode: boolean;
  shiftUp: number[];
  shiftDown: number[];
};

export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>()(
  persist(
    (set) => ({
      ftp: 200,
      weight: 75,
      bikeWeight: 9,
      difficulty: 0.5,
      simMode: false,
      shiftUp: [1],
      shiftDown: [3],
      set: (p) => set(p),
    }),
    { name: "vc-settings", skipHydration: true },
  ),
);

export type RideHud = {
  elapsed: number;
  distance: number;
  speed: number;
  power3s: number;
  power: number;
  grade: number;
  elevation: number;
  elevGain: number;
  gear: number;
  s: number;
  paused: boolean;
  target: number | null;
  segIndex: number;
  segRemaining: number;
  workoutDone: boolean;
};

export const useRide = create<RideHud>(() => ({
  elapsed: 0,
  distance: 0,
  speed: 0,
  power3s: 0,
  power: 0,
  grade: 0,
  elevation: 0,
  elevGain: 0,
  gear: 12,
  s: 0,
  paused: false,
  target: null,
  segIndex: 0,
  segRemaining: 0,
  workoutDone: false,
}));
