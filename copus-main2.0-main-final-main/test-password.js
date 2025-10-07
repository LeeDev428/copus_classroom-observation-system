// test-password.js - Quick password test script
const bcrypt = require('bcryptjs');

async function testPassword() {
    const plainPassword = 'password123';
    const storedHash = '$2b$10$5XksPQi7ch1xazIfifxZvugjdeOC/C4c9873SpAoVTQD3S/hG0PT.';
    
    console.log('=== Password Test ===');
    console.log('Plain password:', `"${plainPassword}"`);
    console.log('Stored hash from DB:', `"${storedHash}"`);
    
    // Test the actual comparison that's failing
    const isMatch = await bcrypt.compare(plainPassword, storedHash);
    console.log('Comparison with stored hash:', isMatch);
    
    // Create fresh hash with same password
    const newHash = await bcrypt.hash(plainPassword, 10);
    console.log('New hash:', `"${newHash}"`);
    
    const newComparison = await bcrypt.compare(plainPassword, newHash);
    console.log('Comparison with new hash:', newComparison);
    
    // Test bcrypt version info
    console.log('\n=== BCrypt Info ===');
    console.log('BCrypt version:', require('bcryptjs/package.json').version);
    
    // Test if it's a $2b vs $2a issue
    const hash2a = await bcrypt.hash(plainPassword, 10);
    console.log('Hash prefix:', hash2a.substring(0, 4));
}

testPassword().catch(console.error);