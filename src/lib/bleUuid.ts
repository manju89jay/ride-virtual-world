/** Expand a 16-bit Bluetooth SIG UUID to its full 128-bit lowercase string form. */
export const uuid16 = (n: number) => `0000${n.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;
export const normUuid = (u: string | number) => (typeof u === "number" ? uuid16(u) : u.toLowerCase());
export const WAHOO_CP = "a026e005-0a7d-4ab3-97fa-f1500f9feb8b";
