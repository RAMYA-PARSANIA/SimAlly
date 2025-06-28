const crypto = require('crypto');
require('dotenv').config();

// Get encryption key from environment variables or generate one
// In production, this should be a secure, persistent key stored in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts sensitive data
 * @param {string} text - Text to encrypt
 * @returns {Object} - Object containing encrypted text, iv, and auth tag
 */
function encrypt(text) {
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedText: encrypted,
    iv: iv.toString('hex'),
    authTag
  };
}

/**
 * Decrypts encrypted data
 * @param {string} encryptedText - Encrypted text
 * @param {string} iv - Initialization vector in hex
 * @param {string} authTag - Authentication tag in hex
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText, iv, authTag) {
  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY, 'hex'), 
    Buffer.from(iv, 'hex')
  );
  
  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  // Decrypt the text
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};