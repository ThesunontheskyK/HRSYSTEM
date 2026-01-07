// Owner Routes (เจ้าของระบบ - Full Access)
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword } = require('../config/passwordUtils');

// ============= DASHBOARD & STATISTICS =============
// GET: Dashboard statistics
router.get('/owner/dashboard-stats', (req, res) => {
  // สถิติพนักงานทั้งหมด
  const employeesSql = `
    SELECT
      COUNT(*) as total_employees,
      COUNT(CASE WHEN r.role_group = 'user' THEN 1 END) as total_users,
      COUNT(CASE WHEN r.role_group = 'admin' THEN 1 END) as total_admins,
      COUNT(CASE WHEN r.role_group = 'owner' THEN 1 END) as total_owners
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
  `;

  db.query(employeesSql, (err, employeeResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงสถิติพนักงาน'
      });
    }

    // สถิติการเข้างานวันนี้
    const today = new Date().toISOString().split('T')[0];
    const attendanceSql = `
      SELECT
        COUNT(*) as total_attendance,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as on_leave
      FROM attendance a
      JOIN employees e ON a.userid = e.userid
      JOIN roles r ON e.role_code = r.role_code
      WHERE DATE(a.timein) = ? AND r.role_group IN ('user', 'admin')
    `;

    db.query(attendanceSql, [today], (err, attendanceResults) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'เกิดข้อผิดพลาดในการดึงสถิติการเข้างาน'
        });
      }

      // สถิติคำร้องลา
      const leaveRequestsSql = `
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lh.status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN lh.status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN lh.status = 'rejected' THEN 1 END) as rejected_requests
        FROM leave_history lh
        JOIN employees e ON lh.userid = e.userid
        JOIN roles r ON e.role_code = r.role_code
        WHERE r.role_group IN ('user', 'admin')
      `;

      db.query(leaveRequestsSql, (err, leaveResults) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงสถิติคำร้องลา'
          });
        }

        // สถิติเงินเดือนรวม
        const salarySql = `
          SELECT
            SUM(CAST(e.salary AS DECIMAL(10,2))) as total_monthly_salary,
            AVG(CAST(e.salary AS DECIMAL(10,2))) as average_salary,
            COUNT(CASE WHEN CAST(e.salary AS DECIMAL(10,2)) > 0 THEN 1 END) as employees_with_salary
          FROM employees e
          JOIN roles r ON e.role_code = r.role_code
          WHERE r.role_group IN ('user', 'admin') AND e.salary IS NOT NULL
        `;

        db.query(salarySql, (err, salaryResults) => {
          if (err) {
            return res.status(500).json({
              success: false,
              error: 'เกิดข้อผิดพลาดในการดึงสถิติเงินเดือน'
            });
          }

          const stats = {
            employees: employeeResults[0],
            attendance: attendanceResults[0],
            leave_requests: leaveResults[0],
            salary: salaryResults[0]
          };

          res.json({
            success: true,
            data: stats
          });
        });
      });
    });
  });
});

// GET: ข้อมูลโปรไฟล์ Owner
router.get('/ownerinfo/:userid', (req, res) => {
  const userid = req.params.userid;
  const sql = `
    SELECT e.userid, e.firstname, e.lastname, e.created_at, e.age, e.gender,
           e.birthdate, e.nation, e.religion, e.address, e.sub_district_id,
           e.district, e.provience, e.image, e.tel, e.email, e.zipcode,
           e.role_code, r.role_group, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ? AND r.role_group = 'owner'
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้หรือไม่ใช่ Owner' });
    }

    res.json(results[0]);
  });
});

// ============= EMPLOYEE MANAGEMENT (FULL ACCESS) =============
// GET: รายชื่อพนักงานทั้งหมด
router.get('/owner/all-employees', (req, res) => {
  const sql = `
    SELECT e.userid, e.firstname, e.lastname, e.email, e.tel, e.age, e.gender,
           e.address, e.district, e.provience, e.salary, e.created_at,
           e.role_code, e.image, r.role_name, r.role_group, r.subject,
           (SELECT COUNT(*) FROM leave_history lh WHERE lh.userid = e.userid) AS total_leave_requests,
           (SELECT COUNT(*) FROM attendance a WHERE a.userid = e.userid AND DATE(a.timein) = CURDATE()) AS today_attendance
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin')
    ORDER BY e.userid
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน'
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  });
});

