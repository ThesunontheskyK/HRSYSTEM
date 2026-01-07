let currentUser = null;
let allRequests = [];
let currentFilter = 'all';

// เริ่มต้นระบบ
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    try {
        // ตรวจสอบการเข้าสู่ระบบ
        currentUser = checkLogin();
        if (!currentUser) return;

        // โหลดข้อมูลผู้ใช้
        await loadUserInfo();

        // โหลดปีการศึกษาปัจจุบัน
        await loadCurrentAcademicYear();

        // โหลดคำร้องของผู้ใช้
        await loadUserRequests();

    } catch (error) {
        console.error('Error initializing app:', error);
        showError('เกิดข้อผิดพลาดในการโหลดระบบ');
    }
}

// ตรวจสอบการเข้าสู่ระบบ
function checkLogin() {
    try {
        const userString = localStorage.getItem('loggedInUser');
        if (!userString) {
            alert('กรุณาเข้าสู่ระบบก่อน');
            window.location.href = '/index.html';
            return null;
        }

        const user = JSON.parse(userString);
        if (!user.userid) {
            alert('ข้อมูลผู้ใช้ไม่ครบถ้วน กรุณาเข้าสู่ระบบใหม่');
            localStorage.removeItem('loggedInUser');
            window.location.href = '/index.html';
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error checking login:', error);
        localStorage.removeItem('loggedInUser');
        alert('เกิดข้อผิดพลาดกับข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        window.location.href = '/index.html';
        return null;
    }
}

// ฟังก์ชันซ่อน/แสดงเมนูสถานะคำร้องเฉพาะ head of subject
function setupMenuVisibility(userRole) {
    const headSubRequestsMenu = document.querySelector('a[href="headsubrequests.html"]');

    if (headSubRequestsMenu) {
        // แสดงเมนูเฉพาะ head of subject เท่านั้น
        if (userRole?.toLowerCase() === 'head_of_math' ||
            userRole?.toLowerCase() === 'head_of_eng' ||
            userRole?.toLowerCase() === 'head_of_computer' ||
            userRole?.toLowerCase() === 'head_of_sci' ||
            userRole?.toLowerCase() === 'head_of_social_studie' ||
            userRole?.toLowerCase() === 'head_of_thai') {
            headSubRequestsMenu.style.display = 'block';
        } else {
            // ซ่อนเมนูสำหรับ role อื่นๆ
            headSubRequestsMenu.style.display = 'none';
        }
    }
}

// โหลดข้อมูลผู้ใช้
async function loadUserInfo() {
    try {
        const res = await fetch(`/api/userinfo/${currentUser.userid}`);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const userInfo = await res.json();

        // อัปเดตข้อมูลในหน้า
        document.getElementById('username').textContent = `${userInfo.firstname} ${userInfo.lastname}`;
        document.getElementById('subjectname').textContent = userInfo.role_name || 'ไม่ระบุตำแหน่ง';
        const profileImgEl = document.getElementById('sidebarProfilePic');
        if (profileImgEl) {
            const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';
            profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
        }

        try {
            const currentUser2 = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            currentUser2.image = userInfo.image || '/uploads/default.png';
            localStorage.setItem('loggedInUser', JSON.stringify(currentUser2));
        } catch (_) { }

        // ตรวจสอบและตั้งค่าเมนูตาม role (เฉพาะ head of subject)
        setupMenuVisibility(userInfo.role_code);

        // บันทึก role ลงใน localStorage สำหรับใช้ในหน้าอื่น
        const currentUserData = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        currentUserData.role = userInfo.role_code;
        localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));

    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// โหลดคำร้องของผู้ใช้
async function loadUserRequests() {
    showLoading(true);

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
            throw new Error('Invalid response format');
        }

        // แปลงข้อมูลจาก leave_history ให้ตรงกับรูปแบบที่ใช้
        allRequests = leaveHistory.map(leave => ({
            id: `REQ-${leave.id}`,
            title: getLeaveTypeText(leave.leave_type),
            submit_date: leave.start_date, // ใช้ start_date เป็นวันที่ส่งคำร้อง
            status: mapLeaveStatus(leave.status),
            approveby: leave.approvername || null,
            approval_date: leave.submitted_at || null,
            // เก็บข้อมูลเพิ่มเติม
            end_date: leave.end_date,
            reason: leave.reason,
            // days_count: leave.days_count
        }));

        // อัปเดต UI
        updateCounts();
        displayRequests();

    } catch (error) {
        console.error('Error loading requests:', error);

        // แสดงข้อผิดพลาดให้ผู้ใช้
        showError(`เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}`);

        // ใช้ข้อมูลจำลองในกรณีเกิดข้อผิดพลาด (ถ้ามี)
        allRequests = [];
        updateCounts();
        displayRequests();

    } finally {
        showLoading(false);
    }
}

