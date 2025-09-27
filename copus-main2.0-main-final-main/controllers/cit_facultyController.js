const mongoose = require('mongoose');
const User = require('../model/employee'); // Corrected import to 'employee'
const Schedule = require('../model/schedule');
const CopusObservation = require('../model/copusObservation');
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

            const facultySchedules = await Schedule.find({
                faculty_user_id: user._id, // Use faculty_user_id for schedules where this user is the observed faculty
                status: { $in: ['scheduled', 'approved', 'completed'] }
            })
            .populate('observers.observer_id', 'firstname lastname')
            .lean();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const availableSchedules = await Schedule.find({
                status: 'pending',
                faculty_user_id: { $in: [null, undefined] }, // Schedules not yet assigned to an observed faculty.
                date: { $gte: today }
            }).lean();

            const calendarEvents = facultySchedules.map(schedule => {
                const title = `${schedule.copus_type || 'Observation'} - ${schedule.faculty_subject_name || schedule.subject_name || 'N/A'}`;
                const startDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.start_time}`;
                const endDateTime = `${schedule.date.toISOString().split('T')[0]}T${schedule.end_time}`;

                let eventColor = '#3788d8';
                if (schedule.status === 'completed') {
                    eventColor = '#28a745';
                } else if (schedule.status === 'approved') {
                    eventColor = '#ffc107';
                } else if (schedule.status === 'cancelled') {
                    eventColor = '#dc3545';
                }

                return {
                    id: schedule._id.toString(),
                    title: title,
                    start: startDateTime,
                    end: endDateTime,
                    color: eventColor,
                    extendedProps: {
                        modality: schedule.modality,
                        room: schedule.faculty_room || 'N/A',
                        observer: schedule.observers.map(o => o.observer_id ? `${o.observer_id.firstname} ${o.observer_id.lastname}` : 'N/A').join(', '),
                        status: schedule.status,
                        copusType: schedule.copus_type
                    }
                };
            });

            const availableDates = new Set(availableSchedules.map(sch => sch.date.toISOString().split('T')[0]));

            availableDates.forEach(dateString => {
                calendarEvents.push({
                    id: `available-${dateString}`,
                    title: 'Available Slot(s)',
                    start: dateString,
                    display: 'background',
                    color: '#add8e6'
                });
            });

            res.render('CIT_Faculty/dashboard', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                calendarEvents: JSON.stringify(calendarEvents),
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

            const rawCompletedSchedules = await Schedule.find({
                faculty_user_id: user._id,
                status: 'completed'
            })
            .populate('faculty_user_id', 'firstname lastname employeeId department')
            .populate('observers.observer_id', 'firstname lastname')
            .sort({ date: -1, start_time: -1 })
            .lean();

            console.log(`Step 1: Found ${rawCompletedSchedules.length} raw completed schedules.`);
            if (rawCompletedSchedules.length === 0) {
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

            const formattedCompletedSchedules = rawCompletedSchedules.map(schedule => {
                const facultyDetails = schedule.faculty_user_id;

                if (!facultyDetails) {
                    console.warn(`Warning: schedule.faculty_user_id not populated for schedule ID: ${schedule._id}. Using logged-in user details.`);
                }
                if (!schedule.observers || schedule.observers.length === 0) {
                    console.warn(`Warning: No observers found for schedule ID: ${schedule._id}.`);
                }

                const observerNames = schedule.observers
                    .map(obs => obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'N/A')
                    .filter(name => name !== 'N/A')
                    .join(', ');

                const formattedSchedule = {
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
                };
                console.log(`Step 2: Formatted Schedule ID ${formattedSchedule._id}:`, formattedSchedule);
                return formattedSchedule;
            });

            console.log(`Step 3: Total formatted schedules prepared: ${formattedCompletedSchedules.length}`);
            console.log('--- END: getCopusResultList for Faculty ---');

            res.render('CIT_Faculty/copus_result', {
                firstName: user.firstname,
                lastName: user.lastname,
                employeeId: user.employeeId,
                completedSchedules: formattedCompletedSchedules,
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

    // GET /CIT_Faculty_copus_history
    getCopusHistory: async (req, res) => {
        try {
            const facultyUser = await User.findById(req.session.user.id).lean();
            if (!facultyUser || facultyUser.role !== 'Faculty') {
                console.warn('User not found or unauthorized for CIT Faculty COPUS history. Redirecting to login.');
                req.flash('error_msg', 'Unauthorized access.');
                return res.redirect('/login');
            }

            const rawHistorySchedules = await Schedule.find({
                faculty_user_id: facultyUser._id,
                status: { $in: ['completed', 'cancelled'] }
            })
            .populate('observers.observer_id', 'firstname lastname')
            .sort({ date: -1, start_time: -1 })
            .lean();

            const transformedHistorySchedules = await Promise.all(rawHistorySchedules.map(async (schedule) => {
                const facultyName = `${schedule.faculty_firstname || 'N/A'} ${schedule.faculty_lastname || 'N/A'}`;
                const facultyDepartment = schedule.faculty_department || 'N/A';
                const subjectCode = schedule.faculty_subject_code || 'N/A';
                const subjectName = schedule.faculty_subject_name || 'N/A';
                const copusType = schedule.copus_type || 'N/A';
                const room = schedule.faculty_room || 'N/A';

                const observerNames = schedule.observers
                    .map(obs => (obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'N/A'))
                    .join(', ');

                const copusObservations = await CopusObservation.find({ scheduleId: schedule._id })
                    .populate('observerId', 'firstname lastname')
                    .sort({ copusNumber: 1 })
                    .lean();

                return {
                    _id: schedule._id,
                    fullname: facultyName,
                    firstname: schedule.faculty_firstname,
                    lastname: schedule.faculty_lastname,
                    department: facultyDepartment,
                    date: schedule.date,
                    start_time: schedule.start_time,
                    end_time: schedule.end_time,
                    year_level: schedule.year_level,
                    school_year: schedule.school_year,
                    semester: schedule.semester,
                    subject_code: subjectCode,
                    subject: subjectName,
                    observer: observerNames,
                    modality: schedule.modality,
                    copus: copusType,
                    status: schedule.status,
                    copusObservations: copusObservations,
                };
            }));

            res.render('CIT_Faculty/copus_history', {
                firstName: facultyUser.firstname,
                lastName: facultyUser.lastname,
                employeeId: facultyUser.employeeId,
                completedSchedules: transformedHistorySchedules,
                error_msg: req.flash('error_msg'),
                success_msg: req.flash('success_msg')
            });

        } catch (err) {
            console.error('Error fetching completed COPUS history for CIT Faculty:', err);
            req.flash('error_msg', 'Failed to load COPUS History view.');
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

    // GET /CIT_Faculty_available_schedule - Enhanced for new workflow
    getAvailableSchedules: async (req, res) => {
        try {
            const facultyUser = await User.findById(req.session.user.id);
            if (!facultyUser) {
                return res.redirect('/login');
            }

            // Get observation slots created by ALC that are available for faculty selection
            const availableSchedules = await Schedule.find({
                schedule_type: 'observation_slot',
                status: 'available_for_selection',
                faculty_user_id: null // Not yet assigned to any faculty
            })
            .populate('observers.observer_id', 'firstname lastname role')
            .populate('created_by_user_id', 'firstname lastname')
            .sort({ date: 1, start_time: 1 })
            .lean();

            res.render('CIT_Faculty/available_schedule', {
                availableSchedules,
                firstName: facultyUser.firstname,
                lastName: facultyUser.lastname,
                employeeId: facultyUser.employeeId,
                department: facultyUser.department,
                success_msg: req.flash('success'),
                error_msg: req.flash('error')
            });

        } catch (err) {
            console.error('Error fetching available schedules:', err);
            res.status(500).redirect('/CIT_Faculty_dashboard');
        }
    },

    // POST /faculty_select_schedule_slot
    selectScheduleSlot: async (req, res) => {
        try {
            const facultyUser = await User.findById(req.session.user.id);
            if (!facultyUser) {
                return res.redirect('/login');
            }

            const {
                scheduleId,
                subjectCode,
                subjectName,
                room
            } = req.body;

            const schedule = await Schedule.findById(scheduleId);
            if (!schedule) {
                req.flash('error', 'Schedule not found.');
                return res.redirect('/CIT_Faculty_available_schedule');
            }

            // Verify schedule is available for selection
            if (schedule.schedule_type !== 'observation_slot' || schedule.status !== 'available_for_selection') {
                req.flash('error', 'This schedule slot is no longer available.');
                return res.redirect('/CIT_Faculty_available_schedule');
            }

            // Update schedule with faculty selection
            schedule.faculty_user_id = facultyUser._id;
            schedule.faculty_employee_id = facultyUser.employeeId;
            schedule.faculty_firstname = facultyUser.firstname;
            schedule.faculty_lastname = facultyUser.lastname;
            schedule.faculty_department = facultyUser.department;
            schedule.faculty_subject_code = subjectCode;
            schedule.faculty_subject_name = subjectName;
            schedule.faculty_room = room;
            schedule.schedule_type = 'faculty_selected';
            schedule.status = 'scheduled'; // Now scheduled for observation

            await schedule.save();

            // Create notifications for assigned observers
            for (const observer of schedule.observers) {
                await Notification.create({
                    userId: observer.observer_id,
                    title: 'New Faculty Schedule Selected',
                    message: `${facultyUser.firstname} ${facultyUser.lastname} has selected a schedule slot for observation on ${new Date(schedule.date).toLocaleDateString()}.`,
                    type: 'schedule_selection',
                    relatedId: schedule._id
                });
            }

            // Log the action
            await Log.create({
                action: 'Faculty Schedule Selection',
                performedBy: facultyUser._id,
                performedByRole: facultyUser.role,
                details: `Faculty ${facultyUser.firstname} ${facultyUser.lastname} selected observation slot for ${new Date(schedule.date).toLocaleDateString()} at ${schedule.start_time}`
            });

            req.flash('success', 'Schedule slot selected successfully! Observers have been notified.');
            res.redirect('/CIT_Faculty_schedule_management');

        } catch (err) {
            console.error('Error selecting schedule slot:', err);
            req.flash('error', 'Failed to select schedule slot.');
            res.redirect('/CIT_Faculty_available_schedule');
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

        // Fetch schedules for the logged-in faculty member
        const schedules = await FacultySchedule.find({
            faculty_user_id: userId
        })
        .populate('faculty_user_id')
        .sort({
            createdAt: -1
        });

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

    

};

module.exports = citFacultyController;