// GET: ข้อมูลพนักงานรายคน
router.get('/owneremployees/:userid', (req, res) => {
  const userid = req.params.userid;
  const sql = `
    SELECT e.userid, e.firstname, e.lastname, e.created_at, e.age, e.gender,
           e.birthdate, e.nation, e.religion, e.address, e.sub_district_id,
           e.district, e.provience, e.image, e.tel, e.email, e.zipcode,
           e.salary, e.role_code, r.role_group, r.role_name, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    }

    res.json(results[0]);
  });
});

// GET: รายการ roles ทั้งหมด
router.get('/owner/roles', (req, res) => {
  const sql = `
    SELECT role_code, role_group, role_name, subject
    FROM roles
    ORDER BY
      CASE role_group
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'user' THEN 3
        ELSE 4
      END,
      role_name
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่ง',
        error: err.message
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// POST: เพิ่มพนักงานใหม่
router.post('/owner/employee', async (req, res) => {
  const {
    firstname, lastname, email, password, role_code, tel, salary,
    age, gender, address, district, provience, zipcode, birthdate, nation, religion
  } = req.body;

  if (!firstname || !lastname || !email || !password || !role_code) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลที่จำเป็น: ชื่อ, นามสกุล, อีเมล, รหัสผ่าน, และตำแหน่ง'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'รูปแบบอีเมลไม่ถูกต้อง'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
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

        const insertSql = `
          INSERT INTO employees (
            firstname, lastname, email, password, role_code, tel, salary,
            age, gender, address, district, provience, zipcode,
            birthdate, nation, religion
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
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน'
    });
  }
});

// PUT: อัพเดทพนักงาน
router.put('/owner/employee/:userid', (req, res) => {
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

  // ตรวจสอบ role_code ถ้ามี
  if (role_code) {
    db.query('SELECT role_code FROM roles WHERE role_code = ?', [role_code], (err, roleResults) => {
      if (err || roleResults.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ตำแหน่งที่เลือกไม่ถูกต้อง'
        });
      }
      checkEmailAndUpdate();
    });
  } else {
    checkEmailAndUpdate();
  }

  function checkEmailAndUpdate() {
    db.query('SELECT userid FROM employees WHERE email = ? AND userid != ?', [email, targetUserId], (err, emailResults) => {
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
          message: 'อัพเดทข้อมูลพนักงานเรียบร้อยแล้ว',
          roleChanged: !!role_code
        });
      });
    });
  }
});

// DELETE: ลบพนักงาน
router.delete('/owner/employee/:userid', (req, res) => {
  const targetUserId = req.params.userid;

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

// ============= SALARY CHANGE HISTORY =============
// POST: บันทึกประวัติการเปลี่ยนแปลงเงินเดือน
router.post('/owner/salary-change-history', (req, res) => {
  const { userid, old_salary, new_salary, changed_by, reason } = req.body;

  if (!userid || old_salary === undefined || new_salary === undefined) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุข้อมูลที่จำเป็น'
    });
  }

  const salary_diff = new_salary - old_salary;
  const yearly_diff = salary_diff * 12;

  const sql = `
    INSERT INTO salary_change_history
    (userid, old_salary, new_salary, salary_diff, yearly_diff, changed_by, reason, change_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(sql, [userid, old_salary, new_salary, salary_diff, yearly_diff, changed_by || null, reason || null], (err, result) => {
    if (err) {
      console.error('Error saving salary change history:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการบันทึกประวัติ'
      });
    }

    res.json({
      success: true,
      message: 'บันทึกประวัติการเปลี่ยนแปลงเรียบร้อยแล้ว',
      change_id: result.insertId
    });
  });
});

// GET: ดึงประวัติการเปลี่ยนแปลงเงินเดือนของพนักงาน
router.get('/owner/salary-change-history/:userid', (req, res) => {
  const userid = req.params.userid;

  const sql = `
    SELECT
      sch.*,
      e.firstname, e.lastname,
      changer.firstname as changed_by_firstname,
      changer.lastname as changed_by_lastname
    FROM salary_change_history sch
    JOIN employees e ON sch.userid = e.userid
    LEFT JOIN employees changer ON sch.changed_by = changer.userid
    WHERE sch.userid = ?
    ORDER BY sch.change_date DESC
    LIMIT 50
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      console.error('Error fetching salary change history:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงประวัติ'
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  });
});

// ============= PAYROLL =============
// GET: Payroll ของพนักงานคนใดคนหนึ่ง
router.get('/owner/payroll/:userid', (req, res) => {
  const userid = req.params.userid;

  const sql = `
    SELECT p.*, e.firstname, e.lastname
    FROM payroll p
    JOIN employees e ON p.userid = e.userid
    WHERE p.userid = ?
    ORDER BY p.pay_date DESC
  `;

  db.query(sql, [userid], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงประวัติ payroll'
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// GET: Payroll ทั้งหมด
router.get('/owner/payroll-all', (req, res) => {
  const { month, year } = req.query;

  let sql = `
    SELECT p.*, e.firstname, e.lastname, e.role_code, r.role_name
    FROM payroll p
    JOIN employees e ON p.userid = e.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE 1=1
  `;

  const params = [];

  if (year) {
    sql += ' AND YEAR(p.pay_date) = ?';
    params.push(year);
  }

  if (month) {
    sql += ' AND MONTH(p.pay_date) = ?';
    params.push(month);
  }

  sql += ' ORDER BY p.pay_date DESC, e.firstname';

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล payroll'
      });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// POST: สร้าง payroll record
router.post('/owner/payroll', (req, res) => {
  const { userid, base_salary, bonus, attendance_deduction, other_deduction, pay_date } = req.body;

  if (!userid || !pay_date) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุ userid และ pay_date'
    });
  }

  const sql = `
    INSERT INTO payroll (userid, base_salary, bonus, attendance_deduction, other_deduction, pay_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [userid, base_salary || 0, bonus || 0, attendance_deduction || 0, other_deduction || 0, pay_date], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้าง payroll record'
      });
    }

    res.json({
      success: true,
      message: 'สร้าง payroll record เรียบร้อยแล้ว',
      payroll_id: result.insertId,
      total_salary: (base_salary || 0) + (bonus || 0) - (attendance_deduction || 0) - (other_deduction || 0)
    });
  });
});

