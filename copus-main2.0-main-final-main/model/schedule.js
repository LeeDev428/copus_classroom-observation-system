// model/schedule.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const observerDetailSchema = new Schema({
    observer_id: {
        type: Schema.Types.ObjectId,
        ref: 'employee',
        required: true,
    },
    observer_name: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending',
    },
    observer_role: {
        type: String,
        required: false
    }
}, { _id: false });

const scheduleSchema = new Schema({
    // Day of week for recurring schedules
    day_of_week: { 
        type: String, 
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 
        required: true 
    },
    date: { type: Date, required: false }, // Made optional for recurring schedules
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    year_level: { type: String, required: false }, // Made optional
    school_year: { type: String, required: false }, // Made optional  
    semester: { type: String, enum: ['Semester 1', 'Semester 2'], required: false }, // Made optional
    modality: { type: String, enum: ['RAD', 'FLEX'], required: false }, // Made optional
    observers: [observerDetailSchema],
    status: {
        type: String,
        enum: [
            'pending',
            'pending_faculty_selection',
            'scheduled',
            'approved',
            'cancelled',
            'completed',
            'rejected',
            'in progress'
        ],
        default: 'scheduled',
        required: true
    },
    // Bulk schedule fields
    schedule_type: {
        type: String,
        enum: ['individual', 'bulk_faculty'],
        default: 'individual'
    },
    faculty_user_id: { type: Schema.Types.ObjectId, ref: 'employee', default: null },
    faculty_employee_id: { type: String, default: null },
    faculty_firstname: { type: String, default: null },
    faculty_lastname: { type: String, default: null },
    faculty_department: { type: String, default: null },
    faculty_subject_code: { type: String, default: null },
    faculty_subject_name: { type: String, default: null },
    faculty_room: { type: String, default: null },
    copus_type: { type: String, enum: ['Copus 1', 'Copus 2', 'Copus 3', null], default: null },
    observer_notes: { type: String, default: null },
    // **CHANGED THIS LINE** 👇
    copus: { type: String, default: 'Copus 1', enum: ['Copus 1', 'Copus 2', 'Copus 3'] }, // Removed 'Not Set' and set default to 'Copus 1'

}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);