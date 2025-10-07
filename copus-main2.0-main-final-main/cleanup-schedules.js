// cleanup-schedules.js - Clean up invalid schedule data
const mongoose = require('mongoose');
require('dotenv').config();

const Schedule = require('./model/schedule');

async function cleanupSchedules() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to DB');

        // Find schedules with invalid dates
        const invalidSchedules = await Schedule.find({
            $or: [
                { date: null },
                { date: { $exists: false } },
                { date: "" }
            ]
        });

        console.log(`Found ${invalidSchedules.length} schedules with invalid dates`);

        if (invalidSchedules.length > 0) {
            // Delete schedules with invalid dates
            const deleteResult = await Schedule.deleteMany({
                $or: [
                    { date: null },
                    { date: { $exists: false } },
                    { date: "" }
                ]
            });

            console.log(`✅ Deleted ${deleteResult.deletedCount} schedules with invalid dates`);
        }

        // Check remaining schedules
        const remainingSchedules = await Schedule.find({});
        console.log(`📊 Remaining schedules: ${remainingSchedules.length}`);

        // Test date parsing for remaining schedules
        let validDates = 0;
        let invalidDates = 0;
        
        for (const schedule of remainingSchedules) {
            if (schedule.date && !isNaN(new Date(schedule.date))) {
                validDates++;
            } else {
                invalidDates++;
                console.log(`⚠️ Invalid date in schedule ${schedule._id}: ${schedule.date}`);
            }
        }

        console.log(`✅ Valid dates: ${validDates}`);
        console.log(`❌ Invalid dates: ${invalidDates}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    }
}

cleanupSchedules();