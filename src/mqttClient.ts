import mqtt from 'mqtt';
import { mqttTrashParser } from './utils/mqtt';
import { History } from './models/history';
import { Sensor } from './models/sensor';
import { Trashbin } from './models/trashbin';
import { EventEmitter } from 'events';
import axios from "axios";

let client: mqtt.MqttClient;
let subscribedTopics: string[] = [];

export function initializeMQTT(eventEmitter: EventEmitter) {
  client = mqtt.connect('mqtt://eu1.cloud.thethings.network:1883', {
    username: process.env.MQTT_CLIENT_NAME,
    password: process.env.MQTT_CLIENT_KEY,
  });

  client.on('connect', async () => {
    console.log('Connected to MQTT broker');
    let sensors = await Sensor.find();
    if (sensors.length > 0) {
      const uniqueDeviceNames = [...new Set(sensors.map(obj => obj.ttnDeviceName))];
      uniqueDeviceNames.forEach(deviceName => {
        subscribeSensor(deviceName);
      })
    }
  });

  client.on('message', async (topic: any, message: any) => {
    console.log('EVENT RECIEVED with TOPIC', topic);
    console.log('Received message:', message.toString());

    const message_json = JSON.parse(message);

    const { batteryLevel, fillLevel, signalLevel } = mqttTrashParser(
      message_json
    );
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
      }
      let sensors = await Sensor.find(query);
      if (sensors.length > 0) {
        const newHistory = new History({
          sensor: sensors[0].id,
          measureType: 'battery_level',
          measurement: batteryLevel ? Math.round(batteryLevel * 100) : 0,
        });
        const response = await newHistory.save();
        console.log(ttnDeviceName + ' with adding battery level =>', response);
        eventEmitter.emit('mqttMessage', 'battery_level', {
          'sensor_id': sensors[0].id,
          'battery_level': batteryLevel,
          'received_at': message_json.received_at
        });

        let trashbin = await Trashbin.find({
          'sensors': sensors[0].id
        });
        if (trashbin.length > 0) {
          trashbin[0].batteryLevel = batteryLevel ? Math.round(batteryLevel * 100) : 0;
          await trashbin[0].save();
        }
      }
    }

    if (fillLevel != undefined) {
      let query = {
        'measureType': 'fill_level',
        'ttnDeviceName': ttnDeviceName
      }
      let sensors = await Sensor.find(query);
      if (sensors.length > 0) {
        const newHistory = new History({
          sensor: sensors[0].id,
          measureType: 'fill_level',
          measurement: fillLevel ? Math.round(fillLevel * 100) : 0,
        });
        const response = await newHistory.save();
        console.log(ttnDeviceName + ' with adding fill level =>', response);
        eventEmitter.emit('mqttMessage', 'fill_level', {
          'sensor_id': sensors[0].id,
          'fill_level': fillLevel,
          'received_at': message_json.received_at
        });
        
        let trashbin = await Trashbin.find({
          'sensors': sensors[0].id
        });
        if (trashbin.length > 0) {
          trashbin[0].fillLevel = fillLevel ? Math.round(fillLevel * 100) : 0;
          await trashbin[0].save();
        }
        await axios.put('http://localhost:5001/api/v1/trashbin/updateFillLevelChanges', {
          // If you don’t want to send `hours`, send an empty object
        });
      }
    }

    if (signalLevel != undefined) {
      let query = {
        'measureType': 'signal_level',
        'ttnDeviceName': ttnDeviceName
      }
      let sensors = await Sensor.find(query);
      if (sensors.length > 0) {
        const newHistory = new History({
          sensor: sensors[0].id,
          measureType: 'signal_level',
          measurement: signalLevel ? Math.round(signalLevel * 100) : 0,
        });
        const response = await newHistory.save();
        console.log(ttnDeviceName + ' with adding signal level =>', response);
        eventEmitter.emit('mqttMessage', 'signal_level', {
          'sensor_id': sensors[0].id,
          'signal_level': signalLevel,
          'received_at': message_json.received_at
        });
        
        let trashbin = await Trashbin.find({
          'sensors': sensors[0].id
        });
        if (trashbin.length > 0) {
          trashbin[0].signalStrength = signalLevel ? Math.round(signalLevel * 100) : 0;
          await trashbin[0].save();
        }
      }
    }
  });

  client.on('error', (error: any) => {
    console.error('MQTT connection error:', error);
  });
  return client;
}

export function subscribeSensor(deviceName: string) {
  if (!client) {
    throw new Error('MQTT client not initialized');
  }

  const topic = `v3/` + process.env.MQTT_CLIENT_NAME + `/devices/` + deviceName + `/up`;
  if(!subscribedTopics.includes(topic)) {
    client.subscribe(topic, () => {
      subscribedTopics.push(topic);
      console.log(`Subscribed to topic '${topic}'`);
    });
  }
}
