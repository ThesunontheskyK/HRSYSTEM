// User Routes (สำหรับพนักงานทั่วไป)
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dbPromise = require('../config/database').promise();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');

// Multer configuration สำหรับ upload รูปภาพ
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `user_${req.params.userid}${ext}`);
  }
});
const upload = multer({ storage });

// ============= PROFILE =============
// GET: ดึงข้อมูลผู้ใช้โดยใช้ userid
router.get('/userinfo/:userid', (req, res) => {
  const userid = req.params.userid;
  const sql = `
  SELECT
      e.userid, e.firstname, e.lastname, e.created_at, e.age, e.gender,
      e.birthdate, e.nation, e.religion, e.address, e.sub_district_id,
      e.district, e.provience, e.image, e.tel, e.email, e.zipcode,
      e.salary, e.role_code, r.role_name, r.subject,
      (SELECT COUNT(*) FROM leave_history lh WHERE lh.userid = e.userid AND lh.status ='approved') AS leave_count
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      console.error('เกิดข้อผิดพลาด:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    }

    res.json(results[0]);
  });
});

// PUT: อัปเดตข้อมูลโปรไฟล์
router.put('/profile/:userid', (req, res) => {
  const userid = req.params.userid;
  const {
    firstname, lastname, tel, age, gender, birthdate,
    nation, religion, address, district, provience, zipcode
  } = req.body;

  if (!firstname || !lastname) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกชื่อและนามสกุล'
    });
  }

  const sql = `
    UPDATE employees
    SET firstname = ?, lastname = ?, tel = ?, age = ?, gender = ?,
        birthdate = ?, nation = ?, religion = ?, address = ?,
        district = ?, provience = ?, zipcode = ?
    WHERE userid = ?
  `;

  const values = [
    firstname, lastname, tel || null, age || null, gender || null,
    birthdate || null, nation || null, religion || null, address || null,
    district || null, provience || null, zipcode || null, userid
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้ที่ต้องการอัปเดต'
      });
    }

    res.json({
      success: true,
      message: 'อัปเดตข้อมูลโปรไฟล์สำเร็จ'
    });
  });
});

// POST: อัพโหลดรูปภาพโปรไฟล์
router.post('/profile/:userid/image', upload.single('image'), (req, res) => {
  const { userid } = req.params;

  if (!userid || userid === 'null' || userid === 'undefined') {
    return res.status(400).json({ success: false, message: 'userid ไม่ถูกต้อง' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'ไม่พบไฟล์รูป' });
  }

  const imagePath = `/uploads/${req.file.filename}`;

  const sql = `UPDATE employees SET image = ? WHERE userid = ?`;
  db.query(sql, [imagePath, userid], (err) => {
    if (err) {
      console.error('อัปเดตรูปภาพล้มเหลว:', err);
      return res.status(500).json({ success: false, message: 'บันทึกรูปไม่สำเร็จ' });
    }
    return res.json({ success: true, image: imagePath });
  });
});

// POST: เปลี่ยนรหัสผ่าน
router.post('/profile/:userid/change-password', async (req, res) => {
  const { userid } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
    });
  }

  try {
    // ดึงข้อมูลผู้ใช้และรหัสผ่านปัจจุบัน
    const getUserSql = 'SELECT password FROM employees WHERE userid = ?';

    db.query(getUserSql, [userid], async (err, results) => {
      if (err) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบผู้ใช้'
        });
      }

      const user = results[0];

      // ตรวจสอบรหัสผ่านปัจจุบัน
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
        });
      }

      // แฮชรหัสผ่านใหม่
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // อัปเดตรหัสผ่านในฐานข้อมูล
      const updateSql = 'UPDATE employees SET password = ? WHERE userid = ?';

      db.query(updateSql, [hashedPassword, userid], (err, result) => {
        if (err) {
          console.error('เกิดข้อผิดพลาดในการอัปเดตรหัสผ่าน:', err);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบผู้ใช้ที่ต้องการอัปเดต'
          });
        }

        return res.json({
          success: true,
          message: 'เปลี่ยนรหัสผ่านสำเร็จ'
        });
      });
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผล'
    });
  }
});

// ============= LEAVE REQUESTS =============
// POST: ส่งคำร้องลา
router.post('/leave-requests', async (req, res) => {
  try {
    const { userid, leave_type, start_date, end_date, reason } = req.body;

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    const academicYearId = activeYear.length > 0 ? activeYear[0].id : null;

    db.query(
      `INSERT INTO leave_history (userid, leave_type, start_date, end_date, reason, academic_year_id)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [userid, leave_type, start_date, end_date, reason, academicYearId],
      (err, result) => {
        if (err) {
          console.error('เกิดข้อผิดพลาดในการบันทึกคำร้อง:', err);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกคำร้อง' });
        }
        res.status(201).json({
          message: 'บันทึกคำร้องสำเร็จ',
          id: result.insertId,
          academic_year_id: academicYearId
        });
      }
    );
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกคำร้อง' });
  }
});

