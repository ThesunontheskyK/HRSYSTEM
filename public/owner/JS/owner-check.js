let currentUser = null;
let allAttendance = [];
let filteredAttendance = [];
let currentPage = 1;
let csvData = [];
let debugMode = false;
const recordsPerPage = 20;

// เริ่มต้นระบบ
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    try {

        
        // ตรวจสอบการเข้าสู่ระบบ
        currentUser = checkLoginStatus();
        if (!currentUser) return;



        // โหลดข้อมูลผู้ใช้
        await loadUserProfile();

        // ตั้งค่าวันที่เริ่มต้น (เดือนปัจจุบัน)
        setDefaultDates();

        // เพิ่ม event listeners
        setupEventListeners();

        // โหลดข้อมูลการเข้างาน
        await loadAttendanceData();

    } catch (error) {
        showError('เกิดข้อผิดพลาดในการโหลดระบบ: ' + error.message);
    }
}

// เช็คการ Login และสิทธิ์
function checkLoginStatus() {
    try {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        
        if (!user) {
            alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
            window.location.href = '/index.html';
            return null;
        }
        
        // ตรวจสอบว่าเป็น Owner หรือไม่
        if (user.loginType !== 'owner' && user.role_group !== 'owner') {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            localStorage.removeItem('loggedInUser');
            window.location.href = '/index.html';
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Error checking login status:', error);
        alert('เกิดข้อผิดพลาดในการตรวจสอบการเข้าสู่ระบบ');
        window.location.href = '/index.html';
        return null;
    }
}

// โหลดข้อมูลโปรไฟล์ผู้ใช้
async function loadUserProfile() {
    try {

        const response = await fetch(`/api/ownerinfo/${currentUser.userid}`, {
            credentials: 'include'
        });
        
        
        if (response.ok) {
            const userInfo = await response.json();
            document.getElementById('username').textContent = `${userInfo.firstname} ${userInfo.lastname}`;
        } else {
            document.getElementById('username').textContent = currentUser.firstname || 'Owner';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        document.getElementById('username').textContent = currentUser.firstname || 'Owner';
    }
}

// ตั้งค่าวันที่เริ่มต้น
function setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput) startDateInput.value = firstDay.toISOString().split('T')[0];
    if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
}

// ตั้งค่า Event Listeners
function setupEventListeners() {
    // Filter listeners
    document.getElementById('employeeSearch')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('startDate')?.addEventListener('change', applyFilters);
    document.getElementById('endDate')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);

    // CSV File input listeners
    const csvFile = document.getElementById('csvFile');
    const importSection = document.getElementById('importSection');

    if (csvFile) {
        csvFile.addEventListener('change', handleFileSelect);
    }
    
    if (importSection) {
        importSection.addEventListener('dragover', handleDragOver);
        importSection.addEventListener('drop', handleDrop);
        importSection.addEventListener('dragleave', handleDragLeave);
        importSection.addEventListener('dragenter', handleDragOver);
    }
}

