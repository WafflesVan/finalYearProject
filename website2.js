const http = require('http');
const fs = require('fs');
const url = require('url');
const mysql = require('mysql2');
//const EC = require('elliptic').ec;
//const ec = new EC('curve25519');
const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const port = 3001;

// ECC keys
const adminPrivateKeyHex = '0f8e0df9e02b906630aa9c33e171147f4145442259069d10fcd20179c1a806ff';
const adminKey = ec.keyFromPrivate(adminPrivateKeyHex, 'hex');
const adminPublicKeyHex = adminKey.getPublic('hex');
const adminPubKey = ec.keyFromPublic(adminPublicKeyHex, 'hex');


// DB connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'votedatabase'
});

// Encrypt function using ECC
function encryptVote(vote) {
    const ephemeralKey = ec.genKeyPair();
  
    // derive expects a Point (which is adminPubKey.getPublic())
    const sharedSecret = ephemeralKey.derive(adminPubKey.getPublic());
  
    const aesKey = crypto.createHash('sha256').update(sharedSecret.toString(16)).digest();
  
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  
    let encrypted = cipher.update(vote, 'utf8', 'hex');
    encrypted += cipher.final('hex');
  
    return {
      encryptedVote: encrypted,
      ephemeralPubKey: ephemeralKey.getPublic('hex'),
      iv: iv.toString('hex')
    };
  }
  

  function decryptStoredVote(voteRow) {
    return decryptVote(
      voteRow.candidate_encrypted,
      voteRow.ephemeral_pubkey,
      voteRow.iv
    );
  }
  
  function decryptVote(encryptedVoteHex, ephemeralPubKeyHex, ivHex) {
    // Recreate ephemeral public key as KeyPair
    const ephemeralPubKey = ec.keyFromPublic(ephemeralPubKeyHex, 'hex').getPublic();
  
    // Derive shared secret using admin private key + ephemeral public key
    const sharedSecret = adminKey.derive(ephemeralPubKey);
  
    // Hash the shared secret to get AES key (same as encrypt)
    const aesKey = crypto.createHash('sha256').update(sharedSecret.toString(16)).digest();
  
    // Convert IV back to buffer
    const iv = Buffer.from(ivHex, 'hex');
  
    // Setup AES-256-CBC decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  
    // Decrypt the vote
    let decrypted = decipher.update(encryptedVoteHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  
    return decrypted;
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
            try {
                const { studentId, candidate } = JSON.parse(body);
                connection.query('SELECT has_voted FROM voters WHERE student_id = ?', [studentId], (err, results) => {
                    if (err) {
                        console.error('DB error on SELECT:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Database error during vote check' }));
                        return;
                    }
    
                    if (results.length === 0) {
                        console.warn(`Student ID ${studentId} not found`);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Invalid student ID' }));
                        return;
                    }
    
                    if (results[0].has_voted) {
                        console.log(`Student ID ${studentId} has already voted`);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'You have already voted' }));
                        return;
                    }
    
                    const encrypted = encryptVote(candidate);
                    const voteQuery = `
                      INSERT INTO votes (student_id, candidate_plain, candidate_encrypted, ephemeral_pubkey, iv)
                      VALUES (?, ?, ?, ?, ?)
                    `;
                    
                    connection.query(
                      voteQuery,
                      [studentId, candidate, encrypted.encryptedVote, encrypted.ephemeralPubKey, encrypted.iv],
                      err2 => {
                        if (err2) {
                          res.writeHead(500, { 'Content-Type': 'application/json' });
                          res.end(JSON.stringify({ message: 'Vote submission failed' }));
                        } else {
                          connection.query('UPDATE voters SET has_voted = TRUE WHERE student_id = ?', [studentId]);
                          res.writeHead(200, { 'Content-Type': 'application/json' });
                          res.end(JSON.stringify({
                            message: 'Vote submitted successfully!',
                            plaintext_vote: candidate,       // for testing only, remove in prod
                            encrypted_vote: encrypted.encryptedVote  // for testing only
                          }));
                        }
                      }
                    );
                    
                });
            } catch (parseErr) {
                console.error('Failed to parse JSON:', parseErr);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid request body' }));
            }
        });
    }
    
    else if (parsedUrl.pathname === '/getVotes' && req.method === 'GET') {
        // For simplicity, no authentication now — add admin auth if you want
        connection.query('SELECT student_id, candidate_encrypted, ephemeral_pubkey, iv FROM votes', (err, results) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error fetching votes' }));
            return;
          }
      
          const decryptedVotes = results.map(row => {
            try {
              return {
                student_id: row.student_id,
                vote: decryptVote(row.candidate_encrypted, row.ephemeral_pubkey, row.iv)
              };
            } catch (e) {
              return {
                student_id: row.student_id,
                vote: null,
                error: 'Decryption failed'
              };
            }
          });
      
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(decryptedVotes));
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