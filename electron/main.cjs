// Hedgerow desktop shell. Runs the app's built server locally (no internet needed)
// and opens it in a native window with Bluetooth device selection.
const { app, BrowserWindow, dialog, Menu } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const CLIENT = path.join(DIST, "client");
const TYPES = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".glb": "model/gltf-binary",
  ".woff2": "font/woff2", ".txt": "text/plain",
};

async function startServer() {
  const mod = await import(pathToFileURL(path.join(DIST, "server", "index.mjs")).href);
  const handler = mod.default;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const file = path.join(CLIENT, decodeURIComponent(url.pathname));
      if (file.startsWith(CLIENT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, {
          "content-type": TYPES[path.extname(file)] || "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        });
        fs.createReadStream(file).pipe(res);
        return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body });
      const response = await handler.fetch(request, {}, { waitUntil() {}, passThroughOnException() {} });
      const headers = {};
      response.headers.forEach((v, k) => (headers[k] = v));
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(e && e.stack ? e.stack : e));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return server.address().port;
}

function setupBluetooth(win) {
  // Chromium asks the app to choose a device; collect results for a few seconds, then let the user pick.
  let pending = null;
  win.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    if (!pending) {
      pending = { callback, devices: new Map() };
      setTimeout(async () => {
        const p = pending;
        pending = null;
        const list = [...p.devices.values()];
        if (!list.length) {
          dialog.showMessageBox(win, { type: "warning", message: "No Bluetooth devices found", detail: "Make sure the device is awake and not connected to another app (close Zwift), then try again." });
          p.callback("");
          return;
        }
        const { response } = await dialog.showMessageBox(win, {
          type: "question",
          message: "Choose a Bluetooth device",
          buttons: [...list.map((d) => d.deviceName || d.deviceId), "Cancel"],
          cancelId: list.length,
        });
        p.callback(response < list.length ? list[response].deviceId : "");
      }, 4000);
    }
    for (const d of devices) pending.devices.set(d.deviceId, d);
  });
}

async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Hedgerow",
    backgroundColor: "#f7f3e8",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  setupBluetooth(win);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      { label: "View", submenu: [{ role: "reload" }, { role: "togglefullscreen" }, { role: "toggleDevTools" }] },
    ]),
  );
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
