// ====================================
// Thai Public Holidays Utility
// ====================================
// จัดการข้อมูลวันหยุดนักขัตฤกษ์ไทย
// - ดึงข้อมูลจาก API ของรัฐบาล
// - คำนวณวันทำงาน (ไม่นับเสาร์-อาทิตย์และวันหยุดราชการ)
// ====================================

const fetch = require('node-fetch');

// Cache สำหรับเก็บข้อมูลวันหยุดแต่ละปี
const holidayCache = new Map();

/**
 * ดึงข้อมูลวันหยุดนักขัตฤกษ์จาก API ของรัฐบาล
 * @param {number} year - ปี พ.ศ. (เช่น 2568)
 * @returns {Promise<Array>} - Array ของวันหยุด
 */
async function fetchThaiPublicHolidays(year) {
  // ตรวจสอบ cache ก่อน
  if (holidayCache.has(year)) {
    return holidayCache.get(year);
  }

  try {
    // API วันหยุดนักขัตฤกษ์ของรัฐบาลไทย
    // ใช้ API จาก data.go.th หรือแหล่งอื่นที่เชื่อถือได้
    const url = `https://data.go.th/api/datasets/th_holidays/${year}`;

    // สำหรับการทดสอบ หากไม่มี API ให้ใช้ข้อมูลวันหยุดพื้นฐาน
    const holidays = await fetchHolidaysFromAPI(year);

    // เก็บใน cache
    holidayCache.set(year, holidays);

    return holidays;
  } catch (error) {
    console.error(`Error fetching holidays for year ${year}:`, error);

    // ถ้า API ล้มเหลว ใช้ข้อมูลวันหยุดพื้นฐาน
    const fallbackHolidays = getFallbackHolidays(year);
    holidayCache.set(year, fallbackHolidays);

    return fallbackHolidays;
  }
}

/**
 * ดึงข้อมูลจาก API จริง (หรือ fallback)
 */
async function fetchHolidaysFromAPI(year) {
  // แปลง พ.ศ. เป็น ค.ศ.
  const gregorianYear = year - 543;

  try {
    // ลองใช้ API สาธารณะ (ถ้ามี)
    // ตัวอย่างนี้จะใช้ข้อมูลที่กำหนดเองไว้

    // หากมี API จริงสามารถใช้แบบนี้:
    // const response = await fetch(`https://api-url.com/holidays/${gregorianYear}`);
    // const data = await response.json();
    // return data.map(h => new Date(h.date));

    // สำหรับตอนนี้ใช้ fallback
    return getFallbackHolidays(year);

  } catch (error) {
    throw error;
  }
}

/**
 * ข้อมูลวันหยุดพื้นฐานสำหรับปีที่กำหนด
 * (ใช้เมื่อ API ไม่พร้อมใช้งาน)
 */
function getFallbackHolidays(year) {
  const gregorianYear = year - 543;

  // วันหยุดประจำปีที่แน่นอน (ไม่เปลี่ยนแปลง)
  const fixedHolidays = [
    `${gregorianYear}-01-01`, // วันขึ้นปีใหม่
    `${gregorianYear}-04-06`, // วันจักรี
    `${gregorianYear}-04-13`, // วันสงกรานต์
    `${gregorianYear}-04-14`, // วันสงกรานต์
    `${gregorianYear}-04-15`, // วันสงกรานต์
    `${gregorianYear}-05-01`, // วันแรงงาน
    `${gregorianYear}-05-04`, // วันฉัตรมงคล (วันพระราชพิธีบรมราชาภิเษก)
    `${gregorianYear}-06-03`, // วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดา
    `${gregorianYear}-07-28`, // วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว
    `${gregorianYear}-08-12`, // วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง
    `${gregorianYear}-10-13`, // วันคืนพระราชสมบัติแด่พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว
    `${gregorianYear}-10-23`, // วันปิยมหาราช
    `${gregorianYear}-12-05`, // วันพ่อแห่งชาติ
    `${gregorianYear}-12-10`, // วันรัฐธรรมนูญ
    `${gregorianYear}-12-31`, // วันสิ้นปี
  ];

  // วันหยุดที่เปลี่ยนแปลงตามจันทรคติ (ต้องคำนวณหรืออัปเดตทุกปี)
  const lunarHolidays = getLunarHolidays(gregorianYear);

  // รวมวันหยุดทั้งหมด
  const allHolidays = [...fixedHolidays, ...lunarHolidays];

  // แปลงเป็น Date objects
  return allHolidays.map(dateStr => new Date(dateStr + 'T00:00:00'));
}

/**
 * วันหยุดตามจันทรคติ (ประมาณการ - ควรอัปเดตทุกปี)
 */
