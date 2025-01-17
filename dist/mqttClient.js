"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMQTT = initializeMQTT;
exports.subscribeSensor = subscribeSensor;
const mqtt_1 = __importDefault(require("mqtt"));
const mqtt_2 = require("./utils/mqtt");
const history_1 = require("./models/history");
const sensor_1 = require("./models/sensor");
const trashbin_1 = require("./models/trashbin");
let client;
let subscribedTopics = [];
function initializeMQTT(eventEmitter) {
    client = mqtt_1.default.connect('mqtt://localhost:1883', {
        username: process.env.MQTT_CLIENT_NAME,
        password: process.env.MQTT_CLIENT_KEY,
    });
    client.on('connect', () => __awaiter(this, void 0, void 0, function* () {
        console.log('Connected to MQTT broker');
        let sensors = yield sensor_1.Sensor.find();
        if (sensors.length > 0) {
            const uniqueDeviceNames = [...new Set(sensors.map(obj => obj.ttnDeviceName))];
            uniqueDeviceNames.forEach(deviceName => {
                subscribeSensor(deviceName);
            });
        }
    }));
    client.on('message', (topic, message) => __awaiter(this, void 0, void 0, function* () {
        console.log('EVENT RECIEVED with TOPIC', topic);
        console.log('Received message:', message.toString());
        const message_json = JSON.parse(message);
        const { batteryLevel, fillLevel, signalLevel } = (0, mqtt_2.mqttTrashParser)(message_json);
        // const message_parsed = JSON.parse(message);
        // const batteryLevel = message_parsed.battery_level;
        // const fillLevel = message_parsed.fill_level;
        // const signalLevel = message_parsed.signal_level;
        let ttnDeviceName = topic.replace('v3/' + process.env.MQTT_CLIENT_NAME + '/devices/', '');
        ttnDeviceName = ttnDeviceName.replace('/up', '');
        if (batteryLevel != undefined) {
            let query = {
                'measureType': 'battery_level',
                'ttnDeviceName': ttnDeviceName
            };
            let sensors = yield sensor_1.Sensor.find(query);
            if (sensors.length > 0) {
                const newHistory = new history_1.History({
                    sensor: sensors[0].id,
                    measureType: 'battery_level',
                    measurement: batteryLevel ? Math.round(batteryLevel * 100) : 0,
                });
                const response = yield newHistory.save();
                console.log(ttnDeviceName + ' with adding battery level =>', response);
                eventEmitter.emit('mqttMessage', 'battery_level', {
                    'sensor_id': sensors[0].id,
                    'battery_level': batteryLevel,
                    'received_at': message_json.received_at
                });
                let trashbin = yield trashbin_1.Trashbin.find({
                    'sensors': sensors[0].id
                });
                if (trashbin.length > 0) {
                    trashbin[0].batteryLevel = batteryLevel ? Math.round(batteryLevel * 100) : 0;
                    yield trashbin[0].save();
                }
            }
        }
        if (fillLevel != undefined) {
            let query = {
                'measureType': 'fill_level',
                'ttnDeviceName': ttnDeviceName
            };
            let sensors = yield sensor_1.Sensor.find(query);
            if (sensors.length > 0) {
                const newHistory = new history_1.History({
                    sensor: sensors[0].id,
                    measureType: 'fill_level',
                    measurement: fillLevel ? Math.round(fillLevel * 100) : 0,
                });
                const response = yield newHistory.save();
                console.log(ttnDeviceName + ' with adding fill level =>', response);
                eventEmitter.emit('mqttMessage', 'fill_level', {
                    'sensor_id': sensors[0].id,
                    'fill_level': fillLevel,
                    'received_at': message_json.received_at
                });
                let trashbin = yield trashbin_1.Trashbin.find({
                    'sensors': sensors[0].id
                });
                if (trashbin.length > 0) {
                    trashbin[0].fillLevel = fillLevel ? Math.round(fillLevel * 100) : 0;
                    yield trashbin[0].save();
                }
            }
        }
        if (signalLevel != undefined) {
            let query = {
                'measureType': 'signal_level',
                'ttnDeviceName': ttnDeviceName
            };
            let sensors = yield sensor_1.Sensor.find(query);
            if (sensors.length > 0) {
                const newHistory = new history_1.History({
                    sensor: sensors[0].id,
                    measureType: 'signal_level',
                    measurement: signalLevel ? Math.round(signalLevel * 100) : 0,
                });
                const response = yield newHistory.save();
                console.log(ttnDeviceName + ' with adding signal level =>', response);
                eventEmitter.emit('mqttMessage', 'signal_level', {
                    'sensor_id': sensors[0].id,
                    'signal_level': signalLevel,
                    'received_at': message_json.received_at
                });
                let trashbin = yield trashbin_1.Trashbin.find({
                    'sensors': sensors[0].id
                });
                if (trashbin.length > 0) {
                    trashbin[0].signalStrength = signalLevel ? Math.round(signalLevel * 100) : 0;
                    yield trashbin[0].save();
                }
            }
        }
    }));
    client.on('error', (error) => {
        console.error('MQTT connection error:', error);
    });
    return client;
}
function subscribeSensor(deviceName) {
    if (!client) {
        throw new Error('MQTT client not initialized');
    }
    const topic = `v3/` + process.env.MQTT_CLIENT_NAME + `/devices/` + deviceName + `/up`;
    if (!subscribedTopics.includes(topic)) {
        client.subscribe(topic, () => {
            subscribedTopics.push(topic);
            console.log(`Subscribed to topic '${topic}'`);
        });
    }
}
