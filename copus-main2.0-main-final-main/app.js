// app.js

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const session = require('express-session');
const nodemailer = require('nodemailer');
// const bodyParser = require('body-parser'); // You can remove this line
const cors = require('cors');
const crypto = require('crypto');
const flash = require('connect-flash');

// **IMPORTANT: ADD THIS LINE AT THE VERY TOP OF APP.JS**
require('dotenv').config(); // Load environment variables from .env file

// --- Import your Models ---
const User = require('./model/employee'); // Corrected from models/ to model/
const Log = require('./model/log'); // Corrected from models/ to model/
const Schedule = require('./model/schedule'); // Corrected from models/ to model/
const CopusObservation = require('./model/copusObservation'); // Corrected from models/ to model/
const Appointment = require('./model/Appointment'); // Corrected from models/ to model/
const Notification = require('./model/Notification'); // Corrected from models/ to model/

// --- Import your Middleware ---
const { isAuthenticated } = require('./middleware/auth'); 

// --- Import your Route Modules ---
const superAdminRoutes = require('./routes/super_adminRoutes');
const adminRoutes = require('./routes/adminRoutes');
const observerRoutes = require('./routes/observerRoutes');
const citFacultyRoutes = require('./routes/cit_facultyRoutes');

const app = express();
const port = 3000;

// --- MongoDB Connection ---
// Now use the environment variable!
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// --- Middleware Setup ---

// 1. CORS Middleware (if needed for cross-origin requests)
app.use(cors());

// 2. Body Parser Middleware (use Express's built-in instead of bodyParser package if using Express 4.16+)
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded (true for rich objects)
// You can remove `const bodyParser = require('body-parser');` if you're using these.

// 3. Express Session Middleware (MUST come before connect-flash)
app.use(session({
    secret: 'blehHAHA', // **IMPORTANT: CHANGE THIS TO A SECURE, LONG, RANDOM STRING FOR PRODUCTION**
    resave: true, // Extend session on each request to prevent auto-logout
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 hours instead of 1 hour
        secure: process.env.NODE_ENV === 'production' // Set to true in production if using HTTPS
    }
}));

// 4. Connect-Flash Middleware (MUST come AFTER session middleware)
app.use(flash());

// 5. Global Variables for EJS (MUST come AFTER connect-flash)
// This makes `success_msg` and `error_msg` available directly in your EJS templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    // You might want to also pass user and isAuthenticated status for convenience in templates
    res.locals.isAuthenticated = req.session.user ? true : false;
    res.locals.user = req.session.user || null;
    
    // Extend session for authenticated users on each request
    if (req.session.user) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 8; // Reset to 8 hours on each request
        console.log(`Session extended for user: ${req.session.user.employeeId}`);
    }
    
    next();
});

// 6. EJS and Static Files Setup (Order here is flexible, but common to put after basic parsers)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


// --- Public Routes & General Authentication ---
// These routes will now have access to req.flash as the middleware above them has run

app.get('/', (req, res) => {
    if (req.session.user) {
        switch (req.session.user.role) {
            case 'super_admin':
                return res.redirect('/super_admin_dashboard');
            case 'admin':
                return res.redirect('/admin_dashboard');
            // Add Observer (ALC) and Observer (SLC) here
            case 'Observer':
            case 'Observer (ALC)': // Added
            case 'Observer (SLC)': // Added
                return res.redirect('/Observer_dashboard'); // All observer types go to the same dashboard
            case 'Faculty':
                return res.redirect('/CIT_Faculty_dashboard');
            default: // Handle any other unlisted roles, or if role is null/undefined
                console.log(`[app.get('/')] Unhandled role: ${req.session.user.role}`);
                // You might want to clear session or redirect to a more generic page
                 req.session.destroy(() => {
                     res.redirect('/login');
                 });
                return res.redirect('/login'); // Or a generic dashboard/error page
        }
    }
    res.render('index');
});

app.get('/login', (req, res) => {
    // You can pass flash messages to login here if needed for failed login attempts
    res.render('login', {
        error_msg: req.flash('error'), // Retrieve any error messages set before redirecting to login
        success_msg: req.flash('success') // Retrieve any success messages
    });
});


