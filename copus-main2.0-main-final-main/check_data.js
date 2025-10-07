require('dotenv').config();
const mongoose = require('mongoose');
const CopusResult = require('./model/copusResult');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('✅ Connected to MongoDB');
        
        const count = await CopusResult.countDocuments();
        console.log(`📊 Total CopusResult documents: ${count}`);
        
        if (count > 0) {
            console.log('\n📋 All CopusResult documents:');
            const results = await CopusResult.find({}).lean();
            results.forEach((result, index) => {
                console.log(`\n--- Document ${index + 1} ---`);
                console.log('faculty_name:', result.faculty_name);
                console.log('observer_name:', result.observer_name);
                console.log('observation_date:', result.observation_date);
                console.log('copus_type:', result.copus_type);
                console.log('overall_percentage:', result.overall_percentage);
                console.log('final_rating:', result.final_rating);
                console.log('status:', result.status);
                console.log('subject_name:', result.subject_name);
                console.log('room:', result.room);
                console.log('start_time:', result.start_time);
                console.log('end_time:', result.end_time);
            });
        } else {
            console.log('⚠️ No documents found in copusresults collection');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkData();