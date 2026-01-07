let isLoading = false;
let hasLoadedOnce = false;

window.onload = async function () {
    const user = checkLogin();
    if (!user) return;

    await loadUserInfo(user.userid);
    await loadLeaveRequests();
};

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

// ตรวจสอบสิทธิ์ Head of Subject
function checkHeadPermission(userRole) {
    const headRoles = [
        'head_of_math', 'head_of_eng', 'head_of_computer',
        'head_of_sci', 'head_of_social_studie', 'head_of_thai'
    ];

    if (!headRoles.includes(userRole?.toLowerCase())) {
        alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะหัวหน้าหมวดวิชาเท่านั้น)');
        window.location.href = '/dashboard.html';
        return false;
    }
    return true;
}

// โหลดข้อมูลผู้ใช้
async function loadUserInfo(userId) {
    try {
        const res = await fetch(`/api/userinfo/${userId}`);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const userInfo = await res.json();

        // ตรวจสอบสิทธิ์
        if (!checkHeadPermission(userInfo.role_code)) {
            return;
        }

        // อัปเดตข้อมูลในหน้า
        const userInfoEl = document.getElementById('userInfo');
        const usernameEl = document.getElementById('username');
        const subjectnameEl = document.getElementById('subjectname');
        const subjectAreaEl = document.getElementById('subjectArea');
        const profileImgEl = document.getElementById('sidebarProfilePic');
        if (profileImgEl) {
            const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';
            // กัน cache เพื่อให้เห็นรูปใหม่ทันทีหลังอัปเดต
            profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
        }

        // เก็บค่าไว้ใน localStorage ด้วย เผื่อหน้าอื่นต้องใช้
        try {
            const currentUser2 = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            currentUser2.image = userInfo.image || '/uploads/default.png';
            localStorage.setItem('loggedInUser', JSON.stringify(currentUser2));
        } catch (_) { }
        setupMenuVisibility(userInfo.role_code);

        const currentUserData = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        currentUserData.role = userInfo.role_code;
        localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));

        if (userInfoEl) {
            userInfoEl.innerHTML = `
                        <strong>ชื่อ:</strong> ${userInfo.firstname} ${userInfo.lastname} | 
                        <strong>อีเมล:</strong> ${userInfo.email} | 
                        <strong>ตำแหน่ง:</strong> ${userInfo.role_name || 'ไม่ระบุ'}
                    `;
        }

        if (usernameEl) {
            usernameEl.textContent = `${userInfo.firstname} ${userInfo.lastname}`;
        }

        if (subjectnameEl) {
            subjectnameEl.textContent = userInfo.role_name || 'ไม่ระบุตำแหน่ง';
        }

        // แสดงหมวดวิชาที่ดูแล
        const subjectName = getSubjectName(userInfo.role_code);
        if (subjectAreaEl) {
            subjectAreaEl.textContent = subjectName;
        }

        // บันทึก role ลงใน localStorage สำหรับใช้ในหน้าอื่น
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        currentUser.role = userInfo.role_code;
        localStorage.setItem('loggedInUser', JSON.stringify(currentUser));

    } catch (error) {
        console.error('ดึงข้อมูลผู้ใช้ล้มเหลว:', error);

        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl) {
            userInfoEl.innerHTML = '<span style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้</span>';
        }
    }
}

// แปลง role code เป็นชื่อหมวดวิชา
function getSubjectName(roleCode) {
    const subjectMap = {
        'head_of_math': 'คณิตศาสตร์',
        'head_of_eng': 'ภาษาอังกฤษ',
        'head_of_computer': 'คอมพิวเตอร์',
        'head_of_sci': 'วิทยาศาสตร์',
        'head_of_social_studie': 'สังคมศึกษา',
        'head_of_thai': 'ภาษาไทย'
    };
    return subjectMap[roleCode?.toLowerCase()] || 'ไม่ระบุ';
}

