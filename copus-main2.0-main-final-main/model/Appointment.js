// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  facultyName: { type: String, required: true }, // Or better: facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  observerName: { type: String, required: true }, // Or better: observerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true }, // Store as HH:MM
  discussionTopic: { type: String },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Observer's User ID
  facultyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Faculty's User ID
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);