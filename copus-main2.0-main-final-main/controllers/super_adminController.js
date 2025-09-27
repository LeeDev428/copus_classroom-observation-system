// controllers/super_adminController.js

// Import necessary models and helpers (assuming they are defined elsewhere)
const User = require('../model/employee'); // Adjust path as per your project structure
const Schedule = require('../model/schedule'); // Adjust path
const CopusObservation = require('../model/copusObservation'); // Adjust path
const Log = require('../model/log'); // Adjust path
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Helper function (if it's not global or part of a utilities file)
function parseDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Month is 0-indexed in Date constructor
    return new Date(year, month - 1, day, hours, minutes);
}


// Dashboard Controller
exports.getDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect('/login');

        // --- Fetching Metric Card Data ---
        const totalObservations = await Schedule.countDocuments({});
        const totalObservers = await User.countDocuments({ role: 'Observer' });
        const totalCitFaculty = await User.countDocuments({ role: 'Faculty' });

        // --- Existing Calendar Event Logic ---
        const schedules = await Schedule.find({});
        const eventMap = {};

        schedules.forEach(sch => {
            const date = new Date(sch.date).toISOString().split('T')[0];
            if (!eventMap[date]) eventMap[date] = [];
            eventMap[date].push(sch);
        });

        const calendarEvents = Object.entries(eventMap).map(([date, scheduleList]) => {
            const total = scheduleList.length;
            const totalCompleted = scheduleList.filter(s => s.status && s.status.toLowerCase() === 'completed').length;
            const totalCancelled = scheduleList.filter(s => s.status && s.status.toLowerCase() === 'cancelled').length;
            const totalPending = scheduleList.filter(s => s.status && s.status.toLowerCase() === 'pending').length;

            let color = 'orange'; // Default to pending
            let statusLabel = 'Pending';

            if (totalCompleted === total && total > 0) {
                color = 'green';
                statusLabel = 'Completed';
            } else if (totalCancelled === total && total > 0) {
                color = 'red';
                statusLabel = 'Cancelled';
            } else if (totalPending === total && total > 0) {
                color = 'orange';
                statusLabel = 'Pending';
            } else if (totalCompleted > 0 || totalCancelled > 0 || totalPending > 0) {
                color = 'blue';
                statusLabel = `${totalCompleted} ✅ / ${totalCancelled} ❌ / ${totalPending} ⏳`;
            } else {
                color = 'gray';
                statusLabel = 'No Schedules';
            }

            return {
                title: statusLabel,
                start: date,
                color
            };
        });

        res.render('Super_Admin/dashboard', {
            employeeId: user.employeeId,
            firstName: user.firstname,
            lastName: user.lastname,
            totalObservations: totalObservations,
            totalObservers: totalObservers,
            totalCitFaculty: totalCitFaculty,
            calendarEvents: JSON.stringify(calendarEvents)
        });

    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Start Copus 1 Observation
exports.startCopus1 = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const schedule = await Schedule.findById(scheduleId);

        if (!schedule) {
            return res.status(404).send('Schedule not found');
        }

        req.session.scheduleId = scheduleId;

        const copusDetails = {
            fullname: `${schedule.firstname} ${schedule.lastname}`,
            department: schedule.department,
            date: new Date(schedule.date).toLocaleDateString(),
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            yearLevel: schedule.year_level,
            semester: schedule.semester,
            subjectCode: schedule.subject_code,
            subjectName: schedule.subject,
            mode: schedule.modality,
            observer: schedule.observer,
            copusType: schedule.copus
        };

        console.log(`Starting Copus 1 for schedule ID: ${scheduleId}`);

        res.render('super_admin/copus_start', {
            copusDetails,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId
        });
    } catch (error) {
        console.error('Error fetching schedule for Copus 1:', error);
        res.status(500).send('Internal server error');
    }
};

// Start Copus 2 Observation
exports.startCopus2 = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const schedule = await Schedule.findById(scheduleId);

        if (!schedule) {
            return res.status(404).send('Schedule not found');
        }

        req.session.scheduleId = scheduleId;

        const copusDetails = {
            fullname: `${schedule.firstname} ${schedule.lastname}`,
            department: schedule.department,
            date: new Date(schedule.date).toLocaleDateString(),
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            yearLevel: schedule.year_level,
            semester: schedule.semester,
            subjectCode: schedule.subject_code,
            subjectName: schedule.subject,
            mode: schedule.modality,
            observer: schedule.observer,
            copusType: schedule.copus
        };

        console.log(`Starting Copus 2 for schedule ID: ${scheduleId}`);

        res.render('super_admin/copus_start2', {
            copusDetails,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId
        });
    } catch (error) {
        console.error('Error fetching schedule for Copus 2:', error);
        res.status(500).send('Internal server error');
    }
};

// Start Copus 3 Observation
exports.startCopus3 = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const schedule = await Schedule.findById(scheduleId);

        if (!schedule) {
            return res.status(404).send('Schedule not found');
        }

        req.session.scheduleId = scheduleId;

        const copusDetails = {
            fullname: `${schedule.firstname} ${schedule.lastname}`,
            department: schedule.department,
            date: new Date(schedule.date).toLocaleDateString(),
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            yearLevel: schedule.year_level,
            semester: schedule.semester,
            subjectCode: schedule.subject_code,
            subjectName: schedule.subject,
            mode: schedule.modality,
            observer: schedule.observer,
            copusType: schedule.copus
        };

        console.log(`Starting Copus 3 for schedule ID: ${scheduleId}`);

        res.render('super_admin/copus_start3', {
            copusDetails,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId
        });
    } catch (error) {
        console.error('Error fetching schedule for Copus 3:', error);
        res.status(500).send('Internal server error');
    }
};

// Display Copus 1 result (with scheduleId in URL)
exports.getResultCopus1ById = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('Schedule ID is missing from URL.');
        }

        const copusObservation = await CopusObservation.findOne({
            scheduleId: scheduleId,
            copusNumber: 1,
            observerId: req.session.user.id
        }).sort({ dateSubmitted: -1 }).exec();

        if (!copusObservation) {
            return res.status(404).send('No Copus 1 observation found for this schedule.');
        }

        const scheduleDetails = await Schedule.findById(scheduleId);
        if (!scheduleDetails) {
            return res.status(404).send('Schedule details not found.');
        }

        const tallies = {
            studentActions: Object.fromEntries(copusObservation.studentActions || new Map()),
            teacherActions: Object.fromEntries(copusObservation.teacherActions || new Map()),
            engagementLevels: copusObservation.engagementLevels || { High: 0, Med: 0, Low: 0 },
        };

        const totalIntervals = Object.values(tallies.studentActions).reduce((sum, count) => sum + count, 0);

        const engagementPercentages = {
            High: totalIntervals > 0 ? (tallies.engagementLevels.High / totalIntervals) * 100 : 0,
            Med: totalIntervals > 0 ? (tallies.engagementLevels.Med / totalIntervals) * 100 : 0,
            Low: totalIntervals > 0 ? (tallies.engagementLevels.Low / totalIntervals) * 100 : 0
        };

        const copusDetails = {
            copusType: `Copus ${copusObservation.copusNumber}`
        };

        res.render('super_admin/copus_result1', {
            tallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId,
            scheduleId: scheduleId,
            copusDetails: copusDetails,
            scheduleDetails: scheduleDetails
        });
    } catch (err) {
        console.error('Error retrieving Copus 1 observation results:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Display Copus 2 result (with scheduleId in URL)
exports.getResultCopus2ById = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('Schedule ID is missing from URL.');
        }

        const copusObservation = await CopusObservation.findOne({
            scheduleId: scheduleId,
            copusNumber: 2,
            observerId: req.session.user.id
        }).sort({ dateSubmitted: -1 }).exec();

        if (!copusObservation) {
            return res.status(404).send('No Copus 2 observation found for this schedule.');
        }

        const scheduleDetails = await Schedule.findById(scheduleId);
        if (!scheduleDetails) {
            return res.status(404).send('Schedule details not found.');
        }

        const tallies = {
            studentActions: copusObservation.studentActions || {},
            teacherActions: copusObservation.teacherActions || {},
            engagementLevels: copusObservation.engagementLevels || { High: 0, Med: 0, Low: 0 },
        };

        const totalIntervals = Object.values(tallies.studentActions).reduce((sum, count) => sum + count, 0);

        const engagementPercentages = {
            High: totalIntervals > 0 ? (tallies.engagementLevels.High / totalIntervals) * 100 : 0,
            Med: totalIntervals > 0 ? (tallies.engagementLevels.Med / totalIntervals) * 100 : 0,
            Low: totalIntervals > 0 ? (tallies.engagementLevels.Low / totalIntervals) * 100 : 0
        };

        res.render('super_admin/copus_result2', {
            tallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId,
            scheduleDetails: scheduleDetails
        });
    } catch (err) {
        console.error('Error retrieving Copus 2 observation results:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Display aggregated Copus 3 result (with scheduleId in URL)
exports.getAggregatedResultCopus3ById = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('Schedule ID is missing from URL.');
        }

        const scheduleDetails = await Schedule.findById(scheduleId);
        if (!scheduleDetails) {
            return res.status(404).send('Schedule details not found.');
        }

        const copusObservations = await CopusObservation.find({
            scheduleId: scheduleId,
            observerId: req.session.user.id
        }).exec();

        if (copusObservations.length === 0) {
            return res.status(404).send('No observations found for this schedule.');
        }

        const aggregatedTallies = {
            studentActions: {},
            teacherActions: {},
            engagementLevels: { High: 0, Med: 0, Low: 0 },
            totalIntervals: 0
        };

        copusObservations.forEach(obs => {
            for (const [action, count] of Object.entries(obs.studentActions || {})) {
                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + count;
            }

            for (const [action, count] of Object.entries(obs.teacherActions || {})) {
                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + count;
            }

            for (const level of ['High', 'Med', 'Low']) {
                aggregatedTallies.engagementLevels[level] += obs.engagementLevels?.[level] || 0;
            }

            aggregatedTallies.totalIntervals += Object.values(obs.studentActions || {}).reduce((a, b) => a + b, 0);
        });

        const engagementPercentages = {
            High: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.High / aggregatedTallies.totalIntervals) * 100 : 0,
            Med: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Med / aggregatedTallies.totalIntervals) * 100 : 0,
            Low: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Low / aggregatedTallies.totalIntervals) * 100 : 0
        };

        res.render('super_admin/copus_result3', {
            tallies: aggregatedTallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId,
            scheduleDetails: scheduleDetails
        });
    } catch (err) {
        console.error('Error retrieving aggregated COPUS observations:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Save Copus 1 Observation
exports.saveCopus1 = async (req, res) => {
    try {
        const { rows } = req.body;
        const user = req.session.user;
        const scheduleId = req.session.scheduleId;
        const copusNumber = 1;

        if (!scheduleId) {
            return res.status(400).send('Schedule ID not found in session. Please start an observation first.');
        }

        const collectedComments = rows.map(row => row.comment).filter(Boolean).join(' ') || 'No comments provided.';

        const copusObservation = new CopusObservation({
            scheduleId,
            copusNumber,
            studentActions: rows.reduce((acc, row) => {
                for (const action in row.student) {
                    acc[action] = (acc[action] || 0) + row.student[action];
                }
                return acc;
            }, {}),
            teacherActions: rows.reduce((acc, row) => {
                for (const action in row.teacher) {
                    acc[action] = (acc[action] || 0) + row.teacher[action];
                }
                return acc;
            }, {}),
            engagementLevels: {
                High: rows.reduce((acc, row) => acc + (row.engagement?.High || 0), 0),
                Med: rows.reduce((acc, row) => acc + (row.engagement?.Med || 0), 0),
                Low: rows.reduce((acc, row) => acc + (row.engagement?.Low || 0), 0),
            },
            comments: collectedComments,
            observerId: user.id
        });

        await copusObservation.save();

        res.redirect(`/super_admin_copus_result1/${scheduleId}`); // Redirect with scheduleId
    } catch (err) {
        console.error('Error saving COPUS 1 observation:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Save Copus 2 Observation
exports.saveCopus2 = async (req, res) => {
    try {
        const { rows } = req.body;
        const user = req.session.user;
        const scheduleId = req.session.scheduleId;
        const copusNumber = 2;

        if (!scheduleId) {
            return res.status(400).send('Schedule ID not found in session. Please start an observation first.');
        }

        const copusObservation = new CopusObservation({
            scheduleId,
            copusNumber,
            studentActions: rows.reduce((acc, row) => {
                for (const action in row.student) {
                    acc[action] = (acc[action] || 0) + row.student[action];
                }
                return acc;
            }, {}),
            teacherActions: rows.reduce((acc, row) => {
                for (const action in row.teacher) {
                    acc[action] = (acc[action] || 0) + row.teacher[action];
                }
                return acc;
            }, {}),
            engagementLevels: {
                High: rows.reduce((acc, row) => acc + (row.engagement?.High || 0), 0),
                Med: rows.reduce((acc, row) => acc + (row.engagement?.Med || 0), 0),
                Low: rows.reduce((acc, row) => acc + (row.engagement?.Low || 0), 0),
            },
            comments: rows.map(row => row.comment).filter(Boolean).join(' '),
            observerId: user.id
        });

        await copusObservation.save();

        res.redirect(`/super_admin_copus_result2/${scheduleId}`); // Redirect with scheduleId
    } catch (err) {
        console.error('Error saving COPUS 2 observation:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Save Copus 3 Observation
exports.saveCopus3 = async (req, res) => {
    try {
        const { rows } = req.body;
        const user = req.session.user;
        const scheduleId = req.session.scheduleId;
        const copusNumber = 3;

        if (!scheduleId) {
            return res.status(400).send('Schedule ID not found in session. Please start an observation first.');
        }

        const markSched = await Schedule.findById(scheduleId);
        if (markSched) {
            markSched.status = "completed";
            await markSched.save();
        } else {
            console.warn('Schedule not found when trying to mark as completed:', scheduleId);
        }

        const copusObservation = new CopusObservation({
            scheduleId,
            copusNumber,
            studentActions: rows.reduce((acc, row) => {
                for (const action in row.student) {
                    acc[action] = (acc[action] || 0) + row.student[action];
                }
                return acc;
            }, {}),
            teacherActions: rows.reduce((acc, row) => {
                for (const action in row.teacher) {
                    acc[action] = (acc[action] || 0) + row.teacher[action];
                }
                return acc;
            }, {}),
            engagementLevels: {
                High: rows.reduce((acc, row) => acc + (row.engagement?.High || 0), 0),
                Med: rows.reduce((acc, row) => acc + (row.engagement?.Med || 0), 0),
                Low: rows.reduce((acc, row) => acc + (row.engagement?.Low || 0), 0),
            },
            comments: rows.map(row => row.comment).filter(Boolean).join(' '),
            observerId: user.id
        });

        await copusObservation.save();

        res.redirect(`/super_admin_copus_result3/${scheduleId}`); // Redirect with scheduleId
    } catch (err) {
        console.error('Error saving COPUS 3 observation:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Display Copus 1 result (relying on session scheduleId) - **Consider deprecating this in favor of ID-based ones**
exports.getResultCopus1 = async (req, res) => {
    try {
        const scheduleId = req.session.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('No active schedule found in session.');
        }

        const copusObservation = await CopusObservation.findOne({
            scheduleId: scheduleId,
            copusNumber: 1,
            observerId: req.session.user.id
        }).sort({ dateSubmitted: -1 }).exec();

        if (!copusObservation) {
            return res.status(404).send('No Copus 1 observation found for this schedule.');
        }

        const tallies = {
            studentActions: Object.fromEntries(copusObservation.studentActions || new Map()),
            teacherActions: Object.fromEntries(copusObservation.teacherActions || new Map()),
            engagementLevels: copusObservation.engagementLevels || { High: 0, Med: 0, Low: 0 },
        };

        const totalIntervals = Object.values(tallies.studentActions).reduce((sum, count) => sum + count, 0);

        const engagementPercentages = {
            High: totalIntervals > 0 ? (tallies.engagementLevels.High / totalIntervals) * 100 : 0,
            Med: totalIntervals > 0 ? (tallies.engagementLevels.Med / totalIntervals) * 100 : 0,
            Low: totalIntervals > 0 ? (tallies.engagementLevels.Low / totalIntervals) * 100 : 0
        };

        const copusDetails = {
            copusType: `Copus ${copusObservation.copusNumber}`
        };

        res.render('super_admin/copus_result1', {
            tallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId,
            scheduleId: scheduleId,
            copusDetails: copusDetails
        });
    } catch (err) {
        console.error('Error retrieving Copus 1 observation results:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Display Copus 2 result (relying on session scheduleId) - **Consider deprecating this in favor of ID-based ones**
exports.getResultCopus2 = async (req, res) => {
    try {
        const scheduleId = req.session.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('No active schedule found in session.');
        }

        const copusObservation = await CopusObservation.findOne({
            scheduleId: scheduleId,
            copusNumber: 2,
            observerId: req.session.user.id
        }).sort({ dateSubmitted: -1 }).exec();

        if (!copusObservation) {
            return res.status(404).send('No Copus 2 observation found for this schedule.');
        }

        const tallies = {
            studentActions: copusObservation.studentActions || {},
            teacherActions: copusObservation.teacherActions || {},
            engagementLevels: copusObservation.engagementLevels || { High: 0, Med: 0, Low: 0 },
        };

        const totalIntervals = Object.values(tallies.studentActions).reduce((sum, count) => sum + count, 0);

        const engagementPercentages = {
            High: totalIntervals > 0 ? (tallies.engagementLevels.High / totalIntervals) * 100 : 0,
            Med: totalIntervals > 0 ? (tallies.engagementLevels.Med / totalIntervals) * 100 : 0,
            Low: totalIntervals > 0 ? (tallies.engagementLevels.Low / totalIntervals) * 100 : 0
        };

        res.render('super_admin/copus_result2', {
            tallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId
        });
    } catch (err) {
        console.error('Error retrieving Copus 2 observation results:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Display aggregated Copus 3 result (relying on session scheduleId) - **Consider deprecating this in favor of ID-based ones**
exports.getAggregatedResultCopus3 = async (req, res) => {
    try {
        const scheduleId = req.session.scheduleId;
        if (!scheduleId) {
            return res.status(400).send('No active schedule found in session.');
        }

        const copusObservations = await CopusObservation.find({
            scheduleId: scheduleId,
            observerId: req.session.user.id
        }).exec();

        if (copusObservations.length === 0) {
            return res.status(404).send('No observations found for this schedule.');
        }

        const aggregatedTallies = {
            studentActions: {},
            teacherActions: {},
            engagementLevels: { High: 0, Med: 0, Low: 0 },
            totalIntervals: 0
        };

        copusObservations.forEach(obs => {
            for (const [action, count] of Object.entries(obs.studentActions || {})) {
                aggregatedTallies.studentActions[action] = (aggregatedTallies.studentActions[action] || 0) + count;
            }

            for (const [action, count] of Object.entries(obs.teacherActions || {})) {
                aggregatedTallies.teacherActions[action] = (aggregatedTallies.teacherActions[action] || 0) + count;
            }

            for (const level of ['High', 'Med', 'Low']) {
                aggregatedTallies.engagementLevels[level] += obs.engagementLevels?.[level] || 0;
            }

            aggregatedTallies.totalIntervals += Object.values(obs.studentActions || {}).reduce((a, b) => a + b, 0);
        });

        const engagementPercentages = {
            High: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.High / aggregatedTallies.totalIntervals) * 100 : 0,
            Med: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Med / aggregatedTallies.totalIntervals) * 100 : 0,
            Low: aggregatedTallies.totalIntervals > 0 ? (aggregatedTallies.engagementLevels.Low / aggregatedTallies.totalIntervals) * 100 : 0
        };

        res.render('super_admin/copus_result3', {
            tallies: aggregatedTallies,
            engagementPercentages,
            firstName: req.session.user.firstname,
            lastName: req.session.user.lastname,
            employeeId: req.session.user.employeeId
        });
    } catch (err) {
        console.error('Error retrieving aggregated COPUS observations:', err);
        res.status(500).send('Internal Server Error');
    }
};


// User Management Controller
exports.getUserManagement = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.redirect('/login');
        }

        const employees = await User.find({ role: { $ne: 'super_admin' } });

        res.render('Super_Admin/user_management', {
            employees,
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId
        });
    } catch (err) {
        console.error('Error fetching user management data:', err);
        res.status(500).send('Failed to load user management view');
    }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
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

        // TODO: Send email to the user about status change

        res.status(200).send('Status updated');
    } catch (err) {
        console.error('Error updating user status:', err);
        res.status(500).send('Failed to update user status');
    }
};

// Update User Details
exports.updateUser = async (req, res) => {
    const { employeeId, department, lastname, firstname, role, email } = req.body;

    try {
        const user = await User.findById(req.session.user.id); // This is the user performing the update
        
        // Find the user to be updated by employeeId
        const updated = await User.findOneAndUpdate(
            { employeeId: employeeId }, // Query by employeeId
            { department, lastname, firstname, role, email }, // Fields to update
            { new: true, runValidators: true } // `new: true` returns the updated doc; `runValidators: true` ensures enum validation
        );

        if (!updated) {
            req.flash('error_msg', 'Employee not found for update.');
            return res.status(404).redirect('/super_admin_user_management');
        }

        await Log.create({
            action: 'Update Employee',
            performedBy: user.id, // ID of the admin performing the update
            performedByRole: user.role,
            details: `Updated employee: ${updated.firstname} ${updated.lastname} (ID: ${updated.employeeId}), role: ${updated.role}, department: ${updated.department}.`
        });

        req.flash('success_msg', 'User updated successfully!');
        res.redirect('/super_admin_user_management');
    } catch (err) {
        console.error('Error updating user:', err);
        // More specific error handling for validation errors
        if (err.name === 'ValidationError') {
            req.flash('error_msg', `Validation Error: ${err.message}`);
        } else {
            req.flash('error_msg', 'Failed to update user. Please try again.');
        }
        res.status(500).redirect('/super_admin_user_management');
    }
};
// Create Schedule
exports.createSchedule = async (req, res) => {
    const {
        firstname,
        lastname,
        department,
        date,
        start_time,
        end_time,
        year_level,
        semester,
        subject_code,
        subject,
        observer,
        modality,
    } = req.body;

    const user = await User.findById(req.session.user.id);

    try {
        // You might want to add a check here for overlapping schedules before saving
        // using the parseDateTime helper and checking existing 'approved' schedules for the observer.

        const newSchedule = new Schedule({
            firstname,
            lastname,
            department,
            date,
            start_time,
            end_time,
            year_level,
            semester,
            subject_code,
            subject,
            observer,
            modality,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newSchedule.save();

        await Log.create({
            action: 'Create Schedule',
            performedBy: user.id,
            performedByRole: user.role,
            details: `Created a schedule for ${firstname} ${lastname} (Observer: ${observer}). Date : ${date}`
        });

        // TODO: Find the observer and the observed faculty and send an email notification

        res.redirect('/super_admin_schedule');
    } catch (err) {
        console.error('Error creating schedule:', err); // Log the actual error
        res.status(500).send('Failed to create schedule.'); // Send a proper error message
    }
};

//Super Admin
exports.getScheduleManagement = async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id).lean();
        if (!currentUser) {
            req.flash('error_msg', 'Unauthorized access. Please log in.');
            return res.redirect('/login');
        }

        let schedulesToDisplay;

        const baseScheduleQuery = Schedule.find()
            .sort({ date: 1, start_time: 1 })
            .populate({
                path: 'faculty_user_id',
                model: 'employee', // Use 'User' if that's your consistent user model
                select: 'firstname lastname department employeeId'
            })
            .populate({
                path: 'observers.observer_id',
                model: 'employee', // Use 'User' here as well for consistency
                select: 'firstname lastname role'
            });

        // Determine which schedules to fetch based on user role
        // A super_admin sees all schedules.
        // For other roles, filters apply.
        if (currentUser.role === 'super_admin') {
            schedulesToDisplay = await baseScheduleQuery.lean();
        } else if (currentUser.role === 'faculty') {
            schedulesToDisplay = await baseScheduleQuery.find({ faculty_user_id: currentUser._id }).lean();
        } else if (['Observer', 'Observer (ALC)', 'Observer (SLC)'].includes(currentUser.role)) {
            schedulesToDisplay = await baseScheduleQuery.find({
                'observers.observer_id': currentUser._id
            }).lean();
        } else {
            schedulesToDisplay = [];
            req.flash('error_msg', 'Your role does not have access to schedule management.');
            return res.redirect('/dashboard');
        }

        schedulesToDisplay = schedulesToDisplay || []; // Ensure it's an array

        // For each schedule, determine the 'myStatus' for the current logged-in user
        schedulesToDisplay = schedulesToDisplay.map(schedule => {
            // Find the specific entry for the current user within this schedule's observers
            const currentUserObserverEntry = schedule.observers.find(
                obs => obs.observer_id && obs.observer_id._id.toString() === currentUser._id.toString()
            );

            // Create a new observers array with formatted names for display
            const formattedObservers = schedule.observers.map(obs => ({
                observer_id: obs.observer_id ? obs.observer_id._id.toString() : null,
                observer_name: obs.observer_id ? `${obs.observer_id.firstname} ${obs.observer_id.lastname}` : 'Unknown Observer',
                observer_status: obs.observer_status
            }));

            return {
                ...schedule,
                faculty_firstname: schedule.faculty_user_id ? schedule.faculty_user_id.firstname : 'N/A',
                faculty_lastname: schedule.faculty_user_id ? schedule.faculty_user_id.lastname : 'N/A',
                faculty_department: schedule.faculty_user_id ? schedule.faculty_user_id.department : 'N/A',
                observers: formattedObservers,
                // **Corrected 'myStatus' logic:**
                // It should only reflect the current user's status if they are an observer
                myStatus: currentUserObserverEntry ? currentUserObserverEntry.observer_status : 'N/A'
            };
        });

        // Fetch all observers for the dropdown (this part remains the same)
        const allObservers = await User.find({
            $or: [
                { role: 'Observer' },
                { role: 'Observer (ALC)' },
                { role: 'Observer (SLC)' },
                { role: 'super_admin' }
            ]
        }).lean();

        res.render('Super_Admin/schedule', {
            facultySchedules: schedulesToDisplay,
            observers: allObservers,
            firstName: currentUser.firstname,
            lastName: currentUser.lastname,
            employeeId: currentUser.employeeId,
            department: currentUser.department,
            currentUser: currentUser,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (err) {
        console.error('Error fetching schedules or user data:', err);
        req.flash('error_msg', 'Failed to load schedules.');
        res.status(500).redirect('/Super_Admin_dashboard');
    }
};




// NEW: Observer (or Super Admin acting as Observer) accepts their assigned schedule slot
// The logic here is designed for a user to accept *their own* assignment.
// A Super Admin can use this if they are assigned as an observer.
exports.acceptObserverAssignment = async (req, res) => {
    try {
        const { scheduleId } = req.params; // Get schedule ID from URL parameters
        const observerUserId = req.session.user.id; // Get the ID of the logged-in user

        const observerUser = await User.findById(observerUserId);
        // Ensure only 'Observer' or 'super_admin' roles can accept assignments
        if (!observerUser || (observerUser.role !== 'observer' && observerUser.role !== 'super_admin')) {
            req.flash('error_msg', 'Unauthorized: Only designated observers can accept assignments.');
            return res.redirect('/login'); // Or a suitable unauthorized page
        }

        const schedule = await Schedule.findById(scheduleId);
        if (!schedule) {
            req.flash('error_msg', 'Schedule not found.');
            return res.redirect('/Super_Admin_schedule'); // Redirect back to Super Admin schedules
        }

        // Find the specific entry for this observer within the schedule's observers array
        const observerEntry = schedule.observers.find(
            (obs) => obs.observer_id && obs.observer_id.toString() === observerUserId
        );

        if (!observerEntry) {
            req.flash('error_msg', 'You are not assigned to this schedule, or your assignment is not found.');
            return res.redirect('/Super_Admin_schedule');
        }

        // --- Conflict Check for Observer's Existing Accepted Schedules ---
        const newAssignmentDate = schedule.date.toISOString().split('T')[0]; //YYYY-MM-DD
        const newAssignmentStart = parseDateTime(newAssignmentDate, schedule.start_time);
        const newAssignmentEnd = parseDateTime(newAssignmentDate, schedule.end_time);

        const observerExistingSchedules = await Schedule.find({
            'observers.observer_id': observerUserId,
            date: schedule.date,
            'observers.observer_status': 'accepted',
            _id: { $ne: scheduleId }
        });

        let hasConflict = false;
        for (let existingSch of observerExistingSchedules) {
            const existingObsAssignment = existingSch.observers.find(
                (obs) => obs.observer_id.toString() === observerUserId && obs.observer_status === 'accepted'
            );

            if (existingObsAssignment) {
                const existingScheduleDate = existingSch.date.toISOString().split('T')[0];
                const existingStart = parseDateTime(existingScheduleDate, existingSch.start_time);
                const existingEnd = parseDateTime(existingScheduleDate, existingSch.end_time);

                if (newAssignmentStart < existingEnd && newAssignmentEnd > existingStart) {
                    hasConflict = true;
                    break;
                }
            }
        }

        if (hasConflict) {
            req.flash('error_msg', 'Acceptance failed: You already have an overlapping accepted schedule for this date and time.');
            return res.redirect('/Super_Admin_schedule');
        }
        // --- End Conflict Check ---

        // Update the observer's status within the schedule's array
        observerEntry.observer_status = 'accepted';
        schedule.updatedAt = new Date();

        const allAssignedObserversAccepted = schedule.observers.every(
            (obs) => obs.observer_status === 'accepted'
        );

        if (allAssignedObserversAccepted) {
            schedule.status = 'confirmed'; // All assigned observers have accepted
        }

        await schedule.save();

        await Log.create({
            action: 'Observer Accepted Assignment',
            performedBy: observerUserId,
            performedByRole: observerUser.role,
            details: `Observer ${observerUser.firstname} ${observerUser.lastname} accepted their assignment for schedule ID: ${schedule._id}. Overall schedule status: ${schedule.status}.`
        });

        req.flash('success_msg', 'Schedule assignment accepted successfully!');
        res.redirect('/Super_Admin_schedule');
    } catch (error) {
        console.error('Error accepting observer assignment:', error);
        req.flash('error_msg', 'An error occurred while accepting the assignment: ' + error.message);
        res.status(500).redirect('/Super_Admin_schedule');
    }
};

// NEW: Observer (or Super Admin acting as Observer) declines their assigned schedule slot
exports.declineObserverAssignment = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const observerUserId = req.session.user.id;

        const observerUser = await User.findById(observerUserId);
        if (!observerUser || (observerUser.role !== 'observer' && observerUser.role !== 'super_admin')) {
            req.flash('error_msg', 'Unauthorized: Only designated observers can decline assignments.');
            return res.redirect('/login');
        }

        const schedule = await Schedule.findById(scheduleId);
        if (!schedule) {
            req.flash('error_msg', 'Schedule not found.');
            return res.redirect('/Super_Admin_schedule');
        }

        const observerEntryIndex = schedule.observers.findIndex(
            (obs) => obs.observer_id && obs.observer_id.toString() === observerUserId
        );

        if (observerEntryIndex === -1) {
            req.flash('error_msg', 'You are not assigned to this schedule, or your assignment is not found.');
            return res.redirect('/Super_Admin_schedule');
        }

        schedule.observers[observerEntryIndex].observer_status = 'declined';
        schedule.updatedAt = new Date();

        const activeObserversCount = schedule.observers.filter(
            (obs) => obs.observer_status === 'pending' || obs.observer_status === 'accepted'
        ).length;

        if (activeObserversCount === 0) {
            schedule.status = 'needs_reassignment';
        } else if (schedule.status === 'confirmed') {
            schedule.status = 'scheduled'; // Revert from confirmed if one declines
        }

        await schedule.save();

        await Log.create({
            action: 'Observer Declined Assignment',
            performedBy: observerUserId,
            performedByRole: observerUser.role,
            details: `Observer ${observerUser.firstname} ${observerUser.lastname} declined their assignment for schedule ID: ${schedule._id}. Overall schedule status: ${schedule.status}.`
        });

        req.flash('success_msg', 'Schedule assignment declined.');
        res.redirect('/Super_Admin_schedule');
    } catch (error) {
        console.error('Error declining observer assignment:', error);
        req.flash('error_msg', 'An error occurred while declining the assignment: ' + error.message);
        res.status(500).redirect('/Super_Admin_schedule');
    }
};
// Get Copus Result Overview
exports.getCopusResultOverview = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect('/login');

        const completedSchedules = await Schedule.find({
            observer: user.firstname + " " + user.lastname,
            status: 'completed'
        }).sort({ date: -1, start_time: -1 })
            .select('firstname lastname department date start_time end_time year_level semester subject_code subject observer copus modality');

        res.render('Super_Admin/copus_result', {
            completedSchedules: completedSchedules,
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId
        });
    } catch (err) {
        console.error('Error fetching completed schedules for Copus Result:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Get Copus History
exports.getCopusHistory = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.redirect('/login');
        }

        const observerFullName = `${user.firstname} ${user.lastname}`;

        const completedSchedules = await Schedule.find({
            observer: observerFullName,
            status: 'completed'
        }).sort({ date: -1, start_time: -1 });

        res.render('Super_Admin/copus_history', {
            completedSchedules: completedSchedules,
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId
        });
    } catch (err) {
        console.error('Error fetching completed COPUS history:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Get Approved Copus Schedules
exports.getApprovedCopusSchedules = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect('/login');

        const schedules = await Schedule.find(
            { observer: user.firstname + " " + user.lastname, status: 'approved' }
        )
            .select('firstname lastname department date start_time end_time year_level semester subject_code subject observer copus modality ');

        res.render('Super_Admin/copus', {
            schedules: schedules,
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId
        });
    } catch (err) {
        console.error('Error fetching approved schedules:', err);
        res.status(500).send('Internal Server Error');
    }
};

// Get Settings Page
exports.getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.redirect('/login');
        }

        res.render('Super_Admin/setting', {
            firstName: user.firstname,
            lastName: user.lastname,
            employeeId: user.employeeId,
            currentUser: user
        });
    } catch (err) {
        console.error('Error fetching user data for settings page:', err);
        res.status(500).send('Failed to load Settings view');
    }
};

// Update Profile
exports.updateProfile = async (req, res) => {
    const userId = req.session.user.id;

    const allowedUpdates = [
        'firstname', 'lastname', 'middleInitial', 'email', 'department', 'dean',
        'assignedProgramHead', 'yearsOfTeachingExperience', 'yearHired',
        'yearRegularized', 'highestEducationalAttainment', 'professionalLicense',
        'employmentStatus', 'rank'
    ];

    const updates = {};
    for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        } else if (req.body[key] === undefined && (key === 'middleInitial' || key === 'assignedProgramHead')) {
            updates[key] = '';
        }
    }

    if (updates.email && !/\S+@\S+\.\S+/.test(updates.email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    try {
        const oldUser = await User.findById(userId).lean();

        const updatedUser = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update session data
        req.session.user.firstname = updatedUser.firstname;
        req.session.user.lastname = updatedUser.lastname;
        req.session.user.email = updatedUser.email;
        await req.session.save();

        let logDetails = 'Super Admin updated own profile. Changes: ';
        const changedFieldsArray = [];
        for (const key in updates) {
            if (oldUser && String(oldUser[key]) !== String(updatedUser[key])) {
                changedFieldsArray.push(`${key} (from '${oldUser[key] || ''}' to '${updatedUser[key] || ''}')`);
            } else if (!oldUser && updatedUser[key]) {
                changedFieldsArray.push(`${key} (set to '${updatedUser[key] || ''}')`);
            }
        }
        logDetails += changedFieldsArray.length > 0 ? changedFieldsArray.join(', ') : 'No values changed effectively.';

        await Log.create({
            action: 'Update Own Profile',
            performedBy: userId,
            performedByRole: updatedUser.role,
            details: logDetails
        });

        res.status(200).json({
            message: 'Profile updated successfully!',
            user: {
                firstname: updatedUser.firstname,
                lastname: updatedUser.lastname,
                email: updatedUser.email
            }
        });

    } catch (error) {
        console.error('Error updating own user profile:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error: ' + messages.join(', ') });
        }
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Update failed. Email or another unique field may already be in use.' });
        }
        res.status(500).json({ message: 'Failed to update profile due to a server error.' });
    }
};

// Get Logs
exports.getLogs = async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 });
        res.render('Super_Admin/logs', { logs });
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).send('Failed to load logs');
    }
};

