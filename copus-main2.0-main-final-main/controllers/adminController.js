// controllers/adminController.js

const User = require('../model/employee');
const Schedule = require('../model/schedule');
const FacultySchedule = require('../model/facultySchedule');
const Log = require('../model/log');
const facultySchedule = require('../model/facultySchedule');

// Helper function to parse date and time into a single Date object for comparison
function parseDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Note: Month is 0-indexed in JavaScript Date objects
    return new Date(year, month - 1, day, hours, minutes);
}

// Helper to determine semester (assuming your logic for semester is elsewhere or simple)
function getSemester(date) {
    // Example logic, adjust as per your academic calendar
    const month = date.getMonth() + 1; // getMonth() is 0-indexed
    if (month >= 8 || month <= 1) { // Aug to Jan (Semester 1)
        return 'Semester 1';
    } else if (month >= 2 && month <= 7) { // Feb to July (Semester 2)
        return 'Semester 2';
    }
    return 'Unknown Semester'; // Fallback
}

const adminController = {
    // GET /admin_dashboard
    getAdminDashboard: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) return res.redirect('/login');

            const schedules = await Schedule.find({});
            const eventMap = {};

            // Group schedules by date
            schedules.forEach(sch => {
                const date = new Date(sch.date).toISOString().split('T')[0];
                if (!eventMap[date]) eventMap[date] = [];
                eventMap[date].push(sch);
            });

            const calendarEvents = Object.entries(eventMap).map(([date, scheduleList]) => {
                const total = scheduleList.length;

                const totalCompleted = scheduleList.filter(s => s.status.toLowerCase() === 'completed').length;
                const totalCancelled = scheduleList.filter(s => s.status.toLowerCase() === 'cancelled').length;
                const totalPending = scheduleList.filter(s => s.status.toLowerCase() === 'pending').length;

                let color = 'orange';
                let statusLabel = 'Pending';

                if (totalCompleted === total) {
                    color = 'green';
                    statusLabel = 'Completed';
                } else if (totalCancelled === total) {
                    color = 'red';
                    statusLabel = 'Cancelled';
                } else if (totalPending === total) {
                    color = 'orange';
                    statusLabel = 'Pending';
                } else {
                    color = 'blue';
                    statusLabel = `${totalCompleted} ✅ / ${totalCancelled} ❌ / ${totalPending} ⏳`;
                }

                return {
                    title: statusLabel,
                    date,
                    color
                };
            });

            res.render('Admin/dashboard', {
                employeeId: user.employeeId,
                firstName: user.firstname,
                lastName: user.lastname,
                calendarEvents: JSON.stringify(calendarEvents)
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    getAdminSchedule: async (req, res) => {
        try {
            // First, get the logged-in user for the sidebar
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            // Fetch employees from the database
            const employees = await User.find({ role: { $ne: 'admin' } }).sort({ lastname: 1 });

            // Fetch schedules to display them in the table
           const schedules = await Schedule.find({})
    // Correctly populate the faculty_user_id and observers fields
   .populate('faculty_user_id')
    .sort({ date: 1, start_time: 1 });

            // Pass all the necessary data to the EJS template
            res.render('Admin/schedule', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                employees: employees, // This is the crucial line to fix the error
                schedules: schedules // Pass schedules for the table
            });

        } catch (err) {
            console.error('Error fetching admin schedule page:', err);
            res.status(500).send('Internal Server Error');
        }
    },

     createSchedule: async (req, res) => {
        try {
            // Check if a file was uploaded by multer
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No image file uploaded.' });
            }

            const { faculty_user_id } = req.body;

            // Find the user to ensure they exist
            const facultyUser = await User.findById(faculty_user_id);
            if (!facultyUser) {
                return res.status(404).json({ success: false, message: 'Faculty user not found.' });
            }

            // Create the new schedule entry using the Schedule model
            const newSchedule = new Schedule({
                faculty_user_id: facultyUser._id,
                image_path: req.file.path, // Save the path provided by Multer
                schedule_type: 'manual_upload', // Mark as manually uploaded schedule
                created_by_role: 'admin',
                created_by_user_id: req.session.user.id
            });

            // Save the new schedule to the database
            await newSchedule.save();

            // Log the activity
            const log = new Log({
                user_id: req.session.user.id,
                action: `Added schedule for faculty member: ${facultyUser.firstname} ${facultyUser.lastname}`,
                details: `File saved at: ${req.file.path}`
            });
            await log.save();

            // Send a success response
            res.status(201).json({ success: true, message: 'Schedule created successfully!', schedule: newSchedule });

        } catch (err) {
            console.error('Error creating schedule:', err);
            res.status(500).json({ success: false, message: 'Failed to create schedule.', error: err.message });
        }
    },

    // GET /admin_weekly_schedule_creation
    getWeeklyScheduleCreation: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            // Get all faculty members for the dropdown
            const facultyMembers = await User.find({ role: 'Faculty' }).lean();

            res.render('Admin/weekly_schedule_creation', {
                facultyMembers,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                success_msg: req.flash('success'),
                error_msg: req.flash('error')
            });
        } catch (err) {
            console.error('Error loading weekly schedule creation:', err);
            res.status(500).send('Failed to load schedule creation page');
        }
    },

    // POST /admin_create_weekly_schedule
    createWeeklySchedule: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            const {
                startDate,
                endDate,
                startTime,
                endTime,
                yearLevel,
                schoolYear,
                semester,
                modality,
                selectedFaculty // Array of faculty IDs
            } = req.body;

            // Validate selectedFaculty
            if (!selectedFaculty || !Array.isArray(selectedFaculty) || selectedFaculty.length === 0) {
                req.flash('error', 'Please select at least one faculty member.');
                return res.redirect('/admin_create_weekly_schedule');
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const createdSchedules = [];

            // Create schedules for each day in the date range (Mon-Sat)
            for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                const dayOfWeek = date.getDay();
                // Skip Sundays (0)
                if (dayOfWeek === 0) continue;

                // Create schedule for each selected faculty member
                for (const facultyId of selectedFaculty) {
                    const faculty = await User.findById(facultyId);
                    if (!faculty) continue;

                    const newSchedule = new Schedule({
                        date: new Date(date),
                        start_time: startTime,
                        end_time: endTime,
                        year_level: yearLevel,
                        school_year: schoolYear,
                        semester: semester,
                        modality: modality,
                        
                        // Faculty information
                        faculty_user_id: faculty._id,
                        faculty_employee_id: faculty.employeeId,
                        faculty_firstname: faculty.firstname,
                        faculty_lastname: faculty.lastname,
                        faculty_department: faculty.department,
                        
                        // NEW WORKFLOW FIELDS
                        schedule_type: 'admin_template',
                        created_by_role: user.role,
                        created_by_user_id: user._id,
                        status: 'pending',
                        
                        observers: [] // Empty initially
                    });

                    const savedSchedule = await newSchedule.save();
                    createdSchedules.push(savedSchedule);
                }
            }

            // Log the action
            await Log.create({
                action: 'Create Weekly Schedules',
                performedBy: user._id,
                performedByRole: user.role,
                details: `Created ${createdSchedules.length} weekly template schedules from ${startDate} to ${endDate} for ${selectedFaculty.length} faculty members`
            });

            req.flash('success', `Successfully created ${createdSchedules.length} weekly schedules!`);
            res.redirect('/admin_create_weekly_schedule');

        } catch (err) {
            console.error('Error creating weekly schedules:', err);
            req.flash('error', 'Failed to create weekly schedules.');
            res.redirect('/admin_create_weekly_schedule');
        }
    },

    // GET /admin_user_management
    getUserManagement: async (req, res) => {
        try {
            // Fetch logged-in user details for the sidebar
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login'); // Redirect if user session is invalid
            }

            const employees = await User.find({ role: { $ne: 'admin' } });
            res.render('Admin/user_management', {
                employees,
                firstName: user.firstname, // Pass user's first name
                lastName: user.lastname,   // Pass user's last name
                employeeId: user.employeeId // Pass user's employee ID
            });
        } catch (err) {
            console.error('Error fetching user management data:', err);
            res.status(500).send('Failed to load user management view');
        }
    },

    // POST /admin_update_user_status
    updateUserStatus: async (req, res) => {
        const { employeeId, status } = req.body;

        try {
            const user = await User.findById(req.session.user.id);
            const targetEmployee = await User.findOneAndUpdate(
                { employeeId },
                { status },
                { new: true }
            );

            if (!targetEmployee) return res.status(404).send('User not found');

            await Log.create({
                action: 'Update Employee Status',
                performedBy: user.id,
                performedByRole: user.role,
                details: `Changed status of employee ${targetEmployee.firstname} ${targetEmployee.lastname} (ID: ${employeeId}) to ${status}.`
            });

            res.status(200).send('Status updated');
        } catch (err) {
            console.error('Error updating user status:', err);
            res.status(500).send('Failed to update user status');
        }
    },

    // POST /admin_update_user
    updateUser: async (req, res) => {
        const { employeeId, department, lastname, firstname, role, email } = req.body;

        try {
            const user = await User.findById(req.session.user.id);
            const updated = await User.findOneAndUpdate(
                { employeeId },
                { department, lastname, firstname, role, email },
                { new: true }
            );

            if (!updated) return res.status(404).send('Employee not found');

            await Log.create({
                action: 'Update Employee',
                performedBy: user.id,
                performedByRole: user.role,
                details: `Updated employee: ${firstname} ${lastname} (ID: ${employeeId}), role: ${role}, department: ${department}.`
            });

            req.flash('success_msg', 'User updated successfully!'); // Add flash message
            res.redirect('/admin_user_management');
        } catch (err) {
            console.error('Error updating user:', err);
            req.flash('error_msg', 'Failed to update user.'); // Add flash message
            res.status(500).redirect('/admin_user_management'); // Redirect to user management on error
        }
    },
    
    

    // GET /admin_copus_result
    getCopusResult: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) return res.redirect('/login');

            res.render('Admin/copus_result', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId
            });
        } catch (err) {
            console.error('Error fetching Copus Result page:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // GET /admin_copus_history
    getCopusHistory: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) return res.redirect('/login');

            res.render('Admin/copus_history', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId
            });
        } catch (err) {
            console.error('Error fetching Copus History page:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // GET /admin_setting
    getSetting: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) return res.redirect('/login');

            res.render('Admin/setting', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId
            });
        } catch (err) {
            console.error('Error fetching Settings page:', err);
            res.status(500).send('Internal Server Error');
        }
    },
};

module.exports = adminController;