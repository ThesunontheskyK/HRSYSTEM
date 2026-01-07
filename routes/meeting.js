// ====================================
// Meeting/Calendar Routes
// ====================================
// APIs สำหรับจัดการการประชุม/ปฏิทิน (Meetings/Calendar)
// - View all meetings
// - Filter by user/department/subject
// - Create/Edit/Delete meetings
// - Meeting participants
// ====================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, DEPARTMENT_HIERARCHY } = require('../middleware/auth');

// GET: ดึงข้อมูลการประชุมทั้งหมด
router.get('/meetings/all', (req, res) => {
  const sql = `
    SELECT m.*,
           CASE
             WHEN m.meeting_type = 'all' THEN 'ทุกคน'
             WHEN m.meeting_type = 'department' THEN CONCAT('ฝ่าย: ', m.target_department)
             WHEN m.meeting_type = 'subject' THEN CONCAT('หมวดวิชา: ', m.target_subject)
             WHEN m.meeting_type = 'specific_roles' THEN 'กลุ่มเฉพาะ'
             ELSE 'ไม่ระบุ'
           END as meeting_scope,
           e.firstname as creator_firstname,
           e.lastname as creator_lastname
    FROM meetings m
    LEFT JOIN employees e ON m.created_by = e.userid
    ORDER BY m.start DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching all meetings:', err);
      return res.status(500).json({
        success: false,
        error: 'Database error'
      });
    }

    // แปลงเป็นรูปแบบที่ FullCalendar ต้องการ
    const events = results.map(meeting => ({
      id: meeting.id,
      title: meeting.title,
      start: meeting.start,
      end: meeting.end,
      backgroundColor: meeting.color || '#3788d8',
      borderColor: meeting.color || '#3788d8',
      extendedProps: {
        meeting_type: meeting.meeting_type,
        target_department: meeting.target_department,
        target_subject: meeting.target_subject,
        target_roles: meeting.target_roles,
        meeting_scope: meeting.meeting_scope,
        description: meeting.description,
        created_by: meeting.created_by,
        creator_name: meeting.creator_firstname && meeting.creator_lastname
          ? `${meeting.creator_firstname} ${meeting.creator_lastname}`
          : null
      }
    }));

    res.json(events);
  });
});

// GET: ดึงข้อมูลการประชุมตาม userid
router.get('/meetings/user/:userid', (req, res) => {
  const { userid } = req.params;

  // ดึงข้อมูลผู้ใช้ก่อน
  const userSql = `
    SELECT e.userid, e.role_code, r.role_group, r.subject
    FROM employees e
    JOIN roles r ON e.role_code = r.role_code
    WHERE e.userid = ?
  `;

  db.query(userSql, [userid], (err, userResults) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResults[0];

    // หาฝ่ายของผู้ใช้จาก role_code (สำหรับ admin)
    const userDepartment = getUserDepartmentFromRole(user.role_code);

    // ดึงการประชุมที่เกี่ยวข้อง
    const meetingSql = `
      SELECT m.*,
             CASE
               WHEN m.meeting_type = 'all' THEN 'ทุกคน'
               WHEN m.meeting_type = 'department' THEN CONCAT('ฝ่าย: ', m.target_department)
               WHEN m.meeting_type = 'subject' THEN CONCAT('หมวดวิชา: ', m.target_subject)
               WHEN m.meeting_type = 'specific_roles' THEN 'กลุ่มเฉพาะ'
               ELSE 'ไม่ระบุ'
             END as meeting_scope,
             e.firstname as creator_firstname,
             e.lastname as creator_lastname
      FROM meetings m
      LEFT JOIN employees e ON m.created_by = e.userid
      WHERE m.meeting_type = 'all'
         OR (m.meeting_type = 'department' AND m.target_department LIKE ?)
         OR (m.meeting_type = 'subject' AND m.target_subject = ?)
         OR (m.meeting_type = 'specific_roles' AND JSON_CONTAINS(m.target_roles, ?))
      ORDER BY m.start DESC
    `;

    const deptPattern = userDepartment ? `%${userDepartment}%` : '%NONE%';
    db.query(meetingSql, [deptPattern, user.subject, `"${user.role_code}"`], (err, meetings) => {
      if (err) {
        console.error('Error fetching meetings:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }

      // แปลงเป็นรูปแบบที่ FullCalendar ต้องการ
      const events = meetings.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        backgroundColor: meeting.color || '#3788d8',
        borderColor: meeting.color || '#3788d8',
        extendedProps: {
          meeting_type: meeting.meeting_type,
          target_department: meeting.target_department,
          target_subject: meeting.target_subject,
          target_roles: meeting.target_roles,
          meeting_scope: meeting.meeting_scope,
          description: meeting.description,
          created_by: meeting.created_by,
          creator_name: meeting.creator_firstname && meeting.creator_lastname
            ? `${meeting.creator_firstname} ${meeting.creator_lastname}`
            : null
        }
      }));

      res.json(events);
    });
  });
});

// POST: เพิ่มการประชุมแบบเดิม (backward compatibility)
router.post('/addmeeting', (req, res) => {
  const {
    title,
    start,
    end,
    color,
    description,
    created_by
  } = req.body;

  if (!title || !start) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกชื่อการประชุมและเวลาเริ่มต้น'
    });
  }

  const sql = `
    INSERT INTO meetings (
      title, start, end, color, meeting_type,
      description, created_by
    ) VALUES (?, ?, ?, ?, 'all', ?, ?)
  `;

  const values = [
    title,
    start,
    end || null,
    color || '#3788d8',
    description || null,
    created_by
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error adding meeting:', err);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการเพิ่มการประชุม'
      });
    }

    res.json({
      success: true,
      message: 'เพิ่มการประชุมสำเร็จ',
      id: result.insertId
    });
  });
});

// POST: เพิ่มการประชุม (รองรับการเลือกกลุ่ม)
router.post('/meetings/advanced', (req, res) => {
  const {
    title,
    start,
    end,
    color,
    meeting_type = 'all',
    target_department,
    target_subject,
    target_roles,
    description,
    created_by
  } = req.body;

  // ตรวจสอบข้อมูลพื้นฐาน
  if (!title || !start || !created_by) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกข้อมูลที่จำเป็น: ชื่อการประชุม, เวลาเริ่ม, และผู้สร้าง'
    });
  }

  // ตรวจสอบ meeting_type
  const validTypes = ['all', 'department', 'subject', 'specific_roles'];
  if (!validTypes.includes(meeting_type)) {
    return res.status(400).json({
      success: false,
      error: 'ประเภทการประชุมไม่ถูกต้อง'
    });
  }

  // เตรียมข้อมูลสำหรับบันทึก
  let finalTargetRoles = null;
  if (meeting_type === 'specific_roles' && target_roles) {
    try {
      finalTargetRoles = Array.isArray(target_roles) ?
        JSON.stringify(target_roles) : target_roles;
    } catch (error) {
      console.error('Error processing target_roles:', error);
      return res.status(400).json({
        success: false,
        error: 'รูปแบบข้อมูล target_roles ไม่ถูกต้อง'
      });
    }
  }

  const sql = `
    INSERT INTO meetings (
      title, start, end, color, meeting_type,
      target_department, target_subject, target_roles,
      description, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    title,
    start,
    end || null,
    color || '#3788d8',
    meeting_type,
    meeting_type === 'department' ? target_department : null,
    meeting_type === 'subject' ? target_subject : null,
    finalTargetRoles,
    description || null,
    created_by
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error adding advanced meeting:', err);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการเพิ่มการประชุม: ' + err.message
      });
    }

    res.json({
      success: true,
      message: 'เพิ่มการประชุมสำเร็จ',
      id: result.insertId,
      meeting_type: meeting_type
    });
  });
});

