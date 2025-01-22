import mqtt from 'mqtt';
import { mqttTrashParser, mqttOldAppParser } from './utils/mqtt';
import { History } from './models/history';
import { Sensor } from './models/sensor';
import { Trashbin } from './models/trashbin';
import { EventEmitter } from 'events';
import { updateFillLevelChanges } from './service';

let clients: Record<string, mqtt.MqttClient> = {}; // Store clients for multiple applications
let subscribedTopics: Record<string, string[]> = {}; // Track topics per application

export function initializeMQTT(eventEmitter: EventEmitter) {
  // Define application configurations
  const applications = [
    {
      name: process.env.MQTT_CLIENT_NAME,
      key: process.env.MQTT_CLIENT_KEY,
      parser: mqttTrashParser,
    },
    {
      name: process.env.OLD_MQTT_CLIENT_NAME,
      key: process.env.OLD_MQTT_CLIENT_KEY,
      parser: mqttOldAppParser,
    },
  ];

  applications.forEach((app) => {
    if (app.name && app.key) {
      initializeApplicationMQTT(app as { name: string; key: string; parser: Function }, eventEmitter);
    } else {
      console.error(`Missing MQTT client name or key for application: ${app.name}`);
    }
  });
}

function initializeApplicationMQTT(
  app: { name: string; key: string; parser: Function },
  eventEmitter: EventEmitter
) {
  const client = mqtt.connect('mqtt://eu1.cloud.thethings.network:1883', {
    username: app.name,
    password: app.key,
  });

  clients[app.name] = client; // Store the client
  subscribedTopics[app.name] = []; // Initialize subscribed topics for this app

  client.on('connect', async () => {
    console.log(`Connected to MQTT broker for application: ${app.name}`);
    const sensors = await Sensor.find({ ttnApplicationName: app.name });
    if (sensors.length > 0) {
      const uniqueDeviceNames = [...new Set(sensors.map((obj) => obj.ttnDeviceName))];
      uniqueDeviceNames.forEach((deviceName) => {
        subscribeSensor(app.name, deviceName);
      });
    }
  });

  client.on('message', async (topic: any, message: any) => {
    console.log(`[${app.name}] EVENT RECEIVED with TOPIC`, topic);
    console.log(`[${app.name}] Received message:`, message.toString());

    const messageJson = JSON.parse(message);
    const { batteryLevel, fillLevel, signalLevel } = app.parser(messageJson);
    
    
    let ttnDeviceName = topic.replace(`v3/${app.name}/devices/`, '');
    ttnDeviceName = ttnDeviceName.replace('/up', '');

    if (fillLevel != undefined) {
      let query = {
        measureType: 'fill_level',
        ttnDeviceName: ttnDeviceName,
      };
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
          sensor_id: sensors[0].id,
          fill_level: fillLevel,
          received_at: message_json.received_at,
        });
    
        let trashbin = await Trashbin.find({
          sensors: sensors[0].id,
        });
        if (trashbin.length > 0) {
          trashbin[0].fillLevel = fillLevel ? Math.round(fillLevel * 100) : 0;
          await trashbin[0].save();
        }
    
        // Automatically trigger the updateFillLevelChangesCore function
        const mockRequest = {
          body: { hours: undefined }, // No value for `hours`
        };
        const mockResponse = {
          status: (code: number) => ({
            json: (data: any) => console.log(`Response: ${code}`, data),
          }),
        };
    
        try {
          console.log("Triggering fill level changes update...");
          await updateFillLevelChanges(mockRequest as any, mockResponse as any);
          console.log("Fill level changes update completed.");
        } catch (error) {
          console.error('Error updating fill level changes:', error);
        }
      }
    }

    handleSensorData(eventEmitter, app.name, ttnDeviceName, batteryLevel, fillLevel, signalLevel, messageJson.received_at);
  });

  client.on('error', (error: any) => {
    console.error(`[${app.name}] MQTT connection error:`, error);
  });
}

async function handleSensorData(
  eventEmitter: EventEmitter,
  appName: string,
  ttnDeviceName: string,
  batteryLevel?: number,
  fillLevel?: number,
  signalLevel?: number,
  receivedAt?: string
) {
  if (batteryLevel != undefined) {
    await updateSensorData(eventEmitter, appName, ttnDeviceName, 'battery_level', batteryLevel, receivedAt);
  }

  if (fillLevel != undefined) {
    await updateSensorData(eventEmitter, appName, ttnDeviceName, 'fill_level', fillLevel, receivedAt);
  }

  if (signalLevel != undefined) {
    await updateSensorData(eventEmitter, appName, ttnDeviceName, 'signal_level', signalLevel, receivedAt);
  }
}

async function updateSensorData(
  eventEmitter: EventEmitter,
  appName: string,
  ttnDeviceName: string,
  measureType: string,
  measurement: number,
  receivedAt?: string
) {
  const query = {
    measureType,
    ttnDeviceName,
    ttnApplicationName: appName,
  };

  const sensors = await Sensor.find(query);
  if (sensors.length > 0) {
    const newHistory = new History({
      sensor: sensors[0].id,
      measureType,
      measurement: Math.round(measurement * 100),
    });
    const response = await newHistory.save();
    console.log(`${ttnDeviceName} with adding ${measureType} =>`, response);
    eventEmitter.emit('mqttMessage', measureType, {
      sensor_id: sensors[0].id,
      [measureType]: measurement,
      received_at: receivedAt,
    });

    const trashbin = await Trashbin.find({ sensors: sensors[0].id });
    if (trashbin.length > 0) {
      const key: 'signalStrength' | 'batteryLevel' | 'fillLevel' = measureType === 'signal_level' ? 'signalStrength' : (measureType=== 'fill_level') ? 'fillLevel' : 'batteryLevel';
      trashbin[0][key] = Math.round(measurement * 100);
      await trashbin[0].save();
    }
  }
}

export function subscribeSensor(appName: string, deviceName: string) {
  const client = clients[appName];
  if (!client) {
    throw new Error(`MQTT client for application '${appName}' not initialized`);
  }

  const topic = `v3/${appName}/devices/${deviceName}/up`;
  if (!subscribedTopics[appName].includes(topic)) {
    client.subscribe(topic, () => {
      subscribedTopics[appName].push(topic);
      console.log(`[${appName}] Subscribed to topic '${topic}'`);
    });
  }
}
