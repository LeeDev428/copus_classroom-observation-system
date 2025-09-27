// middleware/auth.js

// isAuthenticated middleware: Checks if a user is authenticated.
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to view this resource.');
    return res.redirect('/login');
}

// isFaculty middleware: Checks if the authenticated user has a 'Faculty' role.
const isFaculty = (req, res, next) => {
    console.log('--- START: isFaculty middleware check ---');
    console.log('Session user:', req.session.user);
    
    // Check if the user exists before trying to access role
    if (req.session.user) {
        const userRole = req.session.user.role;
        const isMatch = userRole.toLowerCase() === 'faculty';
        
        console.log('Session user role:', userRole);
        console.log('Role after toLowerCase():', userRole.toLowerCase());
        console.log('Is role a match for "faculty"?', isMatch);

        if (isMatch) {
            next();
        } else {
            console.log('Error: Unauthorized access attempt to schedule management.');
            res.status(403).send('Unauthorized access.');
        }
    } else {
        console.log('Error: No session user found.');
        res.status(403).send('Unauthorized access.');
    }
};

module.exports = {
    isAuthenticated,
    isFaculty
};