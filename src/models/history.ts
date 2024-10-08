import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const historySchema = new Schema(
  {
    sensor: {
      type: Schema.Types.ObjectId,
      ref: 'Sensor',
      required: true,
    },
    measureType: {
      type: String,
      enum: ['fill_level', 'battery_level', 'noise_level', 'signal_level'],
      required: true,
    },
    noisePrediction: {
      type: String,
    },
    measurement: {
      type: Number,
      required: true,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const History = mongoose.model('History', historySchema);
