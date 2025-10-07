const mongoose = require('mongoose');
const CopusObservation = require('./model/copusObservation');

async function checkCopusObservations() {
    try {
        await mongoose.connect('mongodb://localhost:27017/copus');
        
        console.log('✅ Connected to MongoDB');
        
        const count = await CopusObservation.countDocuments();
        console.log(`📊 Total CopusObservation documents: ${count}`);
        
        if (count > 0) {
            console.log('\n📋 All CopusObservation documents:');
            const results = await CopusObservation.find({}).lean();
            results.forEach((result, index) => {
                console.log(`\n--- Observation ${index + 1} ---`);
                console.log('observerId:', result.observerId);
                console.log('scheduleId:', result.scheduleId);
                console.log('observationDate:', result.observationDate);
                console.log('copusNumber:', result.copusNumber);
                console.log('overallComments:', result.overallComments);
                console.log('copusRecords length:', result.copusRecords ? result.copusRecords.length : 0);
            });
        } else {
            console.log('⚠️ No documents found in copusobservations collection');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkCopusObservations();