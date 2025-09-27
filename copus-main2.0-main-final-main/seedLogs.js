const mongoose = require('mongoose');
const Log = require('./model/log');
const Employee = require('./model/employee');

mongoose.connect('mongodb+srv://copusAdmin:admin12345@cluster0.ugspmft.mongodb.net/copusDB?retryWrites=true&w=majority&appName=copusDB')
  .then(() => {
    console.log('Connected to MongoDB');
    return seedLogs();
  })
  .catch(err => console.error('Connection error', err));

async function seedLogs() {
  await Log.deleteMany();

  const employees = await Employee.find();

  if (employees.length < 3) {
    console.log('Please seed employees first.');
    return mongoose.disconnect();
  }

  const logs = [
    {
      action: 'Added Schedule',
      performedBy: employees[0]._id,
      performedByRole: employees[0].role,
      details: 'Added new schedule for IT department'
    },
    {
      action: 'Updated User',
      performedBy: employees[1]._id,
      performedByRole: employees[1].role,
      details: 'Changed user role to admin'
    },
    {
      action: 'Deleted Schedule',
      performedBy: employees[2]._id,
      performedByRole: employees[2].role,
      details: 'Removed canceled schedule'
    },
    {
      action: 'Logged In',
      performedBy: employees[3]._id,
      performedByRole: employees[3].role,
      details: 'User logged in to system'
    },
    {
      action: 'Changed Password',
      performedBy: employees[4]._id,
      performedByRole: employees[4].role,
      details: 'Reset account password'
    }
  ];

  try {
    await Log.insertMany(logs);
    console.log('Log seeding successful!');
  } catch (err) {
    console.error('Error inserting logs:', err);
  } finally {
    mongoose.disconnect();
  }
}
