// Password Utilities
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

// ฟังก์ชันสำหรับสร้าง hash รหัสผ่านใหม่
async function hashPassword(plainPassword) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('ไม่สามารถเข้ารหัสรหัสผ่านได้');
  }
}

// ฟังก์ชันสำหรับตรวจสอบรหัสผ่าน
async function verifyPassword(plainPassword, hashedPassword) {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

// ฟังก์ชันตรวจสอบว่ารหัสผ่านเป็น MD5 หรือไม่ (เพื่อ backward compatibility)
function isMD5Hash(password) {
  // MD5 จะมีความยาว 32 ตัวอักษร hex
  return /^[a-f0-9]{32}$/i.test(password);
}

// ฟังก์ชันสำหรับ migrate รหัสผ่านเก่า
function createMD5Hash(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  isMD5Hash,
  createMD5Hash,
  SALT_ROUNDS
};