// GET: ดูสถานะคำร้องของตัวเอง
router.get('/userrequest/:userid', async (req, res) => {
  try {
    const userId = req.params.userid;

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id, year_name FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    let sql = `
      SELECT lh.*,
        CASE WHEN lh.approveby IS NOT NULL THEN r.role_name ELSE NULL END as approvername,
        ay.year_name as academic_year_name
      FROM leave_history lh
      LEFT JOIN employees e ON e.userid = lh.approveby
      LEFT JOIN roles r ON r.role_code = e.role_code
      LEFT JOIN academic_years ay ON lh.academic_year_id = ay.id
      WHERE lh.userid = ?
    `;

    const params = [userId];

    // Filter ตามปีการศึกษาที่ active
    if (activeYear.length > 0) {
      sql += ' AND lh.academic_year_id = ?';
      params.push(activeYear[0].id);
    }

    sql += ' ORDER BY lh.submitted_at DESC';

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('ดึงข้อมูล leave_history ล้มเหลว:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({
        success: true,
        data: results,
        academic_year: activeYear.length > 0 ? activeYear[0] : null
      });
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============= PAYROLL =============
// GET: ดูเงินเดือนของตัวเอง
router.get('/userpayroll/:userid', (req, res) => {
  const userid = req.params.userid;
  const { year, month } = req.query;

  const currentDate = new Date();
  const targetYear = year || currentDate.getFullYear();
  const targetMonth = month || (currentDate.getMonth() + 1);

  const sql = `
    SELECT e.userid, e.firstname, e.lastname, e.role_code, r.role_name,
           e.salary, e.email, e.salary AS current_salary, p.base_salary,
           p.bonus, p.attendance_deduction, p.other_deduction, p.total_salary,
           p.pay_date, IFNULL(l.leave_count, 0) AS leave_count
    FROM employees e
    LEFT JOIN payroll p ON e.userid = p.userid
      AND YEAR(p.pay_date) = ? AND MONTH(p.pay_date) = ?
    LEFT JOIN (
        SELECT userid, COUNT(*) AS leave_count
        FROM attendance WHERE status='leave'
        AND YEAR(timein) = ? AND MONTH(timein) = ?
        GROUP BY userid
    ) l ON e.userid = l.userid
    LEFT JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
    ORDER BY p.id DESC
    LIMIT 1
  `;

  db.query(sql, [targetYear, targetMonth, targetYear, targetMonth, userid], (err, results) => {
    if (err) {
      console.error('เกิดข้อผิดพลาด:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    }

    res.json({
      success: true,
      data: results[0],
      year: targetYear,
      month: targetMonth
    });
  });
});

// ============= ATTENDANCE =============
// GET: ดูการเข้างานของตัวเอง
router.get('/useratt/:userid', (req, res) => {
  const userid = req.params.userid;
  const { year, month } = req.query;

  const currentDate = new Date();
  const targetYear = year || currentDate.getFullYear();
  const targetMonth = month || (currentDate.getMonth() + 1);

  const sql = `
    SELECT
      a.*,
      lh.reason as leave_reason,
      lh.leave_type
    FROM attendance a
    LEFT JOIN leave_history lh ON (
      a.userid = lh.userid
      AND DATE(a.timein) BETWEEN lh.start_date AND lh.end_date
      AND lh.status = 'approved'
      AND a.status = 'leave'
    )
    WHERE a.userid=? AND a.status='leave'
    AND YEAR(a.timein) = ? AND MONTH(a.timein) = ?
    ORDER BY a.timein DESC
  `;

  db.query(sql, [userid, targetYear, targetMonth], (err, results) => {
    if (err) {
      console.error('เกิดข้อผิดพลาด:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // แปลงหมายเหตุให้แสดงเหตุผลการลาแทนคำว่า "Approved leave:xxx"
    const formattedResults = results.map(record => {
      let displayNote = record.note;
      if (record.status === 'leave' && record.leave_reason) {
        displayNote = record.leave_reason;
      }
      return {
        ...record,
        note: displayNote
      };
    });

    res.json({
      success: true,
      data: formattedResults,
      year: targetYear,
      month: targetMonth
    });
  });
});

module.exports = router;
