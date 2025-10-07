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
    // Check if the user exists before trying to access role
    if (req.session.user) {
        const userRole = req.session.user.role;
        const isMatch = userRole.toLowerCase() === 'faculty';
        
        if (isMatch) {
            next();
        } else {
            console.log('Error: Unauthorized access attempt. User role does not match Faculty.');
            res.status(403).send('Unauthorized access.');
        }
    } else {
        console.log('Error: No session user found in isFaculty middleware.');
        res.status(403).send('Unauthorized access.');
    }
};

module.exports = {
    isAuthenticated,
    isFaculty
};