// GET: ดึงข้อมูลการลาและการเข้างานของพนักงานตามเดือน
router.get('/owner/employee-attendance/:userid', (req, res) => {
  const userid = req.params.userid;
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุปีและเดือน'
    });
  }

  // Query ข้อมูลการลา
  const leaveSql = `
    SELECT COUNT(*) as approved_leaves
    FROM leave_history
    WHERE userid = ? AND status = 'approved'
    AND YEAR(start_date) = ? AND MONTH(start_date) = ?
  `;

  // Query ข้อมูลการเข้างาน
  const attendanceSql = `
    SELECT
      COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
      COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days
    FROM attendance
    WHERE userid = ? AND YEAR(timein) = ? AND MONTH(timein) = ?
  `;

  db.query(leaveSql, [userid, year, month], (err, leaveResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการลา'
      });
    }

    db.query(attendanceSql, [userid, year, month], (err, attendanceResults) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน'
        });
      }

      const approvedLeaves = leaveResults[0]?.approved_leaves || 0;
      const absentDays = attendanceResults[0]?.absent_days || 0;
      const lateDays = attendanceResults[0]?.late_days || 0;
      const totalDeductions = approvedLeaves + absentDays + lateDays;
      const deductionAmount = totalDeductions * 300;

      res.json({
        success: true,
        data: {
          approvedLeaves,
          absentDays,
          lateDays,
          totalDeductions,
          deductionAmount,
          year,
          month
        }
      });
    });
  });
});

// ============= STATISTICS & REPORTS =============
// GET: จำนวนพนักงานที่มีปัญหาการเข้างานในเดือนปัจจุบัน
router.get('/owner/attendance-issues-count', (req, res) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // นับจำนวนพนักงานที่ขาดงาน/ลา/มาสายในเดือนนี้
  const sql = `
    SELECT
      COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.userid END) as absent_count,
      COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.userid END) as late_count,
      COUNT(DISTINCT CASE WHEN lh.status = 'approved' THEN lh.userid END) as leave_count,
      COUNT(DISTINCT CASE WHEN a.status IN ('absent', 'late') OR lh.status = 'approved' THEN COALESCE(a.userid, lh.userid) END) as total_issues_count
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    LEFT JOIN attendance a ON e.userid = a.userid
      AND YEAR(a.timein) = ?
      AND MONTH(a.timein) = ?
      AND a.status IN ('absent', 'late')
    LEFT JOIN leave_history lh ON e.userid = lh.userid
      AND YEAR(lh.start_date) = ?
      AND MONTH(lh.start_date) = ?
      AND lh.status = 'approved'
    WHERE r.role_group IN ('user', 'admin')
  `;

  db.query(sql, [currentYear, currentMonth, currentYear, currentMonth], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน'
      });
    }

    res.json({
      success: true,
      data: {
        absent_count: results[0].absent_count || 0,
        late_count: results[0].late_count || 0,
        leave_count: results[0].leave_count || 0,
        total_issues_count: results[0].total_issues_count || 0,
        month: currentMonth,
        year: currentYear
      }
    });
  });
});

