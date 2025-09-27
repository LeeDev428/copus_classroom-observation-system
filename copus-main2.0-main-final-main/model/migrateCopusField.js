// migrateCopusField.js

const mongoose = require('mongoose');
const Schedule = require('./schedule'); // ✅ Correct

const MONGO_URI = 'mongodb+srv://copusAdmin:sK8ZGlLEuWsXavyc@cluster0.ugspmft.mongodb.net/copusDB?retryWrites=true&w=majority&appName=copusDB';

async function migrateCopusField() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const result = await Schedule.updateMany(
      {
        copus_type: { $in: ['Copus 1', 'Copus 2', 'Copus 3'] },
        $or: [
          { copus: { $exists: false } },
          { copus: null },
          { copus: 'Not Set' }
        ]
      },
      [
        { $set: { copus: '$copus_type' } }
      ]
    );

    console.log(`✅ Migration complete. ${result.modifiedCount} schedule(s) updated.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateCopusField();