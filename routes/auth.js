// Authentication Routes
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, verifyPassword, isMD5Hash, createMD5Hash } = require('../config/passwordUtils');
const { DEPARTMENT_HIERARCHY } = require('../middleware/auth');

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let googleClient = null;

try {
  const { OAuth2Client } = require('google-auth-library');
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  console.log('✅ Google OAuth client initialized');
} catch (error) {
  console.log('⚠️ Google Auth Library not installed');
}

// ฟังก์ชันตรวจสอบ Google Token
async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// ============= UNIVERSAL LOGIN =============
// POST: Universal Login (สำหรับทุก role_group)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกอีเมลและรหัสผ่าน'
    });
  }

  const sql = `
    SELECT e.*, r.role_group, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.email = ?
    LIMIT 1
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      });
    }

    const user = results[0];
    let passwordMatch = false;

    try {
      // ตรวจสอบว่ารหัสผ่านในฐานข้อมูลเป็น MD5 หรือ bcrypt
      if (isMD5Hash(user.password)) {
        const md5Hash = createMD5Hash(password);
        passwordMatch = (md5Hash === user.password);

        // ถ้า login สำเร็จ ให้ migrate รหัสผ่านเป็น bcrypt
        if (passwordMatch) {
          const newHash = await hashPassword(password);
          db.query('UPDATE employees SET password = ? WHERE userid = ?',
            [newHash, user.userid], (err) => {
              if (err) console.error('Error updating password:', err);
              else console.log(`Password migrated for user ${user.userid}`);
            });
        }
      } else {
        passwordMatch = await verifyPassword(password, user.password);
      }
    } catch (error) {
      console.error('Password verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน'
      });
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      });
    }

    // เพิ่ม session
    req.session.user = user;

    // เพิ่มข้อมูล permission สำหรับ admin
    let additionalData = {};
    if (user.role_group === 'admin') {
      const userPermissions = DEPARTMENT_HIERARCHY[user.role_code];
      additionalData = {
        permissions: userPermissions?.permissions || [],
        department: userPermissions?.name || 'Unknown',
        manageable_departments: userPermissions?.canManage || []
      };
    }

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        ...user,
        ...additionalData
      }
    });
  });
});

// ============= ADMIN LOGIN =============
router.post('/adminlogin', async (req, res) => {
  const { email, password } = req.body;

  const sql = `
   SELECT e.*, r.role_group, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.email = ? AND r.role_group = 'admin'
    LIMIT 1
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (results.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = results[0];
    let passwordMatch = false;

    try {
      if (isMD5Hash(user.password)) {
        const md5Hash = createMD5Hash(password);
        passwordMatch = (md5Hash === user.password);

        if (passwordMatch) {
          const newHash = await hashPassword(password);
          db.query('UPDATE employees SET password = ? WHERE userid = ?',
            [newHash, user.userid], (err) => {
              if (err) console.error('Error updating password:', err);
              else console.log(`Admin password migrated for user ${user.userid}`);
            });
        }
      } else {
        passwordMatch = await verifyPassword(password, user.password);
      }
    } catch (error) {
      console.error('Admin password verification error:', error);
      return res.status(500).json({
        error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน'
      });
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.user = user;
    const userPermissions = DEPARTMENT_HIERARCHY[user.role_code];

    res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        ...user,
        permissions: userPermissions?.permissions || [],
        department: userPermissions?.name || 'Unknown',
        manageable_departments: userPermissions?.canManage || []
      }
    });
  });
});

// ============= OWNER LOGIN =============
router.post('/ownerlogin', async (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT e.*, r.role_group, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.email = ? AND r.role_group = 'owner'
    LIMIT 1
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('Owner login error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือคุณไม่ใช่ Owner' });
    }

    const user = results[0];
    let passwordMatch = false;

    try {
      if (isMD5Hash(user.password)) {
        const md5Hash = createMD5Hash(password);
        passwordMatch = (md5Hash === user.password);

        if (passwordMatch) {
          const newHash = await hashPassword(password);
          db.query('UPDATE employees SET password = ? WHERE userid = ?',
            [newHash, user.userid], (err) => {
              if (err) console.error('Error updating password:', err);
              else console.log(`Owner password migrated for user ${user.userid}`);
            });
        }
      } else {
        passwordMatch = await verifyPassword(password, user.password);
      }
    } catch (error) {
      console.error('Owner password verification error:', error);
      return res.status(500).json({
        error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน'
      });
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือคุณไม่ใช่ Owner' });
    }

    req.session.user = user;
    res.json({ message: 'เข้าสู่ระบบสำเร็จ', user: user });
  });
});

// ============= GOOGLE AUTHENTICATION =============
router.post('/google-auth', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'ไม่พบ Google token' });
    }

    const payload = await verifyGoogleToken(token);
    const emailFromToken = payload?.email;
    const emailVerified = payload?.email_verified;

    if (!emailFromToken || !emailVerified) {
      return res.status(401).json({ success: false, message: 'อีเมล Google ยังไม่ยืนยัน' });
    }

    const sql = `
      SELECT e.*, r.role_group, r.role_name, r.subject
      FROM employees e
      JOIN roles r ON e.role_code = r.role_code
      WHERE e.email = ?
      LIMIT 1
    `;

    db.query(sql, [emailFromToken], (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          message: `ไม่พบบัญชีที่ลงทะเบียนด้วยอีเมล ${emailFromToken} ในระบบ`,
        });
      }

      const user = results[0];

      req.session.user = {
        ...user,
        google_authenticated: true,
        google_auth_time: new Date().toISOString(),
        google_picture: payload?.picture || null,
      };

      let additionalData = {};
      if (user.role_group === 'admin' || user.role_group === 'owner') {
        const p = DEPARTMENT_HIERARCHY[user.role_code] || {};
        additionalData = {
          permissions: p.permissions || [],
          department: p.name || 'Unknown',
          manageable_departments: p.canManage || [],
        };
      }

      return res.json({
        success: true,
        message: `เข้าสู่ระบบด้วย Google สำเร็จ`,
        user: {
          ...user,
          ...additionalData,
          google_auth: true,
          google_picture: payload?.picture || null,
        },
      });
    });
  } catch (e) {
    console.error('Google auth error:', e);
    return res.status(401).json({ success: false, message: 'Google token ไม่ถูกต้อง' });
  }
});

// ============= LOGOUT =============
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการออกจากระบบ'
      });
    }

    res.json({
      success: true,
      message: 'ออกจากระบบเรียบร้อยแล้ว'
    });
  });
});

// ============= SESSION CHECK =============
router.get('/check-session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      success: true,
      authenticated: true,
      user: req.session.user
    });
  } else {
    res.json({
      success: true,
      authenticated: false
    });
  }
});

// ============= GOOGLE AUTH STATUS =============
router.get('/google-auth/status', (req, res) => {
  const isConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID';
  const hasLibrary = googleClient !== null;

  res.json({
    success: true,
    google_auth_enabled: isConfigured,
    client_id_configured: isConfigured,
    client_id: isConfigured ? GOOGLE_CLIENT_ID.substring(0, 12) + '...' : 'Not configured',
    verification_enabled: hasLibrary,
    development_mode: process.env.NODE_ENV !== 'production'
  });
});

router.get('/config/google-client-id', (req, res) => {
  res.json({
    success: true,
    client_id: GOOGLE_CLIENT_ID,
    configured: GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID'
  });
});

router.post('/google-auth/revoke', (req, res) => {
  if (req.session && req.session.user && req.session.user.google_authenticated) {
    req.session.user.google_authenticated = false;
    delete req.session.user.google_auth_time;
    delete req.session.user.google_picture;

    res.json({
      success: true,
      message: 'Google authentication session ถูกยกเลิกแล้ว'
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'ไม่พบ Google session ที่จะยกเลิก'
    });
  }
});

