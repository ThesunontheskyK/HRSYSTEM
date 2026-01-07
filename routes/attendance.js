// ====================================
// Attendance Routes
// ====================================
// APIs สำหรับจัดการการเข้างาน (Attendance)
// - View all attendance (filtered by permission)
// - Filter/Search attendance
// - Daily summary
// - Record attendance (HR only)
// - Import from CSV
// ====================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dbPromise = require('../config/database').promise();
const { authenticateToken, createDataFilter, checkPermission, DEPARTMENT_HIERARCHY } = require('../middleware/auth');

// GET: ดึงข้อมูลการเข้างาน (filtered by permission and academic year)
router.get('/adminattendance', authenticateToken, async (req, res) => {
  try {
    const filter = createDataFilter(req.user);

    // ดึงปีการศึกษาที่ active
    const [activeYear] = await dbPromise.query(
      'SELECT id, year_name FROM academic_years WHERE is_active = TRUE LIMIT 1'
    );

    let sql = `
      SELECT
        a.id, a.userid, a.status, a.note, a.timein, a.timeout,
        a.academic_year_id,
        e.firstname, e.lastname, e.role_code,
        r.role_name, r.subject,
        DATE(a.timein) as date,
        TIME(a.timein) as timeIn,
        TIME(a.timeout) as timeOut,
        CASE
          WHEN a.timeout IS NOT NULL AND a.timein IS NOT NULL
          THEN TIMEDIFF(a.timeout, a.timein)
          ELSE NULL
        END as hours,
        lh.reason as leave_reason,
        lh.leave_type,
        ay.year_name as academic_year_name
      FROM attendance a
      JOIN employees e ON e.userid = a.userid
      JOIN roles r ON e.role_code = r.role_code
      LEFT JOIN leave_history lh ON (
        a.userid = lh.userid
        AND DATE(a.timein) BETWEEN lh.start_date AND lh.end_date
        AND lh.status = 'approved'
        AND a.status = 'leave'
      )
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
    `;

    const params = [];
    const conditions = [];

    // Filter ตามปีการศึกษาที่ active
    if (activeYear.length > 0) {
      conditions.push('a.academic_year_id = ?');
      params.push(activeYear[0].id);
    }

    // Owner เห็นการเข้างานของทุกคน (รวม owner, admin, user)
    if (req.user.role_group === 'owner') {
      // Owner เห็นทุกคน - ไม่ต้องกรอง role_group
    }
    // HR เห็นการเข้างานของทุกคน (user + admin) ยกเว้น owner
    else if (req.user.role_code === 'admin_hr') {
      conditions.push("r.role_group IN ('user', 'admin')");
    }
    // Admin อื่นเห็นเฉพาะ user และตาม hierarchy
    else {
      conditions.push("r.role_group = 'user'");

      // เพิ่ม filtering ตาม permission สำหรับ admin ที่ไม่ใช่ HR
      if (filter.role_code) {
        const placeholders = filter.role_code.map(() => '?').join(',');
        conditions.push(`e.role_code IN (${placeholders})`);
        params.push(...filter.role_code);
      }

      if (filter.subject) {
        conditions.push('r.subject = ?');
        params.push(filter.subject);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY a.timein DESC LIMIT 1000';

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('ดึงข้อมูล attendance ล้มเหลว:', err);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: err.message
        });
      }

      // จัดรูปแบบข้อมูลให้เหมาะกับการแสดงผล
      const formattedResults = results.map(record => {
        const formatTime = (timeString) => {
          if (!timeString) return null;
          return timeString.substring(0, 5);
        };

        const formatDuration = (duration) => {
          if (!duration) return null;
          const parts = duration.split(':');
          const hours = parseInt(parts[0]);
          const minutes = parseInt(parts[1]);
          return `${hours}.${Math.round(minutes/60*100).toString().padStart(2, '0')} ชม.`;
        };

        // ถ้าเป็นการลาและมีเหตุผลการลา ให้แสดงเหตุผลแทน note เดิม
        let displayNote = record.note || null;
        if (record.status === 'leave' && record.leave_reason) {
          displayNote = record.leave_reason;
        }

        return {
          id: record.id,
          userid: record.userid,
          firstname: record.firstname,
          lastname: record.lastname,
          role_code: record.role_code,
          role_name: record.role_name,
          date: record.date,
          timeIn: formatTime(record.timeIn),
          timeOut: formatTime(record.timeOut),
          hours: formatDuration(record.hours),
          status: record.status,
          note: displayNote
        };
      });

      res.json({
        success: true,
        data: formattedResults,
        filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name || 'Unknown',
        total_shown: formattedResults.length,
        academic_year: activeYear.length > 0 ? activeYear[0] : null
      });
    });
  } catch (error) {
    console.error('Error in /adminattendance:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
});

