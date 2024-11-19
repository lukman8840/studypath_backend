const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  response: {
    symptoms: {
      type: String,
      required: true,
    },
    overall_status: {
      type: String,
      required: true,
    },
    isScheduled: {
      type: String,
      required: false,
      default: false,
    },
    doctor_approved: {
      type: String,
      required: false,
      default: false,
    },
    prescribe_medication: {
      type: String,
      required: false,
    },
    recommendations: {
      type: String,
      required: true,
    },
    next_steps: {
      type: String,
      required: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Record = mongoose.model("Record", recordSchema);
module.exports = Record;