// GET: รายงานสรุปรายได้-รายจ่าย
router.get('/owner/financial-summary', (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;

  const salarySql = `
    SELECT
      SUM(CAST(e.salary AS DECIMAL(10,2))) as total_salary_expense,
      COUNT(*) as total_employees,
      AVG(CAST(e.salary AS DECIMAL(10,2))) as average_salary,
      r.role_group,
      r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin') AND e.salary IS NOT NULL
    GROUP BY r.role_group, r.subject
  `;

  db.query(salarySql, (err, salaryResults) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปทางการเงิน'
      });
    }

    // คำนวณค่าใช้จ่ายรายปีแบบ per employee (แล้วค่อยรวม)
    const perEmployeeYearlySql = `
      SELECT
        e.userid,
        CAST(COALESCE(e.salary, 0) AS DECIMAL(10,2)) as current_salary,
        CAST(COALESCE(SUM(p.total_salary), 0) AS DECIMAL(10,2)) as paid_total,
        CAST(COUNT(p.payroll_id) AS SIGNED) as months_paid,
        CAST((12 - COUNT(p.payroll_id)) * COALESCE(e.salary, 0) AS DECIMAL(10,2)) as estimated_remaining,
        CAST(COALESCE(SUM(p.total_salary), 0) + ((12 - COUNT(p.payroll_id)) * COALESCE(e.salary, 0)) AS DECIMAL(10,2)) as employee_yearly_total
      FROM employees e
      JOIN roles r ON e.role_code = r.role_code
      LEFT JOIN payroll p ON p.userid = e.userid AND YEAR(p.pay_date) = ?
      WHERE r.role_group IN ('user', 'admin')
      GROUP BY e.userid, e.salary
    `;


    db.query(perEmployeeYearlySql, [year], (err, employeeYearlyResults) => {
      if (err) {
        employeeYearlyResults = [];
      }


      const leaveCostSql = `
        SELECT
          COUNT(*) as total_leave_days,
          COUNT(CASE WHEN lh.status = 'approved' THEN 1 END) as approved_leave_days,
          lh.leave_type,
          AVG(DATEDIFF(lh.end_date, lh.start_date) + 1) as avg_leave_duration
        FROM leave_history lh
        JOIN employees e ON lh.userid = e.userid
        JOIN roles r ON e.role_code = r.role_code
        WHERE r.role_group IN ('user', 'admin') AND YEAR(lh.submitted_at) = ?
        GROUP BY lh.leave_type
      `;

      db.query(leaveCostSql, [year], (err, leaveResults) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการคำนวณต้นทุนการลา'
          });
        }

        // แปลง string เป็น number ก่อน reduce
        const totalSalaryExpense = salaryResults.reduce((sum, row) => {
          const expense = parseFloat(row.total_salary_expense) || 0;
          return sum + expense;
        }, 0);
        const totalEmployees = salaryResults.reduce((sum, row) => sum + (parseInt(row.total_employees) || 0), 0);

       

        // คำนวณค่าใช้จ่ายรายปีจาก per-employee calculation
        const totalYearlyExpense = employeeYearlyResults.reduce((sum, row) => {
          const value = parseFloat(row.employee_yearly_total) || 0;
          return sum + value;
        }, 0);
        const totalPaidExpense = employeeYearlyResults.reduce((sum, row) => sum + (parseFloat(row.paid_total) || 0), 0);
        const totalEstimatedExpense = employeeYearlyResults.reduce((sum, row) => sum + (parseFloat(row.estimated_remaining) || 0), 0);

  
        // นับจำนวนพนักงานที่มี payroll แล้ว และยังไม่มี
        const employeesWithPayroll = employeeYearlyResults.filter(row => row.months_paid > 0).length;
        const employeesWithoutPayroll = employeeYearlyResults.filter(row => row.months_paid === 0).length;
        const totalPayrollRecords = employeeYearlyResults.reduce((sum, row) => sum + row.months_paid, 0);

        // คำนวณค่าเฉลี่ยเดือนที่มี payroll
        const avgMonthsPaid = employeesWithPayroll > 0
          ? employeeYearlyResults.reduce((sum, row) => sum + row.months_paid, 0) / totalEmployees
          : 0;

        res.json({
          success: true,
          data: {
            salary_summary: {
              total_monthly_expense: totalSalaryExpense,
              total_yearly_expense: totalYearlyExpense,
              total_employees: totalEmployees,
              breakdown_by_group: salaryResults,
              total_payroll_records: totalPayrollRecords,
              employees_with_payroll: employeesWithPayroll,
              employees_without_payroll: employeesWithoutPayroll,
              total_paid_expense: totalPaidExpense,
              total_estimated_expense: totalEstimatedExpense,
              average_months_paid: Math.round(avgMonthsPaid * 10) / 10,
              is_partially_estimated: totalEstimatedExpense > 0
            },
            leave_summary: leaveResults,
            year: year,
            month: month || 'ทั้งปี'
          }
        });
      });
    });
  });
});

// GET: การเข้างานรายเดือน
router.get('/owner/attendance-monthly', (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;

  let sql = `
    SELECT
      DATE(a.timein) as attendance_date,
      COUNT(*) as total,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
      COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as on_leave
    FROM attendance a
    JOIN employees e ON a.userid = e.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin') AND YEAR(a.timein) = ?
  `;

  const params = [year];

  if (month) {
    sql += ' AND MONTH(a.timein) = ?';
    params.push(month);
  }

  sql += ' GROUP BY DATE(a.timein) ORDER BY attendance_date DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างานรายเดือน'
      });
    }

    res.json({
      success: true,
      data: results,
      year: year,
      month: month || 'ทั้งปี'
    });
  });
});

// GET: คำร้องลารายเดือน
router.get('/owner/leave-requests-monthly', (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;

  let sql = `
    SELECT
      DATE(lh.submitted_at) as request_date,
      lh.leave_type,
      lh.status,
      COUNT(*) as count,
      e.firstname,
      e.lastname,
      r.role_name,
      r.subject
    FROM leave_history lh
    JOIN employees e ON lh.userid = e.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin') AND YEAR(lh.submitted_at) = ?
  `;

  const params = [year];

  if (month) {
    sql += ' AND MONTH(lh.submitted_at) = ?';
    params.push(month);
  }

  sql += ' GROUP BY DATE(lh.submitted_at), lh.leave_type, lh.status, lh.userid ORDER BY request_date DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้องลารายเดือน'
      });
    }

    res.json({
      success: true,
      data: results,
      year: year,
      month: month || 'ทั้งปี'
    });
  });
});

// ============= LEAVE REQUESTS MANAGEMENT =============
// GET: ดึงคำร้องลาทั้งหมด (กรองตามปีการศึกษา)
router.get('/owner/leave-requests-all', (req, res) => {
  const { academic_year_id } = req.query;

  let sql = `
    SELECT
      lh.id,
      lh.userid,
      lh.leave_type,
      lh.start_date,
      lh.end_date,
      lh.reason,
      lh.status,
      lh.submitted_at,
      lh.approveby,
      lh.academic_year_id,
      e.firstname,
      e.lastname,
      e.email,
      r.role_name,
      approver.firstname as approver_firstname,
      approver.lastname as approver_lastname,
      approver_role.role_name as approver_role_name,
      ay.year_name as academic_year_name,
      ay.is_active as is_current_year
    FROM leave_history lh
    JOIN employees e ON lh.userid = e.userid
    JOIN roles r ON e.role_code = r.role_code
    LEFT JOIN employees approver ON lh.approveby = approver.userid
    LEFT JOIN roles approver_role ON approver.role_code = approver_role.role_code
    LEFT JOIN academic_years ay ON lh.academic_year_id = ay.id
    WHERE r.role_group IN ('user', 'admin')
  `;

  const params = [];

  // กรองตามปีการศึกษา
  if (academic_year_id) {
    // กรองตามปีการศึกษาที่ระบุ
    sql += ' AND lh.academic_year_id = ?';
    params.push(academic_year_id);
  } else {
    // กรองตามปีการศึกษาที่ active อยู่โดยอัตโนมัติ
    sql += ' AND ay.is_active = 1';
  }

  sql += ' ORDER BY lh.submitted_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง'
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  });
});

