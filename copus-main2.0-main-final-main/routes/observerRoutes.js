const express = require('express');
const router = express.Router();
const observerController = require('../controllers/observerController'); 

// **CRITICAL FIX:** Correct the import to use destructuring
const { isAuthenticated } = require('../middleware/auth'); 

// Observer Dashboard
router.get('/Observer_dashboard', isAuthenticated, observerController.getDashboard);

// Appointment Scheduling
router.post('/observer_schedule_appointment', isAuthenticated, observerController.scheduleAppointment);

// Notifications API
router.get('/api/notifications', isAuthenticated, observerController.getNotifications);
router.post('/api/notifications/mark-read', isAuthenticated, observerController.markNotificationsRead);

// Schedule Management
router.get('/Observer_schedule_management', isAuthenticated, observerController.getScheduleManagement);
router.post('/observer/schedule/complete/:id', isAuthenticated, observerController.completeSchedule);
router.post('/observer/schedule/:scheduleId/accept', isAuthenticated, observerController.acceptSchedule);
router.post('/observer/schedule/:scheduleId/decline', isAuthenticated, observerController.declineSchedule);

// COPUS Observation Flow
router.get('/observer_copus', isAuthenticated, observerController.getApprovedCopusSchedules); // List of approved schedules for observation

router.post('/observer_copus_start_copus1/:scheduleId', isAuthenticated, observerController.startCopus1Observation);
router.post('/observer_copus_start_copus2/:scheduleId', isAuthenticated, observerController.startCopus2Observation);
router.post('/observer_copus_start_copus3/:scheduleId', isAuthenticated, observerController.startCopus3Observation);

// Saving COPUS Data (POST requests) - These are already correct for API submission
router.post('/observer_copus_result1', isAuthenticated, observerController.saveCopus1Observation);
router.post('/observer_copus_result2', isAuthenticated, observerController.saveCopus2Observation);
router.post('/observer_copus_result3', isAuthenticated, observerController.saveCopus3Observation);

// Displaying COPUS Results (GET requests)
router.get('/observer_copus_result', isAuthenticated, observerController.getCopusResultList); // List of completed schedules to view results

// *** CRITICAL CHANGES HERE ***
// These routes now accept observationId as a query parameter (from copus_start.js redirect)
// AND as a path parameter (from copus_result.ejs "VIEW RESULT" buttons).
// This requires a modification in the respective getCopusXResult controllers to check both.
router.get('/observer_copus_result1', isAuthenticated, observerController.getCopus1Result); // For redirect from submission (query param)
router.get('/observer_copus_result1/:observationId', isAuthenticated, observerController.getCopus1Result); // For "VIEW RESULT" button (path param)

router.get('/observer_copus_result2', isAuthenticated, observerController.getCopus2Result);
router.get('/observer_copus_result2/:observationId', isAuthenticated, observerController.getCopus2Result); // Add similar for Copus 2/3

router.get('/observer_copus_result3', isAuthenticated, observerController.getCopus3Result);
router.get('/observer_copus_result3/:observationId', isAuthenticated, observerController.getCopus3Result); // Add similar for Copus 2/3

// COPUS History & Summary
router.get('/Observer_copus_history', isAuthenticated, observerController.getCopusHistory);
router.get('/observer_copus_summary', isAuthenticated, observerController.getCopusSummary);

// Settings
router.get('/observer_setting', isAuthenticated, observerController.getSetting);

// NEW: ALC Observation Schedule Creation Routes
router.get('/alc_create_observation_schedule', isAuthenticated, observerController.getObservationScheduleCreation);
router.post('/alc_create_observation_slots', isAuthenticated, observerController.createObservationSlots);

module.exports = router;