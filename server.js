// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static HTML/JS files
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New connection. Total clients:', clients.size);

  ws.on('message', (message) => {
    // Broadcast received message to all clients
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Connection closed. Total clients:', clients.size);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
