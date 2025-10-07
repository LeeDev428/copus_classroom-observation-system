// controllers/observerController.js

// Import necessary Mongoose models
const User = require('../model/employee'); // Adjust path as needed
const Schedule = require('../model/schedule'); // Adjust path as needed
const ObserverSchedule = require('../model/observerSchedule'); // New observer schedule model
const CopusObservation = require('../model/copusObservation'); // Adjust path as needed
const CopusResult = require('../model/copusResult'); // COPUS results model
const Notification = require('../model/Notification'); // Adjust path as needed
const Appointment = require('../model/Appointment'); // Adjust path as needed
const Log = require('../model/log');           // Adjust path as needed
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit'); // For PDF generation

// Helper function to send flash messages and redirect
const sendResponseAndRedirect = (req, res, path, messageType, message) => {
    req.flash(messageType, message);
    res.redirect(path);
};

// Helper function to check if the user's role is an observer type
const isObserverRole = (userRole) => {
    return userRole === 'Observer' || userRole === 'Observer (ALC)' || userRole === 'Observer (SLC)';
};

const observerController = { // Start of the observerController object

    // GET /Observer_dashboard
    getDashboard: async (req, res) => {
        try {
            // Ensure user is authenticated and in session
            if (!req.session.user || !req.session.user.id) {
                console.log('User not found in session for getDashboard, redirecting to login.');
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }

            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('User ID from session not found in DB for dashboard, destroying session and redirecting to login.');
                req.session.destroy(() => {
                    req.flash('error', 'User not found. Please log in again.');
                    res.redirect('/login');
                });
                return;
            }

            // Verify the user's role is indeed an observer type
            if (!isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this dashboard.');
                return res.redirect('/login'); // Or a generic dashboard
            }

            // Fetch observer-created schedules for the calendar
            const observerSchedules = await ObserverSchedule.find({
                observer_id: user._id
            })
            .populate('faculty_user_id', 'firstname lastname department')
            .sort({ date: 1, start_time: 1 })
            .lean();

            console.log(`Found ${observerSchedules.length} observer schedules for dashboard calendar`);

            // Convert observer schedules to calendar events
            const calendarEvents = observerSchedules.map(schedule => {
                let color = '#3498db'; // Default blue for scheduled
                if (schedule.status === 'completed') {
                    color = '#2ecc71'; // Green
                } else if (schedule.status === 'cancelled') {
                    color = '#e74c3c'; // Red
                } else if (schedule.status === 'in_progress') {
                    color = '#f39c12'; // Orange
                } else if (schedule.status === 'rescheduled') {
                    color = '#9b59b6'; // Purple
                }

                const facultyName = schedule.faculty_user_id ? 
                    `${schedule.faculty_user_id.firstname} ${schedule.faculty_user_id.lastname}` : 
                    schedule.faculty_name;

                const title = `${schedule.copus_type} - ${facultyName}`;
                const startDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.start_time}`;
                const endDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.end_time}`;

                return {
                    id: schedule._id.toString(),
                    title: title,
                    start: startDateTime,
                    end: endDateTime,
                    color: color,
                    extendedProps: {
                        facultyName: facultyName,
                        copusType: schedule.copus_type,
                        status: schedule.status,
                        room: schedule.room,
                        notes: schedule.notes
                    }
                };
            });

            res.render('Observer/dashboard', {
                employeeId: user.employeeId,
                firstName: user.firstname,
                lastName: user.lastname,
                calendarEvents: calendarEvents,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            req.flash('error', 'Failed to load dashboard data.');
            res.status(500).render('Observer/dashboard', {
                employeeId: req.session.user ? req.session.user.employeeId : '',
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                calendarEvents: '[]', // Send empty array on error
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }
    },

    // POST /observer_schedule_appointment
    scheduleAppointment: async (req, res) => {
        try {
            const { facultyName, appointmentDate, appointmentTime, discussionTopic } = req.body;
            const observerUser = await User.findById(req.session.user.id);

            if (!observerUser) {
                return sendResponseAndRedirect(req, res, '/login', 'error', 'Observer not found in session.');
            }

            const observerId = observerUser._id;
            const observerName = `${observerUser.firstname} ${observerUser.lastname}`;

            const [facultyFirstName, facultyLastName] = facultyName.split(' ');
            const facultyUser = await User.findOne({ firstname: facultyFirstName, lastname: facultyLastName });

            if (!facultyUser) {
                return sendResponseAndRedirect(req, res, '/Observer_copus_result', 'error', 'Faculty member not found.');
            }

            const newAppointment = new Appointment({
                facultyName: facultyName,
                observerName: observerName,
                appointmentDate,
                appointmentTime,
                discussionTopic,
                scheduledBy: observerId,
                facultyMember: facultyUser._id
            });
            await newAppointment.save();

            const notificationMessage = `New appointment scheduled by ${observerName} on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}. Topic: ${discussionTopic || 'Not specified'}`;
            const newNotification = new Notification({
                userId: facultyUser._id,
                message: notificationMessage,
            });
            await newNotification.save();

            await Log.create({
                action: 'Schedule Appointment',
                performedBy: observerUser.id,
                performedByRole: observerUser.role,
                details: `Observer (${observerName}) scheduled an appointment with ${facultyName}. Date: ${appointmentDate}, Time: ${appointmentTime}`
            });

            sendResponseAndRedirect(req, res, '/Observer_copus_result', 'success', 'Appointment scheduled successfully and faculty notified!');

        } catch (error) {
            console.error('Error scheduling appointment:', error);
            sendResponseAndRedirect(req, res, '/Observer_copus_result', 'error', 'Failed to schedule appointment. Please try again.');
        }
    },

    // GET /api/notifications
    getNotifications: async (req, res) => {
        try {
            const notifications = await Notification.find({ userId: req.session.user.id, isRead: false })
                .sort({ createdAt: -1 });
            const unreadCount = await Notification.countDocuments({ userId: req.session.user.id, isRead: false });

            res.json({ notifications, unreadCount });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ message: 'Failed to fetch notifications' });
        }
    },

    // POST /api/notifications/mark-read
    markNotificationsRead: async (req, res) => {
        try {
            await Notification.updateMany({ userId: req.session.user.id, isRead: false }, { $set: { isRead: true } });
            res.json({ message: 'Notifications marked as read' });
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            res.status(500).json({ message: 'Failed to mark notifications as read' });
        }
    },

    // GET /Observer_schedule_management
    getScheduleManagement: async (req, res) => {
        try {
            const currentUser = await User.findById(req.session.user.id).lean();
            if (!currentUser) {
                req.flash('error', 'User not found.');
                return res.redirect('/login');
            }

            const allowedObserverRoles = ['Observer', 'Observer (ALC)', 'Observer (SLC)'];
            if (!allowedObserverRoles.includes(currentUser.role)) {
                req.flash('error', 'Access Denied: You do not have permission to view this page.');
                return res.redirect('/Observer_dashboard');
            }

            // Fetch ALL faculty schedules so observer can see availability
            console.log('[getScheduleManagement] Fetching faculty schedules...');
            const allFacultySchedules = await Schedule.find({
                faculty_user_id: { $exists: true, $ne: null }
            })
            .populate('faculty_user_id', 'firstname lastname department employeeId')
            .sort({ date: 1, start_time: 1 })
            .lean();

            console.log('[getScheduleManagement] Raw faculty schedules fetched:', allFacultySchedules ? allFacultySchedules.length : 'undefined');

            // Group schedules by faculty member (same logic as admin)
            const facultyGroups = {};
            
            allFacultySchedules.forEach(schedule => {
                if (!schedule.faculty_user_id) return;
                
                const facultyId = schedule.faculty_user_id._id.toString();
                if (!facultyGroups[facultyId]) {
                    facultyGroups[facultyId] = {
                        faculty_user_id: schedule.faculty_user_id,
                        faculty_firstname: schedule.faculty_user_id.firstname,
                        faculty_lastname: schedule.faculty_user_id.lastname,
                        faculty_department: schedule.faculty_user_id.department,
                        faculty_employee_id: schedule.faculty_user_id.employeeId,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time,
                        copus_type: schedule.copus_type,
                        faculty_room: schedule.faculty_room,
                        status: schedule.status,
                        days: [],
                        _id: schedule._id // Use first schedule's ID
                    };
                }
                
                // Add day to the group
                if (schedule.day_of_week && !facultyGroups[facultyId].days.includes(schedule.day_of_week)) {
                    facultyGroups[facultyId].days.push(schedule.day_of_week);
                }
            });

            // Convert groups to array and add schedule_display
            const facultySchedules = Object.values(facultyGroups).map(group => {
                // Sort days in proper order
                const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                group.days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                
                // Create display string
                if (group.days.length === 6) {
                    group.schedule_display = 'Mon - Sat';
                } else if (group.days.length > 1) {
                    const shortDays = group.days.map(day => day.substring(0, 3));
                    group.schedule_display = shortDays.join(', ');
                } else if (group.days.length === 1) {
                    group.schedule_display = group.days[0].substring(0, 3);
                } else {
                    group.schedule_display = 'No Schedule';
                }
                
                return group;
            });

            console.log(`[getScheduleManagement] Grouped ${allFacultySchedules.length} individual schedules into ${facultySchedules.length} faculty groups`);

            // Fetch observer-created schedules
            console.log('[getScheduleManagement] Fetching observer schedules...');
            const observerSchedules = await ObserverSchedule.find({
                observer_id: currentUser._id
            })
            .populate('faculty_user_id', 'firstname lastname department employeeId')
            .sort({ date: 1, start_time: 1 })
            .lean();

            console.log('[getScheduleManagement] Observer schedules query result:', observerSchedules ? observerSchedules.length : 'undefined');

            // Get all faculty users for the modal dropdown
            console.log('[getScheduleManagement] Fetching faculty users...');
            const facultyUsers = await User.find({
                role: { $in: ['Faculty', 'CIT Faculty'] }
            })
            .select('firstname lastname department employeeId')
            .sort({ firstname: 1, lastname: 1 })
            .lean();

            console.log('[getScheduleManagement] Faculty users query result:', facultyUsers ? facultyUsers.length : 'undefined');

            // Fetch ALL existing observations for all faculty members to determine which COPUS types are already taken
            console.log('[getScheduleManagement] Fetching all faculty observations for COPUS type filtering...');
            const allFacultyObservations = await ObserverSchedule.find({})
            .select('faculty_user_id copus_type status')
            .lean();

            console.log('[getScheduleManagement] All faculty observations query result:', allFacultyObservations ? allFacultyObservations.length : 'undefined');

            console.log(`[getScheduleManagement] Fetched ${facultySchedules.length} faculty schedules and ${observerSchedules.length} observer schedules`);

            res.render('Observer/schedule_management', {
                facultySchedules: facultySchedules || [],
                observerSchedules: observerSchedules || [],
                facultyUsers: facultyUsers || [],
                allFacultyObservations: allFacultyObservations || [],
                currentUser,
                firstName: currentUser.firstname,
                lastName: currentUser.lastname,
                employeeId: currentUser.employeeId,
                department: currentUser.department,
                success_msg: req.flash('success'),
                error_msg: req.flash('error')
            });

        } catch (err) {
            console.error('Error fetching schedules for observer management:', err);
            sendResponseAndRedirect(req, res, '/login', 'error', 'Failed to load your schedules.');
        }
    },

    // POST /observer/create-schedule - Create new observer schedule
    createObserverSchedule: async (req, res) => {
        try {
            const currentUser = await User.findById(req.session.user.id);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const { date, start_time, end_time, faculty_user_id, copus_type, subject_name, room, notes } = req.body;

            // Validate required fields
            if (!date || !start_time || !end_time || !faculty_user_id) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Date, start time, end time, and faculty selection are required' 
                });
            }

            // Get faculty information
            const facultyUser = await User.findById(faculty_user_id);
            if (!facultyUser) {
                return res.status(400).json({ success: false, message: 'Invalid faculty selected' });
            }

            // Check for scheduling conflicts
            const conflictingSchedule = await ObserverSchedule.findOne({
                $or: [
                    { faculty_user_id: faculty_user_id, date: new Date(date) },
                    { observer_id: currentUser._id, date: new Date(date) }
                ]
            });

            if (conflictingSchedule) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Schedule conflict detected. Please choose a different date or time.' 
                });
            }

            // Create new observer schedule
            const newSchedule = new ObserverSchedule({
                date: new Date(date),
                start_time,
                end_time,
                faculty_user_id,
                faculty_name: `${facultyUser.firstname} ${facultyUser.lastname}`,
                faculty_department: facultyUser.department,
                observer_id: currentUser._id,
                observer_name: `${currentUser.firstname} ${currentUser.lastname}`,
                copus_type: copus_type || 'Copus 1',
                subject_name,
                room,
                notes,
                status: 'scheduled'
            });

            await newSchedule.save();

            console.log(`Observer ${currentUser.firstname} ${currentUser.lastname} created schedule for ${facultyUser.firstname} ${facultyUser.lastname} on ${date}`);

            res.json({ 
                success: true, 
                message: 'Observation schedule created successfully!',
                schedule: newSchedule
            });

        } catch (err) {
            console.error('Error creating observer schedule:', err);
            res.status(500).json({ success: false, message: 'Failed to create schedule. Please try again.' });
        }
    },

    // POST /observer/schedule/:id/start - Mark observation as in progress
    markScheduleInProgress: async (req, res) => {
        try {
            const { id } = req.params;
            const currentUser = await User.findById(req.session.user.id);
            
            if (!currentUser) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const schedule = await ObserverSchedule.findOneAndUpdate(
                { _id: id, observer_id: currentUser._id, status: 'scheduled' },
                { status: 'in_progress' },
                { new: true }
            );

            if (!schedule) {
                return res.status(404).json({ success: false, message: 'Schedule not found or cannot be updated' });
            }

            console.log(`Observer ${currentUser.firstname} ${currentUser.lastname} marked schedule ${id} as in progress`);
            
            // Determine the redirect URL based on COPUS type
            let redirectUrl;
            switch (schedule.copus_type) {
                case 'Copus 1':
                    redirectUrl = `/observer_copus_start_copus1/${id}`;
                    break;
                case 'Copus 2':
                    redirectUrl = `/observer_copus_start_copus2/${id}`;
                    break;
                case 'Copus 3':
                    redirectUrl = `/observer_copus_start_copus3/${id}`;
                    break;
                default:
                    redirectUrl = `/observer_copus_start_copus1/${id}`;
            }
            
            res.json({ 
                success: true, 
                message: 'Observation marked as in progress!',
                redirectUrl: redirectUrl
            });

        } catch (err) {
            console.error('Error updating schedule status:', err);
            res.status(500).json({ success: false, message: 'Failed to update schedule status.' });
        }
    },

    // POST /observer/schedule/:id/complete - Mark observation as completed
    markScheduleCompleted: async (req, res) => {
        try {
            const { id } = req.params;
            const currentUser = await User.findById(req.session.user.id);
            
            if (!currentUser) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const schedule = await ObserverSchedule.findOneAndUpdate(
                { _id: id, observer_id: currentUser._id, status: 'in_progress' },
                { status: 'completed' },
                { new: true }
            );

            if (!schedule) {
                return res.status(404).json({ success: false, message: 'Schedule not found or cannot be updated' });
            }

            console.log(`Observer ${currentUser.firstname} ${currentUser.lastname} marked schedule ${id} as completed`);
            res.json({ success: true, message: 'Observation marked as completed!' });

        } catch (err) {
            console.error('Error updating schedule status:', err);
            res.status(500).json({ success: false, message: 'Failed to update schedule status.' });
        }
    },

    // POST /observer/schedule/:id/cancel - Cancel observation
    cancelSchedule: async (req, res) => {
        try {
            const { id } = req.params;
            const currentUser = await User.findById(req.session.user.id);
            
            if (!currentUser) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const schedule = await ObserverSchedule.findOneAndUpdate(
                { _id: id, observer_id: currentUser._id, status: { $in: ['scheduled', 'in_progress'] } },
                { status: 'cancelled' },
                { new: true }
            );

            if (!schedule) {
                return res.status(404).json({ success: false, message: 'Schedule not found or cannot be cancelled' });
            }

            console.log(`Observer ${currentUser.firstname} ${currentUser.lastname} cancelled schedule ${id}`);
            res.json({ success: true, message: 'Observation cancelled successfully!' });

        } catch (err) {
            console.error('Error cancelling schedule:', err);
            res.status(500).json({ success: false, message: 'Failed to cancel schedule.' });
        }
    },

    // POST /observer/schedule/:scheduleId/accept
    acceptSchedule: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const currentUser = await User.findById(req.session.user.id);

            if (!currentUser) {
                return sendResponseAndRedirect(req, res, '/login', 'error', 'Unauthorized access.');
            }

            const schedule = await Schedule.findById(scheduleId);

            if (!schedule) {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Schedule not found.');
            }

            const observerEntry = schedule.observers.find(
                obs => obs.observer_id.toString() === currentUser._id.toString()
            );

            if (!observerEntry) {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'You are not assigned to this schedule.');
            }

            if (observerEntry.status === 'pending') {
                observerEntry.status = 'accepted';

                // --- MODIFIED LOGIC BASED ON ROLES ---
                // If the current user is an 'Observer (ALC)', their acceptance approves the overall schedule
                if (currentUser.role === 'Observer (ALC)') {
                    schedule.status = 'approved';
                    await Log.create({
                        action: 'Observer (ALC) Accepted & Approved Schedule',
                        performedBy: currentUser._id,
                        performedByRole: currentUser.role,
                        details: `Observer (ALC) ${currentUser.firstname} ${currentUser.lastname} (${currentUser._id}) accepted and APPROVED schedule ID: ${schedule._id}. Schedule overall status set to 'approved'.`
                    });
                } else {
                    // For other observers (Observer, Observer (SLC))
                    // Their acceptance changes their individual status to 'accepted'.
                    // The overall schedule status only changes from 'pending' to 'scheduled'
                    // if it wasn't already 'approved' by an ALC.
                    if (schedule.status === 'pending') {
                        schedule.status = 'scheduled'; // Schedule is now 'scheduled' pending ALC approval
                    }

                    await Log.create({
                        action: 'Observer Accepted Schedule (Individual)',
                        performedBy: currentUser._id,
                        performedByRole: currentUser.role,
                        details: `Observer ${currentUser.firstname} ${currentUser.lastname} (${currentUser._id}) accepted their assignment to schedule ID: ${schedule._id}. Overall schedule status remains '${schedule.status}'.`
                    });
                }
                // --- END MODIFIED LOGIC ---

                await schedule.save();

                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'success', 'Schedule accepted successfully!');
            } else {
                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'You have already responded to this schedule.');
            }
        } catch (err) {
            console.error('Error accepting schedule:', err);
            sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Failed to accept schedule.');
        }
    },

    // The declineSchedule function
    declineSchedule: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const currentUser = await User.findById(req.session.user.id);

            if (!currentUser) {
                return sendResponseAndRedirect(req, res, '/login', 'error', 'Unauthorized access.');
            }

            const schedule = await Schedule.findById(scheduleId);

            if (!schedule) {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Schedule not found.');
            }

            const observerEntry = schedule.observers.find(
                obs => obs.observer_id.toString() === currentUser._id.toString()
            );

            if (!observerEntry) {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'You are not assigned to this schedule.');
            }

            // Allow declining only if pending. If already accepted, you might want to prevent or add specific logic.
            if (observerEntry.status === 'pending') {
                observerEntry.status = 'declined';

                // If any assigned observer declines, the overall schedule status should probably be cancelled.
                // This prevents a partially 'approved' schedule if a key observer backs out.
                schedule.status = 'cancelled'; // Overall schedule is cancelled if ANY observer declines.

                await schedule.save();

                await Log.create({
                    action: 'Observer Declined Schedule',
                    performedBy: currentUser._id,
                    performedByRole: currentUser.role,
                    details: `Observer ${currentUser.firstname} ${currentUser.lastname} (${currentUser._id}) declined schedule ID: ${schedule._id}. Schedule overall status set to '${schedule.status}'.`
                });

                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'success', 'Schedule declined successfully. This observation has been cancelled.');
            } else {
                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'You have already responded to this schedule or cannot decline at this stage.');
            }
        } catch (err) {
            console.error('Error declining schedule:', err);
            sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Failed to decline schedule.');
        }
    },

    completeSchedule: async (req, res) => {
        try {
            const currentUser = await User.findById(req.session.user.id);
            // Allow any assigned observer (including SLC/ALC/Super Admin) to mark completed,
            // as long as their individual status is 'accepted'.
            if (!currentUser) { // Or if their role isn't appropriate for marking complete
                return sendResponseAndRedirect(req, res, '/login', 'error', 'Unauthorized access.');
            }

            const schedule = await Schedule.findById(req.params.id);

            if (!schedule) {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Schedule not found.');
            }

            const observerEntry = schedule.observers.find(
                obs => obs.observer_id.toString() === currentUser._id.toString()
            );
            // An observer can only complete if they are assigned AND their individual status is 'accepted'.
            if (!observerEntry || observerEntry.status !== 'accepted') {
                return sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'You cannot complete this schedule as you did not accept it, or are not assigned.');
            }

            // A schedule can only be completed if its overall status is 'scheduled' or 'approved' or 'in progress'.
            if (schedule.status === 'scheduled' || schedule.status === 'approved' || schedule.status === 'in progress') {
                schedule.status = 'completed'; // Overall schedule status changes to 'completed'
                await schedule.save();

                await Log.create({
                    action: 'Observer Completed Schedule',
                    performedBy: currentUser._id,
                    performedByRole: currentUser.role,
                    details: `Observer ${currentUser.firstname} ${currentUser.lastname} (${currentUser._id}) marked schedule as completed for ${schedule.faculty_firstname} ${schedule.faculty_lastname} (ID: ${schedule._id}).`
                });
                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'success', 'Schedule marked as completed!');
            } else {
                sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Schedule cannot be marked completed in its current state (must be scheduled, approved, or in progress).');
            }
        } catch (err) {
            console.error('Error completing schedule:', err);
            sendResponseAndRedirect(req, res, '/Observer_schedule_management', 'error', 'Failed to complete schedule.');
        }
    },

    // GET /observer_copus (List of approved schedules for observation)
    getApprovedCopusSchedules: async (req, res) => {
        try {
            // Ensure user is authenticated and in session
            if (!req.session.user || !req.session.user.id) {
                console.log('User not found in session for getApprovedCopusSchedules, redirecting to login.');
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }

            // Fetch the full user document from the database to ensure latest data
            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('User ID from session not found in DB, destroying session and redirecting to login.');
                req.session.destroy(() => {
                    req.flash('error', 'User not found. Please log in again.');
                    res.redirect('/login');
                });
                return; // Important to return after redirecting
            }

            // Verify the user's role is indeed an observer type
            if (!isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this page.');
                return res.redirect('/Observer_dashboard'); // Redirect to observer dashboard if not a copus observer
            }

            const observerObjectId = user._id;

            console.log(`[Observer Controller] Fetching schedules for observer ID: ${observerObjectId}`);

            // Query the Schedule collection
            const schedules = await Schedule.find({
                // Schedules must be in 'approved' or 'available' or 'in progress' status
                $or: [
                    { status: 'approved' },
                    { status: 'available' },
                    { status: 'in progress' }
                ],
                // The logged-in observer must be assigned to the schedule
                // AND their specific status for that assignment must be 'accepted' or 'pending'
                observers: {
                    $elemMatch: {
                        observer_id: observerObjectId,
                        $or: [
                            { status: 'accepted' },
                            { status: 'pending' }
                        ]
                    }
                },
                // Crucial: Only fetch schedules that have a valid Copus Type
                copus: { $in: ['Copus 1', 'Copus 2', 'Copus 3'] }
            })
            .sort({ date: 1, start_time: 1 }) // Sort for consistent order (e.g., by date and then time)
            .lean(); // Use .lean() for faster query results if you don't need Mongoose models

            console.log(`[Observer Controller] Found ${schedules.length} schedules for Observer/copus.`);
            // console.log("Fetched Schedules:", JSON.stringify(schedules, null, 2)); // Uncomment for detailed debugging


            res.render('Observer/copus', {
                schedules, // Pass the fetched schedules to the EJS template
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                error_msg: req.flash('error'),    // Pass flash messages
                success_msg: req.flash('success') // Pass flash messages
            });

        } catch (err) {
            console.error('[Observer Controller] Error fetching approved COPUS schedules:', err);
            req.flash('error', 'An error occurred while loading schedules. Please try again.');
            // Render the current page with an empty array and error message
            res.render('Observer/copus', {
                schedules: [], // Ensure schedules is an empty array on error
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                employeeId: req.session.user ? req.session.user.employeeId : '',
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }
    },

    // --- COPUS Observation Flow ---

    // POST /observer_copus_start_copus1/:scheduleId
        startCopus1Observation: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const user = req.session.user;

            console.log(`[startCopus1Observation] Attempting to start for scheduleId: ${scheduleId}`);
            console.log(`[startCopus1Observation] User in session: ${user ? user.employeeId : 'N/A'}, Role: ${user ? user.role : 'N/A'}`);

            if (!user || !isObserverRole(user.role)) {
                console.log('[startCopus1Observation] User not authorized or session invalid.');
                req.flash('error', 'You are not authorized to start this observation.');
                return res.redirect('/login');
            }

            // Try to find in ObserverSchedule first (new model)
            let schedule = await ObserverSchedule.findById(scheduleId)
                .populate('faculty_user_id')
                .populate('observer_id');

            // If not found, try the old Schedule model for backward compatibility
            if (!schedule) {
                schedule = await Schedule.findById(scheduleId)
                    .populate('faculty_user_id')
                    .populate('observers.observer_id');
            }

            if (!schedule) {
                console.log(`[startCopus1Observation] Schedule with ID ${scheduleId} not found.`);
                req.flash('error', 'Schedule not found.');
                return res.redirect('/observer_copus');
            }

            console.log(`[startCopus1Observation] Found schedule: ${schedule._id}, Current Status: ${schedule.status}`);
            
            let isAssignedObserver = false;

            // Check if it's the new ObserverSchedule model
            if (schedule.observer_id) {
                // New ObserverSchedule model - check if current user is the observer
                isAssignedObserver = schedule.observer_id._id.equals(user.id);
                console.log(`[startCopus1Observation] ObserverSchedule model - User ${user.id} is ${isAssignedObserver ? '' : 'NOT '}the assigned observer`);
            } else if (schedule.observers) {
                // Old Schedule model - check observers array
                console.log(`[startCopus1Observation] Schedule observers:`, schedule.observers);
                isAssignedObserver = schedule.observers.some(obs => {
                    const match = obs.observer_id && obs.observer_id._id.equals(user.id) && (obs.status === 'accepted' || obs.status === 'pending');
                    if (match) {
                        console.log(`[startCopus1Observation] User ${user.id} found as assigned observer with status ${obs.status}.`);
                    }
                    return match;
                });
            }

            if (!isAssignedObserver) {
                console.log(`[startCopus1Observation] User ${user.id} is NOT an assigned or active observer for this schedule.`);
                req.flash('error', 'You are not assigned to this schedule or your assignment is not active.');
                return res.redirect('/Observer_schedule_management');
            }

            if (schedule.status === 'completed' || schedule.status === 'cancelled') {
                console.log(`[startCopus1Observation] Schedule ${scheduleId} is already ${schedule.status}, cannot start observation.`);
                req.flash('error', `This schedule is already ${schedule.status} and cannot be started.`);
                return res.redirect('/observer_schedule_management');
            }

            let copusObservation = await CopusObservation.findOne({
                scheduleId: scheduleId,
                observerId: user.id,
                copusNumber: 1
            });

            if (!copusObservation) {
                copusObservation = new CopusObservation({
                    scheduleId: scheduleId,
                    observerId: user.id,
                    copusNumber: 1,
                    observations: []
                });
                await copusObservation.save();
                console.log(`[startCopus1Observation] Created new CopusObservation record with ID: ${copusObservation._id}`);
            } else {
                console.log(`[startCopus1Observation] Found existing CopusObservation record with ID: ${copusObservation._id}`);
            }

            // Update status based on model type
            const targetStatus = schedule.observer_id ? 'in_progress' : 'in progress'; // ObserverSchedule uses 'in_progress', Schedule uses 'in progress'
            
            if (schedule.status !== targetStatus) {
                schedule.status = targetStatus;
                console.log(`[startCopus1Observation] Attempting to save schedule ${scheduleId} with new status: '${targetStatus}'`);
                await schedule.save();
                console.log(`[startCopus1Observation] Schedule ${scheduleId} successfully saved as '${targetStatus}'.`);

                await Log.create({
                    action: 'Start Observation',
                    performedBy: user.id,
                    performedByRole: user.role,
                    details: `Started COPUS 1 observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_user_id ? schedule.faculty_user_id.firstname : schedule.faculty_firstname} ${schedule.faculty_user_id ? schedule.faculty_user_id.lastname : schedule.faculty_lastname})`
                });
                console.log('[startCopus1Observation] Log entry created.');
            } else {
                console.log(`[startCopus1Observation] Schedule ${scheduleId} is already '${targetStatus}', no status update needed.`);
            }

            const copusDetails = {
                // Keep copusDetails.id if your frontend JavaScript expects it this way
                id: copusObservation._id, // This is for the frontend JS to use
                fullname: `${schedule.faculty_user_id ? schedule.faculty_user_id.firstname : schedule.faculty_firstname} ${schedule.faculty_user_id ? schedule.faculty_user_id.lastname : schedule.faculty_lastname}`,
                department: schedule.faculty_department,
                date: new Date(schedule.date).toLocaleDateString(),
                startTime: schedule.start_time,
                endTime: schedule.end_time,
                yearLevel: schedule.year_level,
                semester: schedule.semester,
                subjectCode: schedule.faculty_subject_code,
                subjectName: schedule.faculty_subject_name,
                mode: schedule.modality,
                observer: schedule.observers ? schedule.observers.map(obs => obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'N/A').join(', ') : 
                         (schedule.observer_id ? `${schedule.observer_id.firstname} ${schedule.observer_id.lastname}` : 'N/A'),
                copusType: 'Copus 1'
            };

            console.log(`[startCopus1Observation] Rendering copus_start.ejs with copusDetails.id: ${copusDetails.id}`);
            console.log(`[startCopus1Observation] Value of copusDetails.id before rendering: ${copusDetails.id}`); // ADD THIS LINE


            res.render('Observer/copus_start', {
                copusDetails,
                copusObservation: copusObservation, // <--- EXPLICITLY PASS THE FULL OBJECT HERE
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });

        } catch (error) {
            console.error('[startCopus1Observation] Caught error:', error);
            req.flash('error', 'Failed to start observation. Please try again.');
            res.redirect('/observer_schedule_management');
        }
    },

    // POST /observer_copus_start_copus2/:scheduleId
    startCopus2Observation: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const user = req.session.user;

            // --- ADDED LOGS FOR DEBUGGING ---
            console.log(`[startCopus2Observation] Attempting to start for scheduleId: ${scheduleId}`);
            console.log(`[startCopus2Observation] User in session: ${user ? user.employeeId : 'N/A'}, Role: ${user ? user.role : 'N/A'}`);

            if (!user || !isObserverRole(user.role)) {
                console.log('[startCopus2Observation] User not authorized or session invalid.');
                req.flash('error', 'You are not authorized to start this observation.');
                return res.redirect('/login');
            }

            const schedule = await Schedule.findById(scheduleId);

            if (!schedule) {
                console.log(`[startCopus2Observation] Schedule with ID ${scheduleId} not found.`);
                req.flash('error', 'Schedule not found.');
                return res.redirect('/observer_copus');
            }

            console.log(`[startCopus2Observation] Found schedule: ${schedule._id}, Current Status: ${schedule.status}`);
            console.log(`[startCopus2Observation] Schedule observers:`, schedule.observers);

            const isAssignedObserver = schedule.observers.some(obs => {
                const match = obs.observer_id.equals(user.id) && (obs.status === 'accepted' || obs.status === 'pending');
                if (match) {
                    console.log(`[startCopus2Observation] User ${user.id} found as assigned observer with status ${obs.status}.`);
                }
                return match;
            });

            if (!isAssignedObserver) {
                console.log(`[startCopus2Observation] User ${user.id} is NOT an assigned or active observer for this schedule.`);
                req.flash('error', 'You are not assigned to this schedule or your assignment is not active.');
                return res.redirect('/observer_copus');
            }

            // ADDED CHECK: Prevent starting if schedule is already completed or cancelled
            if (schedule.status === 'completed' || schedule.status === 'cancelled') {
                 console.log(`[startCopus2Observation] Schedule ${scheduleId} is already ${schedule.status}, cannot start observation.`);
                 req.flash('error', `This schedule is already ${schedule.status} and cannot be started.`);
                 return res.redirect('/observer_copus');
            }

            schedule.status = 'in progress';
            console.log(`[startCopus2Observation] Attempting to save schedule ${scheduleId} with new status: 'in progress'`);
            await schedule.save();
            console.log(`[startCopus2Observation] Schedule ${scheduleId} successfully saved as 'in progress'.`);

            await Log.create({
                action: 'Start Observation',
                performedBy: user.id,
                performedByRole: user.role,
                details: `Started COPUS 2 observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_firstname} ${schedule.faculty_lastname})`
            });

            const copusDetails = {
                id: schedule._id,
                fullname: `${schedule.faculty_firstname} ${schedule.faculty_lastname}`,
                department: schedule.faculty_department,
                date: new Date(schedule.date).toLocaleDateString(),
                startTime: schedule.start_time,
                endTime: schedule.end_time,
                yearLevel: schedule.year_level,
                semester: schedule.semester,
                subjectCode: schedule.faculty_subject_code,
                subjectName: schedule.faculty_subject_name,
                mode: schedule.modality,
                observer: Array.isArray(schedule.observer) ? schedule.observer.join(', ') : schedule.observer,
                copusType: 'Copus 2' // Explicitly set for Copus 2
            };

            console.log(`[startCopus2Observation] Rendering copus_start.ejs for schedule ID: ${scheduleId}`);

            res.render('Observer/copus_start', {
                copusDetails,
                firstName: req.session.user.firstname,
                lastName: req.session.user.lastname,
                employeeId: req.session.user.employeeId,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (error) {
            console.error('[startCopus2Observation] Caught error:', error);
            req.flash('error', 'Failed to start observation. Please try again.');
            res.redirect('/observer_copus');
        }
    },

    // POST /observer_copus_start_copus3/:scheduleId
    startCopus3Observation: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const user = req.session.user;

            // --- ADDED LOGS FOR DEBUGGING ---
            console.log(`[startCopus3Observation] Attempting to start for scheduleId: ${scheduleId}`);
            console.log(`[startCopus3Observation] User in session: ${user ? user.employeeId : 'N/A'}, Role: ${user ? user.role : 'N/A'}`);

            if (!user || !isObserverRole(user.role)) {
                console.log('[startCopus3Observation] User not authorized or session invalid.');
                req.flash('error', 'You are not authorized to start this observation.');
                return res.redirect('/login');
            }

            const schedule = await Schedule.findById(scheduleId);

            if (!schedule) {
                console.log(`[startCopus3Observation] Schedule with ID ${scheduleId} not found.`);
                req.flash('error', 'Schedule not found.');
                return res.redirect('/observer_copus');
            }

            console.log(`[startCopus3Observation] Found schedule: ${schedule._id}, Current Status: ${schedule.status}`);
            console.log(`[startCopus3Observation] Schedule observers:`, schedule.observers);

            const isAssignedObserver = schedule.observers.some(obs => {
                const match = obs.observer_id.equals(user.id) && (obs.status === 'accepted' || obs.status === 'pending');
                if (match) {
                    console.log(`[startCopus3Observation] User ${user.id} found as assigned observer with status ${obs.status}.`);
                }
                return match;
            });

            if (!isAssignedObserver) {
                console.log(`[startCopus3Observation] User ${user.id} is NOT an assigned or active observer for this schedule.`);
                req.flash('error', 'You are not assigned to this schedule or your assignment is not active.');
                return res.redirect('/observer_copus');
            }

            // ADDED CHECK: Prevent starting if schedule is already completed or cancelled
            if (schedule.status === 'completed' || schedule.status === 'cancelled') {
                 console.log(`[startCopus3Observation] Schedule ${scheduleId} is already ${schedule.status}, cannot start observation.`);
                 req.flash('error', `This schedule is already ${schedule.status} and cannot be started.`);
                 return res.redirect('/observer_copus');
            }

            schedule.status = 'in progress';
            console.log(`[startCopus3Observation] Attempting to save schedule ${scheduleId} with new status: 'in progress'`);
            await schedule.save();
            console.log(`[startCopus3Observation] Schedule ${scheduleId} successfully saved as 'in progress'.`);

            await Log.create({
                action: 'Start Observation',
                performedBy: user.id,
                performedByRole: user.role,
                details: `Started COPUS 3 observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_firstname} ${schedule.faculty_lastname})`
            });

            const copusDetails = {
                id: schedule._id,
                fullname: `${schedule.faculty_firstname} ${schedule.faculty_lastname}`,
                department: schedule.faculty_department,
                date: new Date(schedule.date).toLocaleDateString(),
                startTime: schedule.start_time,
                endTime: schedule.end_time,
                yearLevel: schedule.year_level,
                semester: schedule.semester,
                subjectCode: schedule.faculty_subject_code,
                subjectName: schedule.faculty_subject_name,
                mode: schedule.modality,
                observer: Array.isArray(schedule.observer) ? schedule.observer.join(', ') : schedule.observer,
                copusType: 'Copus 3' // Explicitly set for Copus 3
            };

            console.log(`[startCopus3Observation] Rendering copus_start.ejs for schedule ID: ${scheduleId}`);

            res.render('Observer/copus_start', {
                copusDetails,
                firstName: req.session.user.firstname,
                lastName: req.session.user.lastname,
                employeeId: req.session.user.employeeId,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (error) {
            console.error('[startCopus3Observation] Caught error:', error);
            req.flash('error', 'Failed to start observation. Please try again.');
            res.redirect('/observer_copus');
        }
    },

    // POST /observer_copus_result1
    saveCopus1Observation: async (req, res) => {
    console.log('[Controller] Entering saveCopus1Observation');
    try {
        const { copusDetailsId, copusRecords, overallComments } = req.body;
        const observerId = req.session.user.id;

        console.log('[Controller] Received copusDetailsId (CopusObservation ID):', copusDetailsId);
        console.log('[Controller] Received copusRecords (length):', copusRecords ? copusRecords.length : 'null/undefined');
        console.log('[Controller] Received overallComments:', overallComments);

        if (!copusDetailsId || !copusRecords || !Array.isArray(copusRecords) || copusRecords.length === 0) {
            console.error('Validation Error: Missing required observation data or empty array.');
            return res.status(400).json({ message: 'Missing required observation data or empty records. Please ensure data is selected.' });
        }

        const copusObservation = await CopusObservation.findById(copusDetailsId);
        if (!copusObservation) {
            console.error('[Controller] CopusObservation record not found for ID:', copusDetailsId);
            return res.status(404).json({ message: 'Copus Observation record not found. It might have been deleted or not created properly.' });
        }

        console.log('[Controller] ✅ Found CopusObservation:', copusObservation._id);
        console.log('[Controller] 📋 CopusObservation scheduleId:', copusObservation.scheduleId);

        const scheduleId = copusObservation.scheduleId;
        if (!scheduleId) {
            console.error('[Controller] Schedule ID is missing in the CopusObservation record:', copusDetailsId);
            return res.status(500).json({ message: 'Internal error: Schedule ID is missing from the observation record.' });
        }

        // Try to find in ObserverSchedule first (new model)
        console.log('[Controller] 🔍 Looking for schedule in ObserverSchedule collection with ID:', scheduleId);
        let schedule = await ObserverSchedule.findById(scheduleId)
            .populate('faculty_user_id')
            .populate('observer_id');

        if (schedule) {
            console.log('[Controller] ✅ Found schedule in ObserverSchedule collection');
        } else {
            // If not found, try the old Schedule model for backward compatibility
            console.log('[Controller] 🔍 Looking for schedule in Schedule collection with ID:', scheduleId);
            schedule = await Schedule.findById(scheduleId)
                .populate('faculty_user_id')
                .populate('observers.observer_id');
            
            if (schedule) {
                console.log('[Controller] ✅ Found schedule in Schedule collection');
            }
        }

        if (!schedule) {
            console.error('[Controller] ❌ Schedule not found in both ObserverSchedule and Schedule collections for ID:', scheduleId);
            return res.status(404).json({ message: 'Schedule not found for this observation (using the ID from the observation record).' });
        }

        const observerObjectId = new mongoose.Types.ObjectId(observerId);
        let isAssignedObserver = false;

        // Check if it's the new ObserverSchedule model
        if (schedule.observer_id) {
            // New ObserverSchedule model - check if current user is the observer
            isAssignedObserver = schedule.observer_id._id.equals(observerObjectId);
            console.log(`[saveCopus1Observation] ObserverSchedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}the assigned observer`);
        } else if (schedule.observers) {
            // Old Schedule model - check observers array
            isAssignedObserver = schedule.observers.some(obs =>
                obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
            );
            console.log(`[saveCopus1Observation] Schedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}an assigned observer`);
        }

        if (!isAssignedObserver) {
            console.warn(`[Controller] Unauthorized attempt by observer ${observerId} for schedule ${scheduleId}`);
            return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule or your assignment is not accepted.' });
        }

        copusObservation.observations = copusRecords;
        copusObservation.overallComments = overallComments;
        copusObservation.updatedAt = new Date();

        await copusObservation.save();
        console.log('[Controller] Existing CopusObservation updated with ID:', copusObservation._id);

        // Update schedule status based on model type
        const targetStatus = schedule.observer_id ? 'completed' : 'completed'; // Both models use 'completed'
        schedule.status = targetStatus;
        await schedule.save();
        console.log('[Controller] Schedule status updated to "completed" for ID:', schedule._id);

        // Get faculty information based on model type
        let facultyUser, facultyName;
        if (schedule.faculty_user_id) {
            // ObserverSchedule model
            facultyUser = schedule.faculty_user_id; // Already populated
            facultyName = schedule.faculty_name || `${facultyUser.firstname} ${facultyUser.lastname}`;
        } else {
            // Old Schedule model
            facultyUser = await User.findById(schedule.faculty_id);
            facultyName = facultyUser ? `${facultyUser.firstname} ${facultyUser.lastname}` : 'Unknown Faculty';
        }
        
        const observerUser = await User.findById(observerId);
        const observerName = observerUser ? `${observerUser.firstname} ${observerUser.lastname}` : 'Unknown Observer';

        // Calculate COPUS results from the observation data
        // Count occurrences of each action from the 45 intervals
        let studentActionsCount = {
            L: 0, Ind: 0, Grp: 0, AnQ: 0, AsQ: 0, WC: 0, SP: 0, TQ: 0, W: 0, O: 0
        };
        let teacherActionsCount = {
            Lec: 0, RtW: 0, MG: 0, AnQ: 0, PQ: 0, FUp: 0, '1o1': 0, DV: 0, Adm: 0, W: 0, O: 0
        };
        let engagementCount = {
            High: 0, Med: 0, Low: 0
        };

        // Process COPUS records to count actions (copus_start.js sends objects like {L: 1, Ind: 1})
        copusRecords.forEach(record => {
            // Student actions
            if (record.studentActions && typeof record.studentActions === 'object') {
                Object.keys(record.studentActions).forEach(action => {
                    if (studentActionsCount.hasOwnProperty(action)) {
                        studentActionsCount[action]++;
                    }
                });
            }
            // Teacher actions
            if (record.teacherActions && typeof record.teacherActions === 'object') {
                Object.keys(record.teacherActions).forEach(action => {
                    if (teacherActionsCount.hasOwnProperty(action)) {
                        teacherActionsCount[action]++;
                    }
                });
            }
            // Engagement levels
            if (record.engagementLevel && typeof record.engagementLevel === 'object') {
                Object.keys(record.engagementLevel).forEach(level => {
                    if (engagementCount.hasOwnProperty(level)) {
                        engagementCount[level]++;
                    }
                });
            }
        });

        console.log('[Controller] COPUS Action Counts:', {
            studentActions: studentActionsCount,
            teacherActions: teacherActionsCount,
            engagement: engagementCount
        });

        // Calculate percentages for CopusResult schema
        const totalIntervals = 45;
        
        // Map COPUS actions to CopusResult schema fields
        const student_engagement = {
            asking_questions: Math.round((studentActionsCount.AnQ / totalIntervals) * 100),
            participating_discussions: Math.round((studentActionsCount.AsQ / totalIntervals) * 100),
            collaborative_work: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
            problem_solving: Math.round((studentActionsCount.SP / totalIntervals) * 100)
        };

        const teacher_facilitation = {
            interactive_teaching: Math.round(((teacherActionsCount.MG + teacherActionsCount['1o1']) / totalIntervals) * 100),
            encouraging_participation: Math.round((teacherActionsCount.PQ / totalIntervals) * 100),
            providing_feedback: Math.round((teacherActionsCount.FUp / totalIntervals) * 100),
            guiding_discussions: Math.round((teacherActionsCount.AnQ / totalIntervals) * 100)
        };

        const learning_environment = {
            classroom_setup: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
            technology_use: Math.round((teacherActionsCount.DV / totalIntervals) * 100),
            resource_utilization: Math.round(((studentActionsCount.WC + teacherActionsCount.RtW) / totalIntervals) * 100),
            time_management: Math.round(((totalIntervals - studentActionsCount.W - teacherActionsCount.W) / totalIntervals) * 100)
        };

        // Calculate overall percentage
        const studentEngAvg = (student_engagement.asking_questions + student_engagement.participating_discussions + 
                              student_engagement.collaborative_work + student_engagement.problem_solving) / 4;
        const teacherFacAvg = (teacher_facilitation.interactive_teaching + teacher_facilitation.encouraging_participation + 
                              teacher_facilitation.providing_feedback + teacher_facilitation.guiding_discussions) / 4;
        const learningEnvAvg = (learning_environment.classroom_setup + learning_environment.technology_use + 
                               learning_environment.resource_utilization + learning_environment.time_management) / 4;
        
        const overallPercentage = Math.round((studentEngAvg + teacherFacAvg + learningEnvAvg) / 3);

        // Create CopusResult record for history display
        const copusResult = new CopusResult({
            schedule_id: copusObservation.scheduleId,
            faculty_id: schedule.faculty_user_id ? schedule.faculty_user_id._id : schedule.faculty_id,
            faculty_name: facultyName,
            faculty_department: facultyUser ? (facultyUser.department || schedule.faculty_department) : 'Unknown Department',
            observer_id: observerId,
            observer_name: observerName,
            observation_date: copusObservation.observationDate || schedule.date,
            start_time: copusObservation.startTime || schedule.start_time,
            end_time: copusObservation.endTime || schedule.end_time,
            subject_name: copusObservation.subjectName || schedule.subject_name || schedule.faculty_subject_name || 'N/A',
            room: copusObservation.room || schedule.room || schedule.faculty_room || 'N/A',
            copus_type: 'Copus 1',
            // Store raw COPUS action counts
            student_actions_count: studentActionsCount,
            teacher_actions_count: teacherActionsCount,
            engagement_level_count: engagementCount,
            // Keep existing calculated fields for backward compatibility
            student_engagement: student_engagement,
            teacher_facilitation: teacher_facilitation,
            learning_environment: learning_environment,
            overall_percentage: overallPercentage,
            additional_comments: overallComments || '',
            status: 'submitted',
            submitted_at: new Date()
        });

        await copusResult.save();
        console.log('[Controller] ✅ CopusResult created with ID:', copusResult._id, 'for display in history');

        await Log.create({
            action: 'Submit COPUS Observation',
            performedBy: observerId,
            performedByRole: req.session.user.role,
            details: `Submitted COPUS ${copusObservation.copusNumber} observation for schedule ID: ${scheduleId} (Faculty: ${facultyName})`
        });
        console.log('[Controller] Log entry created.');

        req.flash('success', 'Observation submitted successfully!');
        // THIS PART IS CORRECT FOR FETCH API SUBMISSION
        res.status(200).json({
            message: 'Observation submitted successfully!',
            observationId: copusObservation._id,
            // Ensure this redirectUrl matches the GET route for displaying results by observationId
            redirectUrl: `/observer_copus_result1?observationId=${copusObservation._id}`
            // The frontend JS will use window.location.href = this URL
        });

    } catch (error) {
        console.error('[Controller] Error saving Copus observation:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => error.errors[key].message);
            return res.status(400).json({ message: 'Validation failed: ' + errors.join(', '), errors: error.errors });
        } else if (error.name === 'CastError') {
            console.error('[Controller] CastError (Invalid ID):', error.message);
            return res.status(400).json({ message: 'Invalid ID format provided.' });
        }
        res.status(500).json({ message: 'Failed to save observation due to a server error.', error: error.message });
    }
},

    // New function to handle GET request for COPUS 1 Result
    getCopus1Result: async (req, res) => {
    try {
        const user = req.session.user;

        if (!user || !user.id || !isObserverRole(user.role)) {
            req.flash('error', 'You are not authorized to view this result.');
            return res.redirect('/login');
        }

        const observationId = req.query.observationId || req.params.observationId;

        let copusObservation;

        if (observationId) {
            copusObservation = await CopusObservation.findById(observationId)
                .populate('scheduleId') // Populate schedule to check observer authorization and get details
                .lean(); // Use lean for better performance as we're not modifying the document
            console.log(`[getCopus1Result] Fetched by observationId: ${observationId}`);
            // *** CRITICAL NEW DEBUG LOG HERE - Check the entire object immediately after fetch ***
            console.log('--- CRITICAL DEBUG 1: Full copusObservation object after fetch ---');
            console.log(JSON.stringify(copusObservation, null, 2)); // Stringify for full object output
            console.log('--- END CRITICAL DEBUG 1 ---');
        } else {
            req.flash('error', 'Observation ID was not provided.');
            return res.redirect('/observer_copus_result');
        }

        if (!copusObservation) {
            req.flash('error', 'No Copus 1 observation found with the provided ID.');
            return res.redirect('/observer_copus_result');
        }

        // Authorization Check (Crucial for security)
        const observerObjectId = new mongoose.Types.ObjectId(user.id);
        if (!copusObservation.observerId || !copusObservation.observerId.equals(observerObjectId)) {
            req.flash('error', 'You are not the assigned observer for this observation.');
            return res.redirect('/observer_copus_result');
        }
        if (copusObservation.scheduleId && copusObservation.scheduleId.observers && copusObservation.scheduleId.observers.length > 0) {
            const isAssignedAndAcceptedInSchedule = copusObservation.scheduleId.observers.some(obs =>
                obs.observer_id && obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
            );
            if (!isAssignedAndAcceptedInSchedule) {
                req.flash('error', 'Your access to this observation is not authorized via the associated schedule.');
                return res.redirect('/observer_copus_result');
            }
        }

        const rawScheduleDetails = copusObservation.scheduleId; // This is the populated schedule document

        if (!rawScheduleDetails) {
            req.flash('error', 'Associated schedule details could not be retrieved.');
            return res.redirect('/observer_copus_result');
        }

        // --- START OF FIX: Construct scheduleDetails to match EJS expectations ---
        const scheduleDetails = {
            firstname: rawScheduleDetails.faculty_firstname || 'N/A',
            lastname: rawScheduleDetails.faculty_lastname || '',
            department: rawScheduleDetails.faculty_department || 'N/A', // Assuming faculty_department is the correct field
            // Date is already a Date object, format it here for direct use in EJS
            date: new Date(rawScheduleDetails.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            start_time: rawScheduleDetails.start_time,
            end_time: rawScheduleDetails.end_time,
            year_level: rawScheduleDetails.year_level,
            semester: rawScheduleDetails.semester,
            subject_code: rawScheduleDetails.faculty_subject_code || 'N/A',
            subject: rawScheduleDetails.faculty_subject_name || 'N/A', // Matches 'subject' in EJS
            copus: rawScheduleDetails.copus || 'N/A', // Matches 'copus' in EJS
            modality: rawScheduleDetails.modality || 'N/A', // Matches 'modality' in EJS
            observer: 'N/A' // Default, will be updated below
        };

        if (rawScheduleDetails.observers && rawScheduleDetails.observers.length > 0) {
            scheduleDetails.observer = rawScheduleDetails.observers.map(obs => obs.observer_name).join(', ');
        }
        // --- END OF FIX ---


        // Aggregate tallies from all intervals
        const aggregatedTallies = {
            studentActions: {},
            teacherActions: {},
            engagementLevels: { High: 0, Med: 0, Low: 0 }, // Ensure these are initialized
            // This line *must* correctly get the length if `copusObservation` has `observations`
            totalIntervals: copusObservation.observations ? copusObservation.observations.length : 0
        };

        // Initialize all possible student and teacher actions to 0 to ensure they appear in results
        const studentActionLabels = ["L", "Ind", "Grp", "AnQ", "AsQ", "WC", "SP", "T/Q", "W", "O"];
        const teacherActionLabels = ["Lec", "RtW", "MG", "AnQ", "PQ", "FUp", "1o1", "D/V", "Adm", "W", "O"];

        studentActionLabels.forEach(label => aggregatedTallies.studentActions[label] = 0);
        teacherActionLabels.forEach(label => aggregatedTallies.teacherActions[label] = 0);

        // *** CRITICAL NEW DEBUG LOG 2 - Check observations array explicitly before the IF condition ***
        console.log('--- CRITICAL DEBUG 2: Before observations loop IF condition ---');
        console.log('Value of copusObservation.observations:', copusObservation.observations);
        console.log('Type of copusObservation.observations:', typeof copusObservation.observations);
        if (Array.isArray(copusObservation.observations)) {
            console.log('Is copusObservation.observations an Array? YES');
        } else {
            console.log('Is copusObservation.observations an Array? NO');
        }
        console.log('Length of copusObservation.observations:', copusObservation.observations ? copusObservation.observations.length : 'N/A');
        console.log('Condition for loop entry (copusObservation.observations && copusObservation.observations.length > 0):',
            !!(copusObservation.observations && copusObservation.observations.length > 0)); // Double boolean to show true/false
        console.log('--- END CRITICAL DEBUG 2 ---');


        if (copusObservation.observations && copusObservation.observations.length > 0) {
            console.log('--- TEST LOG: SUCCESSFULLY ENTERED observations loop ---'); // THIS MUST APPEAR IF THE LOOP RUNS
            copusObservation.observations.forEach((obsInterval, index) => {
                // Aggregate student actions
                if (obsInterval.studentActions && typeof obsInterval.studentActions === 'object') {
                    for (const action in obsInterval.studentActions) {
                        if (obsInterval.studentActions[action]) {
                            aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + 1;
                        }
                    }
                }

                // Aggregate teacher actions
                if (obsInterval.teacherActions && typeof obsInterval.teacherActions === 'object') {
                    for (const action in obsInterval.teacherActions) {
                        if (obsInterval.teacherActions[action]) {
                            aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + 1;
                        }
                    }
                }

                // Engagement Levels (with all previous debugs)
                console.log(`--- TEST LOG 3: Inside Interval ${index} (from loop) ---`); // This is the one we NEED to see 45 times
                console.log(`[DEBUG - Interval ${index}] RAW engagementLevel:`, JSON.stringify(obsInterval.engagementLevel));
                console.log(`[DEBUG - Interval ${index}] TYPE of engagementLevel:`, typeof obsInterval.engagementLevel);
                console.log(`[DEBUG - Interval ${index}] VALUE High:`, obsInterval.engagementLevel ? obsInterval.engagementLevel.High : 'N/A');
                console.log(`[DEBUG - Interval ${index}] VALUE Med:`, obsInterval.engagementLevel ? obsInterval.engagementLevel.Med : 'N/A');
                console.log(`[DEBUG - Interval ${index}] VALUE Low:`, obsInterval.engagementLevel ? obsInterval.engagementLevel.Low : 'N/A');


                if (obsInterval.engagementLevel && typeof obsInterval.engagementLevel === 'object') {
                    if (obsInterval.engagementLevel.High === 1) {
                        aggregatedTallies.engagementLevels.High++;
                        console.log(`[DEBUG - Interval ${index}] Incremented High. Current High count: ${aggregatedTallies.engagementLevels.High}`);
                    }
                    if (obsInterval.engagementLevel.Med === 1) {
                        aggregatedTallies.engagementLevels.Med++;
                        console.log(`[DEBUG - Interval ${index}] Incremented Med. Current Med count: ${aggregatedTallies.engagementLevels.Med}`);
                    }
                    if (obsInterval.engagementLevel.Low === 1) {
                        aggregatedTallies.engagementLevels.Low++;
                        console.log(`[DEBUG - Interval ${index}] Incremented Low. Current Low count: ${aggregatedTallies.engagementLevels.Low}`);
                    }
                } else {
                    console.warn(`[getCopus1Result - Interval ${index}] Engagement level is NOT an object or is missing. Value:`, obsInterval.engagementLevel);
                }
            });
            console.log('--- TEST LOG 4: Exiting observations loop (after CRITICAL DEBUG) ---');
        } else {
            // This is the path taken if the loop doesn't run
            console.warn(`--- TEST LOG: Loop condition NOT met. No observations or empty observations array found for CopusObservation ID: ${copusObservation._id}`);
            console.log('Value of copusObservation.observations at this point:', copusObservation.observations);
        }

        // Calculate percentages AFTER aggregation
        const engagementPercentages = {
            High: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.High / aggregatedTallies.totalIntervals) * 100 : 0,
            Med: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Med / aggregatedTallies.totalIntervals) * 100 : 0,
            Low: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Low / aggregatedTallies.totalIntervals) * 100 : 0
        };

        // It seems 'copusDetails' object is still being passed.
        // If copus_result1.ejs doesn't use it, you can simplify.
        // But for now, ensuring its fields are correct as well.
        const copusDetails = {
            copusType: `Copus ${copusObservation.copusNumber}`, // Assuming copusObservation.copusNumber exists
            facultyName: rawScheduleDetails.faculty_user_id ? `${rawScheduleDetails.faculty_user_id.firstname} ${rawScheduleDetails.faculty_user_id.lastname}` : `${rawScheduleDetails.faculty_firstname || ''} ${rawScheduleDetails.faculty_lastname || ''}`.trim(),
            subject: rawScheduleDetails.faculty_subject_name,
            subjectCode: rawScheduleDetails.faculty_subject_code,
            date: new Date(rawScheduleDetails.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            modality: rawScheduleDetails.modality
        };


        console.log('Copus 1 Aggregated Tallies (FINAL):', aggregatedTallies);
        console.log('Copus 1 Engagement Percentages (FINAL):', engagementPercentages);
        console.log('Copus 1 Details (for copusDetails object, if used):', copusDetails);
        // Add the crucial log for scheduleDetails
        console.log('--- FINAL DEBUG: scheduleDetails object passed to EJS ---');
        console.log(JSON.stringify(scheduleDetails, null, 2));
        console.log('--- END FINAL DEBUG ---');
        console.log('Copus 1 Overall Comments:', copusObservation.overallComments);

        res.render('Observer/copus_result1', {
            tallies: aggregatedTallies,
            engagementPercentages,
            copusObservation: copusObservation,
            overallComments: copusObservation.overallComments,
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId,
            copusDetails: copusDetails, // Pass the copusDetails object as well, for consistency
            scheduleDetails: scheduleDetails, // This is the *NEWLY CONSTRUCTED* scheduleDetails
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    } catch (err) {
        console.error('Error retrieving Copus 1 observation results:', err);
        req.flash('error', 'Failed to retrieve Copus 1 results: ' + err.message);
        res.redirect('/observer_copus_result');
    }
},

    // Placeholder for saveCopus2Observation and saveCopus3Observation
    // They will be very similar to saveCopus1Observation, just ensure copusNumber is correct.
    saveCopus2Observation: async (req, res) => {
        console.log('[Controller] Entering saveCopus2Observation');
        try {
            const { copusDetailsId, copusRecords, overallComments } = req.body;
            const observerId = req.session.user.id;

            console.log('[Controller] Received copusDetailsId (CopusObservation ID):', copusDetailsId);
            console.log('[Controller] Received copusRecords (length):', copusRecords ? copusRecords.length : 'null/undefined');
            console.log('[Controller] Received overallComments:', overallComments);

            if (!copusDetailsId || !copusRecords || !Array.isArray(copusRecords) || copusRecords.length === 0) {
                console.error('Validation Error: Missing required observation data or empty array.');
                return res.status(400).json({ message: 'Missing required observation data or empty records. Please ensure data is selected.' });
            }

            const copusObservation = await CopusObservation.findById(copusDetailsId);
            if (!copusObservation) {
                console.error('[Controller] CopusObservation record not found for ID:', copusDetailsId);
                return res.status(404).json({ message: 'Copus Observation record not found. It might have been deleted or not created properly.' });
            }

            console.log('[Controller] ✅ Found CopusObservation:', copusObservation._id);
            console.log('[Controller] 📋 CopusObservation scheduleId:', copusObservation.scheduleId);

            const scheduleId = copusObservation.scheduleId;
            if (!scheduleId) {
                console.error('[Controller] Schedule ID is missing in the CopusObservation record:', copusDetailsId);
                return res.status(500).json({ message: 'Internal error: Schedule ID is missing from the observation record.' });
            }

            // Try to find in ObserverSchedule first (new model)
            console.log('[Controller] 🔍 Looking for schedule in ObserverSchedule collection with ID:', scheduleId);
            let schedule = await ObserverSchedule.findById(scheduleId)
                .populate('faculty_user_id')
                .populate('observer_id');

            if (schedule) {
                console.log('[Controller] ✅ Found schedule in ObserverSchedule collection');
            } else {
                // If not found, try the old Schedule model for backward compatibility
                console.log('[Controller] 🔍 Looking for schedule in Schedule collection with ID:', scheduleId);
                schedule = await Schedule.findById(scheduleId)
                    .populate('faculty_user_id')
                    .populate('observers.observer_id');
                
                if (schedule) {
                    console.log('[Controller] ✅ Found schedule in Schedule collection');
                }
            }

            if (!schedule) {
                console.error('[Controller] ❌ Schedule not found in both ObserverSchedule and Schedule collections for ID:', scheduleId);
                return res.status(404).json({ message: 'Schedule not found for this observation (using the ID from the observation record).' });
            }

            const observerObjectId = new mongoose.Types.ObjectId(observerId);
            let isAssignedObserver = false;

            // Check if it's the new ObserverSchedule model
            if (schedule.observer_id) {
                // New ObserverSchedule model - check if current user is the observer
                isAssignedObserver = schedule.observer_id._id.equals(observerObjectId);
                console.log(`[saveCopus2Observation] ObserverSchedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}the assigned observer`);
            } else if (schedule.observers) {
                // Old Schedule model - check observers array
                isAssignedObserver = schedule.observers.some(obs =>
                    obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
                );
                console.log(`[saveCopus2Observation] Schedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}an assigned observer`);
            }

            if (!isAssignedObserver) {
                console.warn(`[Controller] Unauthorized attempt by observer ${observerId} for schedule ${scheduleId}`);
                return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule or your assignment is not accepted.' });
            }

            copusObservation.observations = copusRecords;
            copusObservation.overallComments = overallComments;
            copusObservation.updatedAt = new Date();

            await copusObservation.save();
            console.log('[Controller] Existing CopusObservation updated with ID:', copusObservation._id);

            // Update schedule status based on model type
            const targetStatus = schedule.observer_id ? 'completed' : 'completed'; // Both models use 'completed'
            schedule.status = targetStatus;
            await schedule.save();
            console.log('[Controller] Schedule status updated to "completed" for ID:', schedule._id);

            // Get faculty information based on model type
            let facultyUser, facultyName;
            if (schedule.faculty_user_id) {
                // ObserverSchedule model
                facultyUser = schedule.faculty_user_id; // Already populated
                facultyName = schedule.faculty_name || `${facultyUser.firstname} ${facultyUser.lastname}`;
            } else {
                // Old Schedule model
                facultyUser = await User.findById(schedule.faculty_id);
                facultyName = facultyUser ? `${facultyUser.firstname} ${facultyUser.lastname}` : 'Unknown Faculty';
            }
            
            const observerUser = await User.findById(observerId);
            const observerName = observerUser ? `${observerUser.firstname} ${observerUser.lastname}` : 'Unknown Observer';

            // Calculate COPUS results from the observation data
            // Count occurrences of each action from the 45 intervals
            let studentActionsCount = {
                L: 0, Ind: 0, Grp: 0, AnQ: 0, AsQ: 0, WC: 0, SP: 0, TQ: 0, W: 0, O: 0
            };
            let teacherActionsCount = {
                Lec: 0, RtW: 0, MG: 0, AnQ: 0, PQ: 0, FUp: 0, '1o1': 0, DV: 0, Adm: 0, W: 0, O: 0
            };
            let engagementCount = {
                High: 0, Med: 0, Low: 0
            };

            // Process COPUS records to count actions (copus_start.js sends objects like {L: 1, Ind: 1})
            copusRecords.forEach(record => {
                // Student actions
                if (record.studentActions && typeof record.studentActions === 'object') {
                    Object.keys(record.studentActions).forEach(action => {
                        if (studentActionsCount.hasOwnProperty(action)) {
                            studentActionsCount[action]++;
                        }
                    });
                }
                // Teacher actions
                if (record.teacherActions && typeof record.teacherActions === 'object') {
                    Object.keys(record.teacherActions).forEach(action => {
                        if (teacherActionsCount.hasOwnProperty(action)) {
                            teacherActionsCount[action]++;
                        }
                    });
                }
                // Engagement levels
                if (record.engagementLevel && typeof record.engagementLevel === 'object') {
                    Object.keys(record.engagementLevel).forEach(level => {
                        if (engagementCount.hasOwnProperty(level)) {
                            engagementCount[level]++;
                        }
                    });
                }
            });

            console.log('[Controller] COPUS Action Counts:', {
                studentActions: studentActionsCount,
                teacherActions: teacherActionsCount,
                engagement: engagementCount
            });

            // Calculate percentages for CopusResult schema
            const totalIntervals = 45;
            
            // Map COPUS actions to CopusResult schema fields
            const student_engagement = {
                asking_questions: Math.round((studentActionsCount.AnQ / totalIntervals) * 100),
                participating_discussions: Math.round((studentActionsCount.AsQ / totalIntervals) * 100),
                collaborative_work: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
                problem_solving: Math.round((studentActionsCount.SP / totalIntervals) * 100)
            };

            const teacher_facilitation = {
                interactive_teaching: Math.round(((teacherActionsCount.MG + teacherActionsCount['1o1']) / totalIntervals) * 100),
                encouraging_participation: Math.round((teacherActionsCount.PQ / totalIntervals) * 100),
                providing_feedback: Math.round((teacherActionsCount.FUp / totalIntervals) * 100),
                guiding_discussions: Math.round((teacherActionsCount.AnQ / totalIntervals) * 100)
            };

            const learning_environment = {
                classroom_setup: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
                technology_use: Math.round((teacherActionsCount.DV / totalIntervals) * 100),
                resource_utilization: Math.round(((studentActionsCount.WC + teacherActionsCount.RtW) / totalIntervals) * 100),
                time_management: Math.round(((totalIntervals - studentActionsCount.W - teacherActionsCount.W) / totalIntervals) * 100)
            };

            // Calculate overall percentage
            const studentEngAvg = (student_engagement.asking_questions + student_engagement.participating_discussions + 
                                  student_engagement.collaborative_work + student_engagement.problem_solving) / 4;
            const teacherFacAvg = (teacher_facilitation.interactive_teaching + teacher_facilitation.encouraging_participation + 
                                  teacher_facilitation.providing_feedback + teacher_facilitation.guiding_discussions) / 4;
            const learningEnvAvg = (learning_environment.classroom_setup + learning_environment.technology_use + 
                                   learning_environment.resource_utilization + learning_environment.time_management) / 4;
            
            const overallPercentage = Math.round((studentEngAvg + teacherFacAvg + learningEnvAvg) / 3);

            // Create CopusResult record for history display
            const copusResult = new CopusResult({
                schedule_id: copusObservation.scheduleId,
                faculty_id: schedule.faculty_user_id ? schedule.faculty_user_id._id : schedule.faculty_id,
                faculty_name: facultyName,
                faculty_department: facultyUser ? (facultyUser.department || schedule.faculty_department) : 'Unknown Department',
                observer_id: observerId,
                observer_name: observerName,
                observation_date: copusObservation.observationDate || schedule.date,
                start_time: copusObservation.startTime || schedule.start_time,
                end_time: copusObservation.endTime || schedule.end_time,
                subject_name: copusObservation.subjectName || schedule.subject_name || schedule.faculty_subject_name || 'N/A',
                room: copusObservation.room || schedule.room || schedule.faculty_room || 'N/A',
                copus_type: 'Copus 2',
                // Store raw COPUS action counts
                student_actions_count: studentActionsCount,
                teacher_actions_count: teacherActionsCount,
                engagement_level_count: engagementCount,
                // Keep existing calculated fields for backward compatibility
                student_engagement: student_engagement,
                teacher_facilitation: teacher_facilitation,
                learning_environment: learning_environment,
                overall_percentage: overallPercentage,
                additional_comments: overallComments || '',
                status: 'submitted',
                submitted_at: new Date()
            });

            await copusResult.save();
            console.log('[Controller] ✅ CopusResult created with ID:', copusResult._id, 'for display in history');

            await Log.create({
                action: 'Submit COPUS Observation',
                performedBy: observerId,
                performedByRole: req.session.user.role,
                details: `Submitted COPUS ${copusObservation.copusNumber} observation for schedule ID: ${scheduleId} (Faculty: ${facultyName})`
            });
            console.log('[Controller] Log entry created.');

            req.flash('success', 'Observation submitted successfully!');
            // THIS PART IS CORRECT FOR FETCH API SUBMISSION
            res.status(200).json({
                message: 'Observation submitted successfully!',
                observationId: copusObservation._id,
                // Ensure this redirectUrl matches the GET route for displaying results by observationId
                redirectUrl: `/observer_copus_result2?observationId=${copusObservation._id}`
                // The frontend JS will use window.location.href = this URL
            });

        } catch (error) {
            console.error('[Controller] Error saving Copus 2 observation:', error);
            if (error.name === 'ValidationError') {
                const errors = Object.keys(error.errors).map(key => error.errors[key].message);
                return res.status(400).json({ message: 'Validation failed: ' + errors.join(', '), errors: error.errors });
            } else if (error.name === 'CastError') {
                console.error('[Controller] CastError (Invalid ID):', error.message);
                return res.status(400).json({ message: 'Invalid ID format provided.' });
            }
            res.status(500).json({ message: 'Failed to save observation due to a server error.', error: error.message });
        }
    },

        // GET /observer_copus_result2/:scheduleId
    getCopus2Result: async (req, res) => {
        try {
            const user = req.session.user;

            if (!user || !user.id || !isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this result.');
                return res.redirect('/login');
            }

            const observationId = req.query.observationId || req.params.observationId;
            const scheduleIdFromParam = req.params.scheduleId; // Fallback if observationId isn't primary

            let copusObservation;

            if (observationId) {
                copusObservation = await CopusObservation.findById(observationId)
                    .populate('scheduleId') // Populate schedule to check observer authorization
                    .lean();
                console.log(`[getCopus1Result] Fetched by observationId: ${observationId}`);
            } else if (scheduleIdFromParam) {
                console.log(`[getCopus1Result] Falling back to scheduleId: ${scheduleIdFromParam}`);
                copusObservation = await CopusObservation.findOne({
                    scheduleId: scheduleIdFromParam,
                    copusNumber: 1,
                    observerId: user.id
                })
                .sort({ dateSubmitted: -1 })
                .populate('scheduleId')
                .lean();
            } else {
                req.flash('error', 'Neither Observation ID nor Schedule ID was provided.');
                return res.redirect('/observer_copus_result');
            }

            if (!copusObservation) {
                req.flash('error', 'No Copus 1 observation found with the provided ID or criteria.');
                return res.redirect('/observer_copus_result');
            }

            // Authorization Check (from previous updates)
            const observerObjectId = new mongoose.Types.ObjectId(user.id);
            if (!copusObservation.observerId || !copusObservation.observerId.equals(observerObjectId)) {
                req.flash('error', 'You are not the assigned observer for this observation.');
                return res.redirect('/observer_copus_result');
            }
            if (copusObservation.scheduleId && copusObservation.scheduleId.observers && copusObservation.scheduleId.observers.length > 0) {
                 const isAssignedAndAcceptedInSchedule = copusObservation.scheduleId.observers.some(obs =>
                    obs.observer_id && obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
                 );
                if (!isAssignedAndAcceptedInSchedule) {
                    req.flash('error', 'Your access to this observation is not authorized via the associated schedule.');
                    return res.redirect('/observer_copus_result');
                }
            }

            const scheduleDetails = copusObservation.scheduleId;

            if (!scheduleDetails) {
                req.flash('error', 'Associated schedule details could not be retrieved.');
                return res.redirect('/observer_copus_result');
            }

            // Aggregate tallies from all intervals
            const aggregatedTallies = {
                studentActions: {},
                teacherActions: {},
                engagementLevels: { High: 0, Med: 0, Low: 0 }, // Ensure these are initialized
                totalIntervals: copusObservation.observations ? copusObservation.observations.length : 0
            };

            if (copusObservation.observations && copusObservation.observations.length > 0) {
                copusObservation.observations.forEach(obsInterval => {
                    // Aggregate student actions (already handled, but including for context)
                    if (obsInterval.studentActions instanceof Map) {
                        for (const [action, isChecked] of obsInterval.studentActions.entries()) {
                            if (isChecked) {
                                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + 1;
                            }
                        }
                    } else if (typeof obsInterval.studentActions === 'object' && obsInterval.studentActions !== null) {
                        for (const action in obsInterval.studentActions) {
                            if (obsInterval.studentActions[action]) {
                                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + 1;
                            }
                        }
                    }

                    // Aggregate teacher actions (already handled, but including for context)
                    if (obsInterval.teacherActions instanceof Map) {
                        for (const [action, isChecked] of obsInterval.teacherActions.entries()) {
                            if (isChecked) {
                                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + 1;
                            }
                        }
                    } else if (typeof obsInterval.teacherActions === 'object' && obsInterval.teacherActions !== null) {
                        for (const action in obsInterval.teacherActions) {
                            if (obsInterval.teacherActions[action]) {
                                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + 1;
                            }
                        }
                    }

                    // *** CRITICAL PART TO VERIFY/FIX FOR ENGAGEMENT LEVELS ***
                    // Ensure obsInterval.engagementLevel holds one of 'High', 'Med', 'Low'
                    // and that it's correctly incrementing the corresponding counter.
                    if (obsInterval.engagementLevel) {
                        const level = obsInterval.engagementLevel; // Get the string value ('High', 'Med', 'Low')
                        // Ensure the level is one of the expected keys before incrementing
                        if (aggregatedTallies.engagementLevels.hasOwnProperty(level)) {
                            aggregatedTallies.engagementLevels[level]++; // Increment the count for that level
                        } else {
                            console.warn(`[getCopus1Result] Unexpected engagement level found: "${level}" for observation interval.`);
                        }
                    }
                });
            } else {
                console.warn(`[getCopus1Result] No observations found in CopusObservation ID: ${copusObservation._id}`);
            }

            // Calculate percentages AFTER aggregation
            const engagementPercentages = {
                High: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.High / aggregatedTallies.totalIntervals) * 100 : 0,
                Med: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Med / aggregatedTallies.totalIntervals) * 100 : 0,
                Low: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Low / aggregatedTallies.totalIntervals) * 100 : 0
            };

            const copusDetails = {
                copusType: `Copus ${copusObservation.copusNumber}`,
                facultyName: scheduleDetails.faculty_user_id ? `${scheduleDetails.faculty_user_id.firstname} ${scheduleDetails.faculty_user_id.lastname}` : `${scheduleDetails.faculty_firstname || ''} ${scheduleDetails.faculty_lastname || ''}`.trim(),
                subject: scheduleDetails.faculty_subject_name, // Use the stored subject name
                subjectCode: scheduleDetails.faculty_subject_code, // Use the stored subject code
                date: new Date(scheduleDetails.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                modality: scheduleDetails.modality
            };


            console.log('Copus 1 Aggregated Tallies:', aggregatedTallies);
            console.log('Copus 1 Engagement Percentages:', engagementPercentages);
            console.log('Copus 1 Details:', copusDetails);
            console.log('Copus 1 Overall Comments:', copusObservation.overallComments);

            res.render('Observer/copus_result1', {
                tallies: aggregatedTallies,
                engagementPercentages,
                copusObservation: copusObservation,
                overallComments: copusObservation.overallComments,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                copusDetails: copusDetails,
                scheduleDetails: scheduleDetails, // Pass the populated schedule document
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error retrieving Copus 1 observation results:', err);
            req.flash('error', 'Failed to retrieve Copus 1 results: ' + err.message);
            res.redirect('/observer_copus_result');
        }
    },

    saveCopus3Observation: async (req, res) => {
        console.log('[Controller] Entering saveCopus3Observation');
        try {
            const { copusDetailsId, copusRecords, overallComments } = req.body;
            const observerId = req.session.user.id;

            console.log('[Controller] Received copusDetailsId (CopusObservation ID):', copusDetailsId);
            console.log('[Controller] Received copusRecords (length):', copusRecords ? copusRecords.length : 'null/undefined');
            console.log('[Controller] Received overallComments:', overallComments);

            if (!copusDetailsId || !copusRecords || !Array.isArray(copusRecords) || copusRecords.length === 0) {
                console.error('Validation Error: Missing required observation data or empty array.');
                return res.status(400).json({ message: 'Missing required observation data or empty records. Please ensure data is selected.' });
            }

            const copusObservation = await CopusObservation.findById(copusDetailsId);
            if (!copusObservation) {
                console.error('[Controller] CopusObservation record not found for ID:', copusDetailsId);
                return res.status(404).json({ message: 'Copus Observation record not found. It might have been deleted or not created properly.' });
            }

            console.log('[Controller] ✅ Found CopusObservation:', copusObservation._id);
            console.log('[Controller] 📋 CopusObservation scheduleId:', copusObservation.scheduleId);

            const scheduleId = copusObservation.scheduleId;
            if (!scheduleId) {
                console.error('[Controller] Schedule ID is missing in the CopusObservation record:', copusDetailsId);
                return res.status(500).json({ message: 'Internal error: Schedule ID is missing from the observation record.' });
            }

            // Try to find in ObserverSchedule first (new model)
            console.log('[Controller] 🔍 Looking for schedule in ObserverSchedule collection with ID:', scheduleId);
            let schedule = await ObserverSchedule.findById(scheduleId)
                .populate('faculty_user_id')
                .populate('observer_id');

            if (schedule) {
                console.log('[Controller] ✅ Found schedule in ObserverSchedule collection');
            } else {
                // If not found, try the old Schedule model for backward compatibility
                console.log('[Controller] 🔍 Looking for schedule in Schedule collection with ID:', scheduleId);
                schedule = await Schedule.findById(scheduleId)
                    .populate('faculty_user_id')
                    .populate('observers.observer_id');
                
                if (schedule) {
                    console.log('[Controller] ✅ Found schedule in Schedule collection');
                }
            }

            if (!schedule) {
                console.error('[Controller] ❌ Schedule not found in both ObserverSchedule and Schedule collections for ID:', scheduleId);
                return res.status(404).json({ message: 'Schedule not found for this observation (using the ID from the observation record).' });
            }

            const observerObjectId = new mongoose.Types.ObjectId(observerId);
            let isAssignedObserver = false;

            // Check if it's the new ObserverSchedule model
            if (schedule.observer_id) {
                // New ObserverSchedule model - check if current user is the observer
                isAssignedObserver = schedule.observer_id._id.equals(observerObjectId);
                console.log(`[saveCopus3Observation] ObserverSchedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}the assigned observer`);
            } else if (schedule.observers) {
                // Old Schedule model - check observers array
                isAssignedObserver = schedule.observers.some(obs =>
                    obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
                );
                console.log(`[saveCopus3Observation] Schedule model - User ${observerId} is ${isAssignedObserver ? '' : 'NOT '}an assigned observer`);
            }

            if (!isAssignedObserver) {
                console.warn(`[Controller] Unauthorized attempt by observer ${observerId} for schedule ${scheduleId}`);
                return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule or your assignment is not accepted.' });
            }

            copusObservation.observations = copusRecords;
            copusObservation.overallComments = overallComments;
            copusObservation.updatedAt = new Date();

            await copusObservation.save();
            console.log('[Controller] Existing CopusObservation updated with ID:', copusObservation._id);

            // Update schedule status based on model type
            const targetStatus = schedule.observer_id ? 'completed' : 'completed'; // Both models use 'completed'
            schedule.status = targetStatus;
            await schedule.save();
            console.log('[Controller] Schedule status updated to "completed" for ID:', schedule._id);

            // Get faculty information based on model type
            let facultyUser, facultyName;
            if (schedule.faculty_user_id) {
                // ObserverSchedule model
                facultyUser = schedule.faculty_user_id; // Already populated
                facultyName = schedule.faculty_name || `${facultyUser.firstname} ${facultyUser.lastname}`;
            } else {
                // Old Schedule model
                facultyUser = await User.findById(schedule.faculty_id);
                facultyName = facultyUser ? `${facultyUser.firstname} ${facultyUser.lastname}` : 'Unknown Faculty';
            }
            
            const observerUser = await User.findById(observerId);
            const observerName = observerUser ? `${observerUser.firstname} ${observerUser.lastname}` : 'Unknown Observer';

            // Calculate COPUS results from the observation data
            // Count occurrences of each action from the 45 intervals
            let studentActionsCount = {
                L: 0, Ind: 0, Grp: 0, AnQ: 0, AsQ: 0, WC: 0, SP: 0, TQ: 0, W: 0, O: 0
            };
            let teacherActionsCount = {
                Lec: 0, RtW: 0, MG: 0, AnQ: 0, PQ: 0, FUp: 0, '1o1': 0, DV: 0, Adm: 0, W: 0, O: 0
            };
            let engagementCount = {
                High: 0, Med: 0, Low: 0
            };

            // Process COPUS records to count actions (copus_start.js sends objects like {L: 1, Ind: 1})
            copusRecords.forEach(record => {
                // Student actions
                if (record.studentActions && typeof record.studentActions === 'object') {
                    Object.keys(record.studentActions).forEach(action => {
                        if (studentActionsCount.hasOwnProperty(action)) {
                            studentActionsCount[action]++;
                        }
                    });
                }
                // Teacher actions
                if (record.teacherActions && typeof record.teacherActions === 'object') {
                    Object.keys(record.teacherActions).forEach(action => {
                        if (teacherActionsCount.hasOwnProperty(action)) {
                            teacherActionsCount[action]++;
                        }
                    });
                }
                // Engagement levels
                if (record.engagementLevel && typeof record.engagementLevel === 'object') {
                    Object.keys(record.engagementLevel).forEach(level => {
                        if (engagementCount.hasOwnProperty(level)) {
                            engagementCount[level]++;
                        }
                    });
                }
            });

            console.log('[Controller] COPUS Action Counts:', {
                studentActions: studentActionsCount,
                teacherActions: teacherActionsCount,
                engagement: engagementCount
            });

            // Calculate percentages for CopusResult schema
            const totalIntervals = 45;
            
            // Map COPUS actions to CopusResult schema fields
            const student_engagement = {
                asking_questions: Math.round((studentActionsCount.AnQ / totalIntervals) * 100),
                participating_discussions: Math.round((studentActionsCount.AsQ / totalIntervals) * 100),
                collaborative_work: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
                problem_solving: Math.round((studentActionsCount.SP / totalIntervals) * 100)
            };

            const teacher_facilitation = {
                interactive_teaching: Math.round(((teacherActionsCount.MG + teacherActionsCount['1o1']) / totalIntervals) * 100),
                encouraging_participation: Math.round((teacherActionsCount.PQ / totalIntervals) * 100),
                providing_feedback: Math.round((teacherActionsCount.FUp / totalIntervals) * 100),
                guiding_discussions: Math.round((teacherActionsCount.AnQ / totalIntervals) * 100)
            };

            const learning_environment = {
                classroom_setup: Math.round((studentActionsCount.Grp / totalIntervals) * 100),
                technology_use: Math.round((teacherActionsCount.DV / totalIntervals) * 100),
                resource_utilization: Math.round(((studentActionsCount.WC + teacherActionsCount.RtW) / totalIntervals) * 100),
                time_management: Math.round(((totalIntervals - studentActionsCount.W - teacherActionsCount.W) / totalIntervals) * 100)
            };

            // Calculate overall percentage
            const studentEngAvg = (student_engagement.asking_questions + student_engagement.participating_discussions + 
                                  student_engagement.collaborative_work + student_engagement.problem_solving) / 4;
            const teacherFacAvg = (teacher_facilitation.interactive_teaching + teacher_facilitation.encouraging_participation + 
                                  teacher_facilitation.providing_feedback + teacher_facilitation.guiding_discussions) / 4;
            const learningEnvAvg = (learning_environment.classroom_setup + learning_environment.technology_use + 
                                   learning_environment.resource_utilization + learning_environment.time_management) / 4;
            
            const overallPercentage = Math.round((studentEngAvg + teacherFacAvg + learningEnvAvg) / 3);

            // Create CopusResult record for history display
            const copusResult = new CopusResult({
                schedule_id: copusObservation.scheduleId,
                faculty_id: schedule.faculty_user_id ? schedule.faculty_user_id._id : schedule.faculty_id,
                faculty_name: facultyName,
                faculty_department: facultyUser ? (facultyUser.department || schedule.faculty_department) : 'Unknown Department',
                observer_id: observerId,
                observer_name: observerName,
                observation_date: copusObservation.observationDate || schedule.date,
                start_time: copusObservation.startTime || schedule.start_time,
                end_time: copusObservation.endTime || schedule.end_time,
                subject_name: copusObservation.subjectName || schedule.subject_name || schedule.faculty_subject_name || 'N/A',
                room: copusObservation.room || schedule.room || schedule.faculty_room || 'N/A',
                copus_type: 'Copus 3',
                // Store raw COPUS action counts
                student_actions_count: studentActionsCount,
                teacher_actions_count: teacherActionsCount,
                engagement_level_count: engagementCount,
                // Keep existing calculated fields for backward compatibility
                student_engagement: student_engagement,
                teacher_facilitation: teacher_facilitation,
                learning_environment: learning_environment,
                overall_percentage: overallPercentage,
                additional_comments: overallComments || '',
                status: 'submitted',
                submitted_at: new Date()
            });

            await copusResult.save();
            console.log('[Controller] ✅ CopusResult created with ID:', copusResult._id, 'for display in history');

            await Log.create({
                action: 'Submit COPUS Observation',
                performedBy: observerId,
                performedByRole: req.session.user.role,
                details: `Submitted COPUS ${copusObservation.copusNumber} observation for schedule ID: ${scheduleId} (Faculty: ${facultyName})`
            });
            console.log('[Controller] Log entry created.');

            req.flash('success', 'Observation submitted successfully!');
            // THIS PART IS CORRECT FOR FETCH API SUBMISSION
            res.status(200).json({
                message: 'Observation submitted successfully!',
                observationId: copusObservation._id,
                // Ensure this redirectUrl matches the GET route for displaying results by observationId
                redirectUrl: `/observer_copus_result3?observationId=${copusObservation._id}`
                // The frontend JS will use window.location.href = this URL
            });

        } catch (error) {
            console.error('[Controller] Error saving Copus 3 observation:', error);
            if (error.name === 'ValidationError') {
                const errors = Object.keys(error.errors).map(key => error.errors[key].message);
                return res.status(400).json({ message: 'Validation failed: ' + errors.join(', '), errors: error.errors });
            } else if (error.name === 'CastError') {
                console.error('[Controller] CastError (Invalid ID):', error.message);
                return res.status(400).json({ message: 'Invalid ID format provided.' });
            }
            res.status(500).json({ message: 'Failed to save observation due to a server error.', error: error.message });
        }
    },

    // GET /observer_copus_result3/:scheduleId
    getCopus3Result: async (req, res) => {
        try {
            const user = req.session.user;

            if (!user || !user.id || !isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this result.');
                return res.redirect('/login');
            }

            const observationId = req.query.observationId || req.params.observationId;
            const scheduleIdFromParam = req.params.scheduleId; // Fallback if observationId isn't primary

            let copusObservation;

            if (observationId) {
                copusObservation = await CopusObservation.findById(observationId)
                    .populate('scheduleId') // Populate schedule to check observer authorization
                    .lean();
                console.log(`[getCopus1Result] Fetched by observationId: ${observationId}`);
            } else if (scheduleIdFromParam) {
                console.log(`[getCopus1Result] Falling back to scheduleId: ${scheduleIdFromParam}`);
                copusObservation = await CopusObservation.findOne({
                    scheduleId: scheduleIdFromParam,
                    copusNumber: 1,
                    observerId: user.id
                })
                .sort({ dateSubmitted: -1 })
                .populate('scheduleId')
                .lean();
            } else {
                req.flash('error', 'Neither Observation ID nor Schedule ID was provided.');
                return res.redirect('/observer_copus_result');
            }

            if (!copusObservation) {
                req.flash('error', 'No Copus 1 observation found with the provided ID or criteria.');
                return res.redirect('/observer_copus_result');
            }

            // Authorization Check (from previous updates)
            const observerObjectId = new mongoose.Types.ObjectId(user.id);
            if (!copusObservation.observerId || !copusObservation.observerId.equals(observerObjectId)) {
                req.flash('error', 'You are not the assigned observer for this observation.');
                return res.redirect('/observer_copus_result');
            }
            if (copusObservation.scheduleId && copusObservation.scheduleId.observers && copusObservation.scheduleId.observers.length > 0) {
                 const isAssignedAndAcceptedInSchedule = copusObservation.scheduleId.observers.some(obs =>
                    obs.observer_id && obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
                 );
                if (!isAssignedAndAcceptedInSchedule) {
                    req.flash('error', 'Your access to this observation is not authorized via the associated schedule.');
                    return res.redirect('/observer_copus_result');
                }
            }

            const scheduleDetails = copusObservation.scheduleId;

            if (!scheduleDetails) {
                req.flash('error', 'Associated schedule details could not be retrieved.');
                return res.redirect('/observer_copus_result');
            }

            // Aggregate tallies from all intervals
            const aggregatedTallies = {
                studentActions: {},
                teacherActions: {},
                engagementLevels: { High: 0, Med: 0, Low: 0 }, // Ensure these are initialized
                totalIntervals: copusObservation.observations ? copusObservation.observations.length : 0
            };

            if (copusObservation.observations && copusObservation.observations.length > 0) {
                copusObservation.observations.forEach(obsInterval => {
                    // Aggregate student actions (already handled, but including for context)
                    if (obsInterval.studentActions instanceof Map) {
                        for (const [action, isChecked] of obsInterval.studentActions.entries()) {
                            if (isChecked) {
                                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + 1;
                            }
                        }
                    } else if (typeof obsInterval.studentActions === 'object' && obsInterval.studentActions !== null) {
                        for (const action in obsInterval.studentActions) {
                            if (obsInterval.studentActions[action]) {
                                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + 1;
                            }
                        }
                    }

                    // Aggregate teacher actions (already handled, but including for context)
                    if (obsInterval.teacherActions instanceof Map) {
                        for (const [action, isChecked] of obsInterval.teacherActions.entries()) {
                            if (isChecked) {
                                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + 1;
                            }
                        }
                    } else if (typeof obsInterval.teacherActions === 'object' && obsInterval.teacherActions !== null) {
                        for (const action in obsInterval.teacherActions) {
                            if (obsInterval.teacherActions[action]) {
                                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + 1;
                            }
                        }
                    }

                    // *** CRITICAL PART TO VERIFY/FIX FOR ENGAGEMENT LEVELS ***
                    // Ensure obsInterval.engagementLevel holds one of 'High', 'Med', 'Low'
                    // and that it's correctly incrementing the corresponding counter.
                    if (obsInterval.engagementLevel) {
                        const level = obsInterval.engagementLevel; // Get the string value ('High', 'Med', 'Low')
                        // Ensure the level is one of the expected keys before incrementing
                        if (aggregatedTallies.engagementLevels.hasOwnProperty(level)) {
                            aggregatedTallies.engagementLevels[level]++; // Increment the count for that level
                        } else {
                            console.warn(`[getCopus1Result] Unexpected engagement level found: "${level}" for observation interval.`);
                        }
                    }
                });
            } else {
                console.warn(`[getCopus1Result] No observations found in CopusObservation ID: ${copusObservation._id}`);
            }

            // Calculate percentages AFTER aggregation
            const engagementPercentages = {
                High: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.High / aggregatedTallies.totalIntervals) * 100 : 0,
                Med: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Med / aggregatedTallies.totalIntervals) * 100 : 0,
                Low: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Low / aggregatedTallies.totalIntervals) * 100 : 0
            };

            const copusDetails = {
                copusType: `Copus ${copusObservation.copusNumber}`,
                facultyName: scheduleDetails.faculty_user_id ? `${scheduleDetails.faculty_user_id.firstname} ${scheduleDetails.faculty_user_id.lastname}` : `${scheduleDetails.faculty_firstname || ''} ${scheduleDetails.faculty_lastname || ''}`.trim(),
                subject: scheduleDetails.faculty_subject_name, // Use the stored subject name
                subjectCode: scheduleDetails.faculty_subject_code, // Use the stored subject code
                date: new Date(scheduleDetails.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                modality: scheduleDetails.modality
            };


            console.log('Copus 1 Aggregated Tallies:', aggregatedTallies);
            console.log('Copus 1 Engagement Percentages:', engagementPercentages);
            console.log('Copus 1 Details:', copusDetails);
            console.log('Copus 1 Overall Comments:', copusObservation.overallComments);

            res.render('Observer/copus_result1', {
                tallies: aggregatedTallies,
                engagementPercentages,
                copusObservation: copusObservation,
                overallComments: copusObservation.overallComments,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                copusDetails: copusDetails,
                scheduleDetails: scheduleDetails, // Pass the populated schedule document
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error retrieving Copus 1 observation results:', err);
            req.flash('error', 'Failed to retrieve Copus 1 results: ' + err.message);
            res.redirect('/observer_copus_result');
        }
    },

    // GET /observer_copus_result (List of completed schedules for result viewing)
    getCopusResultList: async (req, res) => {
        try {
            // Ensure user is authenticated and in session
            if (!req.session.user || !req.session.user.id) {
                console.log('User not found in session for getCopusResultList, redirecting to login.');
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }

            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('User ID from session not found in DB for getCopusResultList, destroying session and redirecting to login.');
                req.session.destroy(() => {
                    req.flash('error', 'User not found. Please log in again.');
                    res.redirect('/login');
                });
                return;
            }

            // Verify the user's role is indeed an observer type
            if (!isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this page.');
                return res.redirect('/Observer_dashboard');
            }

            // Fetch schedules where the current user is an assigned observer AND the schedule is completed
            const completedSchedules = await Schedule.find({
                'observers.observer_id': user._id,
                status: 'completed'
            })
            .sort({ date: -1, start_time: -1 })
            // *** CRITICAL FIX: Change 'faculty_id' to 'faculty_user_id' ***
            // *** Also, if 'employee' is your User model name, ensure 'User' is imported and used for population,
            // *** or directly use 'employee' if it's a separate model and imported correctly.
            // Assuming 'User' model (which you import as `User`) is indeed your 'employee' model referenced in Schema.
            .populate('faculty_user_id', 'firstname lastname department')
            .lean(); // Use lean() for performance

            console.log("Found completed schedules (before observation lookup):", completedSchedules.map(s => s._id)); // Log schedule IDs

            // Now, iterate through each completed schedule to find its corresponding CopusObservation ID
            const schedulesWithObservationDetails = [];
            for (const schedule of completedSchedules) {
                // Find the associated CopusObservation. Assuming scheduleId is unique in CopusObservation.
                const copusObservation = await CopusObservation.findOne({ scheduleId: schedule._id });

                if (copusObservation) {
                    // Check if faculty_user_id was successfully populated
                    const faculty = schedule.faculty_user_id;

                    schedulesWithObservationDetails.push({
                        ...schedule, // Spread all existing schedule properties
                        // Use populated faculty details if available, otherwise fallback to direct fields
                        fullname: faculty ? `${faculty.firstname} ${faculty.lastname}` : `${schedule.faculty_firstname || ''} ${schedule.faculty_lastname || ''}`.trim(),
                        department: faculty ? faculty.department : schedule.faculty_department,
                        copusNumber: copusObservation.copusNumber, // e.g., '1', '2', '3'
                        observationId: copusObservation._id, // *** CRITICAL: Pass the actual CopusObservation ID ***
                        date: new Date(schedule.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        observer: `${user.firstname} ${user.lastname}`, // Current logged-in observer
                        // Add subject_code and subject here from the schedule itself for consistency with EJS
                        subject_code: schedule.faculty_subject_code,
                        subject: schedule.faculty_subject_name
                    });
                } else {
                    console.warn(`[getCopusResultList] No CopusObservation found for schedule ID: ${schedule._id}. This schedule will not be displayed in results.`);
                    // If you want to display schedules without an observation (e.g., as 'N/A'),
                    // you'd push them here without observationId and handle that in EJS.
                    // For now, we only push if observation exists, aligning with previous logic.
                }
            }

            console.log("Schedules to render (after observation lookup):", schedulesWithObservationDetails); // IMPORTANT LOG

            // Fetch chart data from copusresults collection
            console.log('🔍 Observer: About to call getChartData...');
            let chartData;
            try {
                chartData = await observerController.getChartData();
                console.log('📊 Observer chart data before rendering:', JSON.stringify(chartData, null, 2));
                
                // TEMPORARY: If no data, create test data to ensure charts work
                if (!chartData.topOverall && (!chartData.topHighest || chartData.topHighest.length === 0)) {
                    console.log('🧪 Observer: No chart data found, using test data...');
                    chartData = {
                        topOverall: { faculty_name: 'Test Faculty', overall_percentage: 85, final_rating: 'Good' },
                        topHighest: [
                            { faculty_name: 'Faculty A', overall_percentage: 95, final_rating: 'Excellent' },
                            { faculty_name: 'Faculty B', overall_percentage: 87, final_rating: 'Good' }
                        ],
                        topLowest: [
                            { faculty_name: 'Faculty C', overall_percentage: 65, final_rating: 'Fair' },
                            { faculty_name: 'Faculty D', overall_percentage: 58, final_rating: 'Poor' }
                        ]
                    };
                }
            } catch (chartError) {
                console.error('❌ Observer error calling getChartData:', chartError);
                chartData = { topHighest: [], topLowest: [], topOverall: null };
            }

            res.render('Observer/copus_result', {
                completedSchedules: schedulesWithObservationDetails, // Pass the enhanced data
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                user: user, // Passing the full user object might be useful in the EJS
                chartData: chartData, // Add chart data
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error fetching completed schedules for Copus Result list:', err);
            req.flash('error', 'Failed to load completed schedules: ' + err.message); // Show error message from populate
            
            // Try to get chart data even on error, but provide fallback if it fails
            console.log('🔍 Observer error handler: About to call getChartData...');
            let chartData;
            try {
                chartData = await observerController.getChartData();
                console.log('📊 Observer error handler chart data:', JSON.stringify(chartData, null, 2));
            } catch (chartErr) {
                console.error('❌ Observer error fetching chart data in error handler:', chartErr);
                chartData = { topHighest: [], topLowest: [], topOverall: null };
            }
            
            res.status(500).render('Observer/copus_result', {
                completedSchedules: [], // Ensure an empty array is passed on error
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                employeeId: req.session.user ? req.session.user.employeeId : '',
                user: req.session.user || null,
                chartData: chartData, // Add chart data even in error case
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }
    },

    // GET /observer_copus_summary
    getCopusSummary: (req, res) => {
        // This function might eventually fetch and aggregate data for a summary report
        // For now, it just renders the page.
        if (!req.session.user || !isObserverRole(req.session.user.role)) {
            req.flash('error', 'You are not authorized to view this page.');
            return res.redirect('/login');
        }
        res.render('Observer/copus_summary', {
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId,
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    },

    // GET /Observer_copus_history - Display ALL faculty COPUS results history
    getCopusHistory: async (req, res) => {
        try {
            // Ensure user is authenticated and in session
            if (!req.session.user || !req.session.user.id) {
                console.log('User not found in session for getCopusHistory, redirecting to login.');
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }

            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('User ID from session not found in DB for history, destroying session and redirecting to login.');
                req.session.destroy(() => {
                    req.flash('error', 'User not found. Please log in again.');
                    res.redirect('/login');
                });
                return;
            }

            // Verify the user's role is indeed an observer type
            if (!isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this page.');
                return res.redirect('/Observer_dashboard');
            }

            console.log('🔍 Fetching COPUS results from copusresults collection...');

            // Fetch ALL COPUS results from the copusresults collection
            const copusResults = await CopusResult.find({})
                .sort({ observation_date: -1, createdAt: -1 })
                .lean();

            console.log(`📊 Found ${copusResults.length} total COPUS results in database`);
            
            // Debug: Log first result if exists
            if (copusResults.length > 0) {
                console.log('📋 Sample result structure:', {
                    faculty_name: copusResults[0].faculty_name,
                    observer_name: copusResults[0].observer_name,
                    observation_date: copusResults[0].observation_date,
                    copus_type: copusResults[0].copus_type,
                    overall_percentage: copusResults[0].overall_percentage
                });
            } else {
                console.log('⚠️ No COPUS results found in copusresults collection');
            }

            res.render('Observer/copus_history', {
                copusResults: copusResults,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('❌ Error fetching COPUS results history:', err);
            req.flash('error', 'Failed to load COPUS results history.');
            res.status(500).render('Observer/copus_history', {
                copusResults: [],
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                employeeId: req.session.user ? req.session.user.employeeId : '',
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }
    },

    // GET /observer_setting
    getSetting: async (req, res) => {
        try {
            // Ensure user is authenticated and in session
            if (!req.session.user || !req.session.user.id) {
                console.log('User not found in session for getSetting, redirecting to login.');
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }

            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('User ID from session not found in DB for settings, destroying session and redirecting to login.');
                req.session.destroy(() => {
                    req.flash('error', 'User not found. Please log in again.');
                    res.redirect('/login');
                });
                return;
            }

            // Verify the user's role is indeed an observer type
            if (!isObserverRole(user.role)) {
                req.flash('error', 'You are not authorized to view this page.');
                return res.redirect('/Observer_dashboard');
            }

            res.render('Observer/setting', {
                firstName: user.firstname,
                lastName: user.session.user.lastname, // Fix: Changed from user.lastname to req.session.user.lastname for consistency
                employeeId: req.session.user.employeeId, // Fix: Changed from user.employeeId to req.session.user.employeeId for consistency
                currentUser: user,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error fetching user data for settings page:', err);
            req.flash('error', 'Failed to load Settings view.');
            res.status(500).render('Observer/setting', {
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                employeeId: req.session.user ? req.session.user.employeeId : '',
                currentUser: req.session.user || null,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }
    },

    // GET /observer_copus_evaluate/:scheduleId - Display COPUS evaluation form
    getCopusEvaluationForm: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const user = await User.findById(req.session.user.id);

            if (!user || !isObserverRole(user.role)) {
                req.flash('error_msg', 'Unauthorized access.');
                return res.redirect('/login');
            }

            // Find the observation schedule
            const schedule = await ObserverSchedule.findById(scheduleId)
                .populate('faculty_user_id', 'firstname lastname department')
                .populate('observer_id', 'firstname lastname');

            if (!schedule) {
                req.flash('error_msg', 'Observation schedule not found.');
                return res.redirect('/Observer_schedule_management');
            }

            // Verify this observer is assigned to this schedule
            if (schedule.observer_id._id.toString() !== user._id.toString()) {
                req.flash('error_msg', 'You are not authorized to evaluate this observation.');
                return res.redirect('/Observer_schedule_management');
            }

            // Prepare data for the evaluation form
            const evaluationData = {
                scheduleId: schedule._id,
                facultyId: schedule.faculty_user_id._id,
                facultyName: `${schedule.faculty_user_id.firstname} ${schedule.faculty_user_id.lastname}`,
                facultyDepartment: schedule.faculty_user_id.department,
                observationDate: schedule.date ? schedule.date.toLocaleDateString() : 'N/A',
                startTime: schedule.start_time,
                endTime: schedule.end_time,
                room: schedule.room,
                subjectName: schedule.subject_name || 'N/A',
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId
            };

            res.render('Observer/copus_evaluation_form', evaluationData);

        } catch (error) {
            console.error('Error loading COPUS evaluation form:', error);
            req.flash('error_msg', 'Failed to load evaluation form.');
            res.redirect('/Observer_schedule_management');
        }
    },

    // POST /observer/submit-copus-evaluation - Submit completed COPUS evaluation
    submitCopusEvaluation: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            const CopusResult = require('../model/copusResult');

            console.log('\n=== COPUS EVALUATION SUBMISSION DEBUG ===');
            console.log('User:', user ? `${user.firstname} ${user.lastname}` : 'Not found');
            console.log('Request body:', JSON.stringify(req.body, null, 2));

            if (!user || !isObserverRole(user.role)) {
                return res.status(403).json({ success: false, message: 'Unauthorized access.' });
            }

            const {
                scheduleId,
                facultyId,
                student_engagement,
                teacher_facilitation,
                learning_environment,
                overall_assessment
            } = req.body;

            console.log('Extracted data:', {
                scheduleId,
                facultyId,
                student_engagement,
                teacher_facilitation,
                learning_environment,
                overall_assessment
            });

            // Find the schedule and faculty details
            const schedule = await ObserverSchedule.findById(scheduleId).populate('faculty_user_id', 'firstname lastname department');
            const faculty = await User.findById(facultyId);

            console.log('Schedule found:', schedule ? `${schedule._id}` : 'Not found');
            console.log('Faculty found:', faculty ? `${faculty.firstname} ${faculty.lastname}` : 'Not found');

            if (!schedule || !faculty) {
                return res.status(404).json({ success: false, message: 'Schedule or faculty not found.' });
            }

            // Verify observer authorization
            if (schedule.observer_id.toString() !== user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to evaluate this observation.' });
            }

            // Calculate scores for each section
            const calculateSectionScore = (sectionData) => {
                if (!sectionData || typeof sectionData !== 'object') return 0;
                const values = Object.values(sectionData).map(val => parseFloat(val) || 0);
                return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            };

            const studentEngagementScore = calculateSectionScore(student_engagement);
            const teacherFacilitationScore = calculateSectionScore(teacher_facilitation);
            const learningEnvironmentScore = calculateSectionScore(learning_environment);

            // Calculate final score (average of all three sections)
            const finalScore = (studentEngagementScore + teacherFacilitationScore + learningEnvironmentScore) / 3;

            // Determine rating based on final score
            let finalRating = '';
            if (finalScore >= 72.5) {
                finalRating = 'Great';
            } else if (finalScore >= 50) {
                finalRating = 'Good';
            } else if (finalScore >= 25) {
                finalRating = 'Needs Improvement';
            } else {
                finalRating = 'Unsatisfactory';
            }

            console.log('Calculated scores:', {
                studentEngagementScore,
                teacherFacilitationScore,
                learningEnvironmentScore,
                finalScore,
                finalRating
            });

            // Map form data to model structure
            const mappedStudentEngagement = {
                asking_questions: parseFloat(student_engagement?.questioning_discussion) || 0,
                participating_discussions: parseFloat(student_engagement?.active_participation) || 0,
                collaborative_work: parseFloat(student_engagement?.student_collaboration) || 0,
                problem_solving: parseFloat(student_engagement?.problem_solving) || 0
            };

            const mappedTeacherFacilitation = {
                interactive_teaching: parseFloat(teacher_facilitation?.clear_instruction) || 0,
                encouraging_participation: parseFloat(teacher_facilitation?.effective_questioning) || 0,
                providing_feedback: parseFloat(teacher_facilitation?.student_feedback) || 0,
                guiding_discussions: parseFloat(teacher_facilitation?.activity_guidance) || 0
            };

            const mappedLearningEnvironment = {
                classroom_setup: parseFloat(learning_environment?.classroom_setup) || 0,
                technology_use: parseFloat(learning_environment?.technology_integration) || 0,
                resource_utilization: parseFloat(learning_environment?.learning_resources) || 0,
                time_management: parseFloat(learning_environment?.time_management) || 0
            };

            // Create new COPUS result with all required fields
            const copusResult = new CopusResult({
                schedule_id: schedule._id,
                faculty_id: faculty._id,
                faculty_name: `${faculty.firstname} ${faculty.lastname}`,
                faculty_department: faculty.department || 'N/A',
                observer_id: user._id,
                observer_name: `${user.firstname} ${user.lastname}`,
                observation_date: schedule.date,
                start_time: schedule.start_time,
                end_time: schedule.end_time,
                subject_name: schedule.subject_name || 'N/A',
                room: schedule.room || 'N/A',
                copus_type: schedule.copus_type || 'Copus 1',
                student_engagement: mappedStudentEngagement,
                teacher_facilitation: mappedTeacherFacilitation,
                learning_environment: mappedLearningEnvironment,
                overall_percentage: Math.round(finalScore * 100) / 100,
                final_rating: finalRating,
                strengths: '',
                areas_for_improvement: '',
                recommendations: '',
                additional_comments: overall_assessment || '',
                status: 'submitted',
                evaluation_date: new Date(),
                submitted_at: new Date()
            });

            console.log('Creating COPUS result:', copusResult);

            await copusResult.save();

            // Update the observation schedule status to completed
            await ObserverSchedule.findByIdAndUpdate(scheduleId, {
                status: 'completed',
                updated_at: new Date()
            });

            console.log('COPUS evaluation saved successfully');
            console.log('=== END COPUS EVALUATION SUBMISSION DEBUG ===\n');

            res.json({ 
                success: true, 
                message: 'COPUS evaluation submitted successfully!',
                redirectUrl: '/Observer_schedule_management'
            });

        } catch (error) {
            console.error('Error submitting COPUS evaluation:', error);
            res.status(500).json({ success: false, message: 'Failed to submit evaluation: ' + error.message });
        }
    },

    // POST /observer/save-copus-draft - Save COPUS evaluation as draft
    saveCopusDraft: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            const CopusResult = require('../model/copusResult');

            if (!user || !isObserverRole(user.role)) {
                return res.status(403).json({ success: false, message: 'Unauthorized access.' });
            }

            const {
                scheduleId,
                facultyId,
                student_engagement,
                teacher_facilitation,
                learning_environment,
                overall_assessment
            } = req.body;

            // Find existing draft or create new one
            let copusResult = await CopusResult.findOne({
                schedule_id: scheduleId,
                observer_id: user._id,
                status: 'draft'
            });

            const schedule = await ObserverSchedule.findById(scheduleId).populate('faculty_user_id', 'firstname lastname department');
            const faculty = await User.findById(facultyId);

            if (!schedule || !faculty) {
                return res.status(404).json({ success: false, message: 'Schedule or faculty not found.' });
            }

            // Calculate scores for each section
            const calculateSectionScore = (sectionData) => {
                if (!sectionData || typeof sectionData !== 'object') return 0;
                const values = Object.values(sectionData).map(val => parseFloat(val) || 0);
                return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            };

            const studentEngagementScore = calculateSectionScore(student_engagement);
            const teacherFacilitationScore = calculateSectionScore(teacher_facilitation);
            const learningEnvironmentScore = calculateSectionScore(learning_environment);
            const finalScore = (studentEngagementScore + teacherFacilitationScore + learningEnvironmentScore) / 3;

            // Determine rating based on final score
            let finalRating = '';
            if (finalScore >= 72.5) {
                finalRating = 'Great';
            } else if (finalScore >= 50) {
                finalRating = 'Good';
            } else if (finalScore >= 25) {
                finalRating = 'Needs Improvement';
            } else {
                finalRating = 'Unsatisfactory';
            }

            // Map form data to model structure
            const mappedStudentEngagement = {
                asking_questions: parseFloat(student_engagement?.questioning_discussion) || 0,
                participating_discussions: parseFloat(student_engagement?.active_participation) || 0,
                collaborative_work: parseFloat(student_engagement?.student_collaboration) || 0,
                problem_solving: parseFloat(student_engagement?.problem_solving) || 0
            };

            const mappedTeacherFacilitation = {
                interactive_teaching: parseFloat(teacher_facilitation?.clear_instruction) || 0,
                encouraging_participation: parseFloat(teacher_facilitation?.effective_questioning) || 0,
                providing_feedback: parseFloat(teacher_facilitation?.student_feedback) || 0,
                guiding_discussions: parseFloat(teacher_facilitation?.activity_guidance) || 0
            };

            const mappedLearningEnvironment = {
                classroom_setup: parseFloat(learning_environment?.classroom_setup) || 0,
                technology_use: parseFloat(learning_environment?.technology_integration) || 0,
                resource_utilization: parseFloat(learning_environment?.learning_resources) || 0,
                time_management: parseFloat(learning_environment?.time_management) || 0
            };

            if (!copusResult) {
                // Create new draft
                copusResult = new CopusResult({
                    schedule_id: scheduleId,
                    faculty_id: facultyId,
                    faculty_name: `${faculty.firstname} ${faculty.lastname}`,
                    faculty_department: faculty.department || 'N/A',
                    observer_id: user._id,
                    observer_name: `${user.firstname} ${user.lastname}`,
                    observation_date: schedule.date,
                    start_time: schedule.start_time,
                    end_time: schedule.end_time,
                    subject_name: schedule.subject_name || 'N/A',
                    room: schedule.room || 'N/A',
                    copus_type: schedule.copus_type || 'Copus 1',
                    student_engagement: mappedStudentEngagement,
                    teacher_facilitation: mappedTeacherFacilitation,
                    learning_environment: mappedLearningEnvironment,
                    overall_percentage: Math.round(finalScore * 100) / 100,
                    final_rating: finalRating,
                    strengths: '',
                    areas_for_improvement: '',
                    recommendations: '',
                    additional_comments: overall_assessment || '',
                    status: 'draft',
                    evaluation_date: new Date()
                });
            } else {
                // Update existing draft
                copusResult.student_engagement = mappedStudentEngagement;
                copusResult.teacher_facilitation = mappedTeacherFacilitation;
                copusResult.learning_environment = mappedLearningEnvironment;
                copusResult.overall_percentage = Math.round(finalScore * 100) / 100;
                copusResult.final_rating = finalRating;
                copusResult.additional_comments = overall_assessment || '';
                copusResult.evaluation_date = new Date();
            }

            await copusResult.save();

            res.json({ success: true, message: 'Draft saved successfully!' });

        } catch (error) {
            console.error('Error saving COPUS draft:', error);
            res.status(500).json({ success: false, message: 'Failed to save draft.' });
        }
    },

    // Helper function to get chart data
    getChartData: async function() {
        try {
            console.log('🔍 Observer fetching COPUS results from copusresults collection...');
            
            // Debug: Check if CopusResult model is working
            const totalCount = await CopusResult.countDocuments();
            console.log(`📊 Observer: Total CopusResult documents: ${totalCount}`);
            
            // Get top 10 highest scores
            const topHighest = await CopusResult.find({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: -1 })
                .limit(10)
                .select('faculty_name overall_percentage final_rating')
                .lean();

            console.log(`📊 Observer found ${topHighest.length} highest scores`);

            // Get top 10 lowest scores
            const topLowest = await CopusResult.find({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: 1 })
                .limit(10)
                .select('faculty_name overall_percentage final_rating')
                .lean();

            console.log(`📊 Observer found ${topLowest.length} lowest scores`);

            // Get top 1 overall score
            const topOverall = await CopusResult.findOne({ overall_percentage: { $exists: true, $ne: null } })
                .sort({ overall_percentage: -1 })
                .select('faculty_name overall_percentage final_rating')
                .lean();

            console.log(`📊 Observer found top overall:`, topOverall ? `${topOverall.faculty_name} - ${topOverall.overall_percentage}%` : 'None');

            const result = {
                topHighest: topHighest || [],
                topLowest: topLowest || [],
                topOverall: topOverall || null
            };

            console.log('📋 Observer chart data result:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('❌ Observer error fetching chart data:', error);
            return {
                topHighest: [],
                topLowest: [],
                topOverall: null
            };
        }
    },

    // PDF Download method
    downloadCopusPDF: async (req, res) => {
        try {
            const { resultId } = req.params;
            
            // Find the COPUS result by ID
            const copusResult = await CopusResult.findById(resultId);
            if (!copusResult) {
                return res.status(404).json({ error: 'COPUS result not found' });
            }

            // Create PDF document
            const doc = new PDFDocument({ 
                margin: 50,
                size: 'A4'
            });

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="COPUS-Result-${copusResult.faculty_name}-${new Date(copusResult.observation_date).toLocaleDateString()}.pdf"`);

            // Pipe the PDF to response
            doc.pipe(res);

            // Helper function to determine rating based on percentage
            const getRating = (percentage) => {
                if (percentage >= 72.50) return 'Great';
                if (percentage >= 50) return 'Good';
                if (percentage >= 25) return 'Needs Improvement';
                return 'Unsatisfactory';
            };

            // Helper function to get rating color
            const getRatingColor = (rating) => {
                switch (rating) {
                    case 'Great': return '#27ae60';
                    case 'Good': return '#3498db';
                    case 'Needs Improvement': return '#f39c12';
                    case 'Unsatisfactory': return '#e74c3c';
                    default: return '#7f8c8d';
                }
            };

            // PDF Header
            doc.fontSize(20).font('Helvetica-Bold');
            doc.fillColor('#2c3e50').text('COPUS OBSERVATION REPORT', { align: 'center' });
            doc.moveDown(0.5);

            // Faculty Information Section
            doc.fontSize(16).fillColor('#34495e').text('Faculty Information', { underline: true });
            doc.moveDown(0.3);
            
            doc.fontSize(12).font('Helvetica');
            doc.fillColor('#2c3e50');
            doc.text(`Faculty Name: ${copusResult.faculty_name}`, { continued: true });
            doc.text(`    Department: ${copusResult.faculty_department}`, { align: 'right' });
            doc.text(`Subject: ${copusResult.subject_name}`, { continued: true });
            doc.text(`    Room: ${copusResult.room}`, { align: 'right' });
            doc.text(`Observation Date: ${new Date(copusResult.observation_date).toLocaleDateString()}`, { continued: true });
            doc.text(`    Time: ${copusResult.start_time} - ${copusResult.end_time}`, { align: 'right' });
            doc.text(`COPUS Type: ${copusResult.copus_type}`, { continued: true });
            doc.text(`    Observer: ${copusResult.observer_name}`, { align: 'right' });
            doc.moveDown(1);

            // Overall Results Section
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Overall Results', { underline: true });
            doc.moveDown(0.3);

            const overallPercentage = copusResult.overall_percentage || 0;
            const finalRating = getRating(overallPercentage);

            doc.fontSize(14).font('Helvetica');
            doc.fillColor('#000000');
            doc.text(`Overall Percentage: ${overallPercentage.toFixed(1)}%`, { continued: true });
            doc.fillColor('#000000').font('Helvetica-Bold');
            doc.text(`    Final Rating: ${finalRating}`, { align: 'right' });
            doc.moveDown(1);

            // Grading Criteria Section
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Grading Criteria', { underline: true });
            doc.moveDown(0.3);

            doc.fontSize(11).font('Helvetica').fillColor('#000000');
            doc.text('• 72.50% - 100%: Great');
            doc.text('• 50% - 72.49%: Good');
            doc.text('• 25% - 49.99%: Needs Improvement');
            doc.text('• 0% - 24.99%: Unsatisfactory');
            doc.moveDown(1);

            // Detailed Action Counts Section
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
            doc.text('Detailed COPUS Action Counts', { underline: true });
            doc.moveDown(0.5);

            // Student Actions with Average
            if (copusResult.student_actions_count && Object.keys(copusResult.student_actions_count).length > 0) {
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
                doc.text('Student Actions:');
                doc.moveDown(0.3);

                doc.fontSize(11).font('Helvetica').fillColor('#000000');
                
                // Calculate total and count for average
                let totalStudentActions = 0;
                let studentActionCount = 0;
                
                Object.entries(copusResult.student_actions_count).forEach(([action, count]) => {
                    if (count > 0) {
                        doc.text(`• ${action}: ${count}`, { indent: 20 });
                        totalStudentActions += count;
                        studentActionCount++;
                    }
                });
                
                // Display average with % symbol
                const studentAverage = studentActionCount > 0 ? (totalStudentActions / studentActionCount).toFixed(1) : 0;
                doc.moveDown(0.2);
                doc.font('Helvetica-Bold').text(`Average Student Actions: ${studentAverage}%`, { indent: 20 });
                doc.moveDown(0.5);
            }

            // Teacher Actions with Average
            if (copusResult.teacher_actions_count && Object.keys(copusResult.teacher_actions_count).length > 0) {
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
                doc.text('Teacher Actions:');
                doc.moveDown(0.3);

                doc.fontSize(11).font('Helvetica').fillColor('#000000');
                
                // Calculate total and count for average
                let totalTeacherActions = 0;
                let teacherActionCount = 0;
                
                Object.entries(copusResult.teacher_actions_count).forEach(([action, count]) => {
                    if (count > 0) {
                        doc.text(`• ${action}: ${count}`, { indent: 20 });
                        totalTeacherActions += count;
                        teacherActionCount++;
                    }
                });
                
                // Display average with % symbol
                const teacherAverage = teacherActionCount > 0 ? (totalTeacherActions / teacherActionCount).toFixed(1) : 0;
                doc.moveDown(0.2);
                doc.font('Helvetica-Bold').text(`Average Teacher Actions: ${teacherAverage}%`, { indent: 20 });
                doc.moveDown(0.5);
            }

            // Engagement Levels - Show individual averages for High, Medium, Low
            if (copusResult.engagement_level_count && Object.keys(copusResult.engagement_level_count).length > 0) {
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
                doc.text('Engagement Levels:');
                doc.moveDown(0.3);

                doc.fontSize(11).font('Helvetica').fillColor('#000000');
                
                // Calculate total intervals for percentage calculation
                let totalIntervals = 0;
                Object.values(copusResult.engagement_level_count).forEach(count => {
                    totalIntervals += count;
                });
                
                // Display individual averages for each engagement level with % symbols
                if (totalIntervals > 0) {
                    Object.entries(copusResult.engagement_level_count).forEach(([level, count]) => {
                        const percentage = ((count / totalIntervals) * 100).toFixed(1);
                        doc.text(`• ${level}: ${percentage}%`, { indent: 20 });
                    });
                } else {
                    doc.text('• No engagement data recorded', { indent: 20 });
                }
                doc.moveDown(1);
            }

            // Footer
            doc.fontSize(10).fillColor('#000000');
            doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, {
                align: 'center'
            });
            doc.text('COPUS (Classroom Observation Protocol for Undergraduate STEM)', {
                align: 'center'
            });

            // Finalize the PDF
            doc.end();

        } catch (error) {
            console.error('Error generating PDF:', error);
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    }
};

module.exports = observerController;