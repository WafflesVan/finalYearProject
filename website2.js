const http = require('http');
const fs = require('fs');
const mysql = require('mysql2');
const url = require('url');
const port = 3001;

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'votedatabase'
});

// Create the server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Serve index.html for GET request
    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.readFile('index.html', (error, data) => {
            if (error) {
                res.writeHead(404);
                res.write("Error: File Not Found");
            } else {
                res.write(data);
            }
            res.end();
        });
    }
    // Handle POST request to submit vote
    else if (parsedUrl.pathname === '/vote' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', () => {
            const voteData = JSON.parse(body);
            const candidate = voteData.candidate;

            // Insert the vote into the database
            const query = 'INSERT INTO votes (candidate) VALUES (?)';
            connection.query(query, [candidate], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err.stack);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Error inserting vote' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Vote submitted successfully!' }));
            });
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

// Start the server
server.listen(port, (error) => {
    if (error) {
        console.log('Something went wrong', error);
    } else {
        console.log('Server is listening on port', port);
    }
});
