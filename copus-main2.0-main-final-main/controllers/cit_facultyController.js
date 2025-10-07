const mongoose = require('mongoose');
const User = require('../model/employee'); // Corrected import to 'employee'
const Schedule = require('../model/schedule');
const ObserverSchedule = require('../model/observerSchedule');
const CopusObservation = require('../model/copusObservation');
const CopusResult = require('../model/copusResult');
const Log = require('../model/log');
const FacultySchedule = require('../model/facultySchedule');

// Helper function to calculate tallies and percentages from the 'observations' array
const calculateCopusMetrics = (observations) => {
    const studentActions = {};
    const teacherActions = {};
    const engagementCounts = { High: 0, Med: 0, Low: 0 };
    const totalIntervals = observations.length;

    observations.forEach(record => {
        if (record.studentActions instanceof Map) {
            for (const [action, value] of record.studentActions.entries()) {
                if (value === 1) {
                    studentActions[action] = (studentActions[action] || 0) + 1;
                }
            }
        } else if (typeof record.studentActions === 'object' && record.studentActions !== null) {
            for (const action in record.studentActions) {
                if (record.studentActions[action] === 1) {
                    studentActions[action] = (studentActions[action] || 0) + 1;
                }
            }
        }

        if (record.teacherActions instanceof Map) {
            for (const [action, value] of record.teacherActions.entries()) {
                if (value === 1) {
                    teacherActions[action] = (teacherActions[action] || 0) + 1;
                }
            }
        } else if (typeof record.teacherActions === 'object' && record.teacherActions !== null) {
            for (const action in record.teacherActions) {
                if (record.teacherActions[action] === 1) {
                    teacherActions[action] = (teacherActions[action] || 0) + 1;
                }
            }
        }

        if (record.engagementLevel) {
            if (record.engagementLevel.High === 1) {
                engagementCounts.High++;
            }
            if (record.engagementLevel.Med === 1) {
                engagementCounts.Med++;
            }
            if (record.engagementLevel.Low === 1) {
                engagementCounts.Low++;
            }
        }
    });

    const engagementPercentages = {
        High: 0,
        Med: 0,
        Low: 0
    };

    if (totalIntervals > 0) {
        engagementPercentages.High = (engagementCounts.High / totalIntervals) * 100;
        engagementPercentages.Med = (engagementCounts.Med / totalIntervals) * 100;
        engagementPercentages.Low = (engagementCounts.Low / totalIntervals) * 100;
    }

    return {
        tallies: {
            studentActions,
            teacherActions,
            totalIntervals
        },
        engagementPercentages,
        overallComments: observations.map(obs => obs.comment).filter(Boolean).join(' ') || 'No interval comments provided.'
    };
};

// A unified function to save COPUS observations, reducing code duplication.
const saveCopusResult = async (req, res, copusNumber) => {
    try {
        const { observations: receivedObservations, overallComments } = req.body;
        const user = req.session.user;
        const scheduleId = req.session.scheduleId;

        if (!scheduleId || !Array.isArray(receivedObservations) || receivedObservations.length === 0) {
            req.flash('error_msg', 'Invalid observation data submitted.');
            return res.status(400).redirect(`/CIT_Faculty_copus_result${copusNumber}/${scheduleId}`);
        }

        const formattedObservations = receivedObservations.map(row => ({
            intervalNumber: row.intervalNumber,
            studentActions: new Map(Object.entries(row.student)),
            teacherActions: new Map(Object.entries(row.teacher)),
            engagementLevel: {
                High: row.engagement?.High || 0,
                Med: row.engagement?.Med || 0,
                Low: row.engagement?.Low || 0,
            },
            comment: row.comment || '',
            recordedAt: new Date()
        }));

        let existingObservation = await CopusObservation.findOne({
            scheduleId: scheduleId,
            copusNumber: copusNumber
        });

        if (existingObservation) {
            existingObservation.observations = formattedObservations;
            existingObservation.overallComments = overallComments;
            existingObservation.dateSubmitted = new Date();
            existingObservation.observerId = user.id;
            await existingObservation.save();
            req.flash('success_msg', `COPUS Observation ${copusNumber} data updated successfully!`);
        } else {
            const newObservation = new CopusObservation({
                scheduleId,
                copusNumber,
                observerId: user.id,
                observations: formattedObservations,
                overallComments: overallComments,
                dateSubmitted: new Date()
            });
            await newObservation.save();
            req.flash('success_msg', `COPUS Observation ${copusNumber} data saved successfully!`);
        }

        if (copusNumber === 3) {
            const markSched = await Schedule.findById(scheduleId);
            if (markSched && markSched.status !== "completed") {
                markSched.status = "completed";
                await markSched.save();
                await Log.create({
                    action: 'Schedule Completed',
                    performedBy: user._id,
                    performedByRole: user.role,
                    details: `Schedule ID: ${scheduleId} marked as completed after COPUS 3 observation submission.`
                });
            } else if (!markSched) {
                console.warn('Schedule not found when trying to mark as completed:', scheduleId);
            }
        }

        res.redirect(`/CIT_Faculty_copus_result${copusNumber}/${scheduleId}`);
    } catch (err) {
        console.error(`Error saving COPUS ${copusNumber} observation:`, err);
        req.flash('error_msg', `Failed to save COPUS ${copusNumber} Observation data: ` + err.message);
        res.status(500).redirect(`/CIT_Faculty_copus_result${copusNumber}/${req.session.scheduleId || ''}`);
    }
};

