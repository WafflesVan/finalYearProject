const mysql = require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: 'localhost',  // your MySQL host
  user: 'root',       // your MySQL username
  password: 'password',  // your MySQL password
  database: 'votedatabase'   // your database name
});

// Connect to the database
connection.connect(err => {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});

// Query to read data from a table
connection.query('SELECT * FROM votes', (err, rows) => {
  if (err) {
    console.error('Error reading from the table: ' + err.stack);
    return;
  }

  console.log('Data from table: ', rows);
});

// Close the connection
connection.end();

