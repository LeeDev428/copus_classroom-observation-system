// clearSchedules.js - Script to clear all schedules from MongoDB
const mongoose = require('mongoose');
const Schedule = require('./model/schedule');

async function clearSchedules() {
    try {
        // Connect to MongoDB (update this with your Atlas connection string if needed)
        await mongoose.connect('mongodb://localhost:27017/copusDb');
        console.log('Connected to MongoDB');

        // Count schedules before deletion
        const countBefore = await Schedule.countDocuments();
        console.log(`📊 Found ${countBefore} schedules in the database`);

        if (countBefore === 0) {
            console.log('✅ No schedules to delete');
            mongoose.disconnect();
            return;
        }

        // Ask for confirmation (comment out for automatic deletion)
        console.log('🗑️ Deleting all schedules...');
        
        // Delete all schedules
        const result = await Schedule.deleteMany({});
        console.log(`✅ Successfully deleted ${result.deletedCount} schedules`);

        // Verify deletion
        const countAfter = await Schedule.countDocuments();
        console.log(`📊 Schedules remaining: ${countAfter}`);

        mongoose.disconnect();
        console.log('Database connection closed');
        
    } catch (err) {
        console.error('❌ Error clearing schedules:', err);
        mongoose.disconnect();
    }
}

// Run the clear function
clearSchedules();