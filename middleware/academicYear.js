const db = require('../config/database');

/**
 * Middleware เพื่อดึง active academic year และเพิ่มใน req object
 */
async function getActiveAcademicYear(req, res, next) {
    try {
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE is_active = TRUE LIMIT 1'
        );

        if (years.length === 0) {
            // ถ้าไม่มีปีการศึกษาที่ active ให้ส่ง null
            req.activeAcademicYear = null;
        } else {
            req.activeAcademicYear = years[0];
        }

        next();
    } catch (error) {
        console.error('Error fetching active academic year:', error);
        // ถ้าเกิด error ก็ให้ส่ง null แทน
        req.activeAcademicYear = null;
        next();
    }
}

/**
 * ฟังก์ชันสำหรับดึง academic year id จาก query parameter หรือใช้ active year
 */
function getAcademicYearId(req) {
    // ถ้ามี academic_year_id ใน query ให้ใช้ค่านั้น
    if (req.query.academic_year_id) {
        return parseInt(req.query.academic_year_id);
    }

    // ถ้าไม่มี ให้ใช้ active academic year
    if (req.activeAcademicYear) {
        return req.activeAcademicYear.id;
    }

    // ถ้าไม่มีทั้งสองอย่าง return null
    return null;
}

/**
 * ฟังก์ชันเพิ่ม WHERE condition สำหรับ academic year
 */
function addAcademicYearCondition(conditions, params, academicYearId, tableAlias = '') {
    if (academicYearId) {
        const column = tableAlias ? `${tableAlias}.academic_year_id` : 'academic_year_id';
        conditions.push(`${column} = ?`);
        params.push(academicYearId);
    }
}

/**
 * Middleware เพื่อตรวจสอบว่ามีปีการศึกษาที่ active หรือไม่
 * ถ้าไม่มีจะ return error
 */
async function requireActiveAcademicYear(req, res, next) {
    try {
        const [years] = await db.query(
            'SELECT * FROM academic_years WHERE is_active = TRUE LIMIT 1'
        );

        if (years.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'ไม่พบปีการศึกษาที่ active กรุณาสร้างปีการศึกษาก่อน'
            });
        }

        req.activeAcademicYear = years[0];
        next();
    } catch (error) {
        console.error('Error fetching active academic year:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการตรวจสอบปีการศึกษา'
        });
    }
}

module.exports = {
    getActiveAcademicYear,
    getAcademicYearId,
    addAcademicYearCondition,
    requireActiveAcademicYear
};
