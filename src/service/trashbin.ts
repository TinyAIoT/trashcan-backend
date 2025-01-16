import { City } from '../models/city';
import { Project } from '../models/project';
import { Trashbin } from '../models/trashbin';
import mongoose from 'mongoose';
import { History } from '../models/history';

export const generateUniqueTrashbinIdentifier = async (projectId: string) => {
  const project: any = await Project.findById(projectId);
  const city = await City.findById(project.city);

  if (!city) {
    throw new Error('City not found');
  }

  const cityName = city.name;
  const formattedCityName = cityName.toLowerCase();

  // Filter by projectId before sorting
  const latestTrashbin = await Trashbin.findOne({ project: projectId }).sort({
    createdAt: -1,
  });

  const latestTrashbinCounter = latestTrashbin
    ? parseInt(latestTrashbin.identifier.split('-')[2])
    : 0;

  const counter = (latestTrashbinCounter + 1).toString().padStart(4, '0');

  return `${formattedCityName}-trashbin-${counter}`;
};
export const updateFillLevelChanges = async (req: any, res: any): Promise<void> => {
  try {
    const { hours } = req.body;

    // Validate `hours`
    if (hours !== undefined && (typeof hours !== 'number' || hours < 0)) {
      return res
        .status(400)
        .json({ error: '`hours` must be a positive number or null.' });
    }

    // Fetch all trashbins
    const trashbins = await Trashbin.find();
    if (!trashbins.length) {
      console.warn('No trashbins found.');
      return res.status(404).json({ message: 'No trashbins found.' });
    }

    // Process each trashbin
    await Promise.all(
      trashbins.map(async (trashbin) => {
        let totalFillLevelChange = 0;

        // Skip if no sensors
        if (!trashbin.sensors || trashbin.sensors.length === 0) {
          return;
        }

        // Process each sensor for the current trashbin
        await Promise.all(
          trashbin.sensors.map(async (sensorId) => {
            try {
              // Fetch the most recent history entry for this sensor
              const newestRecord = await History.findOne({
                sensor: new mongoose.Types.ObjectId(sensorId),
                measureType: 'fill_level',
              })
                .sort({ createdAt: -1 })
                .lean();

              if (!newestRecord) {
                console.warn(`No history found for sensor ${sensorId}`);
                return;
              }

              const newestDate = new Date(newestRecord.createdAt);
              const newestMeasurement = newestRecord.measurement;

              // Derive the cutoff date
              const effectiveHours = hours ?? 0;
              const cutoffDate = new Date(
                newestDate.getTime() - effectiveHours * 60 * 60 * 1000
              );

              // Fetch all histories within the specified time range
              const histories = await History.aggregate([
                {
                  $match: {
                    sensor: new mongoose.Types.ObjectId(sensorId),
                    measureType: 'fill_level',
                    $expr: {
                      $and: [
                        { $gte: [{ $toDate: '$createdAt' }, cutoffDate] },
                        { $lte: [{ $toDate: '$createdAt' }, newestDate] },
                      ],
                    },
                  },
                },
                { $sort: { createdAt: 1 } }, // Oldest to newest
              ]);

              if (histories.length > 0) {
                const oldestMeasurement = histories[0].measurement;
                const actualNewestMeasurement =
                  histories[histories.length - 1].measurement;

                // Calculate the fill level change
                const fillLevelChange =
                  actualNewestMeasurement - oldestMeasurement;
                totalFillLevelChange += fillLevelChange;
              } else {
                console.warn(
                  `No valid history between cutoffDate=${cutoffDate} and newestDate=${newestDate} for sensor ${sensorId}`
                );
              }
            } catch (sensorError) {
              console.error(
                `Error processing sensor ${sensorId}:`,
                sensorError
              );
            }
          })
        );

        // Update the trashbin's total fill-level change
        if (totalFillLevelChange !== 0) {
          await Trashbin.findByIdAndUpdate(trashbin._id, {
            fillLevelChange: totalFillLevelChange,
          });
        } else {
          console.log(`No changes to update for Trashbin: ${trashbin._id}`);
        }
      })
    );

    res.status(200).json({
      message: 'Fill-level changes updated successfully for all trashbins.',
    });
  } catch (error) {
    console.error('Error updating fill-level changes:', error);
    res.status(500).json({
      error: 'An error occurred while updating fill-level changes.',
    });
  }
};