// PUT: อัปเดตสถานะคำร้องลา
router.put('/owner/leave-requests/:id/status', async (req, res) => {
  const requestId = req.params.id;
  const { status, note } = req.body;

  // Validate status
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'สถานะไม่ถูกต้อง (ต้องเป็น pending, approved, หรือ rejected)'
    });
  }

  try {
    // ดึงปีการศึกษาปัจจุบัน
    const activeYearSql = 'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1';
    db.query(activeYearSql, (err, yearResults) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา'
        });
      }

      const activeYearId = yearResults.length > 0 ? yearResults[0].id : null;

      // ดึงข้อมูล owner จาก session (ถ้ามี)
      const approveby = req.session?.user?.userid || null;

      // อัปเดตสถานะ และใส่ academic_year_id ถ้ายังไม่มี
      const sql = `
        UPDATE leave_history
        SET status = ?,
            approveby = ?,
            academic_year_id = COALESCE(academic_year_id, ?)
        WHERE id = ?
      `;

      db.query(sql, [status, approveby, activeYearId, requestId], (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบคำร้องที่ต้องการอัปเดต'
          });
        }

        res.json({
          success: true,
          message: `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำร้องเรียบร้อยแล้ว`,
          data: {
            id: requestId,
            status: status,
            approveby: approveby,
            academic_year_id: activeYearId
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตคำร้อง'
    });
  }
});

// GET: คำนวณเงินเดือนรวมทั้งปีแบบละเอียด (พิจารณาการเปลี่ยนแปลงเงินเดือนในแต่ละเดือน)
router.get('/owner/salary-yearly-detailed', (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // ดึงข้อมูลพนักงานทั้งหมด
  const employeeSql = `
    SELECT e.userid, e.firstname, e.lastname, e.salary AS current_salary
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin')
  `;

  db.query(employeeSql, (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน'
      });
    }

    // ดึงประวัติการเปลี่ยนแปลงเงินเดือนทั้งหมดในปีที่ระบุและก่อนหน้า
    const historySql = `
      SELECT userid, old_salary, new_salary, change_date
      FROM salary_change_history
      WHERE YEAR(change_date) <= ?
      ORDER BY userid, change_date ASC
    `;

    db.query(historySql, [year], (err, history) => {
      if (err) {
        console.error('Error fetching salary history:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประวัติเงินเดือน'
        });
      }

      // คำนวณเงินเดือนแต่ละเดือนสำหรับแต่ละพนักงาน
      const employeeYearlyData = employees.map(emp => {
        const empHistory = history.filter(h => h.userid === emp.userid);
        let monthlySalaries = [];
        let totalYearly = 0;

        // หาเงินเดือนเริ่มต้นก่อนมีการเปลี่ยนแปลงใดๆ
        let initialSalary = parseFloat(emp.current_salary) || 0;
        if (empHistory.length > 0) {
          // ถ้ามีประวัติ ใช้เงินเดือนเก่าจากประวัติแรกสุด
          initialSalary = parseFloat(empHistory[0].old_salary) || initialSalary;
        }

        // คำนวณเงินเดือนแต่ละเดือน (1-12)
        for (let month = 1; month <= 12; month++) {
          const monthDate = new Date(year, month - 1, 1); // วันแรกของเดือน

          // เริ่มจากเงินเดือนเริ่มต้น
          let monthlySalary = initialSalary;

          // ดูประวัติว่ามีการเปลี่ยนแปลงก่อนหรือในเดือนนี้หรือไม่
          for (let i = 0; i < empHistory.length; i++) {
            const changeDate = new Date(empHistory[i].change_date);
            const changeMonth = changeDate.getMonth() + 1; // 1-12
            const changeYear = changeDate.getFullYear();

            // ถ้าเปลี่ยนในปีและเดือนนี้หรือก่อนหน้า
            if (changeYear < year || (changeYear === year && changeMonth <= month)) {
              monthlySalary = parseFloat(empHistory[i].new_salary) || 0;
            }
          }

          monthlySalaries.push({
            month: month,
            salary: monthlySalary
          });
          totalYearly += monthlySalary;
        }

        return {
          userid: emp.userid,
          firstname: emp.firstname,
          lastname: emp.lastname,
          current_salary: parseFloat(emp.current_salary) || 0,
          yearly_salary: totalYearly,
          monthly_breakdown: monthlySalaries
        };
      });

      // คำนวณสรุปรวมทั้งหมด
      const totalYearlySalary = employeeYearlyData.reduce((sum, emp) => sum + emp.yearly_salary, 0);
      const totalCurrentMonthly = employeeYearlyData.reduce((sum, emp) => sum + emp.current_salary, 0);
      const estimatedSimple = totalCurrentMonthly * 12;
      const difference = totalYearlySalary - estimatedSimple;

      res.json({
        success: true,
        data: {
          year: year,
          total_yearly_salary: Math.round(totalYearlySalary * 100) / 100,
          estimated_simple: Math.round(estimatedSimple * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          total_employees: employeeYearlyData.length,
          employees: employeeYearlyData
        }
      });
    });
  });
});

