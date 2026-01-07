
// โหลดค่าจาก .env
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `user_${req.params.userid}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  }
});

// Make upload middleware available globally
app.set('upload', upload);


const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const ownerRoutes = require('./routes/owner');
const leaveRoutes = require('./routes/leave');
const attendanceRoutes = require('./routes/attendance');
const meetingRoutes = require('./routes/meeting');
const calendarRoutes = require('./routes/calendar'); // ใช้ Google Calendar API
const academicYearRoutes = require('./routes/academicYears');
const { verifyEmailConfig } = require('./config/emailService');


app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', adminRoutes);
app.use('/api', ownerRoutes);
app.use('/api', leaveRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', meetingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api', academicYearRoutes);     


app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path
  });
});



app.use((err, req, res, next) => {
  console.error('Server error:', err);

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)'
      });
    }
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});


app.listen(PORT, '0.0.0.0', async () => {
  console.log('='.repeat(50));
  console.log('🎉 HR Management System Server Started');
  console.log('='.repeat(50));
  console.log(`🚀 Server is running at:`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://192.168.0.9:${PORT}`);
  console.log('');

  // ตรวจสอบการตั้งค่าอีเมล
  await verifyEmailConfig();

  console.log('📊 System Status: Ready');
  console.log('='.repeat(50));
});

// ============= CRON JOB: ลบ Token หมดอายุ =============
// ทำงานทุก 1 ชั่วโมง เพื่อล้างข้อมูล token ที่หมดอายุแล้ว
setInterval(() => {
  const cleanupSql = 'DELETE FROM password_reset_tokens WHERE expires_at < NOW()';

  db.query(cleanupSql, (err, result) => {
    if (err) {
      console.error('❌ Error cleaning expired reset tokens:', err);
    } else if (result.affectedRows > 0) {
      console.log(`🧹 Cleaned ${result.affectedRows} expired password reset token(s)`);
    }
  });
}, 60 * 60 * 1000); // 1 ชั่วโมง (60 นาที * 60 วินาที * 1000 มิลลิวินาที)

// ทำการล้าง token ครั้งแรกเมื่อเซิร์ฟเวอร์เริ่มทำงาน
setTimeout(() => {
  const cleanupSql = 'DELETE FROM password_reset_tokens WHERE expires_at < NOW()';

  db.query(cleanupSql, (err, result) => {
    if (err) {
      console.error('❌ Error cleaning expired reset tokens on startup:', err);
    } else if (result.affectedRows > 0) {
      console.log(`🧹 Initial cleanup: Removed ${result.affectedRows} expired password reset token(s)`);
    } else {
      console.log('✅ No expired password reset tokens to clean');
    }
  });
}, 5000); // หน่วงเวลา 5 วินาที หลังเซิร์ฟเวอร์เริ่มทำงาน

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