// PUT: แก้ไขการประชุม
router.put('/meetings/:id', (req, res) => {
  const meetingId = req.params.id;
  const {
    title,
    start,
    end,
    color,
    meeting_type,
    target_department,
    target_subject,
    target_roles,
    description
  } = req.body;

  if (!title || !start) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกชื่อการประชุมและเวลาเริ่มต้น'
    });
  }

  // เตรียมข้อมูล target_roles
  let finalTargetRoles = null;
  if (meeting_type === 'specific_roles' && target_roles) {
    try {
      finalTargetRoles = Array.isArray(target_roles) ?
        JSON.stringify(target_roles) : target_roles;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบข้อมูล target_roles ไม่ถูกต้อง'
      });
    }
  }

  const sql = `
    UPDATE meetings
    SET title = ?, start = ?, end = ?, color = ?, meeting_type = ?,
        target_department = ?, target_subject = ?, target_roles = ?, description = ?
    WHERE id = ?
  `;

  const values = [
    title,
    start,
    end || null,
    color || '#3788d8',
    meeting_type || 'all',
    meeting_type === 'department' ? target_department : null,
    meeting_type === 'subject' ? target_subject : null,
    finalTargetRoles,
    description || null,
    meetingId
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating meeting:', err);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการแก้ไขการประชุม'
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการประชุมที่ต้องการแก้ไข'
      });
    }

    res.json({
      success: true,
      message: 'แก้ไขการประชุมสำเร็จ'
    });
  });
});

