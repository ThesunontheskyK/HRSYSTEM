// Global variables
let currentUser = null;
let allRequests = [];
let filteredRequests = [];
let currentFilter = 'all';
let isMobile = false;

// Check if device is mobile
function checkMobile() {
    isMobile = window.innerWidth <= 768;
    return isMobile;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Owner Status page loaded');
    
    // Check mobile on load and resize
    checkMobile();
    window.addEventListener('resize', handleResize);
    
    initializeApp();
});

// Handle window resize
function handleResize() {
    const wasMobile = isMobile;
    checkMobile();
    
    // Re-render if mobile state changed
    if (wasMobile !== isMobile) {
        displayRequests();
    }
}

async function initializeApp() {
    try {
        showLoading(true, 'กำลังตรวจสอบการเข้าสู่ระบบ...');

        // ตรวจสอบการเข้าสู่ระบบ
        const sessionValid = await checkSession();
        if (!sessionValid) return;

        // โหลดข้อมูลผู้ใช้
        await loadUserProfile();

        // โหลดปีการศึกษาปัจจุบัน
        await loadCurrentAcademicYear();

        // โหลดคำร้องทั้งหมด
        await loadAllRequests();

        // Setup event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing app:', error);
        showError('เกิดข้อผิดพลาดในการโหลดระบบ: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Filter inputs
    document.getElementById('employeeSearch').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('leaveTypeFilter').addEventListener('change', applyFilters);
    document.getElementById('startDateFilter').addEventListener('change', applyFilters);
    document.getElementById('endDateFilter').addEventListener('change', applyFilters);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeRequestModal();
        }
        
        // Quick filter shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    filterByStatus('all');
                    break;
                case '2':
                    e.preventDefault();
                    filterByStatus('pending');
                    break;
                case '3':
                    e.preventDefault();
                    filterByStatus('approved');
                    break;
                case '4':
                    e.preventDefault();
                    filterByStatus('rejected');
                    break;
            }
        }
    });
}

// Debounce function for search input
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

