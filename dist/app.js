"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalEventEmitter = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = require('dotenv');
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const events_1 = require("events");
const auth_1 = __importDefault(require("./routes/auth"));
const city_1 = __importDefault(require("./routes/city"));
const project_1 = __importDefault(require("./routes/project"));
const trashbin_1 = __importDefault(require("./routes/trashbin"));
const sensor_1 = __importDefault(require("./routes/sensor"));
const trashCollector_1 = __importDefault(require("./routes/trashCollector"));
const noise_1 = __importDefault(require("./routes/noise"));
const history_1 = __importDefault(require("./routes/history"));
const mqttClient_1 = require("./mqttClient");
const mqtt = require('mqtt');
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
dotenv.config();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
    }
});
// Create a global event emitter
exports.globalEventEmitter = new events_1.EventEmitter();
// Initialize WebSocket
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
// Listen for MQTT messages
exports.globalEventEmitter.on('mqttMessage', (topic, message) => {
    io.emit('newData', { topic, message });
});
// Initialize MQTT handler
(0, mqttClient_1.initializeMQTT)(exports.globalEventEmitter);
// Middleware
app.use(body_parser_1.default.json());
// Update CORS policy to whitelist every client domain
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204); // Stop further processing for preflight
    }
    next();
});
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/city', city_1.default);
app.use('/api/v1/project', project_1.default);
app.use('/api/v1/trashbin', trashbin_1.default);
app.use('/api/v1/sensor', sensor_1.default);
app.use('/api/v1/trash-collector', trashCollector_1.default);
app.use('/api/v1/noise', noise_1.default);
app.use('/api/v1/history', history_1.default);
// Connect to MongoDB
mongoose_1.default
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
