const http = require('http');
const fs = require('fs');
const mysql = require('mysql2');
const url = require('url');
const port = 3001;

// Database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'votedatabase'
});

// Server setup
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Serve index.html
    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.readFile('index2.html', (error, data) => {
            if (error) {
                res.writeHead(404);
                res.write("Error: File Not Found");
            } else {
                res.write(data);
            }
            res.end();
        });
    }

    // Login or register student
    else if (parsedUrl.pathname === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const { studentId } = JSON.parse(body);
            const checkQuery = 'SELECT has_voted FROM voters WHERE student_id = ?';

            connection.query(checkQuery, [studentId], (err, results) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Server error' }));
                    return;
                }

                if (results.length > 0) {
                    if (results[0].has_voted) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', message: 'You have already voted!' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok' }));
                    }
                } else {
                    const insertQuery = 'INSERT INTO voters (student_id) VALUES (?)';
                    connection.query(insertQuery, [studentId], (err2) => {
                        if (err2) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Registration failed' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok' }));
                    });
                }
            });
        });
    }

    // Vote submission
    else if (parsedUrl.pathname === '/vote' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const { studentId, candidate } = JSON.parse(body);

            const checkVoterQuery = 'SELECT has_voted FROM voters WHERE student_id = ?';
            connection.query(checkVoterQuery, [studentId], (err, results) => {
                if (err || results.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid student ID' }));
                    return;
                }

                if (results[0].has_voted) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'You have already voted!' }));
                    return;
                }

                const voteQuery = 'INSERT INTO votes (student_id, candidate) VALUES (?, ?)';
                connection.query(voteQuery, [studentId, candidate], (err2) => {
                    if (err2) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Failed to submit vote' }));
                        return;
                    }

                    const updateVoter = 'UPDATE voters SET has_voted = TRUE WHERE student_id = ?';
                    connection.query(updateVoter, [studentId]);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Vote submitted successfully!' }));
                });
            });
        });
    }

    // 404 for unknown routes
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

// Start the server
server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});