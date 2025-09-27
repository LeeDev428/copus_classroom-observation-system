// routes/super_adminRoutes.js
const express = require('express');
const router = express.Router();

// **CRITICAL FIX:** Use object destructuring to import the functions
const { isAuthenticated } = require('../middleware/auth'); 

// Import the super admin controller functions
const superAdminController = require('../controllers/super_adminController'); 

console.log('Value of superAdminController:', superAdminController);
console.log('Type of superAdminController.getDashboard:', typeof superAdminController.getDashboard);

// Dashboard
router.get('/super_admin_dashboard', isAuthenticated, superAdminController.getDashboard);

// Copus Observation Start Routes
router.get('/super_admin_copus_start_copus1/:scheduleId', isAuthenticated, superAdminController.startCopus1);
router.get('/super_admin_copus_start_copus2/:scheduleId', isAuthenticated, superAdminController.startCopus2);
router.get('/super_admin_copus_start_copus3/:scheduleId', isAuthenticated, superAdminController.startCopus3);

// Copus Observation Result Routes (GET with scheduleId in URL)
router.get('/super_admin_copus_result1/:scheduleId', isAuthenticated, superAdminController.getResultCopus1ById);
router.get('/super_admin_copus_result2/:scheduleId', isAuthenticated, superAdminController.getResultCopus2ById);
router.get('/super_admin_copus_result3/:scheduleId', isAuthenticated, superAdminController.getAggregatedResultCopus3ById);

// Copus Observation Save Routes (POST)
router.post('/super_admin_copus_result1', isAuthenticated, superAdminController.saveCopus1);
router.post('/super_admin_copus_result2', isAuthenticated, superAdminController.saveCopus2);
router.post('/super_admin_copus_result3', isAuthenticated, superAdminController.saveCopus3);

// Copus Observation Result Routes (GET without scheduleId in URL - Relying on Session)
// You might consider removing these if the ID-based routes are preferred and properly implemented in the frontend.
router.get('/super_admin_copus_result1', isAuthenticated, superAdminController.getResultCopus1);
router.get('/super_admin_copus_result2', isAuthenticated, superAdminController.getResultCopus2);
router.get('/super_admin_copus_result3', isAuthenticated, superAdminController.getAggregatedResultCopus3);


// User Management
router.get('/super_admin_user_management', isAuthenticated, superAdminController.getUserManagement);
router.post('/update_user_status', isAuthenticated, superAdminController.updateUserStatus);
router.post('/update_user', isAuthenticated, superAdminController.updateUser);
router.post('/add_employee', isAuthenticated, superAdminController.addEmployee);


// Schedule Management
router.get('/super_admin_schedule', isAuthenticated, superAdminController.getScheduleManagement);
router.post('/create_schedule', isAuthenticated, superAdminController.createSchedule);
// Routes for Super Admin to accept/decline their *own* observer assignments
router.post('/super_admin/schedule/accept/:scheduleId', isAuthenticated, superAdminController.acceptObserverAssignment);
router.post('/super_admin/schedule/decline/:scheduleId', isAuthenticated, superAdminController.declineObserverAssignment);


// Copus Reporting/History
router.get('/super_admin_copus_result', isAuthenticated, superAdminController.getCopusResultOverview);
router.get('/super_admin_copus_history', isAuthenticated, superAdminController.getCopusHistory);
router.get('/super_admin_copus', isAuthenticated, superAdminController.getApprovedCopusSchedules);


// Settings
router.get('/super_admin_setting', isAuthenticated, superAdminController.getSettings);
router.post('/super_admin_update_profile', isAuthenticated, superAdminController.updateProfile);


// Logs
router.get('/super_admin_logs', isAuthenticated, superAdminController.getLogs);


module.exports = router;