// DELETE: ลบการประชุม
router.delete('/deletemeeting/:id', authenticateToken, (req, res) => {
  const meetingId = req.params.id;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อน'
    });
  }

  // ป้องกันการลบวันหยุดราชการ (ID ของวันหยุดจะเป็น string ที่มี 'thai-holiday' หรือขึ้นต้นด้วยตัวเลข 8 หลัก)
  const meetingIdStr = String(meetingId);
  if (meetingIdStr.includes('thai-holiday') || /^\d{8}_/.test(meetingIdStr)) {
    return res.status(403).json({
      success: false,
      message: 'ไม่สามารถลบวันหยุดราชการได้'
    });
  }

  // ตรวจสอบข้อมูลการประชุมก่อนลบ
  const checkMeetingSql = `
    SELECT id, title, created_by, meeting_type, target_department, target_subject
    FROM meetings
    WHERE id = ?
  `;

  db.query(checkMeetingSql, [meetingId], (err, results) => {
    if (err) {
      console.error('Error checking meeting:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบการประชุม'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการประชุมที่ต้องการลบ'
      });
    }

    const meeting = results[0];

    // ตรวจสอบสิทธิ์การลบ
    const canDelete = checkDeletePermission(meeting, currentUser);

    if (!canDelete.allowed) {
      return res.status(403).json({
        success: false,
        message: canDelete.reason
      });
    }

    // ดำเนินการลบการประชุม
    const deleteSql = 'DELETE FROM meetings WHERE id = ?';

    db.query(deleteSql, [meetingId], (deleteErr, deleteResult) => {
      if (deleteErr) {
        console.error('Error deleting meeting:', deleteErr);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการลบการประชุม'
        });
      }

      if (deleteResult.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบการประชุมที่ต้องการลบ'
        });
      }

      console.log(`Meeting deleted: ID=${meetingId}, Title="${meeting.title}", DeletedBy=${currentUser.userid} (${currentUser.role_code})`);

      res.json({
        success: true,
        message: 'ลบการประชุมเรียบร้อยแล้ว',
        deletedBy: `${currentUser.firstname} ${currentUser.lastname}`,
        deletedRole: currentUser.role_code
      });
    });
  });
});

