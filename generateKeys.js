const EC = require('elliptic').ec;
const ec = new EC('curve25519'); 

// Generate key pair
const key = ec.genKeyPair();

const privateKey = key.getPrivate('hex');
const publicKey = key.getPublic('hex');

console.log('Private Key:', privateKey);
console.log('Public Key:', publicKey);
