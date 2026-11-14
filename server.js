const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');
const controller = require('./input-controller');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Detect local IPv4 network address
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 and non-internal addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address
        });
      }
    }
  }

  // Prioritize Wi-Fi or Ethernet
  addresses.sort((a, b) => {
    const aWifi = /wi-?fi|wlan|wireless|ethernet/i.test(a.name);
    const bWifi = /wi-?fi|wlan|wireless|ethernet/i.test(b.name);
    if (aWifi && !bWifi) return -1;
    if (!aWifi && bWifi) return 1;
    return 0;
  });

  return addresses;
}

const localAddresses = getLocalIpAddresses();
const primaryIp = localAddresses.length > 0 ? localAddresses[0].address : '127.0.0.1';
const serverUrl = `http://${primaryIp}:${PORT}`;

// API to get connection info and QR code
app.get('/api/info', async (req, res) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(serverUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({
      ip: primaryIp,
      port: PORT,
      url: serverUrl,
      allAddresses: localAddresses,
      hostname: os.hostname(),
      qrCode: qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// WebSocket real-time communication
let connectedClients = 0;

wss.on('connection', (ws, req) => {
  connectedClients++;
  const clientIp = req.socket.remoteAddress;
  console.log(`[+] Client connected from ${clientIp}. Total connected: ${connectedClients}`);

  // Send initial welcome/handshake
  ws.send(JSON.stringify({
    type: 'init',
    status: 'connected',
    serverName: os.hostname(),
    time: Date.now()
  }));

  // Handle client messages
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'mouse_move':
          // { type: 'mouse_move', dx: number, dy: number }
          if (typeof msg.dx === 'number' && typeof msg.dy === 'number') {
            controller.moveMouse(msg.dx, msg.dy);
          }
          break;

        case 'mouse_click':
          // { type: 'mouse_click', button: 'left' | 'right' | 'middle' }
          controller.mouseClick(msg.button || 'left');
          break;

        case 'mouse_dblclick':
          // { type: 'mouse_dblclick', button: 'left' }
          controller.mouseDblClick(msg.button || 'left');
          break;

        case 'mouse_down':
          // { type: 'mouse_down', button: 'left' | 'right' | 'middle' }
          controller.mouseDown(msg.button || 'left');
          break;

        case 'mouse_up':
          // { type: 'mouse_up', button: 'left' | 'right' | 'middle' }
          controller.mouseUp(msg.button || 'left');
          break;

        case 'mouse_scroll':
          // { type: 'mouse_scroll', amount: number }
          if (typeof msg.amount === 'number') {
            controller.scroll(msg.amount);
          }
          break;

        case 'key_press':
          // { type: 'key_press', key: string }
          if (msg.key) {
            controller.keyTap(msg.key);
          }
          break;

        case 'key_down':
          // { type: 'key_down', key: string }
          if (msg.key) {
            controller.keyDown(msg.key);
          }
          break;

        case 'key_up':
          // { type: 'key_up', key: string }
          if (msg.key) {
            controller.keyUp(msg.key);
          }
          break;

        case 'type_text':
          // { type: 'type_text', text: string }
          if (msg.text) {
            controller.typeText(msg.text);
          }
          break;

        case 'shortcut':
          // { type: 'shortcut', combo: 'ctrl+c' }
          if (msg.combo) {
            controller.shortcut(msg.combo);
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
          break;

        default:
          break;
      }
    } catch (e) {
      console.error('Error handling message:', e.message);
    }
  });

  ws.on('close', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[-] Client disconnected. Remaining: ${connectedClients}`);
    // Release any stuck modifier keys when client disconnects
    controller.releaseAllModifiers();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', async () => {
  console.clear();
  console.log('================================================================');
  console.log('       WIRELESS MOBILE KEYBOARD & MOUSE (Version 1.0)           ');
  console.log('================================================================\n');
  console.log('  1. Connect your Mobile Phone & PC to the SAME Wi-Fi network.');
  console.log('  2. Scan the QR code below with your mobile camera:\n');

  try {
    const qrTerminal = await QRCode.toString(serverUrl, { type: 'terminal', small: true });
    console.log(qrTerminal);
  } catch (err) {
    console.log('   (Could not render terminal QR code)');
  }

  console.log(`  Or open this URL directly in your mobile browser:`);
  console.log(`  >>> \x1b[36m\x1b[1m${serverUrl}\x1b[0m <<<\n`);

  if (localAddresses.length > 1) {
    console.log('  Other detected network interfaces:');
    localAddresses.forEach(a => console.log(`   - ${a.name}: http://${a.address}:${PORT}`));
    console.log('');
  }

  console.log('  Computer Local Access: http://localhost:' + PORT);
  console.log('================================================================');
  console.log('  Waiting for phone to connect...\n');
});
