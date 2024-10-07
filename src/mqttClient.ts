import mqtt from 'mqtt';
import { mqttTrashParser } from './utils/mqtt';
import { History } from './models/history';
import { Sensor } from './models/sensor';
import { Trashbin } from './models/trashbin';
import { EventEmitter } from 'events';

export function initializeMQTT(eventEmitter: EventEmitter) {
  const client = mqtt.connect('mqtt://eu1.cloud.thethings.network:1883', {
    username: process.env.MQTT_CLIENT_NAME,
    password: process.env.MQTT_CLIENT_KEY,
  });

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    const topic = `v3/` + process.env.MQTT_CLIENT_NAME + `/devices/aiconn-trashcan/up`;
    client.subscribe(topic, () => {
      console.log(`Subscribed to topic '${topic}'`);
    });
  });

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    const topic = `v3/` + process.env.MQTT_CLIENT_NAME + `/devices/aiconn-trashcan/up`;
    client.subscribe(topic, () => {
      console.log(`Subscribed to topic '${topic}'`);
    });
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

    if (batteryLevel) {
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
          'battery_level':batteryLevel,
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

    if (fillLevel) {
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
      }
    }

    if (signalLevel) {
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