// ============= PASSWORD RESET =============
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../config/emailService');

// POST: ส่งอีเมลรีเซ็ตรหัสผ่าน
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกอีเมล'
    });
  }

  try {
    // ตรวจสอบว่ามีอีเมลนี้ในระบบหรือไม่
    const userSql = 'SELECT userid, email, firstname, lastname FROM employees WHERE email = ? LIMIT 1';

    db.query(userSql, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
        });
      }

      // ไม่พบผู้ใช้ - แต่ส่ง success เพื่อความปลอดภัย (ไม่เปิดเผยว่ามีอีเมลในระบบหรือไม่)
      if (results.length === 0) {
        return res.json({
          success: true,
          message: 'หากอีเมลนี้ถูกต้อง เราจะส่งลิงค์รีเซ็ตรหัสผ่านไปให้คุณ'
        });
      }

      const user = results[0];
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // หมดอายุใน 1 ชั่วโมง

      // บันทึก token ลงฐานข้อมูล
      const insertTokenSql = `
        INSERT INTO password_reset_tokens (userid, email, token, expires_at)
        VALUES (?, ?, ?, ?)
      `;

      db.query(insertTokenSql, [user.userid, email, resetToken, expiresAt], async (err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างลิงค์รีเซ็ตรหัสผ่าน'
          });
        }

        // ส่งอีเมล
        try {
          const userName = `${user.firstname} ${user.lastname}`;
          await sendPasswordResetEmail(email, resetToken, userName);

          res.json({
            success: true,
            message: 'เราได้ส่งลิงค์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล'
          });
        } catch (emailError) {
          res.status(500).json({
            success: false,
            message: 'ไม่สามารถส่งอีเมลได้ กรุณาตรวจสอบการตั้งค่าอีเมลหรือลองใหม่อีกครั้ง'
          });
        }
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
    });
  }
});

// GET: ตรวจสอบความถูกต้องของ token
router.get('/verify-reset-token/:token', (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'ไม่พบ token'
    });
  }

  const sql = `
    SELECT * FROM password_reset_tokens
    WHERE token = ? AND expires_at > NOW() AND used = FALSE
    LIMIT 1
  `;

  db.query(sql, [token], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ'
      });
    }

    if (results.length === 0) {
      return res.json({
        success: false,
        message: 'ลิงค์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'
      });
    }

    res.json({
      success: true,
      message: 'Token ถูกต้อง'
    });
  });
});

// POST: รีเซ็ตรหัสผ่านใหม่
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
    });
  }

  try {
    // ตรวจสอบ token
    const tokenSql = `
      SELECT * FROM password_reset_tokens
      WHERE token = ? AND expires_at > NOW() AND used = FALSE
      LIMIT 1
    `;

    db.query(tokenSql, [token], async (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในระบบ'
        });
      }

      if (results.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ลิงค์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'
        });
      }

      const tokenData = results[0];

      try {
        // เข้ารหัสรหัสผ่านใหม่
        const hashedPassword = await hashPassword(newPassword);

        // อัปเดตรหัสผ่าน
        const updatePasswordSql = 'UPDATE employees SET password = ? WHERE userid = ?';

        db.query(updatePasswordSql, [hashedPassword, tokenData.userid], (err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'ไม่สามารถอัปเดตรหัสผ่านได้'
            });
          }

          // ทำเครื่องหมายว่า token ถูกใช้แล้ว
          const markUsedSql = 'UPDATE password_reset_tokens SET used = TRUE WHERE token = ?';

          db.query(markUsedSql, [token], (err) => {
            if (err) {
              // Silent error, not critical
            }

            res.json({
              success: true,
              message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
            });
          });
        });
      } catch (hashError) {
        res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน'
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
    });
  }
});

module.exports = router;