// GET: เปรียบเทียบเงินเดือนรวมทั้งปีระหว่างปีปัจจุบันและปีก่อนหน้า
router.get('/owner/salary-yearly-comparison', (req, res) => {
  const currentYear = parseInt(req.query.year) || new Date().getFullYear();
  const previousYear = currentYear - 1;

  // ดึงข้อมูลพนักงานทั้งหมด
  const employeeSql = `
    SELECT e.userid, e.firstname, e.lastname, e.salary AS current_salary
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin')
  `;

  db.query(employeeSql, (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน'
      });
    }

    // ดึงประวัติการเปลี่ยนแปลงเงินเดือนทั้งหมดที่เกี่ยวข้อง
    const historySql = `
      SELECT userid, old_salary, new_salary, change_date
      FROM salary_change_history
      WHERE YEAR(change_date) <= ?
      ORDER BY userid, change_date ASC
    `;

    db.query(historySql, [currentYear], (err, history) => {
      if (err) {
        console.error('Error fetching salary history:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประวัติเงินเดือน'
        });
      }

      // ฟังก์ชันคำนวณเงินเดือนรวมสำหรับปีที่กำหนด
      const calculateYearlySalary = (year) => {
        return employees.reduce((total, emp) => {
          const empHistory = history.filter(h => h.userid === emp.userid);
          let yearlyTotal = 0;

          // หาเงินเดือนเริ่มต้นก่อนมีการเปลี่ยนแปลงใดๆ
          let initialSalary = parseFloat(emp.current_salary) || 0;
          if (empHistory.length > 0) {
            initialSalary = parseFloat(empHistory[0].old_salary) || initialSalary;
          }

          // คำนวณเงินเดือนแต่ละเดือน (1-12)
          for (let month = 1; month <= 12; month++) {
            let monthlySalary = initialSalary;

            // ดูประวัติว่ามีการเปลี่ยนแปลงก่อนหรือในเดือนนี้หรือไม่
            for (let i = 0; i < empHistory.length; i++) {
              const changeDate = new Date(empHistory[i].change_date);
              const changeMonth = changeDate.getMonth() + 1;
              const changeYear = changeDate.getFullYear();

              if (changeYear < year || (changeYear === year && changeMonth <= month)) {
                monthlySalary = parseFloat(empHistory[i].new_salary) || 0;
              }
            }

            yearlyTotal += monthlySalary;
          }

          return total + yearlyTotal;
        }, 0);
      };

      // คำนวณทั้ง 2 ปี
      const currentYearSalary = calculateYearlySalary(currentYear);
      const previousYearSalary = calculateYearlySalary(previousYear);
      const difference = previousYearSalary - currentYearSalary;
      const percentChange = previousYearSalary > 0
        ? ((currentYearSalary - previousYearSalary) / previousYearSalary * 100)
        : 0;

      res.json({
        success: true,
        data: {
          current_year: currentYear,
          current_year_salary: Math.round(currentYearSalary * 100) / 100,
          previous_year: previousYear,
          previous_year_salary: Math.round(previousYearSalary * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          percent_change: Math.round(percentChange * 100) / 100
        }
      });
    });
  });
});