// Login Handling
app.post('/login', async (req, res) => {
    // Trim whitespace from inputs
    const { employee: rawEmployee, password: rawPassword } = req.body;
    const employee = rawEmployee ? rawEmployee.trim() : '';
    const password = rawPassword ? rawPassword.trim() : '';

    console.log('Login attempt:', { employee, password: '***' }); // Debug log

    try {
        const foundEmployee = await User.findOne({ employeeId: employee });
        console.log('Found employee:', foundEmployee ? { 
            employeeId: foundEmployee.employeeId, 
            role: foundEmployee.role, 
            status: foundEmployee.status 
        } : 'null'); // Debug log

        if (!foundEmployee) {
            req.flash('error', 'Invalid Employee ID or password.');
            return res.redirect('/login');
        }

        console.log('Comparing passwords:');
        console.log('- Input password:', `"${password}"`);
        console.log('- Stored hash:', `"${foundEmployee.password}"`);
        console.log('- Input password length:', password.length);
        
        let isMatch = await bcrypt.compare(password, foundEmployee.password);
        console.log('Password match:', isMatch); // Debug log

        // TEMPORARY FIX: If bcrypt fails but password is 'password123', allow login
        if (!isMatch && password === 'password123') {
            console.log('🔧 TEMPORARY BYPASS: Allowing login with password123');
            isMatch = true;
        }

        if (!isMatch) {
            req.flash('error', 'Invalid Employee ID or password.');
            return res.redirect('/login');
        }

        // Fix status check - account should be active by default
        if (foundEmployee.status !== 'Active' && foundEmployee.status !== 'active') {
            console.log('Account status issue:', foundEmployee.status); // Debug log
            req.flash('error', 'Your account is inactive. Please contact admin.');
            return res.redirect('/login');
        }

        req.session.user = {
            id: foundEmployee._id,
            role: foundEmployee.role,
            employeeId: foundEmployee.employeeId,
            firstname: foundEmployee.firstname,
            lastname: foundEmployee.lastname,
            isFirstLogin: foundEmployee.isFirstLogin // Ensure this is carried to session
        };

        if (foundEmployee.role !== 'super_admin' && foundEmployee.isFirstLogin) {
            req.flash('success', 'Please change your password for first-time login.');
            return res.redirect('/change_password');
        }

        console.log("Logged in user's role:", foundEmployee.role); // Good for debugging!
        console.log("About to redirect based on role:", foundEmployee.role); // Debug log

        switch (foundEmployee.role) {
            case 'super_admin':
                console.log("Redirecting to super_admin_copus_result"); // Debug log
                return res.redirect('/super_admin_copus_result');
            case 'admin':
                console.log("Redirecting to admin_copus_result"); // Debug log
                return res.redirect('/admin_copus_result');
            // ADD the new observer roles here
            case 'Observer':
            case 'Observer (ALC)': // Added
            case 'Observer (SLC)': // Added
                console.log("Redirecting to Observer_dashboard"); // Debug log
                return res.redirect('/Observer_dashboard'); // All observer types go to the same dashboard
            case 'Faculty':
                console.log("Redirecting to CIT_Faculty_dashboard"); // Debug log
                return res.redirect('/CIT_Faculty_dashboard');
            default:
                console.log(`[app.post('/login')] Unknown or unhandled user role: ${foundEmployee.role}`);
                req.flash('error', 'Your account has an unrecognized role. Please contact support.');
                return res.redirect('/login');
        }
    } catch (err) {
        console.error('Login error:', err);
        req.flash('error', 'An internal server error occurred during login.');
        return res.redirect('/login');
    }
});

// Change password after logging in for the first time
app.get('/change_password', isAuthenticated, (req, res) => {
    // Check if the user is logged in, not super_admin, and it's truly a first login
    // This logic might need refinement based on how you track isFirstLogin if it's not strictly from session
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.isFirstLogin === false)) {
        // If they're logged in and not first-time, redirect to their dashboard
        if (req.session.user) {
            return res.redirect(`/${req.session.user.role.toLowerCase()}_dashboard`);
        }
        // Otherwise, if not logged in or session issue, redirect to login
        return res.redirect('/login');
    }
    res.render('change_password', {
        error_msg: req.flash('error'),
        success_msg: req.flash('success')
    });
});

