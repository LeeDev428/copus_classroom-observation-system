// model/observerSchedule.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const observerScheduleSchema = new Schema({
    // Date for the observation
    date: { 
        type: Date, 
        required: true 
    },
    start_time: { 
        type: String, 
        required: true 
    },
    end_time: { 
        type: String, 
        required: true 
    },
    
    // Faculty information
    faculty_user_id: { 
        type: Schema.Types.ObjectId, 
        ref: 'employee', 
        required: true 
    },
    faculty_name: { 
        type: String, 
        required: true 
    },
    faculty_department: { 
        type: String, 
        required: false 
    },
    
    // Observer information
    observer_id: { 
        type: Schema.Types.ObjectId, 
        ref: 'employee', 
        required: true 
    },
    observer_name: { 
        type: String, 
        required: true 
    },
    
    // Observation details
    copus_type: { 
        type: String, 
        enum: ['Copus 1', 'Copus 2', 'Copus 3'], 
        default: 'Copus 1' 
    },
    subject_name: { 
        type: String, 
        required: false 
    },
    room: { 
        type: String, 
        required: false 
    },
    
    // Status tracking
    status: {
        type: String,
        enum: [
            'scheduled',
            'in_progress', 
            'completed',
            'cancelled',
            'rescheduled'
        ],
        default: 'scheduled'
    },
    
    // Additional notes
    notes: { 
        type: String, 
        required: false 
    },
    
    // Notification settings
    send_notification: { 
        type: Boolean, 
        default: true 
    },
    
    // Reference to related COPUS observation result
    copus_result_id: { 
        type: Schema.Types.ObjectId, 
        ref: 'copusObservation', 
        required: false 
    }
    
}, { timestamps: true });

// Index for better query performance
observerScheduleSchema.index({ date: 1, observer_id: 1 });
observerScheduleSchema.index({ faculty_user_id: 1, date: 1 });

module.exports = mongoose.model('ObserverSchedule', observerScheduleSchema);