// โหลดข้อมูลการเข้างาน - แก้ไขให้ใช้ API ที่ถูกต้อง
async function loadAttendanceData() {

    showLoading(true, 'กำลังโหลดข้อมูลการเข้างาน...');

    try {
        // ใช้ API ที่เฉพาะสำหรับ Owner
        const response = await fetch('/api/adminattendance', {
            credentials: 'include' // ส่ง session cookie ไปด้วย
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Response error:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลได้');
        }

        const data = result.data || [];
        
        allAttendance = data.map(record => ({
            id: record.id,
            userid: record.userid,
            firstname: record.firstname,
            lastname: record.lastname,
            role_code: record.role_code,
            role_name: record.role_name,
            date: record.date,
            timein: record.timeIn,
            timeout: record.timeOut,
            hours: record.hours,
            status: record.status,
            note: record.note || '-'
        }));

        // เริ่มต้นด้วยข้อมูลทั้งหมด
        filteredAttendance = [...allAttendance];
        currentPage = 1;

        // ตรวจสอบว่ามีตัวกรองหรือไม่
        const hasFilters = document.getElementById('employeeSearch')?.value ||
                          document.getElementById('statusFilter')?.value ||
                          document.getElementById('startDate')?.value ||
                          document.getElementById('endDate')?.value;

        if (hasFilters) {
            // ถ้ามีตัวกรอง ให้ใช้ฟังก์ชัน applyFilters เพื่อกรองข้อมูล
            applyFilters();
        } else {
            // ถ้าไม่มีตัวกรอง แสดงข้อมูลทั้งหมด
            updateStats();
            displayAttendanceData();
            updatePagination();
        }

    } catch (error) {
        console.error('Error loading attendance data:', error);
        showError('เกิดข้อผิดพลาดในการโหลดข้อมูลการเข้างาน: ' + error.message);
        allAttendance = [];
        filteredAttendance = [];
        updateStats();
        displayAttendanceData();
    } finally{
        showLoading(false);
    }
}

// อัปเดตสถิติ
function updateStats() {
    try {
        const total = filteredAttendance.length;
        const present = filteredAttendance.filter(r => r.status === 'present').length;
        const late = filteredAttendance.filter(r => r.status === 'late').length;
        const absent = filteredAttendance.filter(r => r.status === 'absent').length;
        const leave = filteredAttendance.filter(r => r.status === 'leave').length;

        document.getElementById('totalDays').textContent = total;
        document.getElementById('presentDays').textContent = present;
        document.getElementById('lateDays').textContent = late;
        document.getElementById('absentDays').textContent = absent;
        document.getElementById('leaveDays').textContent = leave;
        
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// แสดงข้อมูลการเข้างาน
function displayAttendanceData() {
    try {
        const tableBody = document.getElementById('attendanceTableBody');
        const tableEl = document.getElementById('attendanceTable');
        const emptyEl = document.getElementById('emptyState');

        // คำนวณข้อมูลสำหรับหน้าปัจจุบัน
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        const pageData = filteredAttendance.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            tableEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        tableEl.style.display = 'table';
        emptyEl.style.display = 'none';

        const tableHTML = pageData.map(record => `
            <tr class="fade-in">
                <td>${formatDate(record.date)}</td>
                <td>
                    <div class="employee-name">${record.firstname} ${record.lastname}</div>
                    <div class="employee-role">${record.role_name || record.role_code}</div>
                </td>
                <td class="time-cell">${formatTime(record.timein)}</td>
                <td class="time-cell">${formatTime(record.timeout)}</td>
                <td class="time-cell">${record.hours || calculateWorkHours(record.timein, record.timeout)}</td>
                <td>
                    <span class="status-badge status-${record.status}">
                        ${getStatusText(record.status)}
                    </span>
                </td>
                <td>${record.note}</td>
            </tr>
        `).join('');

        tableBody.innerHTML = tableHTML;

    } catch (error) {
        console.error('Error displaying attendance data:', error);
    }
}

// ใช้ตัวกรอง
function applyFilters() {
    try {
        const employeeSearch = document.getElementById('employeeSearch')?.value?.toLowerCase().trim() || '';
        const startDate = document.getElementById('startDate')?.value || '';
        const endDate = document.getElementById('endDate')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        filteredAttendance = allAttendance.filter(record => {
            // กรองตามชื่อพนักงาน
            const fullName = `${record.firstname} ${record.lastname}`.toLowerCase();
            const matchesEmployee = !employeeSearch || fullName.includes(employeeSearch);

            // กรองตามวันที่
            const recordDate = record.date;
            const matchesStartDate = !startDate || recordDate >= startDate;
            const matchesEndDate = !endDate || recordDate <= endDate;

            // กรองตามสถานะ
            const matchesStatus = !statusFilter || record.status === statusFilter;

            return matchesEmployee && matchesStartDate && matchesEndDate && matchesStatus;
        });

        // รีเซ็ตหน้าเป็น 1 เมื่อกรองข้อมูล
        currentPage = 1;
        
        updateStats();
        displayAttendanceData();
        updatePagination();

    } catch (error) {
        console.error('Error applying filters:', error);
    }
}

// รีเซ็ตตัวกรอง
function resetFilters() {
    try {
        document.getElementById('employeeSearch').value = '';
        document.getElementById('statusFilter').value = '';
        
        // รีเซ็ตวันที่เป็นค่าเริ่มต้น
        setDefaultDates();
        
        filteredAttendance = [...allAttendance];
        currentPage = 1;
        
        updateStats();
        displayAttendanceData();
        updatePagination();
        showNotification('รีเซ็ตตัวกรองเรียบร้อยแล้ว', 'success');
    } catch (error) {
        console.error('Error resetting filters:', error);
    }
}

// อัปเดต pagination
function updatePagination() {
    try {
        const totalPages = Math.ceil(filteredAttendance.length / recordsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (!pagination) return;

        pagination.innerHTML = '';

        // ปุ่มก่อนหน้า
        const prevBtn = document.createElement('button');
        prevBtn.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.innerHTML = '<i class="mdi mdi-chevron-left"></i> ก่อนหน้า';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => changePage(-1);
        pagination.appendChild(prevBtn);

        // ปุ่มหน้า
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => goToPage(i);
            pagination.appendChild(pageBtn);
        }

        // ปุ่มถัดไป
        const nextBtn = document.createElement('button');
        nextBtn.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.innerHTML = 'ถัดไป <i class="mdi mdi-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => changePage(1);
        pagination.appendChild(nextBtn);

        // แสดงข้อมูล pagination
        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `หน้า ${currentPage} จาก ${totalPages} (รวม ${filteredAttendance.length} รายการ)`;
        pagination.appendChild(pageInfo);
    } catch (error) {
        console.error('Error updating pagination:', error);
    }
}

// เปลี่ยนหน้า
function changePage(direction) {
    const totalPages = Math.ceil(filteredAttendance.length / recordsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayAttendanceData();
        updatePagination();
    }
}

// ไปหน้าที่ระบุ
function goToPage(page) {
    const totalPages = Math.ceil(filteredAttendance.length / recordsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayAttendanceData();
        updatePagination();
    }
}

// รีเฟรชข้อมูล
async function refreshData() {
    await loadAttendanceData();
    showNotification('รีเฟรชข้อมูลเรียบร้อยแล้ว', 'success');
}

// ส่งออกข้อมูล
function exportData() {
    try {
        if (filteredAttendance.length === 0) {
            showNotification('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
            return;
        }

        // สร้าง CSV content
        const headers = ['วันที่', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'เวลาเข้างาน', 'เวลาออกงาน', 'ชั่วโมงทำงาน', 'สถานะ', 'หมายเหตุ'];
        
        let csvContent = '\ufeff' + headers.join(',') + '\n';
        
        filteredAttendance.forEach(record => {
            const row = [
                formatDate(record.date),
                `"${record.firstname} ${record.lastname}"`,
                `"${record.role_name || record.role_code}"`,
                formatTime(record.timein),
                formatTime(record.timeout),
                record.hours || calculateWorkHours(record.timein, record.timeout),
                getStatusText(record.status),
                `"${record.note}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('ส่งออกข้อมูลเรียบร้อยแล้ว', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showError('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
}

// ดาวน์โหลดไฟล์ตัวอย่าง
function downloadSample() {
    const sampleData = [
        ['userid', 'status', 'note', 'timein', 'timeout'],
        ['1', 'present', 'เข้างานปกติ', '2025-07-22 08:30:00', '2025-07-22 17:30:00'],
        ['2', 'late', 'มาสาย 15 นาที', '2025-07-22 08:45:00', '2025-07-22 17:30:00'],
        ['3', 'absent', 'ขาดงาน', '', ''],
        ['4', 'leave', 'ลาป่วย', '', '']
    ];

    let csvContent = '\ufeff';
    sampleData.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'attendance_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('ดาวน์โหลดไฟล์ตัวอย่างเรียบร้อยแล้ว', 'success');
}

// ===== CSV Import Functions =====

// จัดการการเลือกไฟล์
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (validateFile(file)) {
            readCSVFile(file);
        } else {
            showError('กรุณาเลือกไฟล์ CSV หรือ TXT เท่านั้น');
            event.target.value = '';
        }
    }
}

// ตรวจสอบรูปแบบไฟล์
function validateFile(file) {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'];
    const validExtensions = ['.csv', '.txt'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension && !allowedTypes.includes(file.type)) {
        return false;
    }
    
    // ตรวจสอบขนาดไฟล์ (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)');
        return false;
    }
    
    return true;
}

// จัดการ Drag & Drop
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('importSection').classList.add('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('importSection').classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (validateFile(file)) {
            readCSVFile(file);
        } else {
            showError('กรุณาเลือกไฟล์ CSV หรือ TXT เท่านั้น');
        }
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        document.getElementById('importSection').classList.remove('drag-over');
    }
}

// อ่านไฟล์ CSV
function readCSVFile(file) {
    showLoading(true, 'กำลังอ่านไฟล์...');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            parseCSV(csvText);
        } catch (error) {
            console.error('Error reading file:', error);
            showError('เกิดข้อผิดพลาดในการอ่านไฟล์');
        } finally {
            showLoading(false);
        }
    };
    
    reader.onerror = function() {
        showLoading(false);
        showError('เกิดข้อผิดพลาดในการอ่านไฟล์');
    };
    
    reader.readAsText(file, 'UTF-8');
}

// แปลง CSV
function parseCSV(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        const data = [];

        if (lines.length === 0) {
            showError('ไฟล์ว่างเปล่า');
            return;
        }

        // ตรวจสอบ header
        const firstLine = lines[0].toLowerCase().trim();
        const hasHeader = ['userid', 'status', 'timein'].some(keyword => firstLine.includes(keyword));
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = parseCSVLine(line);

            // ส่งข้อมูลทั้งหมดไปให้ backend ตรวจสอบ (ไม่กรองที่ frontend)
            if (columns.length >= 3) {
                // รับข้อมูลตามที่มี แม้จะไม่ครบก็ส่งไป
                const userid = columns[0] ? String(columns[0]).trim() : '';
                const status = columns[1] ? String(columns[1]).trim() : '';
                const note = columns[2] ? String(columns[2]).trim() : '';
                const timein = columns[3] ? formatDateTime(columns[3], false) : '';
                const timeout = columns.length > 4 && columns[4] ? formatDateTime(columns[4], true) : null;

                // เพิ่มข้อมูลทั้งหมด (backend จะเป็นคนตรวจสอบ)
                data.push({ userid, status, note, timein, timeout });
            }
        }

        if (data.length > 0) {
            csvData = data;
            displayPreview(data);
            showNotification(`อ่านไฟล์สำเร็จ พบข้อมูล ${data.length} รายการ (ระบบจะตรวจสอบความถูกต้องเมื่อนำเข้า)`, 'info');
        } else {
            showError('ไม่พบข้อมูลในไฟล์ หรือรูปแบบไฟล์ไม่ถูกต้อง');
        }

    } catch (error) {
        console.error('Error parsing CSV:', error);
        showError('เกิดข้อผิดพลาดในการแปลงไฟล์ CSV: ' + error.message);
    }
}

// แปลงบรรทัด CSV
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result;
}

// แปลงรูปแบบวันที่
function formatDateTime(dateStr, isEndTime = false) {
    if (!dateStr || dateStr.trim() === '' || dateStr.trim() === '-') {
        return null;
    }
    
    dateStr = dateStr.trim();
    
    // เวลาอย่างเดียว
    const timeOnlyMatch = dateStr.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
    if (timeOnlyMatch) {
        const now = new Date();
        const hours = parseInt(timeOnlyMatch[1]);
        const minutes = parseInt(timeOnlyMatch[2]);
        const seconds = timeOnlyMatch[4] ? parseInt(timeOnlyMatch[4]) : 0;
        
        now.setHours(hours, minutes, seconds, 0);
        return now.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    let date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
        // รูปแบบ DD/MM/YYYY HH:MM
        const dateTimeMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?$/);
        if (dateTimeMatch) {
            const day = parseInt(dateTimeMatch[1]);
            const month = parseInt(dateTimeMatch[2]) - 1;
            const year = parseInt(dateTimeMatch[3]);
            const hours = parseInt(dateTimeMatch[4]);
            const minutes = parseInt(dateTimeMatch[5]);
            const seconds = dateTimeMatch[7] ? parseInt(dateTimeMatch[7]) : 0;
            
            date = new Date(year, month, day, hours, minutes, seconds);
        }
        
        // รูปแบบ DD/MM/YYYY
        const dateOnlyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dateOnlyMatch) {
            const day = parseInt(dateOnlyMatch[1]);
            const month = parseInt(dateOnlyMatch[2]) - 1;
            const year = parseInt(dateOnlyMatch[3]);
            
            if (isEndTime) {
                date = new Date(year, month, day, 17, 30, 0);
            } else {
                date = new Date(year, month, day, 8, 30, 0);
            }
        }
    }
    
    if (isNaN(date.getTime())) {
        return null;
    }
    
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// แสดงตัวอย่างข้อมูล
function displayPreview(data) {
    const previewTableBody = document.getElementById('previewTableBody');
    const importPreview = document.getElementById('importPreview');
    
    if (!previewTableBody || !importPreview) return;
    
    previewTableBody.innerHTML = '';
    
    const previewData = data.slice(0, 5);
    
    previewData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.userid}</td>
            <td><span class="status-badge status-${row.status}">${getStatusText(row.status)}</span></td>
            <td>${row.note || '-'}</td>
            <td>${formatDisplayTime(row.timein)}</td>
            <td>${formatDisplayTime(row.timeout)}</td>
        `;
        previewTableBody.appendChild(tr);
    });
    
    // แสดงข้อมูลสรุป
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'import-summary';
    summaryDiv.innerHTML = `
        <strong>สรุปข้อมูล:</strong> ${data.length} รายการ<br>
        ${data.length > 5 ? `<small>แสดงตัวอย่าง 5 รายการแรก (ทั้งหมด ${data.length} รายการ)</small>` : ''}
    `;

    const existingSummary = importPreview.querySelector('.import-summary');
    if (existingSummary) {
        existingSummary.remove();
    }

    // แก้ไข: insertBefore ต้องใช้กับ direct child - ใช้ .table-container แทน table
    const tableContainer = importPreview.querySelector('.table-container');
    if (tableContainer) {
        importPreview.insertBefore(summaryDiv, tableContainer);
    } else {
        importPreview.appendChild(summaryDiv);
    }

    importPreview.style.display = 'block';
}

// Flag เพื่อป้องกันการ import ซ้ำ
let isImporting = false;

// นำเข้าข้อมูล CSV - แก้ไขให้ใช้ API ที่ถูกต้อง
async function importCsvData() {
    if (csvData.length === 0) {
        showError('ไม่มีข้อมูลสำหรับนำเข้า');
        return;
    }

    // ป้องกันการเรียกซ้ำ
    if (isImporting) {
        console.log('⚠️ กำลังนำเข้าข้อมูลอยู่ กรุณารอสักครู่...');
        return;
    }

    try {
        isImporting = true;
        showLoading(true, `กำลังบันทึกข้อมูล ${csvData.length} รายการ...`);

        // ใช้ API ที่เฉพาะสำหรับ Owner
        const response = await fetch('/api/owner/attendance/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // ส่ง session cookie ไปด้วย
            body: JSON.stringify({ data: csvData })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            const importedCount = result.imported || 0;
            const failedCount = result.failed || 0;
            const successRecords = result.successRecords || [];
            const errors = result.errors || [];

            // แสดง modal ผลลัพธ์
            showImportResultModal(importedCount, failedCount, successRecords, errors);

            cancelImport();

            // รีเซ็ตตัวกรองก่อนโหลดข้อมูลใหม่ เพื่อให้แสดงข้อมูลทั้งหมด
            document.getElementById('employeeSearch').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';

            // โหลดข้อมูลใหม่
            await loadAttendanceData();

        } else {
            showError(result.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        }

    } catch (error) {
        console.error('Error importing data:', error);
        showError('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + error.message);
    } finally {
        isImporting = false;
        showLoading(false);
    }
}

// ยกเลิกการนำเข้า
function cancelImport() {
    csvData = [];
    const csvFileInput = document.getElementById('csvFile');
    const importPreview = document.getElementById('importPreview');
    const importSection = document.getElementById('importSection');
    
    if (csvFileInput) csvFileInput.value = '';
    if (importPreview) importPreview.style.display = 'none';
    if (importSection) importSection.classList.remove('drag-over');
}

// ===== Helper Functions =====

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function formatTime(timeString) {
    if (!timeString) return '-';
    try {
        if (timeString.includes(':')) {
            return timeString;
        }
        const date = new Date(`1970-01-01 ${timeString}`);
        return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return timeString;
    }
}

function formatDisplayTime(timeStr) {
    if (!timeStr) return '-';
    try {
        const date = new Date(timeStr);
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return timeStr;
    }
}

function calculateWorkHours(timein, timeout) {
    if (!timein || !timeout) return '-';
    try {
        const start = new Date(`1970-01-01 ${timein}`);
        const end = new Date(`1970-01-01 ${timeout}`);
        const diff = end - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } catch (error) {
        return '-';
    }
}

function getStatusText(status) {
    const statuses = {
        'present': 'มาทำงาน',
        'late': 'มาสาย',
        'absent': 'ขาดงาน',
        'leave': 'ลา'
    };
    return statuses[status] || status;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(show, message = 'กำลังโหลดข้อมูล...') {
    const loadingEl = document.getElementById('loadingState');
    const tableEl = document.getElementById('attendanceTable');
    const emptyEl = document.getElementById('emptyState');
    
    if (show) {
        loadingEl.style.display = 'flex';
        loadingEl.querySelector('span').textContent = message;
        tableEl.style.display = 'none';
        emptyEl.style.display = 'none';
    } else {
        loadingEl.style.display = 'none';
    }
}

function showError(message) {
    console.error('Error:', message);
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const colors = {
        'success': '#4CAF50',
        'error': '#f44336',
        'info': '#2196F3',
        'warning': '#ff9800'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-weight: 500;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Show different sections
function showSection(section) {
    const sectionNames = {
        'finance': 'การเงิน',
        'reports': 'รายงาน',
        'settings': 'ตั้งค่าระบบ'
    };
    
    const sectionName = sectionNames[section] || section;
    showNotification(`🚧 ระบบ${sectionName}กำลังอยู่ระหว่างการพัฒนา`, 'info');
}

// ฟังก์ชัน logout
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}

// ===== Import Result Modal Functions =====

// แสดง modal ผลลัพธ์การนำเข้า
function showImportResultModal(successCount, failedCount, successRecords, errors) {
    // อัพเดตจำนวน
    document.getElementById('successCount').textContent = successCount;
    document.getElementById('failedCount').textContent = failedCount;

    // แสดงข้อมูลที่สำเร็จ
    const successTableBody = document.getElementById('successTableBody');
    successTableBody.innerHTML = '';

    if (successRecords && successRecords.length > 0) {
        successRecords.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.index}</td>
                <td>${record.userid}</td>
                <td>${record.employeeName}</td>
                <td><span class="status-badge status-${record.status}">${getStatusText(record.status)}</span></td>
                <td>${formatDate(record.date)}</td>
                <td>
                    <span class="action-badge action-${record.action}">
                        ${record.action === 'inserted' ? 'เพิ่มใหม่' : 'อัพเดท'}
                    </span>
                </td>
            `;
            successTableBody.appendChild(row);
        });
    } else {
        successTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">ไม่มีข้อมูลที่สำเร็จ</td></tr>';
    }

    // แสดงข้อมูลที่ล้มเหลว
    const failedTableBody = document.getElementById('failedTableBody');
    failedTableBody.innerHTML = '';

    if (errors && errors.length > 0) {
        errors.forEach(error => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${error.index}</td>
                <td>${error.record?.userid || '-'}</td>
                <td>${error.record?.status || '-'}</td>
                <td>${error.record?.timein || '-'}</td>
                <td>${error.record?.timeout || '-'}</td>
                <td class="error-message">${error.error}</td>
            `;
            failedTableBody.appendChild(row);
        });
    } else {
        failedTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">ไม่มีข้อมูลที่ล้มเหลว</td></tr>';
    }

    // แสดง modal
    document.getElementById('importResultModal').style.display = 'flex';

    // แสดง tab แรก (success)
    showImportTab('success');
}

// ปิด modal
function closeImportResultModal() {
    document.getElementById('importResultModal').style.display = 'none';
}

// สลับ tab
function showImportTab(tabName) {
    // ซ่อน tab ทั้งหมด
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // ลบ active class จากปุ่มทั้งหมด
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // แสดง tab ที่เลือก
    if (tabName === 'success') {
        document.getElementById('successTab').classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else if (tabName === 'failed') {
        document.getElementById('failedTab').classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}