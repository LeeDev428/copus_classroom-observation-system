// routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); 
const { isAuthenticated } = require('../middleware/auth'); 
const multer = require('multer');
const path = require('path'); // <-- ADD THIS LINE
const FacultySchedule = require('../model/facultySchedule');

// Configure Multer to use disk storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Make sure the 'uploads/' directory exists in your project root
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // You can change the naming logic here if you want
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Admin Pages
router.get('/admin_dashboard', isAuthenticated, adminController.getAdminDashboard);
router.get('/admin_user_management', isAuthenticated, adminController.getUserManagement);
router.post('/admin_update_user_status', isAuthenticated, adminController.updateUserStatus);
router.post('/admin_update_user', isAuthenticated, adminController.updateUser);
router.get('/admin_schedule', isAuthenticated, adminController.getAdminSchedule);

// New route for creating a schedule with a single file upload
router.post('/admin_schedule/create', isAuthenticated, upload.single('schedule_image'), adminController.createSchedule);

// Other admin views
router.get('/admin_copus_result', isAuthenticated, adminController.getCopusResult);
router.get('/admin_copus_history', isAuthenticated, adminController.getCopusHistory);
router.get('/admin_setting', isAuthenticated, adminController.getSetting);

// NEW: Weekly Schedule Creation Routes
router.get('/admin_weekly_schedule_creation', isAuthenticated, adminController.getWeeklyScheduleCreation);
router.post('/admin_create_weekly_schedule', isAuthenticated, adminController.createWeeklySchedule);

module.exports = router;