// ตรวจสอบ session
async function checkSession() {
    try {
        const response = await fetch('/api/check-session', {
            method: 'GET',
            credentials: 'include' // รวม cookies/session
        });

        if (!response.ok) {
            throw new Error('ไม่สามารถตรวจสอบ session ได้');
        }

        const result = await response.json();
        
        if (!result.success || !result.authenticated) {
            alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
            window.location.href = '/index.html';
            return false;
        }

        currentUser = result.user;
        
        // ตรวจสอบว่าเป็น Owner หรือไม่
        if (currentUser.role_group !== 'owner') {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            await logout();
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking session:', error);
        alert('เกิดข้อผิดพลาดในการตรวจสอบการเข้าสู่ระบบ');
        window.location.href = '/index.html';
        return false;
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

// โหลดคำร้องทั้งหมด
async function loadAllRequests() {
    showLoading(true, 'กำลังโหลดคำร้องทั้งหมด...');

    try {
        // ใช้ API owner-specific สำหรับ leave requests
        const response = await fetch('/api/owner/leave-requests-all', {
            credentials: 'include'
        });

        if (!response.ok) {
            // ถ้า API owner-specific ไม่มี ลองใช้ API ทั่วไป
            if (response.status === 404) {
                return await loadAllRequestsFallback();
            }
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลได้');
        }

        allRequests = result.data || [];
        allRequests = allRequests.map(request => ({
            id: request.id,
            userid: request.userid,
            employee_name: `${request.firstname} ${request.lastname}`,
            employee_email: request.email,
            role_name: request.role_name,
            leave_type: request.leave_type,
            start_date: request.start_date,
            end_date: request.end_date,
            submitted_at: request.submitted_at,
            status: request.status,
            reason: request.reason,
            approveby: request.approveby,
            approver_firstname: request.approver_firstname,
            approver_lastname: request.approver_lastname,
            approver_role_name: request.approver_role_name,
            days_count: calculateDays(request.start_date, request.end_date)
        }));

        filteredRequests = [...allRequests];
        updateCounts();
        displayRequests();

    } catch (error) {
        console.error('Error loading requests:', error);
        showError('เกิดข้อผิดพลาดในการโหลดข้อมูลคำร้อง: ' + error.message);
        allRequests = [];
        filteredRequests = [];
        updateCounts();
        displayRequests();
    } finally {
        showLoading(false);
    }
}

// Fallback: ใช้ API ทั่วไปถ้า owner-specific API ไม่มี
async function loadAllRequestsFallback() {
    try {
        const response = await fetch('/api/leave-requests/all', {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลได้');
        }

        allRequests = result.data || [];
        allRequests = allRequests.map(request => ({
            id: request.id,
            userid: request.userid,
            employee_name: `${request.firstname} ${request.lastname}`,
            employee_email: request.email,
            role_name: request.role_name,
            leave_type: request.leave_type,
            start_date: request.start_date,
            end_date: request.end_date,
            submitted_at: request.submitted_at,
            status: request.status,
            reason: request.reason,
            approveby: request.approveby,
            approver_firstname: request.approver_firstname,
            approver_lastname: request.approver_lastname,
            approver_role_name: request.approver_role_name,
            days_count: calculateDays(request.start_date, request.end_date)
        }));

        filteredRequests = [...allRequests];
        updateCounts();
        displayRequests();

    } catch (error) {
        throw error; // ส่งต่อ error ไปให้ function เรียก
    }
}

// คำนวณจำนวนวัน
function calculateDays(startDate, endDate) {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    } catch (error) {
        console.error('Error calculating days:', error);
        return 1;
    }
}

// อัปเดตจำนวนในแต่ละแท็บ
function updateCounts() {
    try {
        const all = allRequests.length;
        const pending = allRequests.filter(r => r.status === 'pending').length;
        const approved = allRequests.filter(r => r.status === 'approved').length;
        const rejected = allRequests.filter(r => r.status === 'rejected').length;

        document.getElementById('allCount').textContent = all;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('rejectedCount').textContent = rejected;
    } catch (error) {
        console.error('Error updating counts:', error);
    }
}

// กรองตามสถานะ
function filterByStatus(status) {
    try {
        currentFilter = status;

        // อัปเดตแท็บที่เลือก
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        const activeTab = document.querySelector(`[data-status="${status}"]`);
        if (activeTab) activeTab.classList.add('active');

        // อัปเดตหัวข้อตาราง
        const titles = {
            'all': 'คำร้องทั้งหมด',
            'pending': 'คำร้องรอดำเนินการ',
            'approved': 'คำร้องที่อนุมัติแล้ว',
            'rejected': 'คำร้องที่ปฏิเสธแล้ว'
        };
        document.getElementById('currentStatusTitle').textContent = titles[status];

        displayRequests();
    } catch (error) {
        console.error('Error filtering by status:', error);
    }
}

// ใช้ตัวกรอง
function applyFilters() {
    try {
        const employeeSearch = document.getElementById('employeeSearch').value.toLowerCase().trim();
        const leaveTypeFilter = document.getElementById('leaveTypeFilter').value;
        const startDateFilter = document.getElementById('startDateFilter').value;
        const endDateFilter = document.getElementById('endDateFilter').value;

        filteredRequests = allRequests.filter(request => {
            // กรองตามชื่อพนักงาน
            const matchesEmployee = !employeeSearch || 
                request.employee_name.toLowerCase().includes(employeeSearch) ||
                request.employee_email.toLowerCase().includes(employeeSearch);

            // กรองตามประเภทคำร้อง
            const matchesLeaveType = !leaveTypeFilter || request.leave_type === leaveTypeFilter;

            // กรองตามวันที่
            const requestDate = new Date(request.start_date);
            const startFilter = !startDateFilter || requestDate >= new Date(startDateFilter);
            const endFilter = !endDateFilter || requestDate <= new Date(endDateFilter);

            return matchesEmployee && matchesLeaveType && startFilter && endFilter;
        });

        updateCounts();
        displayRequests();
    } catch (error) {
        console.error('Error applying filters:', error);
    }
}

// รีเซ็ตตัวกรอง
function resetFilters() {
    try {
        document.getElementById('employeeSearch').value = '';
        document.getElementById('leaveTypeFilter').value = '';
        document.getElementById('startDateFilter').value = '';
        document.getElementById('endDateFilter').value = '';
        
        filteredRequests = [...allRequests];
        updateCounts();
        displayRequests();
    } catch (error) {
        console.error('Error resetting filters:', error);
    }
}

// แสดงคำร้อง (Responsive)
function displayRequests() {
    try {
        const tableEl = document.getElementById('requestsTable');
        const mobileCards = document.getElementById('mobileCards');
        const emptyEl = document.getElementById('emptyState');

        // กรองข้อมูลตามสถานะ
        let displayRequests = filteredRequests;
        if (currentFilter !== 'all') {
            displayRequests = filteredRequests.filter(r => r.status === currentFilter);
        }

        if (displayRequests.length === 0) {
            tableEl.style.display = 'none';
            if (mobileCards) mobileCards.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';

        if (isMobile) {
            // Render mobile cards
            renderMobileCards(displayRequests);
            tableEl.style.display = 'none';
            if (mobileCards) mobileCards.style.display = 'block';
        } else {
            // Render desktop table
            renderDesktopTable(displayRequests);
            tableEl.style.display = 'table';
            if (mobileCards) mobileCards.style.display = 'none';
        }

    } catch (error) {
        console.error('Error displaying requests:', error);
    }
}

// Render desktop table
function renderDesktopTable(displayRequests) {
    const tableBody = document.getElementById('requestsTableBody');
    const tableHTML = displayRequests.map(request => `
        <tr class="fade-in" onclick="showRequestDetail(${request.id})">
            <td class="request-id">REQ-${request.id}</td>
            <td>
                <div class="employee-name">${request.employee_name}</div>
                <div class="employee-role">${request.role_name || '-'}</div>
            </td>
            <td>${getLeaveTypeText(request.leave_type)}</td>
            <td>
                ${formatDate(request.start_date)} - ${formatDate(request.end_date)}
                <br><small style="color: #7f8c8d;">(${request.days_count} วัน)</small>
            </td>
            <td>${formatDateTime(request.submitted_at)}</td>
            <td>
                <span class="status-badge ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </td>
            <td>${formatApprover(request)}</td>
            <td>
                ${renderActionButtons(request, false)}
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = tableHTML;
}

// Render mobile cards
function renderMobileCards(displayRequests) {
    const mobileCards = document.getElementById('mobileCards');
    if (!mobileCards) return;

    const cardsHTML = displayRequests.map(request => `
        <div class="request-card" onclick="showRequestDetail(${request.id})">
            <div class="card-header">
                <div class="card-id">REQ-${request.id}</div>
                <span class="status-badge ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </div>
            <div class="card-body">
                <div class="card-row">
                    <span class="card-label">พนักงาน:</span>
                    <span class="card-value">${request.employee_name}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">ตำแหน่ง:</span>
                    <span class="card-value">${request.role_name || '-'}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">ประเภท:</span>
                    <span class="card-value">${getLeaveTypeText(request.leave_type)}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">วันที่ลา:</span>
                    <span class="card-value">${formatDate(request.start_date)} - ${formatDate(request.end_date)}</span>
                </div>
                <div class="card-row">
                    <span class="card-label">จำนวนวัน:</span>
                    <span class="card-value">${request.days_count} วัน</span>
                </div>
                <div class="card-row">
                    <span class="card-label">วันที่ส่ง:</span>
                    <span class="card-value">${formatDateTime(request.submitted_at)}</span>
                </div>
                ${request.approveby ? `
                <div class="card-row">
                    <span class="card-label">ผู้อนุมัติ:</span>
                    <span class="card-value">${formatApprover(request)}</span>
                </div>
                ` : ''}
            </div>
            <div class="card-actions">
                ${renderActionButtons(request, true)}
            </div>
        </div>
    `).join('');

    mobileCards.innerHTML = cardsHTML;
}

// Render action buttons
function renderActionButtons(request, isMobile = false) {
    let buttons = '';
    
    // View button
    buttons += `<button class="action-btn view" onclick="event.stopPropagation(); showRequestDetail(${request.id})">
        <i class="mdi mdi-eye"></i> ${isMobile ? 'ดูรายละเอียด' : 'ดู'}
    </button>`;
    
    // Action buttons for pending requests
    if (request.status === 'pending') {
        buttons += `
            <button class="action-btn approve" onclick="event.stopPropagation(); approveRequest(${request.id})">
                <i class="mdi mdi-check"></i> ${isMobile ? 'อนุมัติ' : 'อนุมัติ'}
            </button>
            <button class="action-btn reject" onclick="event.stopPropagation(); rejectRequest(${request.id})">
                <i class="mdi mdi-close"></i> ${isMobile ? 'ปฏิเสธ' : 'ปฏิเสธ'}
            </button>
        `;
    }
    
    return buttons;
}

// แสดงรายละเอียดคำร้อง (Responsive Modal)
function showRequestDetail(requestId) {
    try {
        const request = allRequests.find(r => r.id === requestId);
        if (!request) {
            showError('ไม่พบข้อมูลคำร้อง');
            return;
        }

        // แสดง notification เมื่อเปิดรายละเอียด
        showNotification('กำลังแสดงรายละเอียดคำร้อง REQ-' + request.id, 'success');

        // Create responsive modal
        const modal = document.createElement('div');
        modal.id = 'requestModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="mdi mdi-file-document"></i> รายละเอียดคำร้อง REQ-${request.id}</h2>
                    <span class="modal-close" onclick="closeRequestModal()">&times;</span>
                </div>
                
                <div class="modal-body">
                    <div style="display: ${isMobile ? 'block' : 'grid'}; ${!isMobile ? 'grid-template-columns: 1fr 1fr;' : ''} gap: 20px; margin-bottom: 20px;">
                        <div style="${isMobile ? 'margin-bottom: 15px;' : ''}">
                            <strong>พนักงาน:</strong><br>
                            ${request.employee_name}<br>
                            <small style="color: #7f8c8d;">${request.employee_email}</small>
                        </div>
                        <div>
                            <strong>ตำแหน่ง:</strong><br>
                            ${request.role_name || '-'}
                        </div>
                    </div>
                    
                    <div style="display: ${isMobile ? 'block' : 'grid'}; ${!isMobile ? 'grid-template-columns: 1fr 1fr;' : ''} gap: 20px; margin-bottom: 20px;">
                        <div style="${isMobile ? 'margin-bottom: 15px;' : ''}">
                            <strong>ประเภทคำร้อง:</strong><br>
                            ${getLeaveTypeText(request.leave_type)}
                        </div>
                        <div>
                            <strong>จำนวนวัน:</strong><br>
                            ${request.days_count} วัน
                        </div>
                    </div>
                    
                    <div style="display: ${isMobile ? 'block' : 'grid'}; ${!isMobile ? 'grid-template-columns: 1fr 1fr;' : ''} gap: 20px; margin-bottom: 20px;">
                        <div style="${isMobile ? 'margin-bottom: 15px;' : ''}">
                            <strong>วันที่เริ่มลา:</strong><br>
                            ${formatDate(request.start_date)}
                        </div>
                        <div>
                            <strong>วันที่สิ้นสุด:</strong><br>
                            ${formatDate(request.end_date)}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <strong>วันที่ส่งคำร้อง:</strong><br>
                        ${formatDateTime(request.submitted_at)}
                    </div>
                    
                    ${request.reason ? `
                        <div style="margin-bottom: 20px;">
                            <strong>เหตุผล:</strong><br>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 5px; border-left: 4px solid #2c3e50; word-wrap: break-word;">
                                ${request.reason}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 20px;">
                        <strong>สถานะ:</strong> 
                        <span class="status-badge ${getStatusClass(request.status)}">
                            ${getStatusText(request.status)}
                        </span>
                    </div>
                    
                    ${request.approveby ? `
                        <div style="margin-bottom: 20px;">
                            <strong>ผู้อนุมัติ:</strong><br>
                            ${formatApprover(request)}
                        </div>
                    ` : ''}
                </div>
                
                <div class="modal-footer">
                    ${request.status === 'pending' ? `
                        <button class="btn btn-approve" onclick="approveRequestFromModal(${request.id})">
                            <i class="mdi mdi-check"></i> อนุมัติ
                        </button>
                        <button class="btn btn-reject" onclick="rejectRequestFromModal(${request.id})">
                            <i class="mdi mdi-close"></i> ปฏิเสธ
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="closeRequestModal()">
                        <i class="mdi mdi-close"></i> ปิด
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // ปิด modal เมื่อคลิกนอกกรอบ
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeRequestModal();
            }
        });

        // ป้องกันการ scroll ของ body เมื่อ modal เปิด
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error showing request detail:', error);
        showError('เกิดข้อผิดพลาดในการแสดงรายละเอียด');
    }
}

// Close request modal
function closeRequestModal() {
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = ''; // คืนค่าการ scroll
    }
}

// อนุมัติคำร้อง
async function approveRequest(requestId) {
    if (!confirm('คุณต้องการอนุมัติคำร้องนี้หรือไม่?')) return;
    
    await updateRequestStatus(requestId, 'approved');
}

// ปฏิเสธคำร้อง
async function rejectRequest(requestId) {
    if (!confirm('คุณต้องการปฏิเสธคำร้องนี้หรือไม่?')) return;
    
    await updateRequestStatus(requestId, 'rejected');
}

// อนุมัติคำร้องจาก Modal
async function approveRequestFromModal(requestId) {
    if (!confirm('คุณต้องการอนุมัติคำร้องนี้หรือไม่?')) return;
    
    await updateRequestStatus(requestId, 'approved');
    closeRequestModal();
}

// ปฏิเสธคำร้องจาก Modal
async function rejectRequestFromModal(requestId) {
    if (!confirm('คุณต้องการปฏิเสธคำร้องนี้หรือไม่?')) return;
    
    await updateRequestStatus(requestId, 'rejected');
    closeRequestModal();
}

// อัปเดตสถานะคำร้อง
async function updateRequestStatus(requestId, status) {
    try {
        showLoading(true, `กำลัง${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำร้อง...`);
        
        // ใช้ API endpoint สำหรับ Owner
        const response = await fetch(`/api/owner/leave-requests/${requestId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                status: status,
                note: `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}โดย Owner`
            })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'ไม่สามารถอัปเดตสถานะได้');
        }
        
        showNotification(`${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำร้องเรียบร้อยแล้ว`, 'success');

        // อัปเดตข้อมูลใน allRequests
        const requestIndex = allRequests.findIndex(r => r.id === requestId);
        if (requestIndex !== -1) {
            allRequests[requestIndex].status = status;
            allRequests[requestIndex].approveby = currentUser?.userid;
            allRequests[requestIndex].approver_firstname = currentUser?.firstname;
            allRequests[requestIndex].approver_lastname = currentUser?.lastname;
            allRequests[requestIndex].approver_role_name = currentUser?.role_name || 'Owner';
        }

        // อัปเดต filteredRequests
        const filteredIndex = filteredRequests.findIndex(r => r.id === requestId);
        if (filteredIndex !== -1) {
            filteredRequests[filteredIndex].status = status;
            filteredRequests[filteredIndex].approveby = currentUser?.userid;
            filteredRequests[filteredIndex].approver_firstname = currentUser?.firstname;
            filteredRequests[filteredIndex].approver_lastname = currentUser?.lastname;
            filteredRequests[filteredIndex].approver_role_name = currentUser?.role_name || 'Owner';
        }
        
        // รีเฟรชการแสดงผล
        updateCounts();
        displayRequests();
        
    } catch (error) {
        console.error('Error updating request status:', error);
        showError('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// รีเฟรชข้อมูล
async function refreshData() {
    await loadAllRequests();
    showNotification('รีเฟรชข้อมูลเรียบร้อยแล้ว', 'info');
}

function formatApprover(request) {
    if (!request.approveby) {
        return '-';
    }

    if (request.approver_firstname && request.approver_lastname) {
        const name = `${request.approver_firstname} ${request.approver_lastname}`;
        const role = request.approver_role_name || '';
        return role ? `${name}<br><small style="color: #7f8c8d;">(${role})</small>` : name;
    }

    return request.approveby;
}

function getLeaveTypeText(leaveType) {
    const types = {
        'sick': 'ลาป่วย',
        'sick_leave': 'ลาป่วย',
        'personal': 'ลากิจ',
        'personal_leave': 'ลากิจ',
        'annual': 'ลาพักผ่อน',
        'annual_leave': 'ลาพักผ่อน',
        'maternity': 'ลาคลอด',
        'maternity_leave': 'ลาคลอด',
        'other': 'อื่นๆ'
    };
    return types[leaveType] || leaveType;
}

function getStatusText(status) {
    const statuses = {
        'pending': 'รอดำเนินการ',
        'approved': 'อนุมัติแล้ว',
        'rejected': 'ปฏิเสธแล้ว'
    };
    return statuses[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'pending': 'badge-pending status-pending',
        'approved': 'badge-approved status-approved',
        'rejected': 'badge-rejected status-rejected'
    };
    return classMap[status] || 'badge-pending';
}

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
        console.error('Error formatting date:', error);
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting datetime:', error);
        return dateString;
    }
}

function showLoading(show, message = 'กำลังโหลดข้อมูล...') {
    const loadingEl = document.getElementById('loadingState');
    const tableEl = document.getElementById('requestsTable');
    const mobileCards = document.getElementById('mobileCards');
    const emptyEl = document.getElementById('emptyState');
    
    if (show) {
        loadingEl.style.display = 'flex';
        loadingEl.querySelector('span').textContent = message;
        tableEl.style.display = 'none';
        if (mobileCards) mobileCards.style.display = 'none';
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
        font-size: ${isMobile ? '14px' : '16px'};
    `;
    notification.textContent = message;
    
    // Add animation styles if not exists
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
    
    // ลบ notification หลังจาก 5 วินาที
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// ฟังก์ชัน logout
async function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            window.location.href = '/index.html';
        }
    }
}