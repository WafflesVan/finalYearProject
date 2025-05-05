const http = require('http');
const fs = require('fs');
const url = require('url');
const mysql = require('mysql2');
const EC = require('elliptic').ec;
const ec = new EC('curve25519');

const port = 3001;

// ECC keys
const adminPrivateKey = '0f8e0df9e02b906630aa9c33e171147f4145442259069d10fcd20179c1a806ff';
const adminKey = ec.keyFromPrivate(adminPrivateKey, 'hex');
const publicKey = adminKey.getPublic('hex');

// DB connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'votedatabase'
});

// Encrypt function using ECC
function encryptVote(vote) {
    const key = ec.genKeyPair();
    const sharedSecret = key.derive(adminKey.getPublic());
    const ciphertext = Buffer.from(vote).toString('base64'); // Simplified for demo
    return { encrypted: ciphertext, ephemeralPubKey: key.getPublic('hex') };
}

// Server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        fs.readFile('index.html', (err, data) => {
            res.writeHead(err ? 404 : 200, { 'Content-Type': 'text/html' });
            res.end(err ? 'Not Found' : data);
        });
    }

    else if (parsedUrl.pathname === '/addStudent' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { studentId } = JSON.parse(body);
            connection.query('INSERT INTO voters (student_id) VALUES (?)', [studentId], err => {
                res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: err ? 'Error adding student' : 'Student added' }));
            });
        });
    }

    else if (parsedUrl.pathname === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { studentId } = JSON.parse(body);
            connection.query('SELECT has_voted FROM voters WHERE student_id = ?', [studentId], (err, results) => {
                if (err || results.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid student ID' }));
                } else if (results[0].has_voted) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'You have already voted!' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                }
            });
        });
    }

    else if (parsedUrl.pathname === '/vote' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { studentId, candidate } = JSON.parse(body);
            connection.query('SELECT has_voted FROM voters WHERE student_id = ?', [studentId], (err, results) => {
                if (err || results.length === 0 || results[0].has_voted) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid vote or already voted' }));
                    return;
                }

                const encryptedVote = encryptVote(candidate);
                const voteQuery = 'INSERT INTO votes (student_id, candidate_plain, candidate_encrypted, ephemeral_pubkey) VALUES (?, ?, ?, ?)';
                connection.query(voteQuery, [studentId, candidate, encryptedVote.encrypted, encryptedVote.ephemeralPubKey], err2 => {
                    if (err2) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Vote submission failed' }));
                    } else {
                        connection.query('UPDATE voters SET has_voted = TRUE WHERE student_id = ?', [studentId]);
                        // Send both the plaintext and encrypted vote back for Wireshark capture
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            message: 'Vote submitted successfully!',
                            plaintext_vote: candidate,
                            encrypted_vote: encryptedVote.encrypted
                        }));
                    }
                });
            });
        });
    }

    else {
        res.writeHead(404);
        res.end('404 Not Found');
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
