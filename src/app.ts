import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
const dotenv = require('dotenv');
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';

import authRouter from './routes/auth';
import cityRouter from './routes/city';
import projectRouter from './routes/project';
import trashbinRouter from './routes/trashbin';
import sensorRouter from './routes/sensor';
import trashCollectorRouter from './routes/trashCollector';
import noiseRouter from './routes/noise';
import historyRouter from './routes/history';
import { initializeMQTT } from './mqttClient';

const mqtt = require('mqtt');

const app = express();
app.use(
  cors({
      origin: '*',
      credentials: true,
  })
);

const PORT = process.env.PORT || 5001;

dotenv.config();

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  }
});

// Create a global event emitter
export const globalEventEmitter = new EventEmitter();

// Initialize WebSocket
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Listen for MQTT messages
globalEventEmitter.on('mqttMessage', (topic: string, message: string) => {
  io.emit('newData', { topic, message });
});

// Initialize MQTT handler
initializeMQTT(globalEventEmitter);

// Middleware
app.use(bodyParser.json());

// Update CORS policy to whitelist every client domain
app.use((req: any, res: any, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/city', cityRouter);
app.use('/api/v1/project', projectRouter);
app.use('/api/v1/trashbin', trashbinRouter);
app.use('/api/v1/sensor', sensorRouter);
app.use('/api/v1/trash-collector', trashCollectorRouter);
app.use('/api/v1/noise', noiseRouter);
app.use('/api/v1/history', historyRouter);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_DB_URL || '', {})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Define a route
app.get('/', (req, res) => {
  res.send('Hello World with from TinyAIoT');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
