import mysql from 'mysql2';

// Create MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password', // Change this to your actual MySQL password
    database: 'voteDatabase'
}).promise();

// Function to query the database
async function fetchVotes() {
    try {
        const [rows] = await pool.query("SELECT * FROM votes"); // Use pool instead of createPool
        console.log(rows);
    } catch (error) {
        console.error("Error fetching votes:", error);
    }
}

// Run the function
fetchVotes();
