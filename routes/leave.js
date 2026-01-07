// ====================================
// Leave Request Routes
// ====================================
// APIs สำหรับจัดการคำร้องลา (Leave Requests)
// - View all leave requests (filtered by permission)
// - View by roles/subject
// - Approve/Reject requests
// - Statistics
// ====================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dbPromise = require('../config/database').promise();
const { authenticateToken, createDataFilter, DEPARTMENT_HIERARCHY } = require('../middleware/auth');

// GET: ดึงคำร้องลาทั้งหมด (filtered by permission and academic year)
router.get('/leave-requests/all', authenticateToken, async (req, res) => {
  try {
    const filter = createDataFilter(req.user);

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id, year_name FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    let sql = `
      SELECT
        lh.id, lh.userid, lh.leave_type, lh.start_date, lh.end_date,
        lh.reason, lh.status, lh.submitted_at, lh.approveby,
        lh.academic_year_id,
        e.firstname, e.lastname, e.email, e.role_code,
        r.role_name, r.role_group, r.subject,
        approver.firstname as approver_firstname,
        approver.lastname as approver_lastname,
        approver_role.role_name as approver_role_name,
        ay.year_name as academic_year_name
      FROM leave_history lh
      INNER JOIN employees e ON lh.userid = e.userid
      LEFT JOIN roles r ON e.role_code = r.role_code
      LEFT JOIN employees approver ON lh.approveby = approver.userid
      LEFT JOIN roles approver_role ON approver.role_code = approver_role.role_code
      LEFT JOIN academic_years ay ON lh.academic_year_id = ay.id
    `;

    const params = [];
    const conditions = [];

    // Filter ตามปีการศึกษาที่ active
    if (activeYear.length > 0) {
      conditions.push('lh.academic_year_id = ?');
      params.push(activeYear[0].id);
    }

    // เพิ่ม filtering ตาม permission
    if (filter.role_code) {
      const placeholders = filter.role_code.map(() => '?').join(',');
      conditions.push(`e.role_code IN (${placeholders})`);
      params.push(...filter.role_code);
    }

    if (filter.subject) {
      conditions.push('r.subject = ?');
      params.push(filter.subject);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY
      CASE lh.status
        WHEN 'pending' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'rejected' THEN 3
      END, lh.submitted_at DESC`;

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Error fetching all leave requests:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง',
          error: err.message
        });
      }

      res.json({
        success: true,
        data: results,
        count: results.length,
        filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name,
        academic_year: activeYear.length > 0 ? activeYear[0] : null
      });
    });
  } catch (error) {
    console.error('Error in leave-requests/all:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// GET: ดึงคำร้องลาตาม role codes ที่ระบุ
router.get('/leave-requests/roles', authenticateToken, (req, res) => {
  const { roles } = req.query;
  const filter = createDataFilter(req.user);

  if (!roles) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุ roles ที่ต้องการ'
    });
  }

  const roleList = roles.split(',').map(role => role.trim());

  // ตรวจสอบว่า role ที่ขออยู่ในสิทธิ์หรือไม่
  if (filter.role_code) {
    const allowedRoles = roleList.filter(role => filter.role_code.includes(role));
    if (allowedRoles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์ดูข้อมูลจาก roles ที่ระบุ'
      });
    }
    roleList.splice(0, roleList.length, ...allowedRoles);
  }

  const placeholders = roleList.map(() => '?').join(',');

  let sql = `
    SELECT
      lh.id, lh.userid, lh.leave_type, lh.start_date, lh.end_date,
      lh.reason, lh.status, lh.submitted_at, lh.approveby,
      e.firstname, e.lastname, e.email, e.role_code,
      r.role_name, r.role_group, r.subject
    FROM leave_history lh
    INNER JOIN employees e ON lh.userid = e.userid
    LEFT JOIN roles r ON e.role_code = r.role_code
    WHERE e.role_code IN (${placeholders})
  `;

  const params = [...roleList];

  // เพิ่ม subject filter ถ้ามี
  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  sql += ` ORDER BY
    CASE lh.status
      WHEN 'pending' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
    END, lh.submitted_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching leave requests by roles:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง',
        error: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      roles: roleList,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
    });
  });
});