// แปลง role code เป็น subject filter
function getRoleSubject(roleCode) {
    const subjectMap = {
        'head_of_math': 'Math',
        'head_of_eng': 'English',
        'head_of_computer': 'Computer',
        'head_of_sci': 'Science',
        'head_of_social_studie': 'SocialStudies',
        'head_of_thai': 'Thai'
    };
    return subjectMap[roleCode?.toLowerCase()] || null;
}

// โหลดคำร้องลา - เพิ่มการป้องกัน infinite loop
async function loadLeaveRequests() {
    // ป้องกันการเรียกซ้ำ
    if (isLoading) {
        return;
    }

    isLoading = true;

    try {
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const userSubject = getRoleSubject(currentUser.role);


        if (!userSubject) {
            console.error('ไม่สามารถระบุหมวดวิชาได้ - role:', currentUser.role);
            showEmptyRequestMessage('ไม่สามารถระบุหมวดวิชาได้');
            return;
        }


        const res = await fetch(`/api/leave-requests/subject/${userSubject}`);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const response = await res.json();


        // ตรวจสอบรูปแบบข้อมูล response
        let requests = [];
        if (response.success && Array.isArray(response.data)) {
            requests = response.data;
        } else if (Array.isArray(response)) {
            requests = response;
        } else {
            console.error('Unexpected response format:', response);
            requests = [];
        }

        renderRequestList(requests);
        updateStatistics(requests);
        hasLoadedOnce = true;

    } catch (error) {
        console.error('ข้อผิดพลาดในการโหลดคำร้อง:', error);
        showErrorMessage(error.message);
    } finally {
        isLoading = false;
    }
}

// แสดงข้อความเมื่อไม่มีข้อมูล
function showEmptyRequestMessage(message = 'ไม่มีคำร้องในสายงานของท่าน') {
    const requestList = document.getElementById('request-list');
    if (requestList) {
        requestList.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading-cell">
                            <div class="loading-content">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>${message}</p>
                            </div>
                        </td>
                    </tr>
                `;
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

// แสดงข้อความ error
function showErrorMessage(errorMessage) {
    const requestList = document.getElementById('request-list');
    if (requestList) {
        requestList.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading-cell">
                            <div class="loading-content">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                                <p style="font-size: 12px; color: #999; margin-top: 5px;">${errorMessage}</p>
                                <button onclick="manualRefresh()" style="margin-top: 10px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">ลองใหม่</button>
                            </div>
                        </td>
                    </tr>
                `;
    }
}

// ฟังก์ชันรีเฟรชแบบ manual
function manualRefresh() {
    isLoading = false; // รีเซ็ต flag
    hasLoadedOnce = false; // รีเซ็ต flag
    loadLeaveRequests();
}

// แสดงรายการคำร้อง
function renderRequestList(requests) {
    const requestList = document.getElementById('request-list');

    if (!Array.isArray(requests) || requests.length === 0) {
        showEmptyRequestMessage();
        updateStatistics([]);
        return;
    }

    requestList.innerHTML = '';

    requests.forEach(request => {
        const row = document.createElement('tr');

        const statusText = getStatusText(request.status);
        const statusClass = getStatusClass(request.status);
        const leaveTypeText = getLeaveTypeText(request.leave_type);

        // จัดรูปแบบวันที่
        const submittedDate = formatDate(request.submitted_at);
        const startDate = formatDate(request.start_date);
        const endDate = formatDate(request.end_date);
        const leavePeriod = startDate === endDate ? startDate : `${startDate} - ${endDate}`;

        row.innerHTML = `
                    <td>REQ-${String(request.id).padStart(4, '0')}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #2c3e50; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                                ${request.firstname ? request.firstname.charAt(0) : 'U'}
                            </div>
                            <div>
                                <div style="font-weight: 500;">${request.firstname || ''} ${request.lastname || ''}</div>
                                <div style="font-size: 12px; color: #666;">รหัส: ${request.userid || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td>${leaveTypeText}</td>
                    <td>${submittedDate}</td>
                    <td>${leavePeriod}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-view" data-id="${request.id}">ดูรายละเอียด</button>
                            ${request.status === 'pending' ? `
                                <button class="btn-approve" data-id="${request.id}">อนุมัติ</button>
                                <button class="btn-reject" data-id="${request.id}">ปฏิเสธ</button>
                            ` : ''}
                        </div>
                    </td>
                `;

        requestList.appendChild(row);
    });

    // เพิ่ม Event Listeners
    addEventListeners(requests);
}

