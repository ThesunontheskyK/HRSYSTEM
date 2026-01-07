// ===============================
// ฟังก์ชันร่วมสำหรับทุกหน้า (แก้ไขปัญหาแล้ว)
// ===============================

// ตรวจสอบว่า DOM โหลดเสร็จแล้วหรือไม่
function waitForDOM(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// ตรวจสอบการเข้าสู่ระบบ (Standard)
function checkLogin() {
    try {
        const userString = localStorage.getItem('loggedInUser');
        if (!userString) {
            alert('กรุณาเข้าสู่ระบบก่อน');
            window.location.href = '/index.html';
            return null;
        }

        const user = JSON.parse(userString);
        
        // ตรวจสอบว่าข้อมูลผู้ใช้ครบถ้วน
        if (!user.userid || !user.email) {
            alert('ข้อมูลผู้ใช้ไม่ครบถ้วน กรุณาเข้าสู่ระบบใหม่');
            localStorage.removeItem('loggedInUser');
            window.location.href = '/index.html';
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('loggedInUser');
        alert('เกิดข้อผิดพลาดกับข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        window.location.href = '/index.html';
        return null;
    }
}

// โหลดข้อมูลผู้ใช้ (Standard)
async function loadUserInfo(userId, isAdmin = false) {
  try {
    const endpoint = isAdmin ? `/api/admininfo/${userId}` : `/api/userinfo/${userId}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const userInfo = await res.json();

    // ✅ อัปเดตรูปในเมนูบาร์หลังมี userInfo แล้ว
    const profileImgEl = document.getElementById('sidebarProfilePic');
    if (profileImgEl) {
      const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';
      profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }

    updateUserDisplay(userInfo);
    // เก็บลง localStorage เผื่อหน้าอื่นใช้ต่อ
    const currentUser2 = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    currentUser2.image = userInfo.image || '/uploads/default.png';
    localStorage.setItem('loggedInUser', JSON.stringify(currentUser2));

    return userInfo;
  } catch (error) {
    console.error('ดึงข้อมูลผู้ใช้ล้มเหลว:', error);
    alert('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้');
    return null;
  }
}

// อัปเดตการแสดงข้อมูลผู้ใช้
function updateUserDisplay(userInfo) {
    const elements = {
        'userInfo': `
            <strong>ชื่อ:</strong> ${userInfo.firstname} ${userInfo.lastname} | 
            <strong>อีเมล:</strong> ${userInfo.email} | 
            <strong>ตำแหน่ง:</strong> ${userInfo.role_name || 'ไม่ระบุ'}
        `,
        'username': `${userInfo.firstname} ${userInfo.lastname}`,
        'subjectname': userInfo.role_name || 'ไม่ระบุตำแหน่ง',
        'rename': `${userInfo.firstname} ${userInfo.lastname}`,
        'reid': "SJT-"+userInfo.userid,
        'repo': userInfo.role_name,
        'recount': `${userInfo.leave_count || 0} ครั้ง`
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'userInfo') {
                element.innerHTML = elements[id];
            } else {
                element.textContent = elements[id];
            }
        }
    });
}

// ===============================
// UNIFIED NOTIFICATION SYSTEM
// ===============================

/**
 * แสดงข้อความแจ้งเตือน (Unified)
 * @param {string} type - ประเภท: 'success', 'error', 'warning', 'info'
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @param {number} duration - ระยะเวลาแสดง (มิลลิวินาที)
 */
function showAlert(type, message, duration = 5000) {
    // ลบ notification เก่าออกก่อน
    const existingNotifications = document.querySelectorAll('.notification, .alert, .toast-notification');
    existingNotifications.forEach(n => {
        if (n && n.parentNode) {
            n.parentNode.removeChild(n);
        }
    });

    // กำหนดสีและไอคอนตาม type
    const config = {
        success: {
            bg: '#10b981',
            icon: '✅',
            iconColor: '#fff'
        },
        error: {
            bg: '#ef4444',
            icon: '❌',
            iconColor: '#fff'
        },
        warning: {
            bg: '#f59e0b',
            icon: '⚠️',
            iconColor: '#fff'
        },
        info: {
            bg: '#3b82f6',
            icon: 'ℹ️',
            iconColor: '#fff'
        }
    };

    const currentConfig = config[type] || config.info;

    // สร้าง notification ใหม่
    const notification = document.createElement('div');
    notification.className = `notification toast-notification`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        color: white;
        font-weight: 500;
        font-size: 15px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 450px;
        min-width: 300px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: slideIn 0.3s ease-out;
        background: ${currentConfig.bg};
    `;

    notification.innerHTML = `
        <span style="font-size: 20px; flex-shrink: 0;">${currentConfig.icon}</span>
        <span style="flex: 1; line-height: 1.4;">${message}</span>
        <button onclick="this.parentElement.remove()"
                style="background: none; border: none; color: white; cursor: pointer;
                       font-size: 20px; padding: 0; margin-left: 8px; opacity: 0.8;
                       transition: opacity 0.2s;"
                onmouseover="this.style.opacity='1'"
                onmouseout="this.style.opacity='0.8'"
                aria-label="ปิด">×</button>
    `;

    document.body.appendChild(notification);

    // Animation
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }
    }, 10);

    // Auto hide
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, duration);
}

