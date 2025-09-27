const mongoose = require('mongoose');
const Schedule = require('./model/schedule');
const Employee = require('./model/employee');

mongoose.connect('mongodb+srv://copusAdmin:admin12345@cluster0.ugspmft.mongodb.net/copusDB?retryWrites=true&w=majority&appName=copusDB')
  .then(() => {
    console.log('Connected to MongoDB');
    return seedSchedules();
  })
  .catch(err => console.error('Connection error', err));

async function seedSchedules() {
  await Schedule.deleteMany();

  const employees = await Employee.find({ role: 'Faculty' });

  if (employees.length < 3) {
    console.log('Please seed at least 3 faculty employees first.');
    return mongoose.disconnect();
  }

  const schedules = [
    {
      employee_id: employees[0].employeeId,
      firstname: employees[0].firstname,
      lastname: employees[0].lastname,
      department: employees[0].department,
      date: new Date('2025-05-20'),
      start_time: '08:00 AM',
      end_time: '10:00 AM',
      year_level: '1st Year',
      semester: 'Semester 1',
      subject: 'Computer Programming',
      subject_code: 'CS101',
      observer: 'Pedro Cruz',
      modality: 'RAD',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      employee_id: employees[1].employeeId,
      firstname: employees[1].firstname,
      lastname: employees[1].lastname,
      department: employees[1].department,
      date: new Date('2025-05-22'),
      start_time: '10:30 AM',
      end_time: '12:00 PM',
      year_level: '2nd Year',
      semester: 'Semester 2',
      subject: 'Discrete Math',
      subject_code: 'MATH202',
      observer: 'Celia Ramos',
      modality: 'FLEX',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      employee_id: employees[2].employeeId,
      firstname: employees[2].firstname,
      lastname: employees[2].lastname,
      department: employees[2].department,
      date: new Date('2025-05-25'),
      start_time: '01:00 PM',
      end_time: '03:00 PM',
      year_level: '3rd Year',
      semester: 'Semester 1',
      subject: 'Data Structures',
      subject_code: 'CS203',
      observer: 'Tito Morales',
      modality: 'RAD',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  try {
    await Schedule.insertMany(schedules);
    console.log('Schedule seeding successful!');
  } catch (err) {
    console.error('Error inserting schedules:', err);
  } finally {
    mongoose.disconnect();
  }
}
