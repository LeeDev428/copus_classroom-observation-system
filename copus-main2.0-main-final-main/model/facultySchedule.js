// model/facultySchedule.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const facultyScheduleSchema = new Schema({
    faculty_user_id: {
        type: Schema.Types.ObjectId,
        ref: 'employee',
        required: true
    },
    // The path to the uploaded image on the server
    image_path: {
        type: String,
        required: true
    },
    // You can add an optional status, e.g., 'active' or 'archived'
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('FacultySchedule', facultyScheduleSchema);