// ฟังก์ชันตรวจสอบสิทธิ์การลบ
function checkDeletePermission(meeting, currentUser) {
  // HR (admin_hr) มีสิทธิ์ลบการประชุมได้ทุกการประชุม
  if (currentUser.role_code === 'admin_hr') {
    return {
      allowed: true,
      reason: 'ฝ่ายบุคลากรมีสิทธิ์จัดการการประชุมทุกการประชุม'
    };
  }

  // Owner มีสิทธิ์ลบการประชุมได้ทุกการประชุม
  if (currentUser.role_group === 'owner') {
    return {
      allowed: true,
      reason: 'เจ้าของระบบมีสิทธิ์จัดการการประชุมทุกการประชุม'
    };
  }

  // ผู้สร้างการประชุมสามารถลบการประชุมของตนเองได้
  if (meeting.created_by && meeting.created_by == currentUser.userid) {
    return {
      allowed: true,
      reason: 'ผู้สร้างการประชุมสามารถลบการประชุมของตนเองได้'
    };
  }

  // Admin อื่นๆ อาจมีสิทธิ์จำกัดตามประเภทการประชุม
  if (currentUser.role_group === 'admin') {
    return checkAdminSpecificPermission(meeting, currentUser);
  }

  return {
    allowed: false,
    reason: 'คุณไม่มีสิทธิ์ลบการประชุมนี้'
  };
}

// ตรวจสอบสิทธิ์เฉพาะสำหรับ Admin แต่ละประเภท
function checkAdminSpecificPermission(meeting, currentUser) {
  // Admin วิชาการสามารถลบการประชุมทางวิชาการได้
  if (currentUser.role_code === 'admin_academic' &&
      (meeting.meeting_type === 'subject' ||
       meeting.target_subject)) {
    return {
      allowed: true,
      reason: 'หัวหน้าฝ่ายวิชาการสามารถจัดการการประชุมทางวิชาการได้'
    };
  }

  // Admin อื่นสามารถลบการประชุมในสังกัดของตน
  const userDepartment = getUserDepartmentFromRole(currentUser.role_code);
  if (userDepartment &&
      meeting.meeting_type === 'department' &&
      meeting.target_department &&
      meeting.target_department.includes(userDepartment)) {
    return {
      allowed: true,
      reason: `หัวหน้าฝ่ายสามารถจัดการการประชุมของฝ่ายตนเองได้`
    };
  }

  // หัวหน้าหมวดวิชาสามารถลบการประชุมในหมวดวิชาของตน
  if (currentUser.role_code.startsWith('head_of_') &&
      meeting.meeting_type === 'subject') {
    const userSubject = getUserSubjectFromRole(currentUser.role_code);
    if (userSubject && meeting.target_subject === userSubject) {
      return {
        allowed: true,
        reason: 'หัวหน้าหมวดวิชาสามารถจัดการการประชุมของหมวดวิชาตนเองได้'
      };
    }
  }

  return {
    allowed: false,
    reason: 'คุณไม่มีสิทธิ์ลบการประชุมนี้'
  };
}

function getUserDepartmentFromRole(roleCode) {
  const departmentMap = {
    'admin_academic': 'academic',
    'admin_student': 'student',
    'admin_operation': 'operation',
    'admin_quality': 'quality',
    'admin_resource': 'resource',
    'admin_kindergarten': 'kindergarten'
  };
  return departmentMap[roleCode] || null;
}

function getUserSubjectFromRole(roleCode) {
  const subjectMap = {
    'head_of_math': 'Math',
    'head_of_eng': 'English',
    'head_of_computer': 'Computer',
    'head_of_sci': 'Science',
    'head_of_social_studie': 'SocialStudies',
    'head_of_thai': 'Thai'
  };
  return subjectMap[roleCode] || null;
}

// GET: ตรวจสอบสิทธิ์การลบการประชุม
router.get('/meetings/:id/delete-permission', authenticateToken, (req, res) => {
  const meetingId = req.params.id;
  const currentUser = req.user;

  const checkMeetingSql = `
    SELECT id, title, created_by, meeting_type, target_department, target_subject
    FROM meetings
    WHERE id = ?
  `;

  db.query(checkMeetingSql, [meetingId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบการประชุม'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการประชุม'
      });
    }

    const meeting = results[0];
    const permission = checkDeletePermission(meeting, currentUser);

    res.json({
      success: true,
      canDelete: permission.allowed,
      reason: permission.reason,
      userRole: currentUser.role_code,
      meetingInfo: {
        id: meeting.id,
        title: meeting.title,
        createdBy: meeting.created_by,
        isOwner: meeting.created_by == currentUser.userid
      }
    });
  });
});