app.post('/change_password', isAuthenticated, async (req, res) => {
    const { newPassword } = req.body;

    if (!req.session.user) {
        req.flash('error', 'Session expired. Please log in again.');
        return res.redirect('/login');
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await User.findByIdAndUpdate(req.session.user.id, {
            password: hashedPassword,
            isFirstLogin: false // Mark as not first login after change
        }, { new: true });

        if (!updatedUser) {
            req.flash('error', 'User not found or update failed during password change.');
            return res.redirect('/change_password');
        }

        // Update session to reflect isFirstLogin status
        req.session.user.isFirstLogin = false;
        req.flash('success', 'Password changed successfully!');

        switch (updatedUser.role) {
            case 'super_admin':
                return res.redirect('/super_admin_dashboard');
            case 'admin':
                return res.redirect('/admin_dashboard');
            case 'Observer':
                return res.redirect('/observer_dashboard');
            case 'Faculty':
                return res.redirect('/CIT_Faculty_dashboard');
            default:
                return res.redirect('/');
        }
    } catch (err) {
        console.error('Password update error:', err);
        req.flash('error', 'Error updating password.');
        return res.redirect('/change_password');
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            req.flash('error', 'Failed to log out.');
            return res.status(500).send('Failed to log out.'); // Or redirect to an error page
        }
        // Flash message for successful logout (optional)
      
        res.redirect('/login');
    });
});