// Add Employee
exports.addEmployee = async (req, res) => {
    const {
        department,
        lastname,
        firstname,
        role,
        email,
    } = req.body;

    const randomPart1 = Math.floor(1000 + Math.random() * 9000);
    const randomPart2 = Math.floor(1000 + Math.random() * 9000);
    const employeeId = `EMP-${randomPart1}-${randomPart2}`;

    const password = employeeId;
    const user = await User.findById(req.session.user.id);

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { employeeId }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or employee ID already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            employeeId,
            department,
            lastname,
            firstname,
            role,
            email,
            password: hashedPassword
        });

        await newUser.save();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'copus6251@gmail.com',
                pass: 'spgh zwvd qevg oxoe ' // Use environment variables for sensitive info!
            }
        });

        const mailOptions = {
            from: '"Admin" <copus6251@gmail.com>',
            to: email,
            subject: 'Your Login Credentials - PHINMA Copus System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">
                  <h2 style="color: #2c3e50;">Hello ${firstname} ${lastname},</h2>
                  <p style="font-size: 15px; color: #333;">You have been added to the <strong>PHINMA Copus System</strong>. Here are your login credentials:</p>
                  
                  <div style="margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Email:</td>
                        <td style="padding: 8px;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Role:</td>
                        <td style="padding: 8px;">${role}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Username:</td>
                        <td style="padding: 8px;">${employeeId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Password:</td>
                        <td style="padding: 8px;">${password}</td>
                      </tr>
                    </table>
                  </div>
            
                  <p style="font-size: 15px; color: #333;">Please log in and change your password upon first login for security reasons.</p>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #555;">Best regards,<br><strong>PHINMA IT Team</strong></p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        await Log.create({
            action: 'Add Employee',
            performedBy: user.id,
            performedByRole: user.role,
            details: `Added an employee name : ${firstname} ${lastname} employee ID : (${employeeId}) with role ${role} in ${department}.`
        });

        res.redirect('/super_admin_user_management');

    } catch (err) {
        console.error('Error adding user or sending email:', err); // More specific error log
        // Handle specific errors like duplicate key if email or employeeId is unique
        if (err.code === 11000) { // MongoDB duplicate key error
            return res.status(400).json({ error: 'User with this email or employee ID already exists.' });
        }
        res.status(500).json({ error: 'Failed to add user or send email due to a server error.' });
    }
};