// GET: ค้นหาการเข้างาน
router.get('/attendance/search', authenticateToken, (req, res) => {
  const {
    employeeName,
    startDate,
    endDate,
    status,
    page = 1,
    limit = 50
  } = req.query;

  const filter = createDataFilter(req.user);

  let sql = `
    SELECT
      a.id, a.userid, a.status, a.note, a.timein, a.timeout,
      e.firstname, e.lastname, e.role_code,
      r.role_name, r.subject,
      DATE(a.timein) as date,
      TIME(a.timein) as timeIn,
      TIME(a.timeout) as timeOut,
      CASE
        WHEN a.timeout IS NOT NULL AND a.timein IS NOT NULL
        THEN TIMEDIFF(a.timeout, a.timein)
        ELSE NULL
      END as hours
    FROM attendance a
    JOIN employees e ON e.userid = a.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group = 'user'
  `;

  const params = [];

  // เพิ่ม filtering ตาม permission
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  // เพิ่มเงื่อนไขการค้นหา
  if (employeeName) {
    sql += ' AND (e.firstname LIKE ? OR e.lastname LIKE ? OR CONCAT(e.firstname, " ", e.lastname) LIKE ?)';
    const searchTerm = `%${employeeName}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (startDate) {
    sql += ' AND DATE(a.timein) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND DATE(a.timein) <= ?';
    params.push(endDate);
  }

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.timein DESC';

  // เพิ่ม pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error searching attendance:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการค้นหา',
        error: err.message
      });
    }

    // นับจำนวนรวมสำหรับ pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON e.userid = a.userid
      JOIN roles r ON e.role_code = r.role_code
      WHERE r.role_group = 'user'
    `;

    const countParams = [];

    if (filter.role_code) {
      const placeholders = filter.role_code.map(() => '?').join(',');
      countSql += ` AND e.role_code IN (${placeholders})`;
      countParams.push(...filter.role_code);
    }

    if (filter.subject) {
      countSql += ' AND r.subject = ?';
      countParams.push(filter.subject);
    }

    if (employeeName) {
      countSql += ' AND (e.firstname LIKE ? OR e.lastname LIKE ? OR CONCAT(e.firstname, " ", e.lastname) LIKE ?)';
      const searchTerm = `%${employeeName}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (startDate) {
      countSql += ' AND DATE(a.timein) >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countSql += ' AND DATE(a.timein) <= ?';
      countParams.push(endDate);
    }

    if (status) {
      countSql += ' AND a.status = ?';
      countParams.push(status);
    }

    db.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error('Error counting attendance:', countErr);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการนับจำนวน'
        });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      // จัดรูปแบบข้อมูล
      const formattedResults = results.map(record => {
        const formatTime = (timeString) => {
          if (!timeString) return null;
          return timeString.substring(0, 5);
        };

        const formatDuration = (duration) => {
          if (!duration) return null;
          const parts = duration.split(':');
          const hours = parseInt(parts[0]);
          const minutes = parseInt(parts[1]);
          return `${hours}.${Math.round(minutes/60*100).toString().padStart(2, '0')} ชม.`;
        };

        return {
          id: record.id,
          userid: record.userid,
          firstname: record.firstname,
          lastname: record.lastname,
          role_code: record.role_code,
          role_name: record.role_name,
          date: record.date,
          timeIn: formatTime(record.timeIn),
          timeOut: formatTime(record.timeOut),
          hours: formatDuration(record.hours),
          status: record.status,
          note: record.note || '-'
        };
      });

      res.json({
        success: true,
        data: formattedResults,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
      });
    });
  });
});

// GET: สรุปการเข้างานรายวัน
router.get('/adminattendance/summary', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT
      a.status,
      COUNT(*) as count,
      DATE(a.timein) as date
    FROM attendance a
    JOIN employees e ON e.userid = a.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group = 'user'
  `;

  const params = [];

  // เพิ่ม filtering ตาม permission
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  if (startDate) {
    sql += ' AND DATE(a.timein) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND DATE(a.timein) <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY a.status, DATE(a.timein) ORDER BY date DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching attendance summary:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
        error: err.message
      });
    }

    // สร้างสถิติรวม
    const summary = {
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0
    };

    results.forEach(row => {
      summary.total += row.count;
      if (summary.hasOwnProperty(row.status)) {
        summary[row.status] += row.count;
      }
    });

    res.json({
      success: true,
      summary: summary,
      details: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
    });
  });
});

