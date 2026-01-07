const express = require('express');
const router = express.Router();
const db = require('../config/database').promise();

// Middleware ตรวจสอบว่าเป็น owner
const checkOwnerRole = (req, res, next) => {
    if (!req.session.user) {
        return res.status(403).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    }

    const userRole = req.session.user.role || req.session.user.role_code;
    if (userRole !== 'owner') {
        return res.status(403).json({ error: 'ต้องเป็น Owner เท่านั้น' });
    }

    next();
};

// ดึงรายการปีการศึกษาทั้งหมด
router.get('/academic-years', checkOwnerRole, async (req, res) => {
    try {
        const [years] = await db.query(
            'SELECT * FROM academic_years ORDER BY start_date DESC'
        );
        res.json(years);
    } catch (error) {
        console.error('Error fetching academic years:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา' });
    }
});

// ดึงปีการศึกษาที่ active อยู่ (ทุก role เข้าถึงได้)
router.get('/academic-years/active', async (req, res) => {
    try {
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE is_active = TRUE LIMIT 1'
        );

        if (years.length === 0) {
            return res.status(404).json({ error: 'ไม่พบปีการศึกษาที่ active' });
        }

        res.json(years[0]);
    } catch (error) {
        console.error('Error fetching active academic year:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลปีการศึกษา' });
    }
});

// สร้างปีการศึกษาใหม่
router.post('/academic-years', checkOwnerRole, async (req, res) => {
    const { year_name, start_date, end_date, set_as_active } = req.body;

    // ตรวจสอบข้อมูล
    if (!year_name || !start_date || !end_date) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบว่าวันที่ถูกต้อง
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (endDate <= startDate) {
        return res.status(400).json({ error: 'วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น' });
    }

    try {
        // ถ้าต้องการให้ปีการศึกษาใหม่เป็น active ให้ปิด active ของปีเก่าก่อน
        if (set_as_active) {
            await db.query('UPDATE academic_years SET is_active = FALSE');
        }

        const [result] = await db.query(
            'INSERT INTO academic_years (year_name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)',
            [year_name, start_date, end_date, set_as_active || false]
        );

        // ดึงข้อมูลที่เพิ่งสร้าง
        const [newYear] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [result.insertId]
        );

        res.json({
            success: true,
            message: 'สร้างปีการศึกษาใหม่สำเร็จ',
            data: newYear[0]
        });
    } catch (error) {
        console.error('Error creating academic year:', error);

        // ตรวจสอบว่าซ้ำชื่อหรือไม่
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'มีปีการศึกษานี้อยู่แล้ว' });
        }

        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างปีการศึกษา' });
    }
});

// สลับปีการศึกษา (เปลี่ยน active)
router.put('/academic-years/:id/activate', checkOwnerRole, async (req, res) => {
    const { id } = req.params;

    try {
        // ตรวจสอบว่ามีปีการศึกษานี้หรือไม่
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        if (years.length === 0) {
            return res.status(404).json({ error: 'ไม่พบปีการศึกษานี้' });
        }

        // ถ้าปีการศึกษานี้ active อยู่แล้ว
        if (years[0].is_active) {
            return res.json({
                success: true,
                message: 'ปีการศึกษานี้ active อยู่แล้ว',
                data: years[0]
            });
        }

        // ปิด active ทั้งหมด
        await db.query('UPDATE academic_years SET is_active = FALSE');

        // เปิด active ปีการศึกษาที่เลือก
        await db.query(
            'UPDATE academic_years SET is_active = TRUE WHERE id = ?',
            [id]
        );

        // ดึงข้อมูลที่อัพเดท
        const [updatedYear] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'เปลี่ยนปีการศึกษาสำเร็จ',
            data: updatedYear[0]
        });
    } catch (error) {
        console.error('Error activating academic year:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเปลี่ยนปีการศึกษา' });
    }
});

// อัพเดทข้อมูลปีการศึกษา
router.put('/academic-years/:id', checkOwnerRole, async (req, res) => {
    const { id } = req.params;
    const { year_name, start_date, end_date } = req.body;

    if (!year_name || !start_date || !end_date) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        // ตรวจสอบว่ามีปีการศึกษานี้หรือไม่
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        if (years.length === 0) {
            return res.status(404).json({ error: 'ไม่พบปีการศึกษานี้' });
        }

        await db.query(
            'UPDATE academic_years SET year_name = ?, start_date = ?, end_date = ? WHERE id = ?',
            [year_name, start_date, end_date, id]
        );

        const [updatedYear] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'อัพเดทปีการศึกษาสำเร็จ',
            data: updatedYear[0]
        });
    } catch (error) {
        console.error('Error updating academic year:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'มีปีการศึกษานี้อยู่แล้ว' });
        }

        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัพเดทปีการศึกษา' });
    }
});

// ลบปีการศึกษา
router.delete('/academic-years/:id', checkOwnerRole, async (req, res) => {
    const { id } = req.params;

    try {
        // ตรวจสอบว่ามีปีการศึกษานี้หรือไม่
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        if (years.length === 0) {
            return res.status(404).json({ error: 'ไม่พบปีการศึกษานี้' });
        }

        // ห้ามลบปีการศึกษาที่ active อยู่
        if (years[0].is_active) {
            return res.status(400).json({ error: 'ไม่สามารถลบปีการศึกษาที่กำลังใช้งานอยู่ได้' });
        }

        await db.query('DELETE FROM academic_years WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'ลบปีการศึกษาสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting academic year:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบปีการศึกษา' });
    }
});

// ดึงสถิติของปีการศึกษา
router.get('/academic-years/:id/statistics', checkOwnerRole, async (req, res) => {
    const { id } = req.params;

    try {
        // ตรวจสอบว่ามีปีการศึกษานี้หรือไม่
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE id = ?',
            [id]
        );

        if (years.length === 0) {
            return res.status(404).json({ error: 'ไม่พบปีการศึกษานี้' });
        }

        const statistics = {};

        // นับจำนวน leave_requests (ถ้ามีตาราง)
        try {
            const [leaveRequests] = await db.query(
                'SELECT COUNT(*) as count FROM leave_requests WHERE academic_year_id = ?',
                [id]
            );
            statistics.leave_requests = leaveRequests[0].count;
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                statistics.leave_requests = 0;
            } else {
                throw error;
            }
        }

        // นับจำนวน leave_history
        try {
            const [leaveHistory] = await db.query(
                'SELECT COUNT(*) as count FROM leave_history WHERE academic_year_id = ?',
                [id]
            );
            statistics.leave_history = leaveHistory[0].count;
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                statistics.leave_history = 0;
            } else {
                throw error;
            }
        }

        // นับจำนวน salary_history
        try {
            const [salaryHistory] = await db.query(
                'SELECT COUNT(*) as count FROM salary_history WHERE academic_year_id = ?',
                [id]
            );
            statistics.salary_payments = salaryHistory[0].count;
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                statistics.salary_payments = 0;
            } else {
                throw error;
            }
        }

        res.json({
            academic_year: years[0],
            statistics: statistics
        });
    } catch (error) {
        console.error('Error fetching academic year statistics:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
});

module.exports = router;
