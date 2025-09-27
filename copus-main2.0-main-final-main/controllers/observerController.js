// controllers/observerController.js

// Import necessary Mongoose models
const User = require('../model/employee'); // Adjust path as needed
const Schedule = require('../model/schedule'); // Adjust path as needed
const CopusObservation = require('../model/copusObservation'); // Adjust path as needed
const Notification = require('../model/Notification'); // Adjust path as needed
const Appointment = require('../model/Appointment'); // Adjust path as needed
const Log = require('../model/log');           // Adjust path as needed
const mongoose = require('mongoose');

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

            // Fetch schedules where the current user is an assigned observer
            const schedules = await Schedule.find({
                'observers.observer_id': user._id
            }).lean();

            const eventMap = {};

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
                const totalInProgress = scheduleList.filter(s => s.status.toLowerCase() === 'in progress').length;
                const totalApproved = scheduleList.filter(s => s.status.toLowerCase() === 'approved').length;
                const totalScheduled = scheduleList.filter(s => s.status.toLowerCase() === 'scheduled').length;
                const totalAvailable = scheduleList.filter(s => s.status.toLowerCase() === 'available').length;


                let color = 'orange'; // Default for pending/mixed
                let statusLabel = 'Mixed Status'; // Default label

                if (totalCompleted === total && total > 0) {
                    color = 'green';
                    statusLabel = 'Completed';
                } else if (totalCancelled === total && total > 0) {
                    color = 'red';
                    statusLabel = 'Cancelled';
                } else if (totalPending === total && total > 0) {
                    color = 'orange';
                    statusLabel = 'Pending';
                } else if (totalInProgress === total && total > 0) {
                    color = 'blue'; // Or another color for in progress
                    statusLabel = 'In Progress';
                } else if (totalApproved === total && total > 0) {
                    color = '#28a745'; // Bootstrap green for approved
                    statusLabel = 'Approved';
                } else if (totalScheduled === total && total > 0) {
                    color = '#17a2b8'; // Bootstrap info blue for scheduled
                    statusLabel = 'Scheduled';
                } else if (totalAvailable === total && total > 0) {
                    color = '#ffc107'; // Bootstrap yellow for available
                    statusLabel = 'Available';
                } else {
                    // For mixed statuses, show a summary
                    const parts = [];
                    if (totalCompleted > 0) parts.push(`${totalCompleted} ✅`);
                    if (totalCancelled > 0) parts.push(`${totalCancelled} ❌`);
                    if (totalPending > 0) parts.push(`${totalPending} ⏳`);
                    if (totalInProgress > 0) parts.push(`${totalInProgress} ⚙️`);
                    if (totalApproved > 0) parts.push(`${totalApproved} ✔️`);
                    if (totalScheduled > 0) parts.push(`${totalScheduled} 🗓️`);
                    if (totalAvailable > 0) parts.push(`${totalAvailable} 🆓`);
                    statusLabel = parts.join(' / ') || 'No Schedules';
                    color = 'gray'; // Neutral color for mixed
                }


                return {
                    title: statusLabel,
                    date,
                    color
                };
            });

            res.render('Observer/dashboard', {
                employeeId: user.employeeId,
                firstName: user.firstname,
                lastName: user.lastname,
                calendarEvents: JSON.stringify(calendarEvents),
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

    // GET /alc_create_observation_schedule (ALC creates observation slots from admin templates)
    getObservationScheduleCreation: async (req, res) => {
        try {
            const currentUser = await User.findById(req.session.user.id);
            if (!currentUser || currentUser.role !== 'Observer (ALC)') {
                req.flash('error', 'Access denied. Only ALC observers can create observation schedules.');
                return res.redirect('/Observer_dashboard');
            }

            // Get admin template schedules that haven't been converted to observation slots yet
            const adminTemplates = await Schedule.find({
                schedule_type: 'admin_template',
                status: 'pending'
            })
            .populate('faculty_user_id', 'firstname lastname department employeeId')
            .sort({ date: 1, start_time: 1 })
            .lean();

            // Get all observers for assignment
            const observers = await User.find({
                $or: [
                    { role: 'Observer' },
                    { role: 'Observer (ALC)' },
                    { role: 'Observer (SLC)' }
                ]
            }).lean();

            res.render('Observer/create_observation_schedule', {
                adminTemplates,
                observers,
                firstName: currentUser.firstname,
                lastName: currentUser.lastname,
                employeeId: currentUser.employeeId,
                success_msg: req.flash('success'),
                error_msg: req.flash('error')
            });

        } catch (err) {
            console.error('Error loading observation schedule creation:', err);
            sendResponseAndRedirect(req, res, '/Observer_dashboard', 'error', 'Failed to load observation schedule creation.');
        }
    },

    // POST /alc_create_observation_slots
    createObservationSlots: async (req, res) => {
        try {
            const currentUser = await User.findById(req.session.user.id);
            if (!currentUser || currentUser.role !== 'Observer (ALC)') {
                return sendResponseAndRedirect(req, res, '/Observer_dashboard', 'error', 'Access denied.');
            }

            const {
                selectedTemplates, // Array of template schedule IDs
                observerAssignments, // Object mapping template IDs to observer IDs
                copusType,
                subjectCode,
                subjectName,
                room
            } = req.body;

            const createdSlots = [];

            for (const templateId of selectedTemplates) {
                const template = await Schedule.findById(templateId).populate('faculty_user_id');
                if (!template) continue;

                const assignedObservers = observerAssignments[templateId] || [];
                const observerDetails = [];

                // Build observer details array
                for (const observerId of assignedObservers) {
                    const observer = await User.findById(observerId);
                    if (observer) {
                        observerDetails.push({
                            observer_id: observer._id,
                            observer_name: `${observer.firstname} ${observer.lastname}`,
                            status: 'pending',
                            observer_role: observer.role
                        });
                    }
                }

                // Create observation slot based on admin template
                const observationSlot = new Schedule({
                    date: template.date,
                    start_time: template.start_time,
                    end_time: template.end_time,
                    year_level: template.year_level,
                    school_year: template.school_year,
                    semester: template.semester,
                    modality: template.modality,
                    
                    // Faculty information from template
                    faculty_user_id: template.faculty_user_id._id,
                    faculty_employee_id: template.faculty_employee_id,
                    faculty_firstname: template.faculty_firstname,
                    faculty_lastname: template.faculty_lastname,
                    faculty_department: template.faculty_department,
                    
                    // NEW: Observation-specific fields
                    faculty_subject_code: subjectCode,
                    faculty_subject_name: subjectName,
                    faculty_room: room,
                    copus_type: copusType,
                    
                    // Workflow fields
                    schedule_type: 'observation_slot',
                    created_by_role: currentUser.role,
                    created_by_user_id: currentUser._id,
                    template_schedule_id: template._id,
                    status: 'available_for_selection',
                    
                    observers: observerDetails
                });

                await observationSlot.save();
                createdSlots.push(observationSlot);

                // Update original template status
                template.status = 'scheduled';
                await template.save();
            }

            // Log the action
            await Log.create({
                action: 'Create Observation Slots',
                performedBy: currentUser._id,
                performedByRole: currentUser.role,
                details: `ALC created ${createdSlots.length} observation slots for faculty evaluation`
            });

            req.flash('success', `Successfully created ${createdSlots.length} observation slots for faculty selection!`);
            res.redirect('/alc_create_observation_schedule');

        } catch (err) {
            console.error('Error creating observation slots:', err);
            sendResponseAndRedirect(req, res, '/alc_create_observation_schedule', 'error', 'Failed to create observation slots.');
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

            // --- MODIFICATION HERE: Populate faculty_user_id ---
            const observerSchedules = await Schedule.find({
                'observers.observer_id': currentUser._id
            })
            .populate({
                path: 'faculty_user_id', // This path should match the field in your Schedule model that references the User model
                select: 'firstname lastname department' // Select the fields you need from the User model
            })
            .sort({ date: 1, start_time: 1 })
            .lean();

            console.log(`[getScheduleManagement] Fetched ${observerSchedules.length} schedules for observer ${currentUser.firstname} ${currentUser.lastname} (Role: ${currentUser.role}, ID: ${currentUser._id}).`);
            if (observerSchedules.length === 0) {
                console.log("[getScheduleManagement] No schedules found for this observer using the 'observers.observer_id' query.");
            }

            // Log populated data for debugging
            console.log("Sample populated schedule:", JSON.stringify(observerSchedules[0], null, 2));


            res.render('Observer/schedule_management', {
                observerSchedules,
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

            const schedule = await Schedule.findById(scheduleId)
                .populate('faculty_user_id') // Corrected populate path
                .populate('observers.observer_id');

            if (!schedule) {
                console.log(`[startCopus1Observation] Schedule with ID ${scheduleId} not found.`);
                req.flash('error', 'Schedule not found.');
                return res.redirect('/observer_copus');
            }

            console.log(`[startCopus1Observation] Found schedule: ${schedule._id}, Current Status: ${schedule.status}`);
            console.log(`[startCopus1Observation] Schedule observers:`, schedule.observers);

            const isAssignedObserver = schedule.observers.some(obs => {
                const match = obs.observer_id && obs.observer_id._id.equals(user.id) && (obs.status === 'accepted' || obs.status === 'pending');
                if (match) {
                    console.log(`[startCopus1Observation] User ${user.id} found as assigned observer with status ${obs.status}.`);
                }
                return match;
            });

            if (!isAssignedObserver) {
                console.log(`[startCopus1Observation] User ${user.id} is NOT an assigned or active observer for this schedule.`);
                req.flash('error', 'You are not assigned to this schedule or your assignment is not active.');
                return res.redirect('/observer_copus');
            }

            if (schedule.status === 'completed' || schedule.status === 'cancelled') {
                console.log(`[startCopus1Observation] Schedule ${scheduleId} is already ${schedule.status}, cannot start observation.`);
                req.flash('error', `This schedule is already ${schedule.status} and cannot be started.`);
                return res.redirect('/observer_copus');
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

            if (schedule.status !== 'in progress') {
                schedule.status = 'in progress';
                console.log(`[startCopus1Observation] Attempting to save schedule ${scheduleId} with new status: 'in progress'`);
                await schedule.save();
                console.log(`[startCopus1Observation] Schedule ${scheduleId} successfully saved as 'in progress'.`);

                await Log.create({
                    action: 'Start Observation',
                    performedBy: user.id,
                    performedByRole: user.role,
                    details: `Started COPUS 1 observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_user_id ? schedule.faculty_user_id.firstname : schedule.faculty_firstname} ${schedule.faculty_user_id ? schedule.faculty_user_id.lastname : schedule.faculty_lastname})`
                });
                console.log('[startCopus1Observation] Log entry created.');
            } else {
                console.log(`[startCopus1Observation] Schedule ${scheduleId} is already 'in progress', no status update needed.`);
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
                observer: schedule.observers.map(obs => obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'N/A').join(', '),
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
            res.redirect('/observer_copus');
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

        const scheduleId = copusObservation.scheduleId;
        if (!scheduleId) {
            console.error('[Controller] Schedule ID is missing in the CopusObservation record:', copusDetailsId);
            return res.status(500).json({ message: 'Internal error: Schedule ID is missing from the observation record.' });
        }

        const schedule = await Schedule.findById(scheduleId);
        if (!schedule) {
            console.error('[Controller] Schedule not found for ID:', scheduleId);
            return res.status(404).json({ message: 'Schedule not found for this observation (using the ID from the observation record).' });
        }

        const observerObjectId = new mongoose.Types.ObjectId(observerId);
        const isAssignedObserver = schedule.observers.some(obs =>
            obs.observer_id.equals(observerObjectId) && obs.status === 'accepted'
        );

        if (!isAssignedObserver) {
            console.warn(`[Controller] Unauthorized attempt by observer ${observerId} for schedule ${scheduleId}`);
            return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule or your assignment is not accepted.' });
        }

        copusObservation.observations = copusRecords;
        copusObservation.overallComments = overallComments;
        copusObservation.updatedAt = new Date();

        await copusObservation.save();
        console.log('[Controller] Existing CopusObservation updated with ID:', copusObservation._id);

        schedule.status = 'completed';
        await schedule.save();
        console.log('[Controller] Schedule status updated to "completed" for ID:', schedule._id);

        const facultyUser = await User.findById(schedule.faculty_id);
        const facultyName = facultyUser ? `${facultyUser.firstname} ${facultyUser.lastname}` : 'Unknown Faculty';

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
        try {
            const { scheduleId, copusNumber, observations, overallComments } = req.body;
            const observerId = req.session.user.id;

            if (!scheduleId || !copusNumber || !observations || !Array.isArray(observations)) {
                return res.status(400).json({ message: 'Missing required observation data.' });
            }

            const schedule = await Schedule.findById(scheduleId);
            if (!schedule) {
                return res.status(404).json({ message: 'Schedule not found.' });
            }

            const isAssignedObserver = schedule.observers.some(obs =>
                obs.observer_id.equals(observerId) && obs.status === 'accepted'
            );

            if (!isAssignedObserver) {
                return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule.' });
            }

            const newObservation = new CopusObservation({
                scheduleId,
                observerId,
                copusNumber,
                observations,
                overallComments
            });

            await newObservation.save();

            schedule.status = 'completed';
            await schedule.save();

            await Log.create({
                action: 'Submit COPUS Observation',
                performedBy: observerId,
                performedByRole: req.session.user.role,
                details: `Submitted COPUS ${copusNumber} observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_firstname} ${schedule.faculty_lastname})`
            });

            res.status(200).json({ message: 'Observation submitted successfully!', observationId: newObservation._id });

        } catch (error) {
            console.error('Error saving Copus 2 observation:', error);
            res.status(500).json({ message: 'Failed to save observation.', error: error.message });
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
        try {
            const { scheduleId, copusNumber, observations, overallComments } = req.body;
            const observerId = req.session.user.id;

            if (!scheduleId || !copusNumber || !observations || !Array.isArray(observations)) {
                return res.status(400).json({ message: 'Missing required observation data.' });
            }

            const schedule = await Schedule.findById(scheduleId);
            if (!schedule) {
                return res.status(404).json({ message: 'Schedule not found.' });
            }

            const isAssignedObserver = schedule.observers.some(obs =>
                obs.observer_id.equals(observerId) && obs.status === 'accepted'
            );

            if (!isAssignedObserver) {
                return res.status(403).json({ message: 'You are not authorized to submit observation for this schedule.' });
            }

            const newObservation = new CopusObservation({
                scheduleId,
                observerId,
                copusNumber,
                observations,
                overallComments
            });

            await newObservation.save();

            schedule.status = 'completed';
            await schedule.save();

            await Log.create({
                action: 'Submit COPUS Observation',
                performedBy: observerId,
                performedByRole: req.session.user.role,
                details: `Submitted COPUS ${copusNumber} observation for schedule ID: ${scheduleId} (Faculty: ${schedule.faculty_firstname} ${schedule.faculty_lastname})`
            });

            res.status(200).json({ message: 'Observation submitted successfully!', observationId: newObservation._id });

        } catch (error) {
            console.error('Error saving Copus 3 observation:', error);
            res.status(500).json({ message: 'Failed to save observation.', error: error.message });
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

            res.render('Observer/copus_result', {
                completedSchedules: schedulesWithObservationDetails, // Pass the enhanced data
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                user: user, // Passing the full user object might be useful in the EJS
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error fetching completed schedules for Copus Result list:', err);
            req.flash('error', 'Failed to load completed schedules: ' + err.message); // Show error message from populate
            res.status(500).render('Observer/copus_result', {
                completedSchedules: [], // Ensure an empty array is passed on error
                firstName: req.session.user ? req.session.user.firstname : '',
                lastName: req.session.user ? req.session.user.lastname : '',
                employeeId: req.session.user ? req.session.user.employeeId : '',
                user: req.session.user || null,
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

    // GET /Observer_copus_history
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

            // Define the base query: only schedules assigned to the logged-in observer and are completed
            let query = {
                'observers.observer_id': user._id, // Filter by the current observer's ID
                status: 'completed'
            };

            // Get filter criteria from query parameters
            const facultyNameQuery = req.query.facultyName; // e.g., ?facultyName=John Doe
            const departmentQuery = req.query.department;   // e.g., ?department=CIT
            const subjectQuery = req.query.subject;     // e.g., ?subject=ITE 368

            // Apply filters if provided
            if (facultyNameQuery) {
                // To search for faculty name, you might need to handle first and last names
                // This assumes your Schedule model has 'firstname' and 'lastname' fields for the observed faculty
                const nameParts = facultyNameQuery.split(' ').filter(Boolean); // Split by space, remove empty strings
                if (nameParts.length === 1) {
                    // If only one part, search both first and last name for it
                    query.$or = [
                        { firstname: { $regex: new RegExp(nameParts[0], 'i') } },
                        { lastname: { $regex: new RegExp(nameParts[0], 'i') } }
                    ];
                } else if (nameParts.length > 1) {
                    // If multiple parts, assume first and last name
                    query.$and = [
                        { firstname: { $regex: new RegExp(nameParts[0], 'i') } },
                        { lastname: { $regex: new RegExp(nameParts[nameParts.length - 1], 'i') } }
                    ];
                }
                // If you store the full name in one field like 'facultyName' in your Schedule model, use:
                // query.facultyName = { $regex: new RegExp(facultyNameQuery, 'i') };
            }

            if (departmentQuery) {
                query.department = { $regex: new RegExp(departmentQuery, 'i') };
            }

            if (subjectQuery) {
                query.subject = { $regex: new RegExp(subjectQuery, 'i') };
            }

            // Fetch schedules based on the constructed query
            const completedSchedules = await Schedule.find(query)
                .sort({ date: -1, start_time: -1 })
                .lean();

            res.render('Observer/copus_history', {
                completedSchedules: completedSchedules,
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        } catch (err) {
            console.error('Error fetching completed COPUS history:', err);
            req.flash('error', 'Failed to load COPUS history.');
            res.status(500).render('Observer/copus_history', {
                completedSchedules: [],
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
    }
};

module.exports = observerController;