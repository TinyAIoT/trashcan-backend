import { Trashbin } from '../models/trashbin';
import { Project } from '../models/project';
import { Sensor } from '../models/sensor';
import { subscribeSensor } from '../mqttClient';

export const getAllSensors = async (req: any, res: any, next: any) => {
  try {
    // Implement logic to get all sensors

    const sensors = await Sensor.find().populate('trashbin');
    // .populate('history');
    res.status(200).json(sensors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSensorById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const sensor = await Sensor.findById(id)
      .populate('trashbin')
      .populate('history');
    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }
    res.status(200).json(sensor);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const postSensor = async (req: any, res: any, next: any) => {
  try {
    const { trashbinID, measureType, applianceType, ttnDeviceName } = req.body;
    const userID = req.user.id;
    const userRole = req.user.role;

    if (!trashbinID && applianceType === 'trashbin') {
      return res.status(400).json({ message: 'Trashbin ID is required' });
    }

    const trashbin = await Trashbin.findById(trashbinID).populate({
      path: 'project',
      populate: {
        path: 'users',
      },
    });
    if (!trashbin) {
      return res.status(404).json({ message: 'Trashbin not found' });
    }

    if (!trashbin.project) {
      return res
        .status(404)
        .json({ message: 'No project associated with this trashbin' });
    }

    const project = trashbin.project as unknown as { users: { _id: string }[] };

    const isUserInProject = project.users.some(
      (user) => user._id.toString() === userID.toString()
    );

    if (!isUserInProject && userRole !== 'SUPERADMIN') {
      return res
        .status(403)
        .json({ message: 'User does not have access to this project' });
    }

    const newSensor = new Sensor({
      trashbin: trashbinID,
      measureType,
      applianceType,
      ttnDeviceName,
    });

    await newSensor.save();

    // Push the new sensor ID into the trashbin.sensors array
    trashbin.sensors.push(newSensor._id);
    await trashbin.save();

    subscribeSensor(ttnDeviceName);

    return res
      .status(200)
      .json({ message: 'Sensor created successfully', newSensor });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const postNoiseSensor = async (req: any, res: any, next: any) => {
  try {
    const { projectID } = req.body;
    const userID = req.user.id;
    const userRole = req.user.role;

    if (!projectID) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const project = await Project.findById(projectID).populate('users');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isUserInProject = project.users.some(
      (user) => user._id.toString() === userID.toString()
    );

    if (!isUserInProject && userRole !== 'SUPERADMIN') {
      return res
        .status(403)
        .json({ message: 'User does not have access to this project' });
    }

    const newSensor = new Sensor({
      applianceType: 'noise-detector',
      noiseProject: projectID,
      measureType: 'noise_level',
      unit: 'decibel',
    });

    await newSensor.save();

    return res
      .status(200)
      .json({ message: 'Noise Sensor created successfully', newSensor });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