// Alias สำหรับความเข้ากันได้ย้อนหลัง
function showNotification(message, type = 'info') {
    showAlert(type, message);
}

// แสดงสถานะโหลด (Unified)
function showLoading(show, message = 'กำลังโหลด...') {
    let loadingEl = document.getElementById('globalLoadingState');
    
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'globalLoadingState';
        loadingEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            flex-direction: column;
        `;
        document.body.appendChild(loadingEl);
    }
    
    if (show) {
        loadingEl.innerHTML = `
            <div style="text-align: center;">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <p style="color: #666; margin: 0; font-size: 16px;">${message}</p>
            </div>
        `;
        loadingEl.style.display = 'flex';
    } else {
        loadingEl.style.display = 'none';
    }
}

// จัดรูปแบบวันที่ (Unified)
function formatDate(dateString, format = 'short') {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const options = {
            short: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            },
            long: {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            },
            thai: {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        };
        
        return date.toLocaleDateString('th-TH', options[format] || options.short);
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// แปลงประเภทการลา (Unified)
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

// แปลงสถานะ (Unified)
function getStatusText(status) {
    const statusMap = {
        'pending': 'รอดำเนินการ',
        'approved': 'อนุมัติ',
        'rejected': 'ปฏิเสธ',
        'present': 'มาทำงาน',
        'late': 'มาสาย',
        'absent': 'ขาดงาน',
        'leave': 'ลา'
    };
    return statusMap[status] || status;
}

// แปลงสถานะเป็น CSS class (Unified)
function getStatusClass(status) {
    const classMap = {
        'pending': 'badge-pending status-pending',
        'approved': 'badge-approved status-approved',
        'rejected': 'badge-rejected status-rejected',
        'present': 'status-present',
        'late': 'status-late',
        'absent': 'status-absent',
        'leave': 'status-leave'
    };
    return classMap[status] || 'badge-pending';
}

// แปลง role code เป็นชื่อตำแหน่ง (Unified)
function getRoleText(roleCode) {
    const roles = {
        'owner': 'เจ้าของระบบ',
        'admin': 'แอดมิน',
        'admin_academic': 'ผู้ดูแลฝ่ายวิชาการ',
        'admin_management': 'ผู้ดูแลฝ่ายบริหาร',
        'admin_operation': 'ผู้ดูแลฝ่ายปฏิบัติการ',
        'admin_pastoral': 'ผู้ดูแลฝ่ายปกครอง',
        'admin_quality': 'ผู้ดูแลฝ่ายประกันคุณภาพ',
        'admin_resource': 'ผู้ดูแลฝ่ายทรัพยากร',
        'admin_student': 'ผู้ดูแลฝ่ายกิจการนักเรียน',
        'head_of_math': 'หัวหน้าวิชาคณิตศาสตร์',
        'head_of_eng': 'หัวหน้าวิชาภาษาอังกฤษ',
        'head_of_computer': 'หัวหน้าวิชาคอมพิวเตอร์',
        'head_of_sci': 'หัวหน้าวิชาวิทยาศาสตร์',
        'head_of_social_studie': 'หัวหน้าวิชาสังคมศึกษา',
        'head_of_thai': 'หัวหน้าวิชาภาษาไทย',
        'mathteacher': 'ครูคณิตศาสตร์',
        'engteacher': 'ครูภาษาอังกฤษ',
        'computerteacher': 'ครูคอมพิวเตอร์',
        'sciteacher': 'ครูวิทยาศาสตร์',
        'socialteacher': 'ครูสังคมศึกษา',
        'thaiteacher': 'ครูภาษาไทย'
    };
    return roles[roleCode] || roleCode || 'ไม่ระบุ';
}

// แปลง role code เป็นชื่อหมวดวิชา (Unified)
function getSubjectFromRole(roleCode) {
    const subjectMap = {
        'mathteacher': 'หมวดคณิตศาสตร์',
        'engteacher': 'หมวดภาษาอังกฤษ',
        'computerteacher': 'หมวดคอมพิวเตอร์',
        'sciteacher': 'หมวดวิทยาศาสตร์',
        'socialteacher': 'หมวดสังคมศึกษา',
        'thaiteacher': 'หมวดภาษาไทย',
        'head_of_math': 'หมวดคณิตศาสตร์',
        'head_of_eng': 'หมวดภาษาอังกฤษ',
        'head_of_computer': 'หมวดคอมพิวเตอร์',
        'head_of_sci': 'หมวดวิทยาศาสตร์',
        'head_of_social_studie': 'หมวดสังคมศึกษา',
        'head_of_thai': 'หมวดภาษาไทย'
    };
    return subjectMap[roleCode?.toLowerCase()] || '';
}

// ตรวจสอบสิทธิ์ Admin (Unified)
function checkAdminPermission(userRole) {
    const adminRoles = ['admin', 'owner'];
    
    if (!adminRoles.includes(userRole?.toLowerCase())) {
        alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะแอดมินเท่านั้น)');
        window.location.href = '/dashboard.html';
        return false;
    }
    return true;
}

// อัปเดตสถานะคำร้อง (Unified)
async function updateRequestStatus(requestId, status, note = '') {
    try {
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        
        const res = await fetch(`/api/leave-requests/${requestId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: status,
                approveby: currentUser.userid,
                note: note
            })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        const result = await res.json();
        
        if (result.success) {
            showAlert('success', 
                status === 'approved' ? 'อนุมัติคำร้องเรียบร้อยแล้ว' : 'ปฏิเสธคำร้องเรียบร้อยแล้ว'
            );
            return true;
        } else {
            throw new Error(result.message || 'เกิดข้อผิดพลาด');
        }
        
    } catch (error) {
        console.error('ข้อผิดพลาดในการอัปเดตสถานะ:', error);
        showAlert('error', `เกิดข้อผิดพลาดในการอัปเดตสถานะ: ${error.message}`);
        return false;
    }
}

