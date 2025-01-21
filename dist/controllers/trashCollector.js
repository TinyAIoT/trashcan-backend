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
exports.testHistory = exports.getTrashbinsAssignedToTrashCollector = exports.createTrashCollector = exports.getTrashCollector = exports.assignTrashbinsToTrashCollector = void 0;
const trashbin_1 = require("../models/trashbin");
const trashcollector_1 = require("../models/trashcollector");
const mqtt_1 = require("../utils/mqtt");
const project_1 = require("../models/project");
const mongoose_1 = __importDefault(require("mongoose"));
const assignTrashbinsToTrashCollector = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userRole = req.user.role;
        if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
            const { assignedTrashbins, trashCollector } = req.body;
            if (!trashCollector) {
                return res.status(400).json({ message: 'Trash collector is required' });
            }
            const existingTrashCollector = yield trashcollector_1.TrashCollector.findOne({
                _id: trashCollector,
            });
            if (!existingTrashCollector) {
                return res
                    .status(400)
                    .json({ message: 'Trash collector does not exist' });
            }
            if (!assignedTrashbins || !Array.isArray(assignedTrashbins)) {
                return res.status(400).json({ message: 'Invalid trashbins data' });
            }
            // Find trashbins that are currently assigned but not in the new list
            const trashbinsToUnassign = existingTrashCollector.assignedTrashbins.filter((id) => !assignedTrashbins.includes(id));
            // Unassign trashbins that are no longer assigned
            yield trashbin_1.Trashbin.updateMany({ _id: { $in: trashbinsToUnassign } }, { $unset: { assignee: '' } });
            // Assign each trashbin to the trash collector
            for (const trashbinId of assignedTrashbins) {
                const trashbin = yield trashbin_1.Trashbin.findById(trashbinId);
                if (!trashbin) {
                    return res
                        .status(400)
                        .json({ message: `Trashbin with ID ${trashbinId} does not exist` });
                }
                trashbin.assignee = existingTrashCollector._id;
                yield trashbin.save();
            }
            // Update the assignedTrashbins array of the trash collector
            existingTrashCollector.assignedTrashbins = assignedTrashbins;
            yield existingTrashCollector.save();
            return res
                .status(200)
                .json({ message: 'Trash bins assigned successfully' });
        }
        else {
            return res.status(403).json({
                message: 'Unauthorized to assign trashbins to trashcollector, should be admin or superadmin',
            });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.assignTrashbinsToTrashCollector = assignTrashbinsToTrashCollector;
const getTrashCollector = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectQuery = req.query.project;
        let trashcollectors;
        let count;
        if (projectQuery) {
            // Check if the projectQuery is a valid ObjectId
            if (mongoose_1.default.Types.ObjectId.isValid(projectQuery)) {
                trashcollectors = yield trashcollector_1.TrashCollector.find({ project: projectQuery })
                    .populate('assignee')
                    .populate('project');
            }
            else {
                // If not a valid ObjectId, assume it's an identifier
                const project = yield project_1.Project.findOne({ identifier: projectQuery });
                if (project) {
                    trashcollectors = yield trashcollector_1.TrashCollector.find({ project: project._id })
                        .populate('assignee')
                        .populate('project');
                }
                else {
                    return res.status(404).json({ message: 'Project not found' });
                }
            }
        }
        else {
            trashcollectors = yield trashcollector_1.TrashCollector.find();
        }
        count = trashcollectors.length;
        return res.status(200).json({ count, trashcollectors });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getTrashCollector = getTrashCollector;
const createTrashCollector = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userRole = req.user.role;
        if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
            const { name, assignedTrashbins } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }
            const existingTrashCollector = yield trashcollector_1.TrashCollector.findOne({ name });
            if (existingTrashCollector) {
                return res.status(400).json({
                    message: 'A trash collector with the same name already exists',
                });
            }
            if (!assignedTrashbins) {
                req.body.assignedTrashbins = []; // Set assignedTrashbins to an empty array if not provided
            }
            else if (!Array.isArray(assignedTrashbins)) {
                return res
                    .status(400)
                    .json({ message: 'Assigned trashbins must be an array' });
            }
            // Check if all assigned trashbins exist in the database
            const allTrashbinsExist = (assignedTrashbins === null || assignedTrashbins === void 0 ? void 0 : assignedTrashbins.length) > 0 &&
                assignedTrashbins.every((trashbinId) => __awaiter(void 0, void 0, void 0, function* () {
                    const trashbin = yield trashbin_1.Trashbin.findById(trashbinId);
                    return trashbin !== null;
                }));
            console.log('All Trashbins exists =>', allTrashbinsExist);
            if ((assignedTrashbins === null || assignedTrashbins === void 0 ? void 0 : assignedTrashbins.length) > 0 && !allTrashbinsExist) {
                return res
                    .status(400)
                    .json({ message: 'One or more assigned trashbins do not exist' });
            }
            const newTrashCollector = new trashcollector_1.TrashCollector({
                name,
                assignedTrashbins,
            });
            yield newTrashCollector.save();
            yield trashbin_1.Trashbin.updateMany({ _id: { $in: assignedTrashbins } }, { assignee: newTrashCollector._id });
            return res
                .status(201)
                .json({ message: 'Trash collector created successfully' });
        }
        else {
            return res.status(403).json({
                message: 'Unauthorized to create trashcollector',
            });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.createTrashCollector = createTrashCollector;
const getTrashbinsAssignedToTrashCollector = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const trashCollectorId = req.params.trashCollectorId;
        const existingTrashCollector = yield trashcollector_1.TrashCollector.findById(trashCollectorId).populate('assignedTrashbins');
        if (!existingTrashCollector) {
            return res.status(404).json({ message: 'Trash collector not found' });
        }
        const assignedTrashbins = existingTrashCollector.assignedTrashbins;
        return res.status(200).json({ assignedTrashbins });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getTrashbinsAssignedToTrashCollector = getTrashbinsAssignedToTrashCollector;
const testHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        const object = (0, mqtt_1.mqttTrashParser)(JSON.parse(testMessage));
        console.log('Object =>', object);
        return res.status(201).json({ message: 'Success!', object });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.testHistory = testHistory;