// ============= MONTHLY EXPENSES TRACKING =============
// GET: บันทึกค่าใช้จ่ายรายเดือน (ใช้ข้อมูลล่าสุดในแต่ละเดือน)
router.get('/owner/monthly-expenses', (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // ดึงข้อมูลพนักงานทั้งหมด
  const employeeSql = `
    SELECT e.userid, e.firstname, e.lastname, e.salary AS current_salary
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin')
  `;

  db.query(employeeSql, (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน'
      });
    }

    // ดึงประวัติการเปลี่ยนแปลงเงินเดือนทั้งหมดในปีที่ระบุและก่อนหน้า
    const historySql = `
      SELECT userid, old_salary, new_salary, change_date
      FROM salary_change_history
      WHERE YEAR(change_date) <= ?
      ORDER BY userid, change_date ASC
    `;

    db.query(historySql, [year], (err, history) => {
      if (err) {
        console.error('Error fetching salary history:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประวัติเงินเดือน'
        });
      }

      // สร้างข้อมูลรายเดือน (12 เดือน)
      const monthlyData = [];

      for (let month = 1; month <= 12; month++) {
        let monthlyExpense = 0;
        let employeeCount = employees.length;
        let lastUpdateDate = null;

        // คำนวณค่าใช้จ่ายของแต่ละพนักงานในเดือนนี้
        employees.forEach(emp => {
          const empHistory = history.filter(h => h.userid === emp.userid);

          // หาเงินเดือนเริ่มต้นก่อนมีการเปลี่ยนแปลงใดๆ
          let initialSalary = parseFloat(emp.current_salary) || 0;
          if (empHistory.length > 0) {
            initialSalary = parseFloat(empHistory[0].old_salary) || initialSalary;
          }

          let monthlySalary = initialSalary;
          let latestChangeInMonth = null;

          // หาการเปลี่ยนแปลงล่าสุดในเดือนนี้หรือก่อนหน้า
          for (let i = 0; i < empHistory.length; i++) {
            const changeDate = new Date(empHistory[i].change_date);
            const changeMonth = changeDate.getMonth() + 1;
            const changeYear = changeDate.getFullYear();

            // ถ้าเปลี่ยนในปีและเดือนนี้หรือก่อนหน้า
            if (changeYear < year || (changeYear === parseInt(year) && changeMonth <= month)) {
              monthlySalary = parseFloat(empHistory[i].new_salary) || 0;

              // ถ้าเปลี่ยนแปลงในเดือนนี้พอดี เก็บวันที่
              if (changeYear === parseInt(year) && changeMonth === month) {
                latestChangeInMonth = changeDate;
              }
            }
          }

          monthlyExpense += monthlySalary;

          // อัพเดท lastUpdateDate ถ้ามีการเปลี่ยนแปลงในเดือนนี้
          if (latestChangeInMonth && (!lastUpdateDate || latestChangeInMonth > lastUpdateDate)) {
            lastUpdateDate = latestChangeInMonth;
          }
        });

        monthlyData.push({
          year: parseInt(year),
          month: month,
          month_name: getThaiMonthName(month),
          total_expense: Math.round(monthlyExpense * 100) / 100,
          employee_count: employeeCount,
          last_updated: lastUpdateDate ? lastUpdateDate.toISOString() : null
        });
      }

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          monthly_expenses: monthlyData,
          total_annual_expense: monthlyData.reduce((sum, m) => sum + m.total_expense, 0)
        }
      });
    });
  });
});

// GET: Export ค่าใช้จ่ายรายเดือนเป็น CSV
router.get('/owner/monthly-expenses/export-csv', (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // เรียกใช้ logic เดียวกับ /owner/monthly-expenses
  const employeeSql = `
    SELECT e.userid, e.firstname, e.lastname, e.salary AS current_salary
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group IN ('user', 'admin')
  `;

  db.query(employeeSql, (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน'
      });
    }

    const historySql = `
      SELECT userid, old_salary, new_salary, change_date
      FROM salary_change_history
      WHERE YEAR(change_date) <= ?
      ORDER BY userid, change_date ASC
    `;

    db.query(historySql, [year], (err, history) => {
      if (err) {
        console.error('Error fetching salary history:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประวัติเงินเดือน'
        });
      }

      // สร้างข้อมูลรายเดือน
      let csvContent = 'ปี,เดือน,จำนวนพนักงาน,ค่าใช้จ่ายรวม (บาท),วันที่อัพเดทล่าสุด\n';

      for (let month = 1; month <= 12; month++) {
        let monthlyExpense = 0;
        let employeeCount = employees.length;
        let lastUpdateDate = null;

        employees.forEach(emp => {
          const empHistory = history.filter(h => h.userid === emp.userid);

          let initialSalary = parseFloat(emp.current_salary) || 0;
          if (empHistory.length > 0) {
            initialSalary = parseFloat(empHistory[0].old_salary) || initialSalary;
          }

          let monthlySalary = initialSalary;
          let latestChangeInMonth = null;

          for (let i = 0; i < empHistory.length; i++) {
            const changeDate = new Date(empHistory[i].change_date);
            const changeMonth = changeDate.getMonth() + 1;
            const changeYear = changeDate.getFullYear();

            if (changeYear < year || (changeYear === parseInt(year) && changeMonth <= month)) {
              monthlySalary = parseFloat(empHistory[i].new_salary) || 0;

              if (changeYear === parseInt(year) && changeMonth === month) {
                latestChangeInMonth = changeDate;
              }
            }
          }

          monthlyExpense += monthlySalary;

          if (latestChangeInMonth && (!lastUpdateDate || latestChangeInMonth > lastUpdateDate)) {
            lastUpdateDate = latestChangeInMonth;
          }
        });

        const monthName = getThaiMonthName(month);
        const expenseRounded = Math.round(monthlyExpense * 100) / 100;
        const lastUpdatedStr = lastUpdateDate
          ? new Date(lastUpdateDate).toLocaleDateString('th-TH')
          : 'ไม่มีการเปลี่ยนแปลง';

        csvContent += `${year},${monthName},${employeeCount},${expenseRounded},${lastUpdatedStr}\n`;
      }

      // ส่ง CSV
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-expenses-${year}.csv"`);
      res.send('\uFEFF' + csvContent); // BOM for UTF-8
    });
  });
});

// Helper function: แปลงเลขเดือนเป็นชื่อภาษาไทย
function getThaiMonthName(month) {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[month - 1] || '';
}

