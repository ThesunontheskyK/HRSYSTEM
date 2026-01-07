// Admin Routes (สำหรับ Admin ทุกประเภท)
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword } = require('../config/passwordUtils');
const { authenticateToken, createDataFilter, checkPermission, DEPARTMENT_HIERARCHY } = require('../middleware/auth');

// ============= EMPLOYEE MANAGEMENT =============
// GET: ดึงข้อมูลพนักงานตาม permission
router.get('/employees', authenticateToken, (req, res) => {
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT e.userid, e.firstname, e.lastname, e.email, e.role_code,
           r.role_name, r.role_group, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group = 'user'
  `;

  const params = [];

  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  sql += ' ORDER BY e.firstname, e.lastname';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('ดึงข้อมูล employees ล้มเหลว:', err);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name || 'Unknown',
      total_shown: results.length
    });
  });
});

// GET: ดึงข้อมูลพนักงานทั้งหมดสำหรับ Admin
router.get('/adminemployees', authenticateToken, (req, res) => {
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT e.*, r.role_name, r.role_group, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
  `;

  const params = [];
  const conditions = [];

  // HR เห็นได้ทั้ง user และ admin (แต่ไม่รวม owner)
  if (req.user.role_code === 'admin_hr') {
    conditions.push("r.role_group IN ('user', 'admin')");
  } else {
    conditions.push("r.role_group = 'user'");
  }

  if (req.user.role_code !== 'admin_hr' && filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    conditions.push(`e.role_code IN (${placeholders})`);
    params.push(...filter.role_code);
  }

  if (filter.subject && req.user.role_code !== 'admin_hr') {
    conditions.push('r.subject = ?');
    params.push(filter.subject);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY r.role_group, e.firstname, e.lastname';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('ดึงข้อมูล employees ล้มเหลว:', err);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name || 'Unknown',
      total_shown: results.length
    });
  });
});

// GET: ค้นหาพนักงาน
router.get('/searchemployees', authenticateToken, (req, res) => {
  const keyword = req.query.keyword || '';
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT e.*, CONCAT(e.firstname, ' ', e.lastname) AS fullname, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE CONCAT(e.firstname, ' ', e.lastname) LIKE ? AND r.role_group = 'user'
  `;

  const params = [`%${keyword}%`];

  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      success: true,
      data: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name || 'Unknown'
    });
  });
});

// GET: ดึงข้อมูลพนักงานรายคน
router.get('/hr/employees/:userid', authenticateToken, (req, res) => {
  const userid = req.params.userid;
  const currentUser = req.user;

  const userPermissions = DEPARTMENT_HIERARCHY[currentUser.role_code];
  if (!userPermissions) {
    return res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์ในการดำเนินการนี้'
    });
  }

  const sql = `
    SELECT e.userid, e.firstname, e.lastname, e.email, e.tel, e.salary,
           e.age, e.gender, e.address, e.district, e.provience, e.zipcode,
           e.birthdate, e.nation, e.religion, e.role_code, e.created_at, e.image,
           r.role_name, r.role_group, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      console.error('Error fetching employee details:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลพนักงาน'
      });
    }

    const employee = results[0];

    // ตรวจสอบสิทธิ์การเข้าถึง
    if (currentUser.role_code !== 'admin_hr' && currentUser.role_group !== 'owner') {
      if (userPermissions.manageable_roles &&
          !userPermissions.manageable_roles.includes(employee.role_code)) {
        return res.status(403).json({
          success: false,
          message: 'ไม่มีสิทธิ์ดูข้อมูลพนักงานคนนี้'
        });
      }
    }

    res.json({
      success: true,
      data: employee
    });
  });
});

// GET: ดึงข้อมูล Admin Profile
router.get('/admininfo/:userid', (req, res) => {
  const userid = req.params.userid;
  const sql = `
  SELECT e.userid, e.firstname, e.lastname, e.created_at, e.age, e.gender,
         e.birthdate, e.nation, e.religion, e.address, e.sub_district_id,
         e.district, e.provience, e.image, e.tel, e.email, e.zipcode,
         e.role_code, r.role_group, r.role_name, r.subject,
         (SELECT COUNT(*) FROM leave_history lh WHERE lh.userid = e.userid) AS leave_count
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

// POST: เพิ่มพนักงานใหม่ (เฉพาะ HR)
router.post('/hr/employees', authenticateToken, checkPermission('update_all_employees'), async (req, res) => {
  const {
    firstname, lastname, email, password, role_code, tel, salary,
    age, gender, address, district, provience, zipcode, birthdate, nation, religion
  } = req.body;

  if (!firstname || !lastname || !email || !password || !role_code) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลที่จำเป็น'
    });
  }

  try {
    const hashedPassword = await hashPassword(password);

    // ตรวจสอบ role_code
    db.query('SELECT role_code FROM roles WHERE role_code = ?', [role_code], (err, roleResults) => {
      if (err || roleResults.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ตำแหน่งที่เลือกไม่ถูกต้อง'
        });
      }

      // ตรวจสอบ email
      db.query('SELECT userid FROM employees WHERE email = ?', [email], (err, emailResults) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด'
          });
        }

        if (emailResults.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'อีเมลนี้มีผู้ใช้งานแล้ว'
          });
        }

        // เพิ่มพนักงาน
        const insertSql = `
          INSERT INTO employees (
            firstname, lastname, email, password, role_code, tel, salary,
            age, gender, address, district, provience, zipcode, birthdate, nation, religion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          firstname, lastname, email, hashedPassword, role_code,
          tel || null, salary || 0, age || null, gender || null,
          address || null, district || null, provience || null,
          zipcode || null, birthdate || null, nation || null, religion || null
        ];

        db.query(insertSql, values, (err, result) => {
          if (err) {
            console.error('Error adding employee:', err);
            return res.status(500).json({
              success: false,
              message: 'เกิดข้อผิดพลาดในการเพิ่มพนักงาน'
            });
          }

          res.json({
            success: true,
            message: 'เพิ่มพนักงานใหม่เรียบร้อยแล้ว',
            userid: result.insertId
          });
        });
      });
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด'
    });
  }
});