// GET: ดึงคำร้องลาตาม subject
router.get('/leave-requests/subject/:subject', authenticateToken, (req, res) => {
  const { subject } = req.params;
  const filter = createDataFilter(req.user);

  // ตรวจสอบสิทธิ์ดู subject นี้
  if (filter.subject && filter.subject !== subject) {
    return res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์ดูคำร้องลาของหมวดวิชานี้'
    });
  }

  let sql = `
    SELECT
      lh.id, lh.userid, lh.leave_type, lh.start_date, lh.end_date,
      lh.reason, lh.status, lh.submitted_at, lh.approveby,
      e.firstname, e.lastname, e.email, e.role_code,
      r.role_name, r.role_group, r.subject
    FROM leave_history lh
    INNER JOIN employees e ON lh.userid = e.userid
    LEFT JOIN roles r ON e.role_code = r.role_code
    WHERE r.subject = ?
  `;

  const params = [subject];

  // เพิ่ม filtering ตาม role ถ้ามี
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  sql += ` ORDER BY
    CASE lh.status
      WHEN 'pending' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
    END, lh.submitted_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching leave requests by subject:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง',
        error: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      subject: subject,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
    });
  });
});

// GET: ดึงคำร้องลาตาม userid (filtered by academic year)
router.get('/leave-requests/user/:userid', async (req, res) => {
  try {
    const { userid } = req.params;

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id, year_name FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    let sql = `
      SELECT
        lh.id, lh.userid, lh.leave_type, lh.start_date, lh.end_date,
        lh.reason, lh.status, lh.submitted_at, lh.approveby,
        lh.academic_year_id,
        e.firstname, e.lastname, e.email, e.role_code,
        r.role_name, r.role_group,
        ay.year_name as academic_year_name
      FROM leave_history lh
      INNER JOIN employees e ON lh.userid = e.userid
      LEFT JOIN roles r ON e.role_code = r.role_code
      LEFT JOIN academic_years ay ON lh.academic_year_id = ay.id
      WHERE lh.userid = ?
    `;

    const params = [userid];

    // Filter ตามปีการศึกษาที่ active
    if (activeYear.length > 0) {
      sql += ' AND lh.academic_year_id = ?';
      params.push(activeYear[0].id);
    }

    sql += `
      ORDER BY
        CASE lh.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
        END,
        lh.submitted_at DESC
    `;

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Error fetching leave requests by user:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง',
          error: err.message
        });
      }

      res.json({
        success: true,
        data: results,
        count: results.length,
        userid: userid,
        academic_year: activeYear.length > 0 ? activeYear[0] : null
      });
    });
  } catch (error) {
    console.error('Error in /leave-requests/user/:userid:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// GET: ดึงรายละเอียดคำร้องลา
router.get('/leave-requests/:id/details', authenticateToken, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      lh.*,
      e.firstname, e.lastname, e.email, e.role_code, e.tel,
      r.role_name, r.role_group, r.subject,
      approver.firstname as approver_firstname,
      approver.lastname as approver_lastname,
      approver.role_code as approver_role_code
    FROM leave_history lh
    INNER JOIN employees e ON lh.userid = e.userid
    LEFT JOIN roles r ON e.role_code = r.role_code
    LEFT JOIN employees approver ON lh.approveby = approver.userid
    WHERE lh.id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Error fetching leave request details:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง',
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำร้องลาที่ระบุ'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  });
});

// PUT: อัพเดทสถานะคำร้องลา (Approve/Reject)
router.put('/leave-requests/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const approverId = req.user.userid;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'สถานะต้องเป็น approved หรือ rejected'
    });
  }

  // ตรวจสอบว่าคำร้องมีอยู่และเป็น pending
  const checkSql = `
    SELECT lh.*, e.role_code
    FROM leave_history lh
    INNER JOIN employees e ON lh.userid = e.userid
    WHERE lh.id = ?
  `;

  db.query(checkSql, [id], (err, results) => {
    if (err) {
      console.error('Error checking leave request:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบคำร้อง'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำร้องลาที่ระบุ'
      });
    }

    const leaveRequest = results[0];

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `คำร้องนี้ถูก${leaveRequest.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว`
      });
    }

    // ตรวจสอบสิทธิ์ในการอนุมัติ
    const filter = createDataFilter(req.user);

    // HR สามารถอนุมัติได้ทุกคำร้อง
    if (req.user.role_code !== 'admin_hr') {
      // Admin อื่นต้องตรวจสอบสิทธิ์
      let hasPermission = false;

      if (filter.role_code && filter.role_code.includes(leaveRequest.role_code)) {
        hasPermission = true;
      }

      if (filter.subject && filter.subject === leaveRequest.subject) {
        hasPermission = true;
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'คุณไม่มีสิทธิ์อนุมัติ/ปฏิเสธคำร้องนี้'
        });
      }
    }

    // ดึงปีการศึกษาปัจจุบัน
    const activeYearSql = 'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1';
    db.query(activeYearSql, (yearErr, yearResults) => {
      if (yearErr) {
        console.error('Error fetching active academic year:', yearErr);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา'
        });
      }

      const activeYearId = yearResults.length > 0 ? yearResults[0].id : null;

      // อัพเดทสถานะ และใส่ academic_year_id ถ้ายังไม่มี
      const updateSql = `
        UPDATE leave_history
        SET status = ?,
            approveby = ?,
            academic_year_id = COALESCE(academic_year_id, ?)
        WHERE id = ?
      `;

      db.query(updateSql, [status, approverId, activeYearId, id], (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Error updating leave request status:', updateErr);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัพเดทสถานะ'
          });
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบคำร้องลาที่ระบุ'
          });
        }

        res.json({
          success: true,
          message: `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำร้องลาเรียบร้อยแล้ว`,
          data: {
            id: id,
            status: status,
            academic_year_id: activeYearId,
            approved_by: approverId
          }
        });
      });
    });
  });
});

// GET: สถิติคำร้องลาทั้งหมด (filtered by academic year)
router.get('/leave-requests/statistics/all', authenticateToken, async (req, res) => {
  try {
    const filter = createDataFilter(req.user);

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id, year_name FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    // Query สถิติรายเดือน
    let statsSql = `
      SELECT
        lh.status,
        COUNT(*) as count,
        MONTH(lh.submitted_at) as month,
        YEAR(lh.submitted_at) as year
      FROM leave_history lh
      INNER JOIN employees e ON lh.userid = e.userid
      INNER JOIN roles r ON e.role_code = r.role_code
      WHERE r.role_group = 'user'
        AND lh.submitted_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    `;

    const params = [];

    // Filter ตามปีการศึกษาที่ active
    if (activeYear.length > 0) {
      statsSql += ' AND lh.academic_year_id = ?';
      params.push(activeYear[0].id);
    }

    // เพิ่ม filtering ตาม permission
    if (filter.role_code) {
      const placeholders = filter.role_code.map(() => '?').join(',');
      statsSql += ` AND e.role_code IN (${placeholders})`;
      params.push(...filter.role_code);
    }

    if (filter.subject) {
      statsSql += ' AND r.subject = ?';
      params.push(filter.subject);
    }

    statsSql += ' GROUP BY lh.status, YEAR(lh.submitted_at), MONTH(lh.submitted_at) ORDER BY year DESC, month DESC';

    db.query(statsSql, params, (err, statsResults) => {
      if (err) {
        console.error('Error fetching statistics:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
          error: err.message
        });
      }

      // Query สรุปรวม
      let summarySql = `
        SELECT
          status,
          COUNT(*) as total
        FROM leave_history lh
        INNER JOIN employees e ON lh.userid = e.userid
        INNER JOIN roles r ON e.role_code = r.role_code
        WHERE r.role_group = 'user'
      `;

      const summaryParams = [];

      // Filter ตามปีการศึกษาที่ active
      if (activeYear.length > 0) {
        summarySql += ' AND lh.academic_year_id = ?';
        summaryParams.push(activeYear[0].id);
      }

      // เพิ่ม filtering เดียวกัน
      if (filter.role_code) {
        const placeholders = filter.role_code.map(() => '?').join(',');
        summarySql += ` AND e.role_code IN (${placeholders})`;
        summaryParams.push(...filter.role_code);
      }

      if (filter.subject) {
        summarySql += ' AND r.subject = ?';
        summaryParams.push(filter.subject);
      }

      summarySql += ' GROUP BY status';

      db.query(summarySql, summaryParams, (err, summaryResults) => {
        if (err) {
          console.error('Error fetching summary:', err);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสรุป',
            error: err.message
          });
        }

        // จัดรูปแบบข้อมูล
        const summary = {
          pending: 0,
          approved: 0,
          rejected: 0
        };

        summaryResults.forEach(row => {
          summary[row.status] = row.total;
        });

        res.json({
          success: true,
          data: {
            summary: summary,
            monthlyStats: statsResults
          },
          filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name,
          academic_year: activeYear.length > 0 ? activeYear[0] : null
        });
      });
    });
  } catch (error) {
    console.error('Error in leave-requests/statistics/all:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
      error: error.message
    });
  }
});

// GET: สถิติคำร้องลาตามหมวดวิชา
router.get('/leave-requests/statistics/:subject', authenticateToken, (req, res) => {
  const { subject } = req.params;
  const filter = createDataFilter(req.user);

  // ตรวจสอบสิทธิ์ดู subject นี้
  if (filter.subject && filter.subject !== subject) {
    return res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์ดูสถิติหมวดวิชานี้'
    });
  }

  // Query สถิติ
  let statsSql = `
    SELECT
      lh.status,
      COUNT(*) as count,
      MONTH(lh.submitted_at) as month,
      YEAR(lh.submitted_at) as year
    FROM leave_history lh
    INNER JOIN employees e ON lh.userid = e.userid
    INNER JOIN roles r ON e.role_code = r.role_code
    WHERE r.subject = ?
      AND lh.submitted_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
  `;

  const params = [subject];

  // เพิ่ม filtering ตาม role ถ้ามี
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    statsSql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  statsSql += ' GROUP BY lh.status, YEAR(lh.submitted_at), MONTH(lh.submitted_at) ORDER BY year DESC, month DESC';

  db.query(statsSql, params, (err, statsResults) => {
    if (err) {
      console.error('Error fetching statistics:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
        error: err.message
      });
    }

    // Query สรุปรวม
    let summarySql = `
      SELECT
        status,
        COUNT(*) as total
      FROM leave_history lh
      INNER JOIN employees e ON lh.userid = e.userid
      INNER JOIN roles r ON e.role_code = r.role_code
      WHERE r.subject = ?
    `;

    const summaryParams = [subject];

    // เพิ่ม filtering เดียวกัน
    if (filter.role_code) {
      const placeholders = filter.role_code.map(() => '?').join(',');
      summarySql += ` AND e.role_code IN (${placeholders})`;
      summaryParams.push(...filter.role_code);
    }

    summarySql += ' GROUP BY status';

    db.query(summarySql, summaryParams, (err, summaryResults) => {
      if (err) {
        console.error('Error fetching summary:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงสรุป',
          error: err.message
        });
      }

      // จัดรูปแบบข้อมูล
      const summary = {
        pending: 0,
        approved: 0,
        rejected: 0
      };

      summaryResults.forEach(row => {
        summary[row.status] = row.total;
      });

      res.json({
        success: true,
        data: {
          summary: summary,
          monthlyStats: statsResults,
          subject: subject
        },
        filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
      });
    });
  });
});

module.exports = router;
