// Hierarchical Permission System
const DEPARTMENT_HIERARCHY = {
  // ฝ่ายบุคลากร - สิทธิ์สูงสุด
  admin_hr: {
    name: 'หัวหน้าฝ่ายบุคลากร',
    canManage: ['all'],
    permissions: [
      'read_all_employees', 'update_all_employees', 'manage_attendance',
      'manage_payroll', 'approve_all_leaves', 'create_reports'
    ]
  },

  // ฝ่ายวิชาการ - ดูเฉพาะครู
  admin_academic: {
    name: 'หัวหน้าฝ่ายวิชาการ',
    canManage: ['teachers'],
    permissions: ['read_teachers', 'update_teachers', 'approve_teacher_leaves', 'view_teacher_attendance'],
    manageable_roles: [
      'mathteacher', 'engteacher', 'computerteacher', 'sciteacher',
      'socialteacher', 'thaiteacher', 'head_of_math', 'head_of_eng',
      'head_of_computer', 'head_of_sci', 'head_of_social_studie', 'head_of_thai'
    ]
  },

  // ฝ่ายกิจการนักเรียน
  admin_student: {
    name: 'หัวหน้าฝ่ายกิจการนักเรียน',
    canManage: ['student_affairs'],
    permissions: ['read_student_staff', 'update_student_staff', 'approve_student_staff_leaves'],
    manageable_roles: ['student_affair_staff']
  },

  // ฝ่ายอื่น ๆ
  admin_operation: {
    name: 'หัวหน้าฝ่ายบริหาร',
    canManage: ['operation'],
    permissions: ['read_operation_staff', 'approve_operation_leaves'],
    manageable_roles: ['operation_staff']
  },

  admin_quality: {
    name: 'หัวหน้าฝ่ายมาตรฐาน',
    canManage: ['quality'],
    permissions: ['read_quality_staff', 'approve_quality_leaves'],
    manageable_roles: ['quality_staff']
  },

  admin_resource: {
    name: 'หัวหน้าฝ่ายทรัพยากร',
    canManage: ['resource'],
    permissions: ['read_resource_staff', 'approve_resource_leaves'],
    manageable_roles: ['resource_staff']
  },

  admin_kindergarten: {
    name: 'หัวหน้าแผนกปฐมวัย',
    canManage: ['kindergarten'],
    permissions: ['read_kindergarten_staff', 'approve_kindergarten_leaves'],
    manageable_roles: ['kindergarten_teacher']
  },

  // หัวหน้าหมวดวิชา - ดูเฉพาะครูในหมวดตัวเอง
  head_of_math: {
    name: 'หัวหน้าหมวดวิชาคณิตศาสตร์',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'Math',
    manageable_roles: ['mathteacher']
  },

  head_of_eng: {
    name: 'หัวหน้าหมวดวิชาภาษาอังกฤษ',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'English',
    manageable_roles: ['engteacher']
  },

  head_of_computer: {
    name: 'หัวหน้าหมวดวิชาคอมพิวเตอร์',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'Computer',
    manageable_roles: ['computerteacher']
  },

  head_of_sci: {
    name: 'หัวหน้าหมวดวิชาวิทยาศาสตร์',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'Science',
    manageable_roles: ['sciteacher']
  },

  head_of_social_studie: {
    name: 'หัวหน้าหมวดวิชาสังคม',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'SocialStudies',
    manageable_roles: ['socialteacher']
  },

  head_of_thai: {
    name: 'หัวหน้าหมวดวิชาภาษาไทย',
    canManage: ['own_subject'],
    permissions: ['read_own_teachers', 'approve_own_leaves'],
    subject: 'Thai',
    manageable_roles: ['thaiteacher']
  }
};

// Middleware: ตรวจสอบ authentication
const authenticateToken = (req, res, next) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบ'
    });
  }
  req.user = user;
  next();
};

// Helper: สร้าง data filter ตาม permission
const createDataFilter = (user) => {
  const permissions = DEPARTMENT_HIERARCHY[user.role_code];
  if (!permissions) return {};

  const filter = {};

  switch (permissions.canManage[0]) {
    case 'all':
      // HR ดูได้หมด - ไม่มี filter
      break;
    case 'teachers':
      // ฝ่ายวิชาการ - เฉพาะครู
      filter.role_code = permissions.manageable_roles;
      break;
    case 'own_subject':
      // หัวหน้าหมวดวิชา - เฉพาะครูในหมวดตัวเอง
      filter.role_code = permissions.manageable_roles;
      filter.subject = permissions.subject;
      break;
    default:
      // ฝ่ายอื่น ๆ
      filter.role_code = permissions.manageable_roles || [];
      break;
  }

  return filter;
};

// Middleware: ตรวจสอบ permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = DEPARTMENT_HIERARCHY[req.user.role_code];
    if (!userPermissions || !userPermissions.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์ในการดำเนินการนี้'
      });
    }
    next();
  };
};

module.exports = {
  DEPARTMENT_HIERARCHY,
  authenticateToken,
  createDataFilter,
  checkPermission
};
