// scripts/migrateEngagementLevels.js
const mongoose = require('mongoose');
const CopusObservation = require('../model/copusObservation'); // Adjust path as needed
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

async function migrateEngagementLevels() {
    try {
        // This will now correctly get the URI from process.env.MONGODB_URI
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully for migration.');

        const observationsToMigrate = await CopusObservation.find({});

        console.log(`Found ${observationsToMigrate.length} CopusObservation documents to process.`);

        for (const obs of observationsToMigrate) {
            let hasChanges = false;
            const updatedObservations = obs.observations.map(interval => {
                let currentHigh = interval.engagementLevel?.High;
                let currentMed = interval.engagementLevel?.Med;
                let currentLow = interval.engagementLevel?.Low;

                if (!interval.engagementLevel ||
                    currentHigh === undefined || currentMed === undefined || currentLow === undefined ||
                    (currentHigh !== 0 && currentHigh !== 1) ||
                    (currentMed !== 0 && currentMed !== 1) ||
                    (currentLow !== 0 && currentLow !== 1) )
                {
                    interval.engagementLevel = {
                        High: 0,
                        Med: 0,
                        Low: 0
                    };
                    hasChanges = true;
                }
                return interval;
            });

            if (hasChanges) {
                await CopusObservation.updateOne(
                    { _id: obs._id },
                    { $set: { observations: updatedObservations } }
                );
                console.log(`Updated CopusObservation ID: ${obs._id}`);
            }
        }

        console.log('Migration complete!');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
}

migrateEngagementLevels();