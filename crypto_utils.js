const EC = require('elliptic').ec;
const CryptoJS = require('crypto-js');

const ec = new EC('secp256k1');

// Your private key here (HEX format)
const serverPrivateKeyHex = 'your_private_key_here';
const serverPrivateKey = ec.keyFromPrivate(serverPrivateKeyHex);

// Public key for clients (send this to frontend)
const serverPublicKey = serverPrivateKey.getPublic('hex');

function deriveSharedSecret(ephemeralPublicKeyHex) {
    const ephemeralKey = ec.keyFromPublic(ephemeralPublicKeyHex, 'hex');
    const sharedSecret = serverPrivateKey.derive(ephemeralKey.getPublic());
    return CryptoJS.SHA256(sharedSecret.toString()).toString(); // AES key
}

function decryptMessage(ciphertext, ephemeralPublicKeyHex) {
    const aesKey = deriveSharedSecret(ephemeralPublicKeyHex);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, aesKey);
    return decrypted.toString(CryptoJS.enc.Utf8);
}

module.exports = {
    serverPublicKey,
    decryptMessage
};