// ออกจากระบบ (Unified)
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}

// ฟังก์ชันจัดการข้อผิดพลาด (Unified)
function handleError(error, userMessage = 'เกิดข้อผิดพลาด') {
    console.error('Error:', error);
    showAlert('error', userMessage);
}

// ฟังก์ชันตรวจสอบความถูกต้องของอีเมล
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ฟังก์ชันตรวจสอบเบอร์โทรศัพท์
function validatePhone(phone) {
    const phoneRegex = /^[0-9-+\s()]*$/;
    return phoneRegex.test(phone);
}

// ฟังก์ชันล้างตัวกรอง
function clearFilters() {
    const filterElements = document.querySelectorAll('input[type="text"], select, input[type="date"]');
    filterElements.forEach(element => {
        if (element.type === 'text' || element.type === 'date') {
            element.value = '';
        } else if (element.tagName === 'SELECT') {
            element.value = '';
        }
    });
}

// เริ่มต้นระบบทั่วไป
function initializeCommon() {
    // ตั้งค่า active menu อัตโนมัติ
    autoSetActiveMenu();

    // เพิ่ม CSS animations
    if (!document.getElementById('commonStyles')) {
        const style = document.createElement('style');
        style.id = 'commonStyles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .fade-in {
                animation: fadeIn 0.3s ease-in;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .notification {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .badge-pending {
                background-color: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            .badge-approved {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            .badge-rejected {
                background-color: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .status-pending { color: #996100ff; }
            .status-approved { color: #10b981; }
            .status-rejected { color: #ef4444; }
            .status-present { color: #10b981; }
            .status-late { color: #f59e0b; }
            .status-absent { color: #ef4444; }
            .status-leave { color: #6b7280; }
        `;
        document.head.appendChild(style);
    }
}


// ฟังก์ชันจัดรูปแบบเลขทศนิยม
function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || num === '') return '-';
    return parseFloat(num).toFixed(decimals);
}

// ฟังก์ชันแปลงเวลาให้อ่านง่าย
function formatTime(timeString) {
    if (!timeString || timeString === '00:00:00') return '-';
    return timeString.substring(0, 5); // เอาแค่ HH:MM
}

// ฟังก์ชันคำนวณระยะเวลาทำงาน
function calculateWorkHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return '-';
    
    const start = new Date(`2000-01-01 ${timeIn}`);
    const end = new Date(`2000-01-01 ${timeOut}`);
    
    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHrs}.${Math.round(diffMins/60*100).toString().padStart(2, '0')} ชม.`;
}

// ฟังก์ชันตรวจสอบว่าเป็นวันหยุดหรือไม่
function isWeekend(dateString) {
    const date = new Date(dateString);
    const day = date.getDay();
    return day === 0 || day === 6; // วันอาทิตย์ = 0, วันเสาร์ = 6
}

// ฟังก์ชันสร้าง CSV content
function generateCSV(data, headers) {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
        headers.map(header => {
            const value = row[header] || '';
            // ถ้าข้อมูลมีเครื่องหมาย comma หรือ quote ให้ใส่ quotes ครอบ
            if (value.toString().includes(',') || value.toString().includes('"')) {
                return `"${value.toString().replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
}

// ฟังก์ชันดาวน์โหลดไฟล์
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ฟังก์ชันตรวจสอบว่าเบราว์เซอร์รองรับ feature หรือไม่
function checkBrowserSupport() {
    const features = {
        fetch: typeof fetch !== 'undefined',
        arrow: (() => { try { eval('() => {}'); return true; } catch(e) { return false; } })(),
        const: (() => { try { eval('const a = 1'); return true; } catch(e) { return false; } })(),
        template: 'content' in document.createElement('template')
    };
    
    const unsupported = Object.keys(features).filter(key => !features[key]);
    
    if (unsupported.length > 0) {
        console.warn('เบราว์เซอร์ไม่รองรับ features:', unsupported);
        showAlert('warning', 'เบราว์เซอร์ของคุณอาจไม่รองรับฟีเจอร์บางอย่าง กรุณาอัปเดตเบราว์เซอร์');
    }
    
    return unsupported.length === 0;
}

// ฟังก์ชันแปลงข้อมูลเป็น Table format สำหรับการแสดงผล
function formatDataForTable(data, columns) {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }
    
    return data.map(item => {
        const formattedItem = {};
        columns.forEach(col => {
            if (col.format) {
                formattedItem[col.key] = col.format(item[col.key], item);
            } else {
                formattedItem[col.key] = item[col.key] || '-';
            }
        });
        return formattedItem;
    });
}

// ฟังก์ชันคำนวณสถิติพื้นฐาน
function calculateStats(data, field) {
    if (!Array.isArray(data) || data.length === 0) {
        return {
            count: 0,
            sum: 0,
            average: 0,
            min: 0,
            max: 0
        };
    }
    
    const values = data
        .map(item => parseFloat(item[field]) || 0)
        .filter(val => !isNaN(val));
    
    if (values.length === 0) {
        return {
            count: 0,
            sum: 0,
            average: 0,
            min: 0,
            max: 0
        };
    }
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    
    return {
        count: values.length,
        sum: sum,
        average: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
    };
}


// เรียกใช้เมื่อ DOM โหลดเสร็จ
waitForDOM(initializeCommon);

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

// ฟังก์ชันจัดการ active menu
function setActiveMenu(currentPage) {
    // ลบ active class จากเมนูทั้งหมด
    const allMenuLinks = document.querySelectorAll('.menu a');
    allMenuLinks.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });

    // หา href ที่ตรงกับหน้าปัจจุบัน
    const targetLink = document.querySelector(`.menu a[href="${currentPage}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
        targetLink.setAttribute('aria-current', 'page');
    }
}

// ฟังก์ชันตรวจสอบหน้าปัจจุบันและตั้งค่า active menu อัตโนมัติ
function autoSetActiveMenu() {
    const currentPath = window.location.pathname;
    const fileName = currentPath.split('/').pop() || 'index.html';
    setActiveMenu(fileName);
}

// ตรวจสอบว่า common.js โหลดสำเร็จ
window.commonJsLoaded = true;