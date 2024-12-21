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
Object.defineProperty(exports, "__esModule", { value: true });
exports.anySample = exports.getNoiseSensorHistoryBySensorId = exports.addNoiseHistory = void 0;
const history_1 = require("../models/history");
const sensor_1 = require("../models/sensor");
const project_1 = require("../models/project");
const mqtt_1 = require("../utils/mqtt");
const addNoiseHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, sensorId, prediction, value } = req.body;
        // For now always send the projectId as 668e605974f99f35291be526
        // For now always send the sensorId as 668e92ca094613ff3bade435
        // Check if the project exists
        const project = yield project_1.Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project does not exist' });
        }
        // Check if the sensor exists
        const sensor = yield sensor_1.Sensor.findById(sensorId);
        if (!sensor) {
            return res.status(404).json({ message: 'Sensor does not exist' });
        }
        // Create the history object
        const history = new history_1.History({
            sensor: sensorId,
            measureType: 'noise_level',
            noisePrediction: prediction.toString(),
            measurement: value,
        });
        // Save the history object
        yield history.save();
        // Push the history ID to the sensor's history array
        sensor.history.push(history._id);
        yield sensor.save();
        // Also push the history ref to the sensors
        return res
            .status(201)
            .json({ message: 'Noise history added successfully!', history });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.addNoiseHistory = addNoiseHistory;
const getNoiseSensorHistoryBySensorId = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sensorId } = req.params;
        // Check if the sensor exists
        const sensor = yield sensor_1.Sensor.findById(sensorId);
        if (!sensor) {
            return res.status(404).json({ message: 'Sensor does not exist' });
        }
        // Get all histories for the sensor and populate the sensor field
        const histories = yield history_1.History.find({ sensor: sensorId });
        return res.status(200).json({ histories });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getNoiseSensorHistoryBySensorId = getNoiseSensorHistoryBySensorId;
const anySample = (req, res, next) => {
    try {
        const testMessage = `{
	"end_device_ids": {
		"device_id": "trash-bin-01",
		"application_ids": {
			"application_id": "tinyaiot-project-seminar"
		},
		"dev_eui": "9876B6FFFE12FD2D",
		"join_eui": "0000000000000000"
	},
	"correlation_ids": [
		"as:up:01J1WZCHYT2RYVV9P3KDP3GGKC",
		"rpc:/ttn.lorawan.v3.AppAs/SimulateUplink:0c89dab4-4185-43b8-ab1f-78608a201e6b"
	],
	"received_at": "2024-07-03T18:58:21.774534711Z",
	"uplink_message": {
		"f_port": 1,
		"frm_payload": "PA/CAQ==",
		"rx_metadata": [
			{
				"gateway_ids": {
					"gateway_id": "test"
				},
				"rssi": -110,
				"channel_rssi": -110,
				"snr": 4.2
			}
		],
		"settings": {
			"data_rate": {
				"lora": {
					"bandwidth": 125000,
					"spreading_factor": 7
				}
			},
			"frequency": "868000000"
		}
	},
	"simulated": true
}`;
        const { batteryLevel, fillLevel, signalLevel } = (0, mqtt_1.mqttTrashParser)(JSON.parse(testMessage));
        console.log(batteryLevel, fillLevel, signalLevel);
        return res.status(200).json({ message: 'Success' });
    }
    catch (error) { }
};
exports.anySample = anySample;