// ฟังก์ชันจัดรูปแบบวันที่
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// เพิ่ม Event Listeners สำหรับปุ่มต่างๆ
function addEventListeners(requests) {
    // ปุ่มดูรายละเอียด
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', function () {
            const requestId = parseInt(this.getAttribute('data-id'));
            const request = requests.find(r => r.id === requestId);
            if (request) {
                openRequestModal(request);
            }
        });
    });

    // ปุ่มอนุมัติ
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', function () {
            const requestId = parseInt(this.getAttribute('data-id'));
            if (confirm('คุณต้องการอนุมัติคำร้องนี้หรือไม่?')) {
                updateRequestStatus(requestId, 'approved');
            }
        });
    });

    // ปุ่มปฏิเสธ
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', function () {
            const requestId = parseInt(this.getAttribute('data-id'));
            if (confirm('คุณต้องการปฏิเสธคำร้องนี้หรือไม่?')) {
                updateRequestStatus(requestId, 'rejected');
            }
        });
    });
}

// อัปเดตสถิติ
function updateStatistics(requests) {
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;

    const pendingEl = document.getElementById('pendingCount');
    const approvedEl = document.getElementById('approvedCount');
    const rejectedEl = document.getElementById('rejectedCount');

    if (pendingEl) pendingEl.textContent = pendingCount;
    if (approvedEl) approvedEl.textContent = approvedCount;
    if (rejectedEl) rejectedEl.textContent = rejectedCount;
}

// เปิด Modal รายละเอียด
function openRequestModal(request) {
    // ตั้งค่าข้อมูลใน Modal
    const modalElements = {
        'modal-request-id': `REQ-${String(request.id).padStart(4, '0')}`,
        'modal-request-type': getLeaveTypeText(request.leave_type),
        'modal-request-date': formatDate(request.submitted_at),
        'modal-requester-name': `${request.firstname || ''} ${request.lastname || ''}`,
        'modal-requester-position': request.role_name || 'ไม่ระบุตำแหน่ง',
        'modal-requester-email': request.email || '-',
        'modal-requester-id': request.userid || '-',
        'modal-request-reason': request.reason || 'ไม่ได้ระบุ'
    };

    // อัปเดตข้อมูลใน modal
    Object.keys(modalElements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = modalElements[id];
        }
    });

    // อัปเดตช่วงวันที่ลา
    const startDate = formatDate(request.start_date);
    const endDate = formatDate(request.end_date);
    const leavePeriod = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
    const leavePeriodEl = document.getElementById('modal-leave-period');
    if (leavePeriodEl) leavePeriodEl.textContent = leavePeriod;

    // อัปเดตสถานะ
    const statusText = getStatusText(request.status);
    const statusClass = getStatusClass(request.status);
    const statusEl = document.getElementById('modal-request-status');
    if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.className = `badge ${statusClass}`;
    }

    // จัดการปุ่มอนุมัติ/ปฏิเสธ
    const approveBtn = document.getElementById('modal-approve-btn');
    const rejectBtn = document.getElementById('modal-reject-btn');
    const noteTextarea = document.getElementById('approval-note');

    if (request.status === 'pending') {
        if (approveBtn) approveBtn.style.display = 'block';
        if (rejectBtn) rejectBtn.style.display = 'block';
        if (noteTextarea) {
            noteTextarea.disabled = false;
            noteTextarea.value = '';
        }
    } else {
        if (approveBtn) approveBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
        if (noteTextarea) {
            noteTextarea.disabled = true;
            noteTextarea.value = `สถานะ: ${statusText}`;
        }
    }

    // แสดง Modal
    const modal = document.getElementById('request-modal');
    if (modal) modal.classList.remove('hidden');

    // Event Listeners สำหรับ Modal
    const closeModal = document.getElementById('close-modal');
    const modalApproveBtn = document.getElementById('modal-approve-btn');
    const modalRejectBtn = document.getElementById('modal-reject-btn');

    if (closeModal) closeModal.onclick = hideModal;
    if (modalApproveBtn) {
        modalApproveBtn.onclick = () => {
            updateRequestStatus(request.id, 'approved');
            hideModal();
        };
    }
    if (modalRejectBtn) {
        modalRejectBtn.onclick = () => {
            updateRequestStatus(request.id, 'rejected');
            hideModal();
        };
    }
}