function getLunarHolidays(gregorianYear) {
  // วันหยุดที่เปลี่ยนตามปี (ตัวอย่าง - ควรใช้ API จริง)
  const lunarHolidaysMap = {
    2024: [
      '2024-02-24', // วันมาฆบูชา
      '2024-05-22', // วันวิสาขบูชา
      '2024-07-20', // วันอาสาฬหบูชา
      '2024-07-21', // วันเข้าพรรษา
    ],
    2025: [
      '2025-02-12', // วันมาฆบูชา
      '2025-04-13', // วันสงกรานต์ (ซ้ำกับ fixed)
      '2025-05-11', // วันวิสาขบูชา
      '2025-07-10', // วันอาสาฬหบูชา
      '2025-07-11', // วันเข้าพรรษา
    ],
    2026: [
      '2026-03-03', // วันมาฆบูชา
      '2026-05-31', // วันวิสาขบูชา
      '2026-07-29', // วันอาสาฬหบูชา
      '2026-07-30', // วันเข้าพรรษา
    ],
    2027: [
      '2027-02-20', // วันมาฆบูชา
      '2027-05-20', // วันวิสาขบูชา
      '2027-07-18', // วันอาสาฬหบูชา
      '2027-07-19', // วันเข้าพรรษา
    ],
  };

  return lunarHolidaysMap[gregorianYear] || [];
}

/**
 * ตรวจสอบว่าวันที่กำหนดเป็นวันหยุดราชการหรือไม่
 * @param {Date} date - วันที่ต้องการตรวจสอบ
 * @param {Array} holidays - Array ของวันหยุด
 * @returns {boolean}
 */
function isPublicHoliday(date, holidays) {
  const dateStr = formatDateToString(date);
  return holidays.some(holiday => {
    const holidayStr = formatDateToString(holiday);
    return dateStr === holidayStr;
  });
}

/**
 * ตรวจสอบว่าเป็นวันเสาร์หรืออาทิตย์
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = อาทิตย์, 6 = เสาร์
}

/**
 * คำนวณจำนวนวันทำงานระหว่างสองวันที่
 * (ไม่นับวันเสาร์-อาทิตย์และวันหยุดราชการ)
 * @param {Date} startDate - วันเริ่มต้น
 * @param {Date} endDate - วันสิ้นสุด
 * @returns {Promise<number>} - จำนวนวันทำงาน
 */
async function calculateWorkingDays(startDate, endDate) {
  // ตรวจสอบ input
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error('Start date and end date must be Date objects');
  }

  if (startDate > endDate) {
    return 0;
  }

  // ดึงวันหยุดของทุกปีที่เกี่ยวข้อง
  const years = getYearsBetweenDates(startDate, endDate);
  const allHolidays = [];

  for (const year of years) {
    const yearHolidays = await fetchThaiPublicHolidays(year);
    allHolidays.push(...yearHolidays);
  }

  // นับวันทำงาน
  let workingDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // ถ้าไม่ใช่วันหยุดและไม่ใช่วันเสาร์-อาทิตย์
    if (!isWeekend(currentDate) && !isPublicHoliday(currentDate, allHolidays)) {
      workingDays++;
    }

    // เลื่อนไปวันถัดไป
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * คำนวณวันรวม (ทุกวันรวมเสาร์-อาทิตย์และวันหยุด)
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
function calculateTotalDays(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error('Start date and end date must be Date objects');
  }

  if (startDate > endDate) {
    return 0;
  }

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 เพื่อนับวันสิ้นสุดด้วย

  return diffDays;
}

/**
 * Helper: แปลง Date เป็น string YYYY-MM-DD
 */
function formatDateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: หาปี พ.ศ. ทั้งหมดที่อยู่ระหว่างสองวันที่
 */
function getYearsBetweenDates(startDate, endDate) {
  const years = new Set();
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const buddhistYear = currentDate.getFullYear() + 543;
    years.add(buddhistYear);
    currentDate.setFullYear(currentDate.getFullYear() + 1);
  }

  return Array.from(years);
}

/**
 * ล้าง cache (สำหรับการทดสอบหรือรีเฟรชข้อมูล)
 */
function clearHolidayCache() {
  holidayCache.clear();
}

/**
 * รายละเอียดการคำนวณวันลา
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
async function getLeaveDetails(startDate, endDate) {
  const totalDays = calculateTotalDays(startDate, endDate);
  const workingDays = await calculateWorkingDays(startDate, endDate);

  // ดึงวันหยุดที่เกี่ยวข้อง
  const years = getYearsBetweenDates(startDate, endDate);
  const allHolidays = [];

  for (const year of years) {
    const yearHolidays = await fetchThaiPublicHolidays(year);
    allHolidays.push(...yearHolidays);
  }

  // นับวันเสาร์-อาทิตย์
  let weekends = 0;
  let publicHolidayCount = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isWeekend(currentDate)) {
      weekends++;
    } else if (isPublicHoliday(currentDate, allHolidays)) {
      publicHolidayCount++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    startDate: formatDateToString(startDate),
    endDate: formatDateToString(endDate),
    totalDays,
    workingDays,
    weekends,
    publicHolidays: publicHolidayCount,
    calculation: `${totalDays} วันทั้งหมด - ${weekends} วันหยุดสุดสัปดาห์ - ${publicHolidayCount} วันหยุดนักขัตฤกษ์ = ${workingDays} วันทำงาน`
  };
}

module.exports = {
  fetchThaiPublicHolidays,
  calculateWorkingDays,
  calculateTotalDays,
  getLeaveDetails,
  isWeekend,
  isPublicHoliday,
  clearHolidayCache,
  formatDateToString
};