// ============= ATTENDANCE IMPORT =============
// POST: นำเข้าข้อมูลการเข้างานจาก CSV
router.post('/owner/attendance/import', async (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'ไม่มีข้อมูลสำหรับนำเข้า'
    });
  }

  // ดึงปีการศึกษาปัจจุบัน
  const activeYearSql = 'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1';
  db.query(activeYearSql, (yearErr, yearResults) => {
    if (yearErr) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา'
      });
    }

    const activeYearId = yearResults.length > 0 ? yearResults[0].id : null;

    let imported = 0;
    let failed = 0;
    let errors = [];
    let successRecords = [];

    // ใช้ Promise.all เพื่อประมวลผลทั้งหมด
    const promises = data.map((record, index) => {
    return new Promise((resolve) => {
      const { userid, status, note, timein, timeout } = record;

      // Validation 1: ตรวจสอบว่ามีค่าและไม่ใช่ค่าว่าง
      if (!userid || userid === '' || String(userid).trim() === '') {
        failed++;
        errors.push({
          index: index + 1,
          record: record,
          error: 'ไม่พบข้อมูล User ID หรือเป็นค่าว่าง'
        });
        resolve();
        return;
      }

      if (!status || status === '' || String(status).trim() === '') {
        failed++;
        errors.push({
          index: index + 1,
          record: record,
          error: 'ไม่พบข้อมูล Status หรือเป็นค่าว่าง'
        });
        resolve();
        return;
      }

      if (!timein || timein === '' || String(timein).trim() === '') {
        failed++;
        errors.push({
          index: index + 1,
          record: record,
          error: 'ไม่พบข้อมูล Time In หรือเป็นค่าว่าง'
        });
        resolve();
        return;
      }

      // Validation 2: ตรวจสอบว่า userid เป็นตัวเลข
      const useridNum = parseInt(userid);
      if (isNaN(useridNum) || useridNum <= 0) {
        failed++;
        errors.push({
          index: index + 1,
          record: record,
          error: `User ID (${userid}) ไม่ถูกต้อง ต้องเป็นตัวเลขที่มากกว่า 0`
        });
        resolve();
        return;
      }

      // Validation 3: ตรวจสอบว่า status เป็นค่าที่ถูกต้อง
      const validStatuses = ['present', 'late', 'absent', 'leave'];
      const statusLower = String(status).toLowerCase().trim();
      if (!validStatuses.includes(statusLower)) {
        failed++;
        errors.push({
          index: index + 1,
          record: record,
          error: `Status (${status}) ไม่ถูกต้อง ต้องเป็น present, late, absent, หรือ leave`
        });
        resolve();
        return;
      }

      // ตรวจสอบว่า userid มีอยู่จริง
      db.query('SELECT userid, firstname, lastname FROM employees WHERE userid = ?', [useridNum], (err, userResults) => {
        if (err || userResults.length === 0) {
          failed++;
          errors.push({
            index: index + 1,
            record: record,
            error: `ไม่พบ User ID ${useridNum} ในระบบ`
          });
          resolve();
          return;
        }

        const employee = userResults[0];

        // แปลง timein เป็นวันที่
        const timeinStr = String(timein).trim();
        const dateMatch = timeinStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateMatch) {
          failed++;
          errors.push({
            index: index + 1,
            record: record,
            error: `รูปแบบ Time In (${timeinStr}) ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD HH:MM:SS`
          });
          resolve();
          return;
        }

        const attendanceDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

        // ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
        const checkSql = 'SELECT id FROM attendance WHERE userid = ? AND DATE(timein) = ?';
        db.query(checkSql, [useridNum, attendanceDate], (err, existingRecords) => {
          if (err) {
            failed++;
            errors.push({
              index: index + 1,
              record: record,
              error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลซ้ำ'
            });
            resolve();
            return;
          }

          if (existingRecords.length > 0) {
            // อัปเดตข้อมูลเดิม
            const updateSql = `
              UPDATE attendance
              SET status = ?, note = ?, timein = ?, timeout = ?,
                  academic_year_id = COALESCE(academic_year_id, ?)
              WHERE id = ?
            `;

            db.query(updateSql, [statusLower, note || null, timeinStr, timeout || null, activeYearId, existingRecords[0].id], (err) => {
              if (err) {
                failed++;
                errors.push({
                  index: index + 1,
                  record: record,
                  error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + err.message
                });
              } else {
                imported++;
                successRecords.push({
                  index: index + 1,
                  userid: useridNum,
                  employeeName: `${employee.firstname} ${employee.lastname}`,
                  status: statusLower,
                  date: attendanceDate,
                  action: 'updated'
                });
              }
              resolve();
            });
          } else {
            // เพิ่มข้อมูลใหม่
            const insertSql = `
              INSERT INTO attendance (userid, status, note, timein, timeout, academic_year_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

            db.query(insertSql, [useridNum, statusLower, note || null, timeinStr, timeout || null, activeYearId], (err) => {
              if (err) {
                failed++;
                errors.push({
                  index: index + 1,
                  record: record,
                  error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message
                });
              } else {
                imported++;
                successRecords.push({
                  index: index + 1,
                  userid: useridNum,
                  employeeName: `${employee.firstname} ${employee.lastname}`,
                  status: statusLower,
                  date: attendanceDate,
                  action: 'inserted'
                });
              }
              resolve();
            });
          }
        });
      });
    });
  });

    // รอให้ประมวลผลทั้งหมดเสร็จ
    Promise.all(promises).then(() => {
      res.json({
        success: true,
        message: `นำเข้าข้อมูลเสร็จสิ้น: สำเร็จ ${imported} รายการ, ล้มเหลว ${failed} รายการ`,
        imported: imported,
        failed: failed,
        successRecords: successRecords,
        errors: errors
      });
    });
  });
});

module.exports = router;