// GET: ดึงข้อมูลการประชุมพร้อมผู้เข้าร่วม
router.get('/meetings/:id/participants', (req, res) => {
  const meetingId = req.params.id;

  const sql = `
    SELECT
      m.*,
      CASE
        WHEN m.meeting_type = 'all' THEN 'ทุกคน'
        WHEN m.meeting_type = 'department' THEN CONCAT('ฝ่าย: ', m.target_department)
        WHEN m.meeting_type = 'subject' THEN CONCAT('หมวดวิชา: ', m.target_subject)
        WHEN m.meeting_type = 'specific_roles' THEN 'กลุ่มเฉพาะ'
      END as scope_description
    FROM meetings m
    WHERE m.id = ?
  `;

  db.query(sql, [meetingId], (err, meetingResults) => {
    if (err) {
      console.error('Error fetching meeting:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (meetingResults.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const meeting = meetingResults[0];

    // ดึงรายชื่อผู้ที่ควรเข้าร่วม
    let participantsSql = '';
    let params = [];

    switch (meeting.meeting_type) {
      case 'all':
        participantsSql = `
          SELECT e.userid, e.firstname, e.lastname, e.role_code, r.role_name, r.subject
          FROM employees e
          JOIN roles r ON e.role_code = r.role_code
          WHERE r.role_group IN ('user', 'admin')
          ORDER BY r.role_group, e.firstname
        `;
        break;

      case 'department':
        participantsSql = `
          SELECT e.userid, e.firstname, e.lastname, e.role_code, r.role_name, r.subject
          FROM employees e
          JOIN roles r ON e.role_code = r.role_code
          WHERE (r.role_group = 'admin' AND e.role_code LIKE ?)
             OR (r.role_group = 'user' AND r.role_code LIKE ?)
          ORDER BY r.role_group, e.firstname
        `;
        params = [`admin_${meeting.target_department}%`, `%${meeting.target_department}%`];
        break;

      case 'subject':
        participantsSql = `
          SELECT e.userid, e.firstname, e.lastname, e.role_code, r.role_name, r.subject
          FROM employees e
          JOIN roles r ON e.role_code = r.role_code
          WHERE r.subject = ?
          ORDER BY e.firstname
        `;
        params = [meeting.target_subject];
        break;

      case 'specific_roles':
        if (meeting.target_roles) {
          try {
            const roles = JSON.parse(meeting.target_roles);
            const placeholders = roles.map(() => '?').join(',');
            participantsSql = `
              SELECT e.userid, e.firstname, e.lastname, e.role_code, r.role_name, r.subject
              FROM employees e
              JOIN roles r ON e.role_code = r.role_code
              WHERE e.role_code IN (${placeholders})
              ORDER BY r.role_group, e.firstname
            `;
            params = roles;
          } catch (error) {
            console.error('Error parsing target_roles:', error);
            return res.status(500).json({ error: 'Invalid target_roles data' });
          }
        }
        break;
    }

    if (participantsSql) {
      db.query(participantsSql, params, (err, participants) => {
        if (err) {
          console.error('Error fetching participants:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          success: true,
          data: {
            meeting: meeting,
            participants: participants,
            participant_count: participants.length
          }
        });
      });
    } else {
      res.json({
        success: true,
        data: {
          meeting: meeting,
          participants: [],
          participant_count: 0
        }
      });
    }
  });
});

// GET: ดึงข้อมูล departments
router.get('/meetings/departments', (req, res) => {
  const departments = [
    { value: 'hr', label: 'ฝ่ายบุคลากร' },
    { value: 'academic', label: 'ฝ่ายวิชาการ' },
    { value: 'student', label: 'ฝ่ายกิจการนักเรียน' },
    { value: 'operation', label: 'ฝ่ายบริหาร' },
    { value: 'quality', label: 'ฝ่ายมาตรฐาน' },
    { value: 'resource', label: 'ฝ่ายทรัพยากร' },
    { value: 'kindergarten', label: 'แผนกปฐมวัย' },
    { value: 'pastoral', label: 'ฝ่ายอภิบาล' },
    { value: 'management', label: 'คณะกรรมการบริหาร' }
  ];

  res.json({ success: true, data: departments });
});

// GET: ดึงข้อมูล subjects
router.get('/meetings/subjects', (req, res) => {
  const subjects = [
    { value: 'Math', label: 'คณิตศาสตร์' },
    { value: 'English', label: 'ภาษาอังกฤษ' },
    { value: 'Thai', label: 'ภาษาไทย' },
    { value: 'Science', label: 'วิทยาศาสตร์' },
    { value: 'SocialStudie', label: 'สังคมศึกษา' },
    { value: 'Computer', label: 'คอมพิวเตอร์' },
    { value: 'Kindergarten', label: 'ปฐมวัย' }
  ];

  res.json({ success: true, data: subjects });
});

// GET: ดึงข้อมูล roles
router.get('/meetings/roles', (req, res) => {
  const adminRoles = [
    { value: 'admin_hr', label: 'หัวหน้าฝ่ายบุคลากร' },
    { value: 'admin_academic', label: 'หัวหน้าฝ่ายวิชาการ' },
    { value: 'admin_student', label: 'หัวหน้าฝ่ายกิจการนักเรียน' },
    { value: 'admin_operation', label: 'หัวหน้าฝ่ายบริหาร' },
    { value: 'admin_quality', label: 'หัวหน้าฝ่ายมาตรฐาน' },
    { value: 'admin_resource', label: 'หัวหน้าฝ่ายทรัพยากร' },
    { value: 'admin_kindergarten', label: 'หัวหน้าแผนกปฐมวัย' }
  ];

  const userRoles = [
    { value: 'mathteacher', label: 'ครูคณิตศาสตร์', subject: 'Math' },
    { value: 'engteacher', label: 'ครูภาษาอังกฤษ', subject: 'English' },
    { value: 'thaiteacher', label: 'ครูภาษาไทย', subject: 'Thai' },
    { value: 'sciteacher', label: 'ครูวิทยาศาสตร์', subject: 'Science' },
    { value: 'socialteacher', label: 'ครูสังคมศึกษา', subject: 'SocialStudie' },
    { value: 'computerteacher', label: 'ครูคอมพิวเตอร์', subject: 'Computer' },
    { value: 'kindergarten_teacher', label: 'ครูปฐมวัย', subject: 'Kindergarten' },
    { value: 'head_of_math', label: 'หัวหน้าหมวดวิชาคณิตศาสตร์', subject: 'Math' },
    { value: 'head_of_eng', label: 'หัวหน้าหมวดวิชาภาษาอังกฤษ', subject: 'English' },
    { value: 'head_of_thai', label: 'หัวหน้าหมวดวิชาภาษาไทย', subject: 'Thai' },
    { value: 'head_of_sci', label: 'หัวหน้าหมวดวิชาวิทยาศาสตร์', subject: 'Science' },
    { value: 'head_of_social_studie', label: 'หัวหน้าหมวดวิชาสังคมศึกษา', subject: 'SocialStudie' },
    { value: 'head_of_computer', label: 'หัวหน้าหมวดวิชาคอมพิวเตอร์', subject: 'Computer' },
    { value: 'hr_staff', label: 'เจ้าหน้าที่บุคลากร' },
    { value: 'operation_staff', label: 'เจ้าหน้าที่บริหาร' },
    { value: 'quality_staff', label: 'เจ้าหน้าที่มาตรฐาน' },
    { value: 'resource_staff', label: 'เจ้าหน้าที่ทรัพยากร' },
    { value: 'student_affair_staff', label: 'เจ้าหน้าที่กิจการนักเรียน' }
  ];

  res.json({
    success: true,
    data: {
      admin: adminRoles,
      user: userRoles
    }
  });
});

module.exports = router;
