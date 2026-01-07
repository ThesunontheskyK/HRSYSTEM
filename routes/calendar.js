const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

/**
 * API endpoint สำหรับดึงวันหยุดของไทยจาก Google Calendar
 * ใช้ Public Calendar API โดยไม่ต้องมี API Key (ใช้ข้อมูล public)
 */
router.get('/thai-holidays', async (req, res) => {
  try {
    // สร้าง calendar instance โดยไม่ต้อง auth สำหรับ public calendar
    const calendar = google.calendar({
      version: 'v3',
      auth: process.env.GOOGLE_API_KEY || null // ใช้ API Key ถ้ามี
    });

    // Calendar ID สำหรับวันหยุดไทย (Public Google Calendar)
    // th.th#holiday@group.v.calendar.google.com สำหรับวันหยุดราชการไทย
    const calendarId = 'th.th#holiday@group.v.calendar.google.com';

    // กำหนดช่วงเวลา (1 ปีจากวันนี้)
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    // เรียกข้อมูลจาก Google Calendar API
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: now.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50, // จำกัดผลลัพธ์
      key: process.env.GOOGLE_API_KEY || undefined // ใช้ API Key
    });

    const events = response.data.items || [];

    // แปลงข้อมูลให้เป็นรูปแบบที่ใช้งานง่าย
    const holidays = events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.date || event.start.dateTime,
      end: event.end.date || event.end.dateTime,
      description: event.description || 'วันหยุดราชการ',
      backgroundColor: '#e74c3c', // สีแดงสำหรับวันหยุด
      borderColor: '#c0392b',
      textColor: '#ffffff',
      allDay: true,
      extendedProps: {
        type: 'thai-holiday',
        isHoliday: true
      }
    }));

    res.json({
      success: true,
      count: holidays.length,
      data: holidays
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูลวันหยุดจาก Google Calendar ได้',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: []
    });
  }
});

/**
 * API endpoint สำหรับดึงวันหยุดในช่วงเวลาที่กำหนด
 */
router.get('/thai-holidays/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ startDate และ endDate',
        data: []
      });
    }

    const calendar = google.calendar({
      version: 'v3',
      auth: process.env.GOOGLE_API_KEY || null
    });
    const calendarId = 'th.th#holiday@group.v.calendar.google.com';

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
      key: process.env.GOOGLE_API_KEY || undefined
    });

    const events = response.data.items || [];

    const holidays = events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.date || event.start.dateTime,
      end: event.end.date || event.end.dateTime,
      description: event.description || 'วันหยุดราชการ',
      backgroundColor: '#e74c3c',
      borderColor: '#c0392b',
      textColor: '#ffffff',
      allDay: true,
      extendedProps: {
        type: 'thai-holiday',
        isHoliday: true
      }
    }));

    res.json({
      success: true,
      count: holidays.length,
      data: holidays
    });

  } catch (error) {
    console.error('Error fetching Thai holidays in range:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวันหยุด',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: []
    });
  }
});

module.exports = router;