// แปลงประเภทการลาเป็นข้อความ
function getLeaveTypeText(leaveType) {
    const leaveTypes = {
        'sick': 'ขอลาป่วย',
        'personal': 'ขอลากิจ',
        'vacation': 'ขอลาพักผ่อน',
        'maternity': 'ขอลาคลอด',
        'emergency': 'ขอลาฉุกเฉิน',
        'study': 'ขอลาเพื่อการศึกษา',
        'training': 'ขอลาฝึกอบรม/สัมมนา',
        'other': 'อื่นๆ'
    };
    return leaveTypes[leaveType] || `ขอลา${leaveType}`;
}

// แปลงสถานะจากฐานข้อมูลให้ตรงกับระบบ
function mapLeaveStatus(dbStatus) {
    // แปลงสถานะจากฐานข้อมูลให้ตรงกับ UI
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

// แสดง Loading
function showLoading(show) {
    const loadingEl = document.getElementById('loadingState');
    const tableEl = document.getElementById('requestsTable');
    const emptyEl = document.getElementById('emptyState');

    if (show) {
        loadingEl.style.display = 'flex';
        tableEl.style.display = 'none';
        emptyEl.style.display = 'none';
    } else {
        loadingEl.style.display = 'none';
    }
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

// แสดงคำร้อง
function displayRequests() {
    const tableBody = document.getElementById('requestsTableBody');
    const tableEl = document.getElementById('requestsTable');
    const emptyEl = document.getElementById('emptyState');

    // กรองข้อมูลตามสถานะ
    let filteredRequests = allRequests;
    if (currentFilter !== 'all') {
        filteredRequests = allRequests.filter(r => r.status === currentFilter);
    }

    if (filteredRequests.length === 0) {
        tableEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }

    tableEl.style.display = 'table';
    emptyEl.style.display = 'none';

    tableBody.innerHTML = filteredRequests.map(request => `
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
                    <td>${request.approval_date ? formatDate(request.approval_date) : '-'}</td>
                </tr>
            `).join('');
}

// แสดงรายละเอียดคำร้อง (Modal)
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
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
    `;

    content.innerHTML = `
        <div style="background: #2c3e50; color: white; padding: 20px 25px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 500;">รายละเอียดคำร้อง</h2>
            <button onclick="this.closest('.modal').remove(); document.body.style.overflow = '';" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: white;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.3s;
            " onmouseover="this.style.backgroundColor='rgba(255,255,255,0.1)'"
               onmouseout="this.style.backgroundColor='transparent'">&times;</button>
        </div>

        <div style="padding: 25px;">
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

                ${request.approval_date ? `
                    <div style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
                        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px;">วันที่อนุมัติ</div>
                        <div style="font-weight: 500; color: #2c3e50;">${formatDate(request.approval_date)}</div>
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

        <div style="padding: 20px 25px; border-top: 1px solid #f0f0f0; text-align: center;">
            <button onclick="this.closest('.modal').remove(); document.body.style.overflow = '';" style="
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

// ข้อความสถานะ
function getStatusText(status) {
    const statusMap = {
        'pending': 'รอดำเนินการ',
        'approved': 'อนุมัติ',
        'rejected': 'ปฏิเสธ'
    };
    return statusMap[status] || status;
}

// คลาส CSS สำหรับสถานะ
function getStatusClass(status) {
    const classMap = {
        'pending': 'badge-pending status-pending',
        'approved': 'badge-approved status-approved',
        'rejected': 'badge-rejected status-rejected'
    };
    return classMap[status] || 'badge-pending';
}

// จัดรูปแบบวันที่
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

// แสดงข้อผิดพลาดและ notification แบบมาตรฐาน
function showError(message) {
    showAlert('error', message);
}

function showAlert(type, message, duration = 5000) {
    // ลบ notification เก่าออกก่อน
    const existingNotifications = document.querySelectorAll('.notification, .alert');
    existingNotifications.forEach(n => {
        if (n && n.parentNode) {
            n.parentNode.removeChild(n);
        }
    });

    // สร้าง notification ใหม่
    const notification = document.createElement('div');
    notification.className = `notification`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        max-width: 400px;
        transition: all 0.3s ease;
        ${type === 'success' ? 'background-color: #10b981;' :
          type === 'warning' ? 'background-color: #f59e0b;' :
          'background-color: #ef4444;'}
    `;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    notification.innerHTML = `
        <span style="margin-right: 10px; font-size: 16px;">${icons[type] || icons.error}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Auto hide
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, duration);
}

// โหลดปีการศึกษาปัจจุบัน
async function loadCurrentAcademicYear() {
    try {
        const response = await fetch('/api/academic-years/active', {
            credentials: 'include'
        });

        const yearElement = document.getElementById('currentAcademicYear');

        if (response.ok) {
            const year = await response.json();
            yearElement.textContent = year.year_name;
        } else {
            yearElement.textContent = 'ไม่ได้ระบุ';
            console.log('No active academic year found');
        }
    } catch (error) {
        console.error('Error loading academic year:', error);
        document.getElementById('currentAcademicYear').textContent = 'ไม่ได้ระบุ';
    }
}

// ออกจากระบบ
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}