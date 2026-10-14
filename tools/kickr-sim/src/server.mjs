#!/usr/bin/env node
// Virtual Wahoo KICKR Core — a standalone "virtual ECU".
// Exposes the trainer's Bluetooth GATT services over a local WebSocket (raw bytes + characteristic UUID),
// serves a control panel, keeps its own byte log, and can run a virtual peloton of bot riders.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { SERVICES, UUID, encodeCPM, encodeIBD, handleFtmsCP, handleWahoo, hex } from "./protocol.mjs";
import { createTrainer, stepTrainer } from "./trainer.mjs";
import { courseGradeFn, createBots, stepBot } from "./bots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PORT = Number(arg("port", 8765));
const LOG_FILE = arg("log", path.join(process.cwd(), "kickr-sim-log.txt"));

const trainer = createTrainer({ cadence: Number(arg("cadence", 85)), maxWatts: Number(arg("max-watts", 400)) });
let bots = createBots(Number(arg("bots", 0)));
let gradeAt = () => 0;
const faults = { rejectNext: false, slowAck: false };
const stats = { writes: 0, acks: 0, notifies: 0, connects: 0 };

let app = null;
let subs = new Set();
const panels = new Set();
const log = [];
const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });

const NAMES = {
  [UUID.FTMS_CP]: "FTMS control point",
  [UUID.WAHOO_CP]: "Wahoo control",
  [UUID.IBD]: "Indoor Bike Data",
  [UUID.CPM]: "Cycling Power",
};
const name = (u) => NAMES[u] ?? u;

function slog(dir, msg) {
  const e = { t: Date.now(), dir, msg };
  log.push(e);
  if (log.length > 2000) log.shift();
  logStream.write(`${new Date(e.t).toISOString()} ${dir} ${msg}\n`);
  for (const p of panels) p.send(JSON.stringify({ t: "log", e }));
  if (process.env.SIM_QUIET !== "1") console.log(`[${dir}] ${msg}`);
}

function snapshot() {
  return {
    connected: !!app,
    hasControl: trainer.hasControl,
    unlocked: trainer.unlocked,
    mode: trainer.mode,
    grade: +trainer.grade.toFixed(2),
    gradeTarget: trainer.gradeTarget,
    ergTarget: trainer.ergTarget,
    level: trainer.level,
    power: Math.round(trainer.power),
    cadence: Math.round(trainer.cadenceEst),
    speedKmh: +(trainer.v * 3.6).toFixed(1),
    spiral: trainer.spiral,
    rider: trainer.rider,
    faults,
    stats,
    bots: bots.map((b) => ({ id: b.id, name: b.name, power: Math.round(b.power), kmh: +(b.v * 3.6).toFixed(1), s: Math.round(b.s) })),
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(here, "panel.html")));
  } else if (req.url === "/state") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(snapshot()));
  } else if (req.url === "/log") {
    res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
    res.end(log.map((e) => `${new Date(e.t).toISOString()} ${e.dir} ${e.msg}`).join("\n"));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  if (req.url?.startsWith("/panel")) {
    panels.add(ws);
    ws.send(JSON.stringify({ t: "hello", log: log.slice(-200) }));
    ws.on("message", (raw) => onPanel(JSON.parse(String(raw))));
    ws.on("close", () => panels.delete(ws));
    return;
  }
  // App link. A real trainer talks to one app at a time — so does this one.
  if (app) {
    ws.send(JSON.stringify({ t: "busy" }));
    ws.close();
    slog("info", "rejected a second app — trainer already in use");
    return;
  }
  app = ws;
  subs = new Set();
  trainer.hasControl = false;
  trainer.unlocked = false;
  stats.connects++;
  slog("info", `app connected (${req.socket.remoteAddress})`);

  const send = (m) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m.t === "hello") {
      send({ t: "device", name: "KICKR CORE SIM", services: SERVICES });
      slog("info", `GATT discovery by ${m.client ?? "app"}`);
    } else if (m.t === "sub") {
      subs.add(m.uuid);
      slog("info", `notifications on ${name(m.uuid)}`);
      send({ t: "ack", id: m.id, ok: true });
    } else if (m.t === "write") {
      stats.writes++;
      const bytes = m.data;
      slog("in", `${name(m.uuid)} · ${hex(bytes)}`);
      let resp = null;
      if (m.uuid === UUID.FTMS_CP) resp = handleFtmsCP(bytes, trainer);
      else if (m.uuid === UUID.WAHOO_CP) resp = handleWahoo(bytes, trainer);
      if (resp && faults.rejectNext) {
        faults.rejectNext = false;
        resp = m.uuid === UUID.FTMS_CP ? [0x80, bytes[0], 4] : [0, bytes[0]];
        slog("info", "fault injected: command rejected");
      }
      setTimeout(
        () => {
          send({ t: "ack", id: m.id, ok: true });
          stats.acks++;
          if (resp && subs.has(m.uuid)) {
            send({ t: "notify", uuid: m.uuid, data: resp });
            slog("out", `${name(m.uuid)} · ${hex(resp)}`);
          }
        },
        faults.slowAck ? 1500 : 15,
      );
    } else if (m.t === "course") {
      gradeAt = courseGradeFn(m);
      slog("info", `course received: ${(m.length / 1000).toFixed(2)} km, ${m.grades.length} grade samples`);
    }
  });
  ws.on("close", () => {
    if (app === ws) app = null;
    trainer.hasControl = false;
    slog("info", "app disconnected");
  });
});

function onPanel(m) {
  if (m.t === "rider") {
    if (typeof m.cadence === "number") trainer.rider.cadence = m.cadence;
    if (typeof m.maxWatts === "number") trainer.rider.maxWatts = m.maxWatts;
  } else if (m.t === "fault") {
    if (m.kind === "drop" && app) {
      slog("info", "fault injected: connection drop");
      app.terminate();
    } else if (m.kind === "reject") faults.rejectNext = true;
    else if (m.kind === "slowack") {
      faults.slowAck = !faults.slowAck;
      slog("info", `fault: slow acks ${faults.slowAck ? "on" : "off"}`);
    }
  } else if (m.t === "bots") {
    bots = createBots(Math.max(0, Math.min(10, m.n | 0)));
    slog("info", `peloton: ${bots.length} riders`);
  }
}

// 10 Hz physics.
setInterval(() => {
  stepTrainer(trainer, 0.1);
  for (const b of bots) stepBot(b, 0.1, gradeAt);
}, 100);

// 4 Hz notifications — same rate as the real unit.
setInterval(() => {
  if (app && app.readyState === app.OPEN) {
    const send = (uuid, bytes) => {
      stats.notifies++;
      app.send(JSON.stringify({ t: "notify", uuid, data: Array.from(bytes) }));
    };
    if (subs.has(UUID.IBD)) send(UUID.IBD, encodeIBD({ speedKmh: trainer.v * 3.6, cadence: trainer.cadenceEst, power: trainer.power }));
    if (subs.has(UUID.CPM)) send(UUID.CPM, encodeCPM(trainer));
    if (bots.length)
      app.send(
        JSON.stringify({
          t: "riders",
          riders: bots.map((b) => ({ id: b.id, name: b.name, color: b.color, s: b.s, v: b.v, power: Math.round(b.power) })),
        }),
      );
  }
  const st = JSON.stringify({ t: "state", s: snapshot() });
  for (const p of panels) p.send(st);
}, 250);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Virtual KICKR Core running.
  Control panel: http://127.0.0.1:${PORT}/
  App link:      ws://127.0.0.1:${PORT}/ble
  Byte log:      ${LOG_FILE}
  Peloton:       ${bots.length} bot riders`);
});
