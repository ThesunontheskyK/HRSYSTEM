// ต้องมี common.js loaded ก่อน
let currentUser = null;
let allRequests = [];
let currentFilter = 'all';
let isMobileView = false;

// เริ่มต้นระบบ
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    try {
        // ตรวจสอบการเข้าสู่ระบบ
        currentUser = checkLogin(); // ใช้จาก common.js
        if (!currentUser) return;

        // ตรวจสอบขนาดหน้าจอ
        checkViewportSize();
        
        // ตั้งค่า responsive listeners
        setupResponsiveListeners();

        // โหลดข้อมูลผู้ใช้
        await loadUserInfo(currentUser.userid, true); // ใช้จาก common.js (isAdmin = true)

        // โหลดคำร้องของผู้ใช้
        await loadUserRequests();

    } catch (error) {
        handleError(error, 'เกิดข้อผิดพลาดในการโหลดระบบ'); // ใช้จาก common.js
    }
}

// ตรวจสอบขนาดหน้าจอและตั้งค่า view mode
function checkViewportSize() {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    isMobileView = mediaQuery.matches;
    
    // แสดง/ซ่อน elements ตามขนาดหน้าจอ
    updateViewMode();
    
    return isMobileView;
}

// อัปเดต view mode
function updateViewMode() {
    const desktopTable = document.getElementById('requestsTable');
    const mobileCards = document.getElementById('mobileCards');
    
    if (isMobileView) {
        if (desktopTable) desktopTable.style.display = 'none';
        if (mobileCards) mobileCards.style.display = 'block';
    } else {
        if (desktopTable) desktopTable.style.display = 'table';
        if (mobileCards) mobileCards.style.display = 'none';
    }
}

// ตั้งค่า responsive event listeners
function setupResponsiveListeners() {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    function handleMediaChange(e) {
        isMobileView = e.matches;
        updateViewMode();
        
        // รีเรนเดอร์ข้อมูลตาม view mode ใหม่
        displayRequests();
    }
    
    // ใช้ addEventListener แทน addListener (deprecated)
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
    } else {
        // Fallback สำหรับเบราว์เซอร์เก่า
        mediaQuery.addListener(handleMediaChange);
    }
    
    // เรียกใช้ครั้งแรก
    handleMediaChange(mediaQuery);
    
    // เพิ่ม resize listener
    window.addEventListener('resize', debounce(() => {
        checkViewportSize();
        displayRequests();
    }, 250));
}

// Debounce function เพื่อลดการเรียก resize handler
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

// โหลดคำร้องของผู้ใช้
async function loadUserRequests() {
    showLoading(true, 'กำลังโหลดคำร้อง...'); // ใช้จาก common.js

    try {
        const res = await fetch(`/api/userrequest/${currentUser.userid}`);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const response = await res.json();

        // รองรับทั้ง format เก่า (array) และ format ใหม่ ({ success: true, data: [...] })
        const leaveHistory = response.success ? response.data : response;

        // ตรวจสอบว่า leaveHistory เป็น array
        if (!Array.isArray(leaveHistory)) {
            throw new Error('Invalid response format: leaveHistory is not an array');
        }

        // แปลงข้อมูลจาก leave_history ให้ตรงกับรูปแบบที่ใช้
        allRequests = leaveHistory.map(leave => ({
            id: `REQ-${leave.id}`,
            title: getLeaveTypeText(leave.leave_type), // ใช้จาก common.js
            submit_date: leave.start_date,
            status: mapLeaveStatus(leave.status),
            approveby: leave.approvername || null,
            approval_date: leave.approved_date || null,
            end_date: leave.end_date,
            reason: leave.reason,
            days_count: calculateDaysBetween(leave.start_date, leave.end_date)
        }));

        // อัปเดต UI
        updateCounts();
        displayRequests();

    } catch (error) {
        handleError(error, 'เกิดข้อผิดพลาดในการโหลดข้อมูล'); // ใช้จาก common.js
        allRequests = [];
        updateCounts();
        displayRequests();
    } finally {
        showLoading(false); // ใช้จาก common.js
    }
}