const citFacultyController = {
    // GET /CIT_Faculty_dashboard
    getDashboard: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            console.log(`\n=== FACULTY DASHBOARD DEBUG ===`);
            console.log(`Logged-in user: ${user.firstname} ${user.lastname} (ID: ${user._id})`);
            console.log(`Employee ID: ${user.employeeId}, Role: ${user.role}`);

            // Get observation schedules for this faculty member from ObserverSchedule collection
            const observationSchedules = await ObserverSchedule.find({
                faculty_user_id: user._id // Observation schedules where this user is being observed
            })
            .populate('observer_id', 'firstname lastname')
            .lean();

            console.log(`Found ${observationSchedules.length} observation schedules for faculty ${user.firstname} ${user.lastname}`);
            observationSchedules.forEach((schedule, index) => {
                console.log(`  Schedule ${index + 1}:`);
                console.log(`    - Faculty ID in schedule: ${schedule.faculty_user_id}`);
                console.log(`    - Observer: ${schedule.observer_id ? schedule.observer_id.firstname + ' ' + schedule.observer_id.lastname : 'N/A'}`);
                console.log(`    - Type: ${schedule.copus_type}`);
                console.log(`    - Date: ${schedule.date}`);
                console.log(`    - Status: ${schedule.status}`);
            });

            // Get faculty's own teaching schedules (available slots)
            const facultySchedules = await Schedule.find({
                faculty_user_id: user._id // Faculty's teaching schedules
            })
            .lean();

            console.log(`Found ${facultySchedules.length} teaching schedules for faculty ${user.firstname} ${user.lastname}`);

            // Create calendar events for observations
            const observationEvents = observationSchedules.map((schedule, index) => {
                if (!schedule.date || isNaN(new Date(schedule.date))) {
                    console.log(`Skipping observation ${index + 1} with invalid date:`, schedule._id);
                    return null;
                }

                const observerName = schedule.observer_id ? 
                    `${schedule.observer_id.firstname} ${schedule.observer_id.lastname}` : 
                    schedule.observer_name || 'Observer';

                const title = `${schedule.copus_type} - ${observerName}`;
                const startDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.start_time}`;
                const endDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.end_time}`;

                let eventColor = '#3498db'; // Default scheduled color (blue)
                let className = 'fc-event-scheduled';
                
                if (schedule.status === 'completed') {
                    eventColor = '#2ecc71'; // Green for completed
                    className = 'fc-event-completed';
                } else if (schedule.status === 'cancelled') {
                    eventColor = '#e74c3c'; // Red for cancelled
                    className = 'fc-event-cancelled';
                } else if (schedule.status === 'in_progress') {
                    eventColor = '#f39c12'; // Orange for in progress  
                    className = 'fc-event-in-progress';
                }

                console.log(`  Creating calendar event ${index + 1}:`);
                console.log(`    - Title: ${title}`);
                console.log(`    - Start: ${startDateTime}`);
                console.log(`    - End: ${endDateTime}`);
                console.log(`    - Color: ${eventColor}`);

                return {
                    id: schedule._id.toString(),
                    title: title,
                    start: startDateTime,
                    end: endDateTime,
                    color: eventColor,
                    className: className,
                    extendedProps: {
                        type: 'observation',
                        observerName: observerName,
                        copusType: schedule.copus_type,
                        status: schedule.status,
                        room: schedule.room
                    }
                };
            }).filter(event => event !== null);

            // Create calendar events for available teaching slots
            const availableSlotEvents = facultySchedules.map(schedule => {
                if (!schedule.date || isNaN(new Date(schedule.date))) {
                    console.log('Skipping teaching schedule with invalid date:', schedule._id);
                    return null;
                }

                const title = `Available Slot - ${schedule.day_of_week}`;
                const startDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.start_time || '08:00'}`;
                const endDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.end_time || '10:00'}`;

                return {
                    id: `teaching_${schedule._id.toString()}`,
                    title: title,
                    start: startDateTime,
                    end: endDateTime,
                    color: '#27ae60', // Green for available slots
                    className: 'fc-event-available',
                    display: 'background', // Show as background event
                    extendedProps: {
                        type: 'available_slot',
                        room: schedule.faculty_room,
                        status: 'available'
                    }
                };
            }).filter(event => event !== null);

            // Combine all calendar events
            const calendarEvents = [...observationEvents, ...availableSlotEvents];
            
            console.log(`Faculty Dashboard: Generated ${calendarEvents.length} calendar events for ${user.firstname} ${user.lastname}`);
            console.log('Sample events:', calendarEvents.slice(0, 2));

            // Add detailed debugging for calendar events
            console.log('=== FACULTY DASHBOARD DEBUG ===');
            console.log('User:', user.firstname, user.lastname, user._id);
            console.log('Total calendar events:', calendarEvents.length);
            console.log('Calendar events JSON:', JSON.stringify(calendarEvents, null, 2));
            console.log('=== END DEBUG ===');

            res.render('CIT_Faculty/dashboard', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                calendarEvents: JSON.stringify(calendarEvents), // Pass as JSON string for the template
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error fetching data for dashboard:', err);
            req.flash('error_msg', 'Failed to load dashboard.');
            res.status(500).redirect('/login');
        }
    },

    // GET /CIT_Faculty_copus_result (List of completed schedules for result viewing)
    getCopusResultList: async (req, res) => {
        console.log('\n--- START: getCopusResultList for Faculty ---');
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                console.log('Error: User not found in session. Redirecting to login.');
                return res.redirect('/login');
            }
            console.log(`Logged-in Faculty: ${user.firstname} ${user.lastname} (ID: ${user._id})`);

            // Get completed observation schedules for this faculty
            const completedObservationSchedules = await ObserverSchedule.find({
                faculty_user_id: user._id,
                status: 'completed'
            })
            .populate('observer_id', 'firstname lastname')
            .sort({ date: -1, start_time: -1 })
            .lean();

            console.log(`Step 1: Found ${completedObservationSchedules.length} completed observation schedules.`);

            // Also get old completed schedules for backward compatibility
            const rawCompletedSchedules = await Schedule.find({
                faculty_user_id: user._id,
                status: 'completed'
            })
            .populate('faculty_user_id', 'firstname lastname employeeId department')
            .populate('observers.observer_id', 'firstname lastname')
            .sort({ date: -1, start_time: -1 })
            .lean();

            console.log(`Step 2: Found ${rawCompletedSchedules.length} old completed schedules.`);

            // Get COPUS evaluation results for this faculty
            const copusResults = await CopusResult.find({
                faculty_id: user._id
            })
            .populate('observer_id', 'firstname lastname')
            .populate('schedule_id')
            .sort({ evaluation_date: -1 })
            .lean();

            console.log(`Step 3: Found ${copusResults.length} COPUS evaluation results.`);

            // Format new observation schedules with evaluation results
            const formattedObservationSchedules = await Promise.all(
                completedObservationSchedules.map(async schedule => {
                    // Find corresponding evaluation result
                    const evaluationResult = copusResults.find(result => 
                        result.schedule_id && result.schedule_id.toString() === schedule._id.toString()
                    );

                    const observerName = schedule.observer_id ? 
                        `${schedule.observer_id.firstname} ${schedule.observer_id.lastname}` : 'N/A';

                    return {
                        _id: schedule._id,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        employeeId: user.employeeId,
                        department: user.department,
                        date: schedule.date,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time,
                        year_level: schedule.year_level || 'N/A',
                        semester: schedule.semester || 'N/A',
                        subject_code: schedule.subject_code || 'N/A',
                        subject: schedule.subject_name || 'N/A',
                        modality: schedule.modality || 'N/A',
                        copus: schedule.copus_type || 'N/A',
                        observer: observerName,
                        room: schedule.room || 'N/A',
                        hasEvaluation: !!evaluationResult,
                        evaluationResult: evaluationResult ? {
                            final_score: evaluationResult.final_score,
                            final_rating: evaluationResult.final_rating,
                            student_engagement_score: evaluationResult.student_engagement_score,
                            teacher_facilitation_score: evaluationResult.teacher_facilitation_score,
                            learning_environment_score: evaluationResult.learning_environment_score,
                            overall_assessment: evaluationResult.overall_assessment,
                            evaluation_date: evaluationResult.evaluation_date
                        } : null
                    };
                })
            );

            // Format old schedules for backward compatibility
            const formattedOldSchedules = rawCompletedSchedules.map(schedule => {
                const facultyDetails = schedule.faculty_user_id;
                const observerNames = schedule.observers
                    .map(obs => obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'N/A')
                    .filter(name => name !== 'N/A')
                    .join(', ');

                return {
                    _id: schedule._id,
                    firstname: schedule.faculty_firstname || (facultyDetails ? facultyDetails.firstname : user.firstname),
                    lastname: schedule.faculty_lastname || (facultyDetails ? facultyDetails.lastname : user.lastname),
                    employeeId: schedule.faculty_employee_id || (facultyDetails ? facultyDetails.employeeId : user.employeeId),
                    department: schedule.faculty_department || (facultyDetails ? facultyDetails.department : user.department),
                    date: schedule.date,
                    start_time: schedule.start_time,
                    end_time: schedule.end_time,
                    year_level: schedule.year_level,
                    semester: schedule.semester,
                    subject_code: schedule.faculty_subject_code || schedule.subject_code || 'N/A',
                    subject: schedule.faculty_subject_name || schedule.subject_name || 'N/A',
                    modality: schedule.modality || 'N/A',
                    copus: schedule.copus_type || 'N/A',
                    observer: observerNames || 'N/A',
                    hasEvaluation: false,
                    evaluationResult: null,
                    isOldFormat: true
                };
            });

            // Combine both types of schedules
            const allCompletedSchedules = [...formattedObservationSchedules, ...formattedOldSchedules];

            console.log(`Step 4: Total formatted schedules prepared: ${allCompletedSchedules.length}`);
            console.log('--- END: getCopusResultList for Faculty ---');

            if (allCompletedSchedules.length === 0) {
                console.log('No completed schedules found for this faculty user. Rendering empty list.');
                return res.render('CIT_Faculty/copus_result', {
                    firstName: user.firstname,
                    lastName: user.lastname,
                    employeeId: user.employeeId,
                    completedSchedules: [],
                    error_msg: req.flash('error_msg'),
                    success_msg: req.flash('success_msg')
                });
            }

            res.render('CIT_Faculty/copus_result', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                completedSchedules: allCompletedSchedules,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('CRITICAL ERROR in getCopusResultList:', err);
            req.flash('error_msg', 'An unexpected error occurred while loading your COPUS results.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_copus_result1/:scheduleId
    getCopusResult1: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const currentFacultyId = req.session.user.id;

            const copusObservation = await CopusObservation.findOne({
                scheduleId: scheduleId,
                copusNumber: 1
            })
            .populate({
                path: 'scheduleId',
                model: 'Schedule',
                populate: [
                    {
                        path: 'faculty_user_id',
                        model: 'User', // Assuming your User model is named 'User' and not 'employee'
                        select: 'firstname lastname department employeeId'
                    },
                    {
                        path: 'observers.observer_id',
                        model: 'User', // Assuming your User model is named 'User' and not 'employee'
                        select: 'firstname lastname'
                    }
                ]
            })
            .populate('observerId', 'firstname lastname'); // Assuming your User model is named 'User' and not 'employee'

            if (!copusObservation) {
                console.warn(`No Copus 1 observation data found for scheduleId: ${scheduleId}`);
                req.flash('error_msg', 'No COPUS 1 observation data found for this schedule.');
                return res.render('CIT_Faculty/copus_result1', {
                    scheduleDetails: null,
                    tallies: null,
                    engagementPercentages: null,
                    overallComments: '',
                    message: req.flash('error_msg') || req.flash('success_msg'),
                    firstName: req.session.user.firstname,
                    lastName: req.session.user.lastname,
                    employeeId: req.session.user.employeeId
                });
            }

            const schedule = copusObservation.scheduleId;
            const observedFaculty = schedule.faculty_user_id;

            if (!schedule || !observedFaculty) {
                console.error('Associated schedule or observed faculty details not found for Copus Observation:', copusObservation._id);
                req.flash('error_msg', 'Associated schedule or observed faculty details not found.');
                return res.render('CIT_Faculty/copus_result1', {
                    scheduleDetails: null,
                    tallies: null,
                    engagementPercentages: null,
                    overallComments: '',
                    message: req.flash('error_msg') || req.flash('success_msg'),
                    firstName: req.session.user.firstname,
                    lastName: req.session.user.lastname,
                    employeeId: req.session.user.employeeId
                });
            }

            const isFacultyBeingObserved = observedFaculty._id.toString() === currentFacultyId.toString();
            const isObserverOfThisSchedule = schedule.observers.some(obs => obs.observer_id && obs.observer_id._id.toString() === currentFacultyId.toString());

            if (!isFacultyBeingObserved && !isObserverOfThisSchedule) {
                req.flash('error_msg', 'You are not authorized to view this observation result.');
                return res.redirect('/CIT_Faculty_dashboard');
            }

            const scheduleDetails = {
                firstname: observedFaculty.firstname,
                lastname: observedFaculty.lastname,
                employeeId: observedFaculty.employeeId,
                department: observedFaculty.department,
                date: schedule.date.toLocaleDateString(),
                start_time: schedule.start_time,
                end_time: schedule.end_time,
                year_level: schedule.year_level,
                semester: schedule.semester,
                subject_code: schedule.faculty_subject_code || schedule.subject_code || 'N/A',
                subject: schedule.faculty_subject_name || schedule.subject_name || 'N/A',
                room: schedule.faculty_room || schedule.room || 'N/A',
                observer: copusObservation.observerId ? `${copusObservation.observerId.firstname} ${copusObservation.observerId.lastname}` : 'N/A',
                modality: schedule.modality,
                copus_type: schedule.copus_type || `COPUS ${copusObservation.copusNumber}`
            };

            const { tallies, engagementPercentages, overallComments } = calculateCopusMetrics(copusObservation.observations);

            res.render('CIT_Faculty/copus_result1', {
                firstName: req.session.user.firstname,
                lastName: req.session.user.lastname,
                employeeId: req.session.user.employeeId,
                scheduleDetails: scheduleDetails,
                tallies: tallies,
                engagementPercentages: engagementPercentages,
                overallComments: copusObservation.overallComments || overallComments,
                message: req.flash('error_msg') || req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error retrieving Copus 1 observation results:', err);
            req.flash('error_msg', 'Internal Server Error when loading Copus 1 result.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_copus_result2/:scheduleId
    getCopusResult2: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const currentFacultyId = req.session.user.id;

            const copusObservation = await CopusObservation.findOne({
                scheduleId: scheduleId,
                copusNumber: 2
            })
                .populate({
                    path: 'scheduleId',
                    model: 'Schedule',
                    populate: [
                        { path: 'faculty_user_id', model: 'User', select: 'firstname lastname department employeeId' },
                        { path: 'observers.observer_id', model: 'User', select: 'firstname lastname' }
                    ]
                })
                .populate('observerId', 'firstname lastname');

            if (!copusObservation) {
                req.flash('error_msg', 'No Copus 2 observation found for this schedule.');
                return res.render('CIT_Faculty/copus_result2', {
                    scheduleDetails: null, tallies: null, engagementPercentages: null, overallComments: '',
                    message: req.flash('error_msg') || req.flash('success_msg'),
                    firstName: req.session.user.firstname, lastName: req.session.user.lastname, employeeId: req.session.user.employeeId
                });
            }

            const schedule = copusObservation.scheduleId;
            const observedFaculty = schedule.faculty_user_id;

            const isFacultyBeingObserved = observedFaculty._id.toString() === currentFacultyId.toString();
            const isObserverOfThisSchedule = schedule.observers.some(obs => obs.observer_id && obs.observer_id._id.toString() === currentFacultyId.toString());

            if (!isFacultyBeingObserved && !isObserverOfThisSchedule) {
                req.flash('error_msg', 'You are not authorized to view this observation result.');
                return res.redirect('/CIT_Faculty_dashboard');
            }

            const scheduleDetails = {
                firstname: observedFaculty.firstname, lastname: observedFaculty.lastname, employeeId: observedFaculty.employeeId, department: observedFaculty.department,
                date: schedule.date.toLocaleDateString(), start_time: schedule.start_time, end_time: schedule.end_time,
                year_level: schedule.year_level, semester: schedule.semester,
                subject_code: schedule.faculty_subject_code || schedule.subject_code || 'N/A',
                subject: schedule.faculty_subject_name || schedule.subject_name || 'N/A',
                room: schedule.faculty_room || schedule.room || 'N/A',
                observer: copusObservation.observerId ? `${copusObservation.observerId.firstname} ${copusObservation.observerId.lastname}` : 'N/A',
                modality: schedule.modality,
                copus_type: schedule.copus_type || `COPUS ${copusObservation.copusNumber}`
            };

            const { tallies, engagementPercentages, overallComments } = calculateCopusMetrics(copusObservation.observations);

            res.render('CIT_Faculty/copus_result2', {
                firstName: req.session.user.firstname, lastName: req.session.user.lastname, employeeId: req.session.user.employeeId,
                scheduleDetails: scheduleDetails, tallies: tallies, engagementPercentages: engagementPercentages,
                overallComments: copusObservation.overallComments || overallComments,
                message: req.flash('error_msg') || req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error retrieving Copus 2 observation results:', err);
            req.flash('error_msg', 'Internal Server Error when loading Copus 2 result.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_copus_result3/:scheduleId
    getCopusResult3: async (req, res) => {
        try {
            const scheduleId = req.params.scheduleId;
            const currentFacultyId = req.session.user.id;

            const copusObservation = await CopusObservation.findOne({
                scheduleId: scheduleId,
                copusNumber: 3
            })
                .populate({
                    path: 'scheduleId',
                    model: 'Schedule',
                    populate: [
                        { path: 'faculty_user_id', model: 'User', select: 'firstname lastname department employeeId' },
                        { path: 'observers.observer_id', model: 'User', select: 'firstname lastname' }
                    ]
                })
                .populate('observerId', 'firstname lastname');

            if (!copusObservation) {
                req.flash('error_msg', 'No Copus 3 observation found for this schedule.');
                return res.render('CIT_Faculty/copus_result3', {
                    scheduleDetails: null, tallies: null, engagementPercentages: null, overallComments: '',
                    message: req.flash('error_msg') || req.flash('success_msg'),
                    firstName: req.session.user.firstname, lastName: req.session.user.lastname, employeeId: req.session.user.employeeId
                });
            }

            const schedule = copusObservation.scheduleId;
            const observedFaculty = schedule.faculty_user_id;

            const isFacultyBeingObserved = observedFaculty._id.toString() === currentFacultyId.toString();
            const isObserverOfThisSchedule = schedule.observers.some(obs => obs.observer_id && obs.observer_id._id.toString() === currentFacultyId.toString());

            if (!isFacultyBeingObserved && !isObserverOfThisSchedule) {
                req.flash('error_msg', 'You are not authorized to view this observation result.');
                return res.redirect('/CIT_Faculty_dashboard');
            }

            const scheduleDetails = {
                firstname: observedFaculty.firstname, lastname: observedFaculty.lastname, employeeId: observedFaculty.employeeId, department: observedFaculty.department,
                date: schedule.date.toLocaleDateString(), start_time: schedule.start_time, end_time: schedule.end_time,
                year_level: schedule.year_level, semester: schedule.semester,
                subject_code: schedule.faculty_subject_code || schedule.subject_code || 'N/A',
                subject: schedule.faculty_subject_name || schedule.subject_name || 'N/A',
                room: schedule.faculty_room || schedule.room || 'N/A',
                observer: copusObservation.observerId ? `${copusObservation.observerId.firstname} ${copusObservation.observerId.lastname}` : 'N/A',
                modality: schedule.modality,
                copus_type: schedule.copus_type || `COPUS ${copusObservation.copusNumber}`
            };

            const { tallies, engagementPercentages, overallComments } = calculateCopusMetrics(copusObservation.observations);

            res.render('CIT_Faculty/copus_result3', {
                firstName: req.session.user.firstname, lastName: req.session.user.lastname, employeeId: req.session.user.employeeId,
                scheduleDetails: scheduleDetails, tallies: tallies, engagementPercentages: engagementPercentages,
                overallComments: copusObservation.overallComments || overallComments,
                message: req.flash('error_msg') || req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error retrieving Copus 3 observation results:', err);
            req.flash('error_msg', 'Internal Server Error when loading Copus 3 result.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // POST /CIT_Faculty_copus_result1 (Save COPUS 1 observation)
    saveCopusResult1: async (req, res) => {
        await saveCopusResult(req, res, 1);
    },

    // POST /CIT_Faculty_copus_result2 (Save COPUS 2 observation)
    saveCopusResult2: async (req, res) => {
        await saveCopusResult(req, res, 2);
    },

    // POST /CIT_Faculty_copus_result3 (Save COPUS 3 observation)
    saveCopusResult3: async (req, res) => {
        await saveCopusResult(req, res, 3);
    },

    // GET /CIT_Faculty_copus_summary
    getCopusSummary: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            const facultySchedules = await Schedule.find({ faculty_user_id: user._id })
                .populate('observers.observer_id', 'firstname lastname')
                .lean();

            const copusObservations = await CopusObservation.find({
                scheduleId: { $in: facultySchedules.map(sch => sch._id) }
            })
                .populate('scheduleId')
                .populate('observerId', 'firstname lastname')
                .sort({ dateSubmitted: 1 })
                .lean();

            const summaryData = {};

            copusObservations.forEach(obs => {
                const metrics = calculateCopusMetrics(obs.observations);
                const schedule = obs.scheduleId;
                if (schedule) {
                    const key = `${schedule.date.toISOString().split('T')[0]}-${schedule.start_time}-${obs.copusNumber}`;
                    summaryData[key] = {
                        scheduleDate: schedule.date.toLocaleDateString(),
                        startTime: schedule.start_time,
                        endTime: schedule.end_time,
                        copusNumber: obs.copusNumber,
                        observerName: obs.observerId ? `${obs.observerId.firstname} ${obs.observerId.lastname}` : 'N/A',
                        modality: schedule.modality,
                        subject: schedule.faculty_subject_name || schedule.subject_name || 'N/A',
                        tallies: metrics.tallies,
                        engagementPercentages: metrics.engagementPercentages,
                        overallComments: obs.overallComments || metrics.overallComments
                    };
                }
            });

            res.render('CIT_Faculty/copus_summary', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                summaryData: Object.values(summaryData),
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });
        } catch (err) {
            console.error('Error fetching user data for copus_summary:', err);
            req.flash('error_msg', 'Failed to load Copus Summary view');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_copus_history - Display history and evaluation results (SIMPLIFIED)
    getCopusHistory: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            // Simply fetch all COPUS results for this faculty from copusresults collection
            const copusResults = await CopusResult.find({
                faculty_id: user._id
            })
            .sort({ evaluation_date: -1 })
            .lean();

            console.log(`Found ${copusResults.length} COPUS results for ${user.firstname} ${user.lastname}`);

            res.render('CIT_Faculty/copus_history', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                copusResults: copusResults,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error fetching COPUS history:', err);
            req.flash('error_msg', 'Failed to load COPUS History.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_setting
    getSetting: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            res.render('CIT_Faculty/setting', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                currentUser: user,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });
        } catch (err) {
            console.error('Error fetching user data for settings page:', err);
            req.flash('error_msg', 'Failed to load Settings view');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    getFacultySchedules: async (req, res) => {
    try {
        const userId = req.session.user.id;
        const facultyUser = await User.findById(userId);

        if (!facultyUser) {
            req.flash('error_msg', 'User not found.');
            return res.redirect('/login');
        }

        console.log(`Fetching schedules for faculty: ${facultyUser.firstname} ${facultyUser.lastname} (ID: ${userId})`);

        // Fetch schedules for the logged-in faculty member from the Schedule model
        const schedules = await Schedule.find({
            faculty_user_id: userId
        })
        .populate('faculty_user_id')
        .sort({
            createdAt: -1
        });

        console.log(`Found ${schedules.length} schedules for faculty member`);

        // The variables are correctly defined and passed to the view
        res.render('CIT_Faculty/schedule_management', {
            schedules,
            firstName: facultyUser.firstname,
            lastName: facultyUser.lastname,
            employeeId: facultyUser.employeeId,
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
        });

    } catch (err) {
        console.error('Error fetching faculty schedules:', err);
        // Ensure the page is rendered even on error, and pass an empty array for schedules
        req.flash('error_msg', 'Failed to retrieve schedules.');
        res.render('CIT_Faculty/schedule_management', {
            schedules: [], // Pass an empty array to prevent the ReferenceError
            firstName: '', // Pass a default empty string
            lastName: '', // Pass a default empty string
            employeeId: '', // Pass a default empty string
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
        });
    }
},

    // GET /CIT_Faculty_available_schedule - Display available schedule slots for faculty
    getAvailableSchedule: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return res.redirect('/login');
            }

            console.log(`\n=== FACULTY AVAILABLE SCHEDULE ===`);
            console.log(`Faculty: ${user.firstname} ${user.lastname} (ID: ${user._id})`);

            // Get available schedules for this faculty
            const availableSchedules = await ObserverSchedule.find({
                faculty_user_id: user._id,
                status: { $in: ['pending', 'confirmed'] }
            })
            .populate('observer_id', 'firstname lastname')
            .sort({ date: 1, start_time: 1 })
            .lean();

            console.log(`Found ${availableSchedules.length} available schedules.`);

            res.render('CIT_Faculty/available_schedule', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                department: user.department || 'N/A',
                availableSchedules: availableSchedules,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error fetching available schedules for CIT Faculty:', err);
            req.flash('error_msg', 'Failed to load Available Schedule view.');
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // GET /CIT_Faculty_evaluation_result/:scheduleId - Display detailed COPUS evaluation result
    getEvaluationResult: async (req, res) => {
        console.log('\n--- START: getEvaluationResult for Faculty ---');
        try {
            const scheduleId = req.params.scheduleId;
            const user = await User.findById(req.session.user.id);
            
            if (!user) {
                console.log('Error: User not found in session. Redirecting to login.');
                return res.redirect('/login');
            }

            console.log(`Getting evaluation result for schedule ${scheduleId} for faculty: ${user.firstname} ${user.lastname}`);

            // Find the evaluation result for this schedule
            const evaluationResult = await CopusResult.findOne({
                schedule_id: scheduleId,
                faculty_id: user._id
            })
            .populate('observer_id', 'firstname lastname')
            .populate('schedule_id')
            .lean();

            if (!evaluationResult) {
                req.flash('error_msg', 'No evaluation result found for this schedule.');
                return res.redirect('/CIT_Faculty_copus_result');
            }

            // Get the observer schedule details
            const observerSchedule = await ObserverSchedule.findById(scheduleId)
                .populate('observer_id', 'firstname lastname')
                .lean();

            console.log('Evaluation result found:', {
                final_score: evaluationResult.final_score,
                final_rating: evaluationResult.final_rating,
                evaluation_date: evaluationResult.evaluation_date
            });

            res.render('CIT_Faculty/evaluation_result', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                evaluationResult: evaluationResult,
                observerSchedule: observerSchedule,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('CRITICAL ERROR in getEvaluationResult:', err);
            req.flash('error_msg', 'An unexpected error occurred while loading the evaluation result.');
            res.status(500).redirect('/CIT_Faculty_copus_result');
        }
    },

    // GET /CIT_Faculty_evaluation_details/:id - Get detailed evaluation information for modal
    getEvaluationDetails: async (req, res) => {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user || user.role !== 'Faculty') {
                return res.status(401).json({ success: false, message: 'Unauthorized access.' });
            }

            const evaluationId = req.params.id;
            
            // Find the evaluation result
            const evaluation = await CopusResult.findOne({
                _id: evaluationId,
                faculty_id: user._id
            })
            .populate('observer_id', 'firstname lastname')
            .populate('schedule_id')
            .lean();

            if (!evaluation) {
                return res.status(404).json({ success: false, message: 'Evaluation not found.' });
            }

            // Format the response data
            const responseData = {
                _id: evaluation._id,
                observationDate: evaluation.evaluation_date,
                observerName: evaluation.observer_id ? 
                    `${evaluation.observer_id.firstname} ${evaluation.observer_id.lastname}` : 'Unknown',
                subjectName: evaluation.subject_name || 'N/A',
                yearLevel: evaluation.year_level || 'N/A',
                semester: evaluation.semester || 'N/A',
                observationDuration: evaluation.observation_duration || 'N/A',
                studentEngagementScore: evaluation.student_engagement_score || 0,
                teacherFacilitationScore: evaluation.teacher_facilitation_score || 0,
                learningEnvironmentScore: evaluation.learning_environment_score || 0,
                overallScore: evaluation.final_score || 0,
                rating: evaluation.final_rating || 'N/A',
                observations: evaluation.additional_notes || evaluation.comments || null
            };

            res.json({ 
                success: true, 
                evaluation: responseData 
            });

        } catch (err) {
            console.error('Error fetching evaluation details:', err);
            res.status(500).json({ 
                success: false, 
                message: 'An error occurred while loading evaluation details.' 
            });
        }
    },

};

module.exports = citFacultyController;