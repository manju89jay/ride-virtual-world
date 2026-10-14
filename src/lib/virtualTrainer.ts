/// <reference types="web-bluetooth" />
// Client for the standalone virtual KICKR Core (tools/kickr-sim). It presents the simulator as a
// Web-Bluetooth-shaped device so ble.ts runs the exact same code path as for real hardware.
import { normUuid } from "./bleUuid";
import { getCourse, sampleAt } from "./course";
import { setRemoteRiders } from "./riders";

export const VIRTUAL_URL = "ws://127.0.0.1:8765/ble";

type Pending = { resolve: () => void; reject: (e: Error) => void };

class VChar extends EventTarget {
  value: DataView | null = null;
  constructor(
    private link: Link,
    readonly uuid: string,
  ) {
    super();
  }
  async startNotifications() {
    await this.link.request({ t: "sub", uuid: this.uuid });
    return this;
  }
  async stopNotifications() {
    return this;
  }
  writeValueWithResponse(buf: BufferSource) {
    return this.link.write(this.uuid, buf);
  }
  writeValue(buf: BufferSource) {
    return this.link.write(this.uuid, buf);
  }
  writeValueWithoutResponse(buf: BufferSource) {
    return this.link.write(this.uuid, buf);
  }
}

class VService {
  constructor(
    private link: Link,
    readonly uuid: string,
  ) {}
  async getCharacteristic(u: string | number) {
    const id = normUuid(u);
    if (!this.link.services[this.uuid]?.includes(id)) throw new DOMException(`No characteristic ${id}`, "NotFoundError");
    return this.link.char(id);
  }
}

class Link {
  ws: WebSocket | null = null;
  services: Record<string, string[]> = {};
  private chars = new Map<string, VChar>();
  private pending = new Map<number, Pending>();
  private nextId = 1;
  constructor(
    readonly url: string,
    private device: VirtualDevice,
  ) {}

  char(id: string) {
    let c = this.chars.get(id);
    if (!c) this.chars.set(id, (c = new VChar(this, id)));
    return c;
  }

  open() {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(msg));
      };
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const timer = setTimeout(() => {
        fail(`No virtual trainer answered at ${this.url}. Start it with "npm start" in tools/kickr-sim.`);
        ws.close();
      }, 4000);
      ws.onerror = () => fail(`No virtual trainer at ${this.url}. Start it with "npm start" in tools/kickr-sim.`);
      ws.onopen = () => ws.send(JSON.stringify({ t: "hello", client: "hedgerow" }));
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        if (m.t === "busy") {
          clearTimeout(timer);
          fail("The virtual trainer is already in use by another app.");
        } else if (m.t === "device") {
          clearTimeout(timer);
          this.services = m.services;
          this.device.name = m.name;
          this.sendCourse();
          settled = true;
          resolve();
        } else if (m.t === "ack") {
          const p = this.pending.get(m.id);
          this.pending.delete(m.id);
          if (m.ok) p?.resolve();
          else p?.reject(new Error(m.err ?? "write failed"));
        } else if (m.t === "notify") {
          const c = this.chars.get(m.uuid);
          if (!c) return;
          c.value = new DataView(Uint8Array.from(m.data as number[]).buffer);
          c.dispatchEvent(new Event("characteristicvaluechanged"));
        } else if (m.t === "riders") {
          setRemoteRiders(m.riders);
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        const wasOpen = settled;
        fail("Virtual trainer closed the connection.");
        this.pending.forEach((p) => p.reject(new Error("disconnected")));
        this.pending.clear();
        this.ws = null;
        setRemoteRiders([]);
        if (wasOpen) {
          this.device.gatt.connected = false;
          this.device.dispatchEvent(new Event("gattserverdisconnected"));
        }
      };
    });
  }

  private sendCourse() {
    const c = getCourse();
    const step = 10;
    const grades: number[] = [];
    for (let s = 0; s < c.length; s += step) grades.push(+sampleAt(s).grade.toFixed(4));
    this.ws?.send(JSON.stringify({ t: "course", length: c.length, step, grades }));
  }

  request(msg: Record<string, unknown>) {
    return new Promise<void>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error("not connected"));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  write(uuid: string, buf: BufferSource) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return this.request({ t: "write", uuid, data: Array.from(bytes) });
  }
}

class VGatt {
  connected = false;
  constructor(
    private link: Link,
    readonly device: VirtualDevice,
  ) {}
  async connect() {
    if (!this.connected) await this.link.open();
    this.connected = true;
    return this;
  }
  disconnect() {
    this.link.ws?.close();
  }
  async getPrimaryService(u: string | number) {
    const id = normUuid(u);
    if (!this.link.services[id]) throw new DOMException(`No service ${id}`, "NotFoundError");
    return new VService(this.link, id);
  }
}

export class VirtualDevice extends EventTarget {
  readonly virtual = true;
  readonly id = "virtual-kickr-core";
  name = "KICKR CORE SIM";
  gatt: VGatt;
  constructor(url: string) {
    super();
    this.gatt = new VGatt(new Link(url, this), this);
  }
}

/** Returns an unconnected device; ble.ts connects it exactly like a real one. */
export function openVirtualTrainer(url = VIRTUAL_URL): BluetoothDevice {
  return new VirtualDevice(url) as unknown as BluetoothDevice;
}
