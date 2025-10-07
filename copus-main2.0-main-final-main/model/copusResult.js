const mongoose = require('mongoose');

const copusResultSchema = new mongoose.Schema({
    // Reference to the observation schedule
    schedule_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObserverSchedule',
        required: true
    },
    
    // Faculty being evaluated
    faculty_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    faculty_name: {
        type: String,
        required: true
    },
    faculty_department: {
        type: String,
        required: true
    },
    
    // Observer conducting evaluation
    observer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    observer_name: {
        type: String,
        required: true
    },
    
    // Observation details
    observation_date: {
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
    subject_name: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    copus_type: {
        type: String,
        enum: ['Copus 1', 'Copus 2', 'Copus 3'],
        required: true
    },
    
    // COPUS Action Counts (Raw checkbox counts from observation)
    student_actions_count: {
        L: { type: Number, default: 0 },        // Listening
        Ind: { type: Number, default: 0 },      // Individual thinking/problem solving
        Grp: { type: Number, default: 0 },      // Group work
        AnQ: { type: Number, default: 0 },      // Answering questions
        AsQ: { type: Number, default: 0 },      // Asking questions
        WC: { type: Number, default: 0 },       // Whole class discussion
        SP: { type: Number, default: 0 },       // Student presentation
        TQ: { type: Number, default: 0 },       // Test/quiz
        W: { type: Number, default: 0 },        // Waiting
        O: { type: Number, default: 0 }         // Other
    },
    
    teacher_actions_count: {
        Lec: { type: Number, default: 0 },      // Lecturing
        RtW: { type: Number, default: 0 },      // Real-time writing
        MG: { type: Number, default: 0 },       // Moving and guiding
        AnQ: { type: Number, default: 0 },      // Answering questions
        PQ: { type: Number, default: 0 },       // Posing questions
        FUp: { type: Number, default: 0 },      // Follow-up/feedback
        '1o1': { type: Number, default: 0 },    // One-on-one
        DV: { type: Number, default: 0 },       // Demo/video
        Adm: { type: Number, default: 0 },      // Administration
        W: { type: Number, default: 0 },        // Waiting
        O: { type: Number, default: 0 }         // Other
    },
    
    engagement_level_count: {
        High: { type: Number, default: 0 },     // High engagement
        Med: { type: Number, default: 0 },      // Medium engagement
        Low: { type: Number, default: 0 }       // Low engagement
    },
    
    // Active Learning Evaluation Criteria
    student_engagement: {
        asking_questions: { type: Number, min: 0, max: 100, default: 0 },
        participating_discussions: { type: Number, min: 0, max: 100, default: 0 },
        collaborative_work: { type: Number, min: 0, max: 100, default: 0 },
        problem_solving: { type: Number, min: 0, max: 100, default: 0 }
    },
    
    teacher_facilitation: {
        interactive_teaching: { type: Number, min: 0, max: 100, default: 0 },
        encouraging_participation: { type: Number, min: 0, max: 100, default: 0 },
        providing_feedback: { type: Number, min: 0, max: 100, default: 0 },
        guiding_discussions: { type: Number, min: 0, max: 100, default: 0 }
    },
    
    learning_environment: {
        classroom_setup: { type: Number, min: 0, max: 100, default: 0 },
        technology_use: { type: Number, min: 0, max: 100, default: 0 },
        resource_utilization: { type: Number, min: 0, max: 100, default: 0 },
        time_management: { type: Number, min: 0, max: 100, default: 0 }
    },
    
    // Overall scores and rating
    overall_percentage: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    
    final_rating: {
        type: String,
        enum: ['Great', 'Good', 'Needs Improvement', 'Unsatisfactory']
        // Auto-calculated by pre-save hook, so not required
    },
    
    // Additional feedback
    strengths: {
        type: String,
        default: ''
    },
    areas_for_improvement: {
        type: String,
        default: ''
    },
    recommendations: {
        type: String,
        default: ''
    },
    additional_comments: {
        type: String,
        default: ''
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['draft', 'submitted', 'reviewed'],
        default: 'draft'
    },
    
    // Timestamps
    evaluation_date: {
        type: Date,
        default: Date.now
    },
    submitted_at: {
        type: Date
    },
    reviewed_at: {
        type: Date
    }
}, {
    timestamps: true
});

// Calculate final rating based on overall percentage
copusResultSchema.pre('save', function(next) {
    if (this.overall_percentage >= 72.50) {
        this.final_rating = 'Great';
    } else if (this.overall_percentage >= 50.00) {
        this.final_rating = 'Good';
    } else if (this.overall_percentage >= 25.00) {
        this.final_rating = 'Needs Improvement';
    } else {
        this.final_rating = 'Unsatisfactory';
    }
    next();
});

// Index for efficient queries
copusResultSchema.index({ faculty_id: 1, observation_date: -1 });
copusResultSchema.index({ observer_id: 1, observation_date: -1 });
copusResultSchema.index({ schedule_id: 1 });

module.exports = mongoose.model('CopusResult', copusResultSchema);