// ปิด Modal
function hideModal() {
    const modal = document.getElementById('request-modal');
    if (modal) modal.classList.add('hidden');
}

// อัปเดตสถานะคำร้อง
async function updateRequestStatus(requestId, status) {
    try {
        const note = document.getElementById('approval-note')?.value || '';
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
            showNotification(
                status === 'approved' ? 'อนุมัติคำร้องเรียบร้อยแล้ว' : 'ปฏิเสธคำร้องเรียบร้อยแล้ว',
                'success'
            );
            // รีโหลดรายการ (รีเซ็ต flag ก่อน)
            isLoading = false;
            await loadLeaveRequests();
        } else {
            throw new Error(result.message || 'เกิดข้อผิดพลาด');
        }

    } catch (error) {
        console.error('ข้อผิดพลาดในการอัปเดตสถานะ:', error);
        showNotification(`เกิดข้อผิดพลาดในการอัปเดตสถานะ: ${error.message}`, 'error');
    }
}

// ฟังก์ชันช่วยเหลือ
function getStatusText(status) {
    const statusMap = {
        'pending': 'รอการอนุมัติ',
        'approved': 'อนุมัติแล้ว',
        'rejected': 'ปฏิเสธแล้ว'
    };
    return statusMap[status] || 'ไม่ทราบสถานะ';
}

function getStatusClass(status) {
    const classMap = {
        'pending': 'badge-pending',
        'approved': 'badge-approved',
        'rejected': 'badge-rejected'
    };
    return classMap[status] || 'badge-pending';
}

function getLeaveTypeText(leaveType) {
    const typeMap = {
        'sick': 'ลาป่วย',
        'personal': 'ลากิจ',
        'maternity': 'ลาคลอดบุตร',
        'training': 'ลาฝึกอบรม/สัมมนา'
    };
    return typeMap[leaveType] || leaveType;
}

// แสดงการแจ้งเตือน
function showNotification(message, type) {
    // ลบ notification เก่าออกก่อน
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification`;
    notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                color: white;
                font-family: 'Prompt', sans-serif;
                font-size: 14px;
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 10px;
                background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;

    const icon = document.createElement('span');
    icon.innerHTML = type === 'success' ? '✓' : '✗';
    icon.style.cssText = 'font-weight: bold; font-size: 16px;';

    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));

    document.body.appendChild(notification);

    // แสดง notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // ซ่อน notification
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ฟังก์ชันรีเฟรช
function refreshRequests() {
    if (isLoading) return; // ป้องกันการเรียกซ้ำ

    showNotification('กำลังรีเฟรชข้อมูล...', 'success');
    isLoading = false; // รีเซ็ต flag
    loadLeaveRequests();
}

// ฟังก์ชันออกจากระบบ
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}

// Event Listeners สำหรับ Filter
document.addEventListener('DOMContentLoaded', function () {
    // Filter สถานะ
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function () {
            showNotification(`กรองตามสถานะ: ${this.options[this.selectedIndex].text}`, 'success');
        });
    }

    // Filter ประเภท
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        typeFilter.addEventListener('change', function () {
            showNotification(`กรองตามประเภท: ${this.options[this.selectedIndex].text}`, 'success');
        });
    }

    // ค้นหา
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            // TODO: เพิ่มการค้นหา
        });
    }
});