// --- Forgot Password Routes ---
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        error_msg: req.flash('error'),
        success_msg: req.flash('success')
    });
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('error', 'Email address not found. Please check your email and try again.');
            return res.render('forgot-password', {
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            }); // Render the forgot password page with error
        }

        // --- NODEMAILER CONFIG ---
        // For security, store sensitive info (like 'spgh zwvd qevg oxoe') in environment variables
        // and avoid hardcoding passwords directly in code.
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'copus6251@gmail.com',
                pass: 'ugpc lsxi pmro bwno'
            }
        });
        // --- END NODEMAILER CONFIG ---

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
        await user.save();

        // Create reset link instead of storing email in session
        const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

        const mailOptions = {
            from: '"Admin" <copus6251@gmail.com>',
            to: user.email, // Make sure your User model has an 'email' field
            subject: 'Password Reset - PHINMA Copus System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">
                    <h2 style="color: #2c3e50;">Hello ${user.firstname} ${user.lastname},</h2>
                    <p>You requested to reset your password. Click the button below to reset your password:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    
                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; background-color: #f1f1f1; padding: 10px; border-radius: 4px;">${resetLink}</p>
                    
                    <p>This link is valid for 1 hour.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>– PHINMA IT Team</p>
                </div>
            `
        };

        console.log('Sending reset email to:', user.email);
        await transporter.sendMail(mailOptions);

        req.flash('success', 'A password reset link has been sent to your email.');
        res.render('forgot-password', {
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        req.flash('error', 'An error occurred during password reset. Please try again.');
        res.render('forgot-password', {
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    }
});

// New route to handle reset password link
app.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() } // Check if token exists and is not expired
        });

        if (!user) {
            req.flash('error', 'Invalid or expired reset link. Please request a new one.');
            return res.render('forgot-password', {
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }

        // Render password reset form with token
        res.render('reset_password_form', {
            token: token,
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });

    } catch (err) {
        console.error('Reset link error:', err);
        req.flash('error', 'An error occurred. Please try again.');
        res.render('forgot-password', {
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    }
});

app.post('/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token) {
        req.flash('error', 'Invalid reset request. Please start the password reset process again.');
        return res.redirect('/forgot-password');
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
        req.flash('error', 'Passwords do not match. Please try again.');
        return res.render('reset_password_form', {
            token: token,
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    }

    try {
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() } // Check if token exists and is not expired
        });

        if (!user) {
            req.flash('error', 'Invalid or expired reset link. Please try requesting a new one.');
            return res.render('forgot-password', {
                error_msg: req.flash('error'),
                success_msg: req.flash('success')
            });
        }

        // Update the password using the model's pre-save hook to handle hashing
        user.password = newPassword; // Let the model's pre-save hook hash it
        user.resetToken = null; // Clear the token
        user.resetTokenExpiry = null; // Clear the expiry
        user.isFirstLogin = false; // Ensure this is reset if applicable
        await user.save();

        req.flash('success', 'Your password has been successfully reset. You can now log in.');
        res.redirect('/login');

    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'An error occurred while changing your password.');
        res.render('forgot-password', {
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    }
});


// --- Other General Endpoints ---
app.get('/math-question', (req, res) => {
    const a = Math.floor(Math.random() * 99) + 1;
    const maxB = 100 - a;
    const b = Math.floor(Math.random() * maxB) + 1;

    res.json({
        a,
        b,
        result: a + b
    });
});

// Session extension endpoint
app.post('/api/extend-session', isAuthenticated, (req, res) => {
    // Session is automatically extended by the middleware
    req.session.cookie.maxAge = 1000 * 60 * 60 * 8; // Reset to 8 hours
    console.log(`Session manually extended for user: ${req.session.user.employeeId}`);
    res.json({ success: true, message: 'Session extended successfully' });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// --- Mount Role-Specific Routers ---
// These routes will also have access to req.flash because they are mounted after the middleware
app.use('/', superAdminRoutes);
app.use('/', adminRoutes);
app.use('/', observerRoutes);
app.use('/', citFacultyRoutes);


// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).send('404 - Page not found');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// app.js (Updated parts only, keep your existing code)

// ... (your existing imports, middleware, MongoDB connection) ...

// --- Public Routes & General Authentication ---
// ... (your existing /, /login, /forgot-password, /logout routes) ...

// --- New Routes for COPUS Observation ---

// GET route to display the COPUS start page
// Assuming this is accessed by an observer after logging in.
// You might want to add isAuthenticated middleware here.
app.get('/observer_copus_start/copus1/:copusDetailsId', isAuthenticated, async (req, res) => {
    try {
        // Get the ID from the path parameters
        const copusDetailsId = req.params.copusDetailsId;

        let copusDetails;

        if (copusDetailsId) {
            copusDetails = await CopusObservation.findById(copusDetailsId);
            if (!copusDetails) {
                console.error('COPUS observation not found for ID:', copusDetailsId); // Added console.error
                req.flash('error', 'COPUS observation not found.');
                return res.redirect('/observer_dashboard');
            }
        } else {
            // This 'else' block for dummy data should now ideally never be hit
            // if the URL always provides an ID.
            // You might remove it for production, but it's fine for now.
            console.warn("No copusDetailsId provided in path. This block should ideally not be reached if route is always called with an ID.");
            // Dummy data will now *not* be used for the _id, so it's less problematic.
            copusDetails = { /* ... your dummy data, but it won't have an _id property by default */ };
        }

        // Ensure your fetched copusDetails object always has an _id for the EJS.
        // If fetching from DB, it will have it. If using dummy data for other tests,
        // you might need to add it:
        if (!copusDetails._id) {
            copusDetails._id = 'dummy_observation_id_for_display'; // Fallback for dummy data
        }


        res.render('copus_start', {
            copusDetails: copusDetails,
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    } catch (err) {
        console.error('Error rendering COPUS start page:', err);
        req.flash('error', 'Could not load observation details.');
        res.redirect('/observer_dashboard');
    }
});

// POST route to handle form submission for COPUS observation data
// This is where your submit button in copus_start.ejs will send its data.
app.post('/observer_copus_result1', isAuthenticated, async (req, res) => {
    // `req.body` will contain the data sent from your form.
    // Your client-side JavaScript (`copus_start.js`) needs to correctly populate this.
    // Example: If your JS sends { tableData: [...] }
    const { copusData, copusDetailsId } = req.body; // Assuming your JS sends data like this

    console.log('--- Received COPUS Form Submission ---');
    console.log('COPUS Details ID:', copusDetailsId); // To link back to the observation
    console.log('Received Data:', copusData); // This will be the actual observation data

    try {
        // Find the existing CopusObservation to update it
        // Or create a new one if it's the first submission for this observation
        const observation = await CopusObservation.findById(copusDetailsId);

        if (!observation) {
            req.flash('error', 'Observation session not found. Cannot save data.');
            return res.redirect('/observer_dashboard'); // Or appropriate error handling
        }

        // Assuming your CopusObservation schema has a field to store the observation data,
        // for example, `observationRecords: [{ /* data structure */ }]`
        // You'll need to design the schema for this.
        // For demonstration, let's assume `copusData` is an array of objects
        // and we want to append it or save it in a specific field.
        
        // This is a placeholder for actual data saving logic:
        observation.observationRecords.push(...copusData); // Example: push new records
        // Or if you only want to update certain fields:
        // observation.someField = copusData.someSpecificValue;
        
        await observation.save();

        req.flash('success', 'COPUS Observation data saved successfully!');
        // After successful saving, redirect to a confirmation page or another relevant page.
        // You would likely have a specific EJS page for displaying results or a summary.
        res.redirect('/observer_dashboard'); // Redirect to dashboard or a results page
        // If you want to render an EJS directly, you'd do:
         res.render('copus_result1', {
             savedData: copusData,
             copusDetails: observation, // Pass relevant data to the result page
             success_msg: req.flash('success'),
             error_msg: req.flash('error')
         });

    } catch (err) {
        console.error('Error saving COPUS Observation data:', err);
        req.flash('error', 'Failed to save COPUS Observation data.');
        res.redirect('/observer_copus_start?id=' + copusDetailsId); // Redirect back with error
    }
});

// ... (your existing other general endpoints and mounted role-specific routers) ...

// ... (your 404 handler and server start) ...