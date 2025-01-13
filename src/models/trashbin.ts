import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const trashbinSchema = new Schema(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    assignee: { type: mongoose.Types.ObjectId },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    location: {
      type: String,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    signalStrength: {
      type: Number,
      max: 100,
      default: 0,
    },
    image: {
      type: String,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    lastEmptied: {
      type: Date,
    },
    fillLevel: {
      type: Number,
    },
    fillLevelChange: {
      type: Number,
      default: 0,
    },
    sensors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Sensor',
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Trashbin = mongoose.model('Trashbin', trashbinSchema);
