const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  action: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'employee'
  },
  performedByRole: String,
  details: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('logs', logSchema);
