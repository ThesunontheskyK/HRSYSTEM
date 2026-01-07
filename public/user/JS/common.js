
function waitForDOM(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function checkLogin() {
    try {
        const userString = localStorage.getItem('loggedInUser');
        if (!userString) {
            alert('กรุณาเข้าสู่ระบบก่อน');
            window.location.href = '/index.html';
            return null;
        }

        const user = JSON.parse(userString);

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


async function loadUserInfo(userId, isAdmin = false) {
  try {
    const endpoint = isAdmin ? `/api/admininfo/${userId}` : `/api/userinfo/${userId}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const userInfo = await res.json();


    const profileImgEl = document.getElementById('sidebarProfilePic');
    if (profileImgEl) {
      const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';
      profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }

    updateUserDisplay(userInfo);
    // เก็บลง localStorage 
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

// เรียกใช้เมื่อ DOM โหลดเสร็จ
waitForDOM(initializeCommon);


// ตรวจสอบว่า common.js โหลดสำเร็จ
window.commonJsLoaded = true;