// PUT: แก้ไขพนักงาน (เฉพาะ HR)
router.put('/hr/employees/:userid', authenticateToken, checkPermission('update_all_employees'), (req, res) => {
  const targetUserId = req.params.userid;
  const {
    firstname, lastname, email, tel, salary, role_code, age, gender,
    address, district, provience, zipcode, birthdate, nation, religion
  } = req.body;

  if (!firstname || !lastname || !email) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกชื่อ, นามสกุล, และอีเมล'
    });
  }

  const checkEmailSql = `SELECT userid FROM employees WHERE email = ? AND userid != ?`;

  db.query(checkEmailSql, [email, targetUserId], (err, emailResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาด'
      });
    }

    if (emailResults.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'อีเมลนี้มีผู้ใช้งานแล้ว'
      });
    }

    const updateSql = `
      UPDATE employees
      SET firstname = ?, lastname = ?, email = ?, tel = ?, salary = ?, role_code = ?,
          age = ?, gender = ?, address = ?, district = ?, provience = ?, zipcode = ?,
          birthdate = ?, nation = ?, religion = ?
      WHERE userid = ?
    `;

    const values = [
      firstname, lastname, email, tel || null, salary || null, role_code || null,
      age || null, gender || null, address || null, district || null, provience || null,
      zipcode || null, birthdate || null, nation || null, religion || null, targetUserId
    ];

    db.query(updateSql, values, (err, result) => {
      if (err) {
        console.error('Error updating employee:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบพนักงานที่ต้องการอัพเดท'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดทข้อมูลพนักงานเรียบร้อยแล้ว'
      });
    });
  });
});

// DELETE: ลบพนักงาน (เฉพาะ HR)
router.delete('/hr/employees/:userid', authenticateToken, checkPermission('update_all_employees'), (req, res) => {
  const targetUserId = req.params.userid;

  if (targetUserId == req.user.userid) {
    return res.status(400).json({
      success: false,
      message: 'ไม่สามารถลบบัญชีของตัวเองได้'
    });
  }

  const checkRoleSql = `
    SELECT r.role_group
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
  `;

  db.query(checkRoleSql, [targetUserId], (err, roleResults) => {
    if (err || roleResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบพนักงานที่ต้องการลบ'
      });
    }

    if (roleResults[0].role_group === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถลบ Owner ได้'
      });
    }

    // ลบข้อมูลที่เกี่ยวข้อง
    db.query('DELETE FROM attendance WHERE userid = ?', [targetUserId], () => {
      db.query('DELETE FROM leave_history WHERE userid = ?', [targetUserId], () => {
        db.query('DELETE FROM payroll WHERE userid = ?', [targetUserId], () => {
          db.query('DELETE FROM employees WHERE userid = ?', [targetUserId], (err, result) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบพนักงาน'
              });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({
                success: false,
                message: 'ไม่พบพนักงานที่ต้องการลบ'
              });
            }

            res.json({
              success: true,
              message: 'ลบพนักงานเรียบร้อยแล้ว'
            });
          });
        });
      });
    });
  });
});

// GET: ดึงรายการ roles
router.get('/hr/roles', authenticateToken, checkPermission('read_all_employees'), (req, res) => {
  const sql = `
    SELECT role_code, role_group, role_name, subject
    FROM roles
    WHERE role_group IN ('user', 'admin')
    ORDER BY CASE role_group WHEN 'admin' THEN 1 WHEN 'user' THEN 2 END, role_name
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching roles:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่ง'
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// GET: ดู permissions ของตัวเอง
router.get('/my-permissions', authenticateToken, (req, res) => {
  const userPermissions = DEPARTMENT_HIERARCHY[req.user.role_code];

  if (!userPermissions) {
    return res.status(404).json({
      success: false,
      message: 'ไม่พบข้อมูลสิทธิ์'
    });
  }

  res.json({
    success: true,
    data: {
      user_info: {
        userid: req.user.userid,
        firstname: req.user.firstname,
        lastname: req.user.lastname,
        role_code: req.user.role_code,
        role_group: req.user.role_group
      },
      permissions: {
        role_name: userPermissions.name,
        permissions: userPermissions.permissions,
        can_manage: userPermissions.canManage,
        manageable_roles: userPermissions.manageable_roles || [],
        subject: userPermissions.subject || null
      }
    }
  });
});

module.exports = router;
