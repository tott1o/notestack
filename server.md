# 🚀 NoteStack Live Server & Network Hosting Guide

Welcome to the **NoteStack Live Server Guide**! This document explains how NoteStack functions as a live network web server, how to connect mobile devices on your Wi-Fi, and how to deploy NoteStack to cloud servers or local networks.

---

## 📑 Table of Contents
- [Embedded Electron Server](#embedded-electron-server)
- [Standalone Node Web Server (`server.js`)](#standalone-node-web-server-serverjs)
- [Connecting Mobile & External Devices](#connecting-mobile--external-devices)
- [Developer & Cloud Deployment](#developer--cloud-deployment)
- [IPC API Reference](#ipc-api-reference)

---

## ⚡ Embedded Electron Server

NoteStack Desktop embeds an **active HTTP web server directly inside the Electron main process** (`electron/main.cjs`).

> [!NOTE]
> Whenever you launch the **NoteStack Desktop App**, Electron automatically spins up a background HTTP server listening on host `0.0.0.0` and port `3000` (or the next available port).

### Features:
- **Zero Configuration**: Server starts automatically when the app opens.
- **Auto Port Failover**: If port `3000` is occupied, NoteStack automatically binds to `3001`, `3002`, etc.
- **Local Network Broadcast**: Listens on all network interfaces (`0.0.0.0`) so any device on your Wi-Fi can connect.

---

## 🌐 Standalone Node Web Server (`server.js`)

If you want to run NoteStack as a pure web server without opening the desktop UI (for Linux servers, headless boxes, or Docker containers), use the included `server.js` script.

### Launch Commands:
```bash
# Build production bundle and start live web server on port 3000
npm run serve:live

# Live development server with hot-reloading across network
npm run dev:host
```

### Direct Node Command:
```bash
node server.js
```

---

## 📱 Connecting Mobile & External Devices

You can use NoteStack live on your iPhone, Android phone, iPad, or secondary computer over your local Wi-Fi / LAN network.

### Step-by-Step Connection:
1. Ensure your computer and mobile device are connected to the **same Wi-Fi network**.
2. Open NoteStack on your desktop (or run `npm run serve:live`).
3. Find your desktop's local IPv4 address (e.g., `192.168.1.15` or `10.0.0.4`).
4. On your phone/tablet browser, enter:
   ```http
   http://192.168.1.15:3000/
   ```

> [!TIP]
> You can bookmark `http://<your-pc-ip>:3000` on your mobile home screen to use NoteStack as a Web App!

---

## ☁️ Developer & Cloud Deployment

Since NoteStack compiles into static HTML, JS, and CSS files inside the `dist/` directory, it can be deployed to any web host or cloud provider in minutes.

### 1. Vercel / Netlify / Render
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Root Directory**: `./`

### 2. Docker Container
Use the following `Dockerfile` pattern to containerize NoteStack:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "server.js"]
```

### 3. Linux VPS (PM2 Daemon)
```bash
npx pm2 start server.js --name "notestack-server"
npx pm2 save
```

---

## 🛠️ IPC API Reference

Inside the Electron app, you can programmatically inspect the live server status using `window.electronAPI.getServerStatus()`:

```typescript
if (window.electronAPI?.getServerStatus) {
  const status = await window.electronAPI.getServerStatus();
  console.log('Server Active:', status.active);
  console.log('Local URL:', status.localUrl);     // http://localhost:3000
  console.log('Network URL:', status.networkUrl); // http://192.168.x.x:3000
}
```

---

> [!IMPORTANT]
> Keep your computer connected to Wi-Fi while using NoteStack from mobile devices. If you change Wi-Fi networks, your local IP address may update.
