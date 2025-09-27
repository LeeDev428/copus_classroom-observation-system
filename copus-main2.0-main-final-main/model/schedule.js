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
    date: { type: Date, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    year_level: { type: String, required: true },
    school_year: { type: String, required: true },
    semester: { type: String, enum: ['Semester 1', 'Semester 2'], required: true },
    modality: { type: String, enum: ['RAD', 'FLEX'], required: true },
    observers: [observerDetailSchema],
    
    // NEW FIELDS FOR COMPLETE WORKFLOW
    schedule_type: {
        type: String,
        enum: ['admin_template', 'observation_slot', 'faculty_selected'],
        default: 'admin_template',
        required: true
    },
    created_by_role: {
        type: String,
        enum: ['super_admin', 'admin', 'Observer (ALC)', 'Observer (SLC)'],
        required: true
    },
    created_by_user_id: {
        type: Schema.Types.ObjectId,
        ref: 'employee',
        required: true
    },
    template_schedule_id: {
        type: Schema.Types.ObjectId,
        ref: 'Schedule',
        default: null // References admin template for observation slots
    },
    
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
            'in progress',
            'available_for_selection' // NEW: ALC created slots waiting for faculty
        ],
        default: 'pending',
        required: true
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