// GET: ดึงข้อมูลพนักงานสำหรับการเข้างาน
router.get('/attendance/employees', authenticateToken, (req, res) => {
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT
      e.userid, e.firstname, e.lastname, e.role_code,
      r.role_name,
      COUNT(a.id) as attendance_count
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    LEFT JOIN attendance a ON e.userid = a.userid
    WHERE r.role_group = 'user'
  `;

  const params = [];

  // เพิ่ม filtering ตาม permission
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  sql += ' GROUP BY e.userid, e.firstname, e.lastname, e.role_code, r.role_name ORDER BY e.firstname, e.lastname';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching attendance employees:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน',
        error: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
    });
  });
});

// GET: สรุปรายวัน
router.get('/attendance/daily-summary', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;
  const filter = createDataFilter(req.user);

  let sql = `
    SELECT
      DATE(a.timein) as date,
      COUNT(*) as total,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
      COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as leave
    FROM attendance a
    JOIN employees e ON a.userid = e.userid
    JOIN roles r ON e.role_code = r.role_code
    WHERE r.role_group = 'user'
  `;

  const params = [];

  // เพิ่ม filtering ตาม permission
  if (filter.role_code) {
    const placeholders = filter.role_code.map(() => '?').join(',');
    sql += ` AND e.role_code IN (${placeholders})`;
    params.push(...filter.role_code);
  }

  if (filter.subject) {
    sql += ' AND r.subject = ?';
    params.push(filter.subject);
  }

  if (startDate) {
    sql += ' AND DATE(a.timein) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND DATE(a.timein) <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY DATE(a.timein) ORDER BY date DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching daily summary:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปรายวัน',
        error: err.message
      });
    }

    res.json({
      success: true,
      data: results,
      filter_applied: DEPARTMENT_HIERARCHY[req.user.role_code]?.name
    });
  });
});

// POST: บันทึกการเข้างาน (HR only) - with academic year
router.post('/hr/attendance/record',
  authenticateToken,
  checkPermission('update_all_employees'),
  async (req, res) => {
    try {
      const { userid, status, timein, timeout, note } = req.body;

      if (!userid || !status || !timein) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุข้อมูลที่จำเป็น (userid, status, timein)'
        });
      }

      const validStatuses = ['present', 'late', 'absent', 'leave'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status ต้องเป็น ${validStatuses.join(', ')}`
        });
      }

      // ดึงปีการศึกษาที่ active
      const [activeYear] = await dbPromise.query(
        'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1'
      );

      const academicYearId = activeYear.length > 0 ? activeYear[0].id : null;

      const sql = `
        INSERT INTO attendance (userid, status, timein, timeout, note, academic_year_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const finalNote = note || `บันทึกโดย ${req.user.firstname} ${req.user.lastname}`;

      db.query(sql, [userid, status, timein, timeout || null, finalNote, academicYearId], (err, result) => {
        if (err) {
          console.error('Error recording attendance:', err);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกเวลางาน'
          });
        }

        res.json({
          success: true,
          message: 'บันทึกเวลางานเรียบร้อยแล้ว',
          data: {
            id: result.insertId,
            userid: userid,
            status: status,
            recorded_by: req.user.userid,
            recorded_at: new Date().toISOString(),
            academic_year_id: academicYearId
          }
        });
      });
    } catch (error) {
      console.error('Error in /hr/attendance/record:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการบันทึกเวลางาน',
        error: error.message
      });
    }
  }
);

// POST: บันทึกการเข้างานแบบ bulk (HR only) - with academic year
router.post('/hr/attendance/bulk-record',
  authenticateToken,
  checkPermission('update_all_employees'),
  async (req, res) => {
    try {
      // ดึงปีการศึกษาที่ active
      const [activeYear] = await dbPromise.query(
        'SELECT id FROM academic_years WHERE is_active = TRUE LIMIT 1'
      );

      const academicYearId = activeYear.length > 0 ? activeYear[0].id : null;

      const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง'
      });
    }

    // ตรวจสอบรูปแบบข้อมูล
    const validatedData = [];
    const errors = [];
    const successRecords = [];
    let imported = 0;
    let failed = 0;

    // Validate ข้อมูลแต่ละ record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // Validation 1: ตรวจสอบค่าว่าง
      if (!record.userid || record.userid === '' || String(record.userid).trim() === '') {
        failed++;
        errors.push({
          index: i + 1,
          record: record,
          error: 'ไม่พบข้อมูล User ID หรือเป็นค่าว่าง'
        });
        continue;
      }

      if (!record.status || record.status === '' || String(record.status).trim() === '') {
        failed++;
        errors.push({
          index: i + 1,
          record: record,
          error: 'ไม่พบข้อมูล Status หรือเป็นค่าว่าง'
        });
        continue;
      }

      if (!record.timein || record.timein === '' || String(record.timein).trim() === '') {
        failed++;
        errors.push({
          index: i + 1,
          record: record,
          error: 'ไม่พบข้อมูล Time In หรือเป็นค่าว่าง'
        });
        continue;
      }

      // Validation 2: ตรวจสอบว่า userid เป็นตัวเลข
      const useridNum = parseInt(record.userid);
      if (isNaN(useridNum) || useridNum <= 0) {
        failed++;
        errors.push({
          index: i + 1,
          record: record,
          error: `User ID (${record.userid}) ไม่ถูกต้อง ต้องเป็นตัวเลขที่มากกว่า 0`
        });
        continue;
      }

      // Validation 3: ตรวจสอบว่า status ถูกต้อง
      const validStatuses = ['present', 'late', 'absent', 'leave'];
      const statusLower = String(record.status).toLowerCase().trim();
      if (!validStatuses.includes(statusLower)) {
        failed++;
        errors.push({
          index: i + 1,
          record: record,
          error: `Status (${record.status}) ไม่ถูกต้อง ต้องเป็น present, late, absent, หรือ leave`
        });
        continue;
      }

      validatedData.push({
        index: i + 1,
        userid: useridNum,
        status: statusLower,
        timein: String(record.timein).trim(),
        timeout: record.timeout || null,
        note: record.note || `บันทึกโดย ${req.user.firstname} ${req.user.lastname}`
      });
    }

      // บันทึกข้อมูลที่ผ่านการตรวจสอบ
      const insertSql = `
        INSERT INTO attendance (userid, status, timein, timeout, note, academic_year_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const insertPromises = [];

      validatedData.forEach((record) => {
        const insertPromise = new Promise((resolve) => {
          // ดึงข้อมูลพนักงานก่อน
          db.query('SELECT userid, firstname, lastname FROM employees WHERE userid = ?', [record.userid], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
              failed++;
              errors.push({
                index: record.index,
                record: record,
                error: `ไม่พบ User ID ${record.userid} ในระบบ`
              });
              resolve();
              return;
            }

            const employee = userResults[0];

            // ตรวจสอบข้อมูลซ้ำ
            const dateMatch = record.timein.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!dateMatch) {
              failed++;
              errors.push({
                index: record.index,
                record: record,
                error: `รูปแบบ Time In (${record.timein}) ไม่ถูกต้อง`
              });
              resolve();
              return;
            }

            const attendanceDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            const checkSql = 'SELECT id FROM attendance WHERE userid = ? AND DATE(timein) = ?';

            db.query(checkSql, [record.userid, attendanceDate], (checkErr, existingRecords) => {
              if (checkErr) {
                failed++;
                errors.push({
                  index: record.index,
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

                db.query(updateSql, [record.status, record.note, record.timein, record.timeout, academicYearId, existingRecords[0].id], (updateErr) => {
                  if (updateErr) {
                    failed++;
                    errors.push({
                      index: record.index,
                      record: record,
                      error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + updateErr.message
                    });
                  } else {
                    imported++;
                    successRecords.push({
                      index: record.index,
                      userid: record.userid,
                      employeeName: `${employee.firstname} ${employee.lastname}`,
                      status: record.status,
                      date: attendanceDate,
                      action: 'updated'
                    });
                  }
                  resolve();
                });
              } else {
                // เพิ่มข้อมูลใหม่
                db.query(insertSql, [record.userid, record.status, record.timein, record.timeout, record.note, academicYearId], (insertErr, result) => {
                  if (insertErr) {
                    console.error('Insert error:', insertErr);
                    failed++;
                    errors.push({
                      index: record.index,
                      record: record,
                      error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + insertErr.message
                    });
                  } else {
                    imported++;
                    successRecords.push({
                      index: record.index,
                      userid: record.userid,
                      employeeName: `${employee.firstname} ${employee.lastname}`,
                      status: record.status,
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

        insertPromises.push(insertPromise);
      });

      Promise.all(insertPromises)
        .then(() => {
          res.json({
            success: true,
            message: `นำเข้าข้อมูลเสร็จสิ้น: สำเร็จ ${imported} รายการ, ล้มเหลว ${failed} รายการ`,
            imported: imported,
            failed: failed,
            successRecords: successRecords,
            errors: errors
          });
        })
        .catch(error => {
          console.error('Error during batch import:', error);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล',
            error: error.message
          });
        });
    } catch (error) {
      console.error('Error in /hr/attendance/bulk-record:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล',
        error: error.message
      });
    }
  }
);

module.exports = router;
