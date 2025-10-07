// controllers/adminController.js

const User = require('../model/employee');
const Schedule = require('../model/schedule');
const FacultySchedule = require('../model/facultySchedule');
const CopusResult = require('../model/copusResult');
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

            // Clean up schedules with invalid dates first
            await Schedule.deleteMany({
                $or: [
                    { date: null },
                    { date: { $exists: false } }
                ]
            });

            const schedules = await Schedule.find({});
            const eventMap = {};

            // Group schedules by date with proper date validation
            schedules.forEach(sch => {
                if (!sch.date || isNaN(new Date(sch.date))) {
                    console.log(`Skipping schedule with invalid date:`, sch._id, sch.date);
                    return; // Skip schedules with invalid dates
                }
                
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
            
            // Render dashboard with empty calendar events if there's an error
            try {
                const user = await User.findById(req.session.user.id);
                res.render('Admin/dashboard', {
                    employeeId: user ? user.employeeId : 'Unknown',
                    firstName: user ? user.firstname : 'Unknown',
                    lastName: user ? user.lastname : 'User',
                    calendarEvents: JSON.stringify([])
                });
            } catch (renderErr) {
                console.error('Error rendering dashboard:', renderErr);
                res.status(500).send('Internal Server Error');
            }
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

            // Clean up orphaned schedules (schedules with deleted users)
            await Schedule.deleteMany({ faculty_user_id: null });

            // Fetch schedules and group by faculty member
            const allSchedules = await Schedule.find({ faculty_user_id: { $ne: null } })
                .populate('faculty_user_id', 'firstname lastname role department employeeId')
                .sort({ date: 1, start_time: 1 });

            // Identify and clean up schedules with failed populates (referenced user doesn't exist)
            const orphanedScheduleIds = [];
            const validSchedules = allSchedules.filter(schedule => {
                if (!schedule.faculty_user_id) {
                    orphanedScheduleIds.push(schedule._id);
                    return false;
                }
                return true;
            });

            // Remove orphaned schedules if any found
            if (orphanedScheduleIds.length > 0) {
                console.log(`Removing ${orphanedScheduleIds.length} orphaned schedules with invalid user references`);
                await Schedule.deleteMany({ _id: { $in: orphanedScheduleIds } });
            }

            // Group schedules by faculty member
            const facultyScheduleMap = {};
            
            validSchedules.forEach(schedule => {
                // Double-check that faculty_user_id exists (should be guaranteed by filtering above)
                if (!schedule.faculty_user_id || !schedule.faculty_user_id._id) {
                    console.log('Skipping schedule with missing faculty user:', schedule._id);
                    return;
                }
                
                const facultyId = schedule.faculty_user_id._id.toString();
                
                if (!facultyScheduleMap[facultyId]) {
                    facultyScheduleMap[facultyId] = {
                        faculty_user_id: schedule.faculty_user_id,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time,
                        copus_type: schedule.copus_type,
                        schedule_type: schedule.schedule_type,
                        dates: [],
                        days: []
                    };
                }
                
                // Add the date and day to the group
                if (schedule.date) {
                    facultyScheduleMap[facultyId].dates.push(schedule.date);
                }
                if (schedule.day_of_week && !facultyScheduleMap[facultyId].days.includes(schedule.day_of_week)) {
                    facultyScheduleMap[facultyId].days.push(schedule.day_of_week);
                }
            });

            // Convert grouped data back to array format for the view
            const schedules = Object.values(facultyScheduleMap).map(group => ({
                faculty_user_id: group.faculty_user_id,
                start_time: group.start_time,
                end_time: group.end_time,
                copus_type: group.copus_type,
                schedule_type: group.schedule_type,
                // Use the earliest date for display
                date: group.dates.length > 0 ? new Date(Math.min(...group.dates)) : null,
                // Store all days for the schedule column
                all_days: group.days,
                // Create a schedule display string
                schedule_display: group.schedule_type === 'bulk_faculty' ? 'Mon - Sat' : group.days.join(', ')
            }));

            console.log(`Grouped ${allSchedules.length} individual schedules into ${schedules.length} faculty schedule groups`);

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

            // Create the new schedule entry using the FacultySchedule model
            const newSchedule = new FacultySchedule({
                faculty_user_id: facultyUser._id,
                image_path: req.file.path // Save the path provided by Multer
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

    // NEW METHOD: Create bulk schedules for all users of a specific role
    createBulkSchedule: async (req, res) => {
        try {
            console.log('Raw request body:', req.body); // Debug log
            
            const { target_role, start_time, end_time, copus_type, days } = req.body;
            const selectedDays = days || [];

            console.log('Bulk schedule creation:', { target_role, start_time, end_time, copus_type, selectedDays });

            // Validate required fields
            if (!target_role || !start_time || !end_time || selectedDays.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Please fill in all required fields and select at least one day.' 
                });
            }

            // Find all users with the specified role
            const users = await User.find({ role: target_role, status: 'Active' });
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: `No active users found with role: ${target_role}` 
                });
            }

            console.log(`Found ${users.length} users with role ${target_role}`);

            let createdCount = 0;
            const Schedule = require('../model/schedule'); // Import Schedule model

            // Create schedules for each user and each selected day
            for (const user of users) {
                for (const day of selectedDays) {
                    try {
                        // Create a date for the schedule (current week + day)
                        const today = new Date();
                        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const targetDayIndex = daysOfWeek.indexOf(day);
                        
                        // Calculate the date for this day in the current week
                        const daysUntilTarget = (targetDayIndex - currentDay + 7) % 7;
                        const scheduleDate = new Date(today);
                        scheduleDate.setDate(today.getDate() + daysUntilTarget);

                        const newSchedule = new Schedule({
                            date: scheduleDate,
                            day_of_week: day,
                            start_time: start_time,
                            end_time: end_time,
                            faculty_user_id: user._id,
                            faculty_employee_id: user.employeeId,
                            faculty_firstname: user.firstname,
                            faculty_lastname: user.lastname,
                            faculty_department: user.department,
                            copus_type: copus_type || 'Copus 1',
                            schedule_type: 'bulk_faculty',
                            status: 'scheduled'
                        });

                        await newSchedule.save();
                        createdCount++;
                        console.log(`Created schedule for ${user.firstname} ${user.lastname} on ${day}`);
                    } catch (scheduleError) {
                        console.error(`Failed to create schedule for ${user.firstname} ${user.lastname} on ${day}:`, scheduleError.message);
                    }
                }
            }

            // Log the bulk creation activity
            const log = new Log({
                user_id: req.session.user.id,
                action: `Bulk schedule creation for role: ${target_role}`,
                details: `Created ${createdCount} schedules for ${users.length} users across ${selectedDays.length} days`
            });
            await log.save();

            res.status(201).json({ 
                success: true, 
                message: `Successfully created schedules!`,
                created_count: createdCount,
                users_count: users.length,
                days_count: selectedDays.length
            });

        } catch (err) {
            console.error('Error creating bulk schedules:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create bulk schedules.', 
                error: err.message 
            });
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

            console.log('🔍 Admin fetching ALL completed schedules...');
            
            // Fetch ALL completed schedules (Admin can see everything)
            const completedSchedules = await Schedule.find({
                status: 'completed'
            }).sort({ date: -1, start_time: -1 })
                .select('firstname lastname department date start_time end_time year_level semester subject_code subject observer copus modality');

            console.log(`📊 Found ${completedSchedules.length} total completed schedules for Admin view`);

            // Fetch chart data from copusresults collection
            const chartData = await adminController.getChartData();

            res.render('Admin/copus_result', {
                completedSchedules: completedSchedules,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                chartData: chartData
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

            console.log('🔍 Admin fetching ALL COPUS results from copusresults collection...');
            
            // Fetch ALL COPUS results from copusresults collection (Admin can see everything)
            const copusResults = await CopusResult.find({})
                .sort({ evaluation_date: -1, submitted_at: -1 })
                .lean();

            console.log(`📊 Found ${copusResults.length} total COPUS results for Admin view`);

            res.render('Admin/copus_history', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                copusResults: copusResults,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
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

    // Helper function to get chart data
    getChartData: async function() {
        try {
            // Get top 10 highest scores
            const topHighest = await CopusResult.find({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: -1 })
                .limit(10)
                .select('faculty_name overall_percentage final_rating')
                .lean();

            // Get top 10 lowest scores
            const topLowest = await CopusResult.find({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: 1 })
                .limit(10)
                .select('faculty_name overall_percentage final_rating')
                .lean();

            // Get top 1 overall score
            const topOverall = await CopusResult.findOne({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: -1 })
                .select('faculty_name overall_percentage final_rating')
                .lean();

            return {
                topHighest: topHighest || [],
                topLowest: topLowest || [],
                topOverall: topOverall || null
            };
        } catch (error) {
            console.error('Error fetching chart data:', error);
            return {
                topHighest: [],
                topLowest: [],
                topOverall: null
            };
        }
    },
};

module.exports = adminController;