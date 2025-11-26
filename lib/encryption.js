/**
 * ============================================================================
 * Token Encryption Utility - AES-256-CBC 암호화
 * ============================================================================
 *
 * Meta Access Token을 암호화하여 DB에 저장
 * 환경변수 TOKEN_ENCRYPTION_KEY에 32바이트(64자 hex) 키 필요
 *
 * 키 생성 방법:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * ============================================================================
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * 암호화 키 가져오기
 * @returns {Buffer} 32바이트 암호화 키
 */
function getEncryptionKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * 텍스트 암호화
 * @param {string} text - 암호화할 텍스트
 * @returns {string} 암호화된 문자열 (iv:encrypted 형식)
 */
function encrypt(text) {
  if (!text) {
    return null;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // IV와 암호문을 콜론으로 구분하여 저장
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 암호문 복호화
 * @param {string} encryptedText - 암호화된 문자열 (iv:encrypted 형식)
 * @returns {string} 복호화된 텍스트
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  const key = getEncryptionKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 암호화 키 유효성 검사
 * @returns {boolean} 키가 유효하면 true
 */
function validateKey() {
  try {
    getEncryptionKey();
    return true;
  } catch (error) {
    console.error('Encryption key validation failed:', error.message);
    return false;
  }
}

/**
 * 새 암호화 키 생성 (유틸리티)
 * @returns {string} 64자 hex 문자열
 */
function generateNewKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  validateKey,
  generateNewKey
};