// คำนวณจำนวนวันระหว่างวันที่
function calculateDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 1;
    
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    } catch (error) {
        return 1;
    }
}

// แปลงสถานะจากฐานข้อมูลให้ตรงกับระบบ
function mapLeaveStatus(dbStatus) {
    const statusMap = {
        'pending': 'pending',
        'approved': 'approved',
        'rejected': 'rejected',
        'รอดำเนินการ': 'pending',
        'อนุมัติ': 'approved',
        'ปฏิเสธ': 'rejected',
    };
    return statusMap[dbStatus] || 'pending';
}

// อัปเดตจำนวนในแต่ละแท็บ
function updateCounts() {
    const all = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    document.getElementById('allCount').textContent = all;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('approvedCount').textContent = approved;
    document.getElementById('rejectedCount').textContent = rejected;
}

// กรองตามสถานะ
function filterByStatus(status) {
    currentFilter = status;

    // อัปเดตแท็บที่เลือก
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-status="${status}"]`).classList.add('active');

    // อัปเดตหัวข้อตาราง
    const titles = {
        'all': 'คำร้องทั้งหมด',
        'pending': 'คำร้องรอดำเนินการ',
        'approved': 'คำร้องที่อนุมัติแล้ว',
        'rejected': 'คำร้องที่ปฏิเสธ'
    };
    document.getElementById('currentStatusTitle').textContent = titles[status];

    displayRequests();
}

// แสดงคำร้อง (รองรับทั้ง desktop และ mobile)
function displayRequests() {
    // กรองข้อมูลตามสถานะ
    let filteredRequests = allRequests;
    if (currentFilter !== 'all') {
        filteredRequests = allRequests.filter(r => r.status === currentFilter);
    }

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    const tableEl = document.getElementById('requestsTable');
    const mobileCardsEl = document.getElementById('mobileCards');
    const emptyEl = document.getElementById('emptyState');

    if (filteredRequests.length === 0) {
        if (tableEl) tableEl.style.display = 'none';
        if (mobileCardsEl) mobileCardsEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    // แสดงตาม view mode
    if (isMobileView) {
        displayMobileCards(filteredRequests);
        if (tableEl) tableEl.style.display = 'none';
        if (mobileCardsEl) mobileCardsEl.style.display = 'block';
    } else {
        displayDesktopTable(filteredRequests);
        if (tableEl) tableEl.style.display = 'table';
        if (mobileCardsEl) mobileCardsEl.style.display = 'none';
    }
}

// แสดงตารางแบบ desktop
function displayDesktopTable(requests) {
    const tableBody = document.getElementById('requestsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = requests.map(request => `
        <tr class="fade-in" onclick="showRequestDetail('${request.id}')" style="cursor: pointer;">
            <td class="request-id">${request.id}</td>
            <td>
                ${request.title}
                ${request.days_count ? `<br><small style="color: #7f8c8d;">(${request.days_count} วัน)</small>` : ''}
            </td>
            <td>${formatDate(request.submit_date)}</td>
            <td>
                <span class="status-badge ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </td>
            <td>${request.approveby || '-'}</td>
            <td>${request.submit_date ? formatDate(request.submit_date) : '-'}</td>
        </tr>
    `).join('');
}

// แสดงการ์ดแบบ mobile
function displayMobileCards(requests) {
    const mobileCardsEl = document.getElementById('mobileCards');
    if (!mobileCardsEl) return;

    mobileCardsEl.innerHTML = requests.map(request => `
        <div class="mobile-card fade-in" onclick="showRequestDetail('${request.id}')">
            <div class="card-header">
                <div>
                    <h3 class="card-title">${request.title}</h3>
                    <div class="card-id">${request.id}</div>
                </div>
                <div class="card-status">
                    <span class="status-badge ${getStatusClass(request.status)}">
                        ${getStatusText(request.status)}
                    </span>
                </div>
            </div>
            
            <div class="card-info">
                <div class="info-item">
                    <div class="info-label">วันที่ส่ง</div>
                    <div class="info-value">${formatDate(request.submit_date)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">จำนวนวัน</div>
                    <div class="info-value">${request.days_count || 1} วัน</div>
                </div>
                ${request.approveby ? `
                    <div class="info-item">
                        <div class="info-label">ผู้อนุมัติ</div>
                        <div class="info-value">${request.approveby}</div>
                    </div>
                ` : ''}
                ${request.submit_date ? `
                    <div class="info-item">
                        <div class="info-label">วันที่เริ่มส่ง</div>
                        <div class="info-value">${formatDate(request.submit_date)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// แสดงรายละเอียดคำร้อง (Modal) - Responsive
function showRequestDetail(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showAlert('error', 'ไม่พบข้อมูลคำร้อง');
        return;
    }

    // แสดง notification เมื่อเปิดรายละเอียด
    showAlert('success', 'กำลังแสดงรายละเอียดคำร้อง ' + request.id);

    // สร้าง Modal แสดงรายละเอียด
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 20px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        position: relative;
    `;

    content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
            <h2 style="margin: 0; color: #2c3e50; font-size: 18px;">รายละเอียดคำร้อง</h2>
            <button onclick="this.closest('.modal').remove()" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #7f8c8d;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.3s;
            " onmouseover="this.style.backgroundColor='#f8f9fa'" 
               onmouseout="this.style.backgroundColor='transparent'">&times;</button>
        </div>
        
        <div style="space-y: 15px;">
            <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="color: #2c3e50; font-size: 16px;">${request.title}</strong>
                        <div style="font-size: 12px; color: #7f8c8d; margin-top: 2px;">${request.id}</div>
                    </div>
                    <span class="status-badge ${getStatusClass(request.status)}" style="margin: 0;">
                        ${getStatusText(request.status)}
                    </span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                    <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">วันที่เริ่มต้น</div>
                    <div style="font-weight: 500; color: #2c3e50;">${formatDate(request.submit_date)}</div>
                </div>
                
                ${request.end_date ? `
                    <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">วันที่สิ้นสุด</div>
                        <div style="font-weight: 500; color: #2c3e50;">${formatDate(request.end_date)}</div>
                    </div>
                ` : ''}
                
                <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                    <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">จำนวนวัน</div>
                    <div style="font-weight: 500; color: #2c3e50;">${request.days_count || 1} วัน</div>
                </div>
                
                ${request.approveby ? `
                    <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">ผู้อนุมัติ</div>
                        <div style="font-weight: 500; color: #2c3e50;">${request.approveby}</div>
                    </div>
                ` : ''}
                
                ${request.submit_date ? `
                    <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">วันที่เริ่มส่ง</div>
                        <div style="font-weight: 500; color: #2c3e50;">${formatDate(request.submit_date)}</div>
                    </div>
                ` : ''}
            </div>
            
            ${request.reason ? `
                <div style="margin-top: 20px;">
                    <div style="font-size: 14px; font-weight: 500; color: #2c3e50; margin-bottom: 8px;">เหตุผล</div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; line-height: 1.5;">
                        ${request.reason}
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div style="margin-top: 25px; text-align: center;">
            <button onclick="this.closest('.modal').remove()" style="
                background: #2c3e50;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                cursor: pointer;
                font-family: 'Prompt', sans-serif;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s;
            " onmouseover="this.style.backgroundColor='#34495e'"
               onmouseout="this.style.backgroundColor='#2c3e50'">ปิด</button>
        </div>
    `;

    modal.appendChild(content);
    modal.className = 'modal';
    document.body.appendChild(modal);

    // ป้องกันการเลื่อนหน้าจอเมื่อ modal เปิด
    document.body.style.overflow = 'hidden';

    // ปิด modal เมื่อคลิกนอกกรอบ
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
    });

    // ปิด modal เมื่อกด ESC
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // เมื่อ modal ถูกลบ ให้คืนการเลื่อนหน้าจอ
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node === modal) {
                        document.body.style.overflow = '';
                        observer.disconnect();
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true });

    // Focus ไปที่ปุ่มปิดเพื่อ accessibility
    setTimeout(() => {
        const closeButton = content.querySelector('button');
        if (closeButton) closeButton.focus();
    }, 100);
}