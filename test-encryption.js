/**
 * Token Encryption 테스트 스크립트
 */

require('dotenv').config();

const { encrypt, decrypt, validateKey, generateNewKey } = require('./lib/encryption');

console.log('=== Token Encryption Test ===\n');

// 1. 키 유효성 검사
console.log('1. Validating encryption key...');
if (!validateKey()) {
  console.error('❌ TOKEN_ENCRYPTION_KEY is not set or invalid!');
  console.log('\n💡 Generate a new key with:');
  console.log(`   TOKEN_ENCRYPTION_KEY=${generateNewKey()}`);
  process.exit(1);
}
console.log('✅ Encryption key is valid\n');

// 2. 테스트 토큰 암호화/복호화
const testToken = 'EAAU9F4G7pHABO' + 'TestToken' + Date.now();
console.log('2. Testing encryption/decryption...');
console.log(`   Original: ${testToken.substring(0, 30)}...`);

const encrypted = encrypt(testToken);
console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);

const decrypted = decrypt(encrypted);
console.log(`   Decrypted: ${decrypted.substring(0, 30)}...`);

if (decrypted === testToken) {
  console.log('✅ Encryption/Decryption successful!\n');
} else {
  console.error('❌ Decryption mismatch!');
  process.exit(1);
}

// 3. null 처리 테스트
console.log('3. Testing null handling...');
const nullResult = encrypt(null);
const undefinedResult = encrypt(undefined);
console.log(`   encrypt(null) = ${nullResult}`);
console.log(`   encrypt(undefined) = ${undefinedResult}`);

if (nullResult === null && undefinedResult === null) {
  console.log('✅ Null handling correct!\n');
} else {
  console.error('❌ Null handling failed!');
  process.exit(1);
}

// 4. 다른 키로 복호화 시도 (실패해야 함)
console.log('4. Testing decryption with wrong format...');
try {
  decrypt('invalid-format-without-colon');
  console.error('❌ Should have thrown an error!');
  process.exit(1);
} catch (error) {
  console.log(`   Expected error: ${error.message}`);
  console.log('✅ Invalid format correctly rejected!\n');
}

console.log('=== All tests passed! ===');
console.log('\n📝 Next steps:');
console.log('   1. Set TOKEN_ENCRYPTION_KEY in Railway Environment Variables');
console.log('   2. Set TOKEN_ENCRYPTION_KEY in Vercel Environment Variables');
console.log('   3. Deploy and test client creation');
