// ตัวแปรสำหรับจัดการ modal
const yearModal = document.getElementById('yearModal');
const deleteModal = document.getElementById('deleteModal');
const statsModal = document.getElementById('statsModal');
const yearForm = document.getElementById('yearForm');

let currentEditId = null;
let currentDeleteId = null;

// เมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔧 Academic Years page loaded');

    // ตรวจสอบ session ก่อน
    const sessionValid = await checkSession();

    if (sessionValid) {
        console.log('✅ Session valid, loading data...');
        loadCurrentYear();
        loadAllYears();
        setupEventListeners();
    } else {
        console.log('❌ Session invalid, redirecting...');
    }
});

// ตรวจสอบ session
async function checkSession() {
    try {
        console.log('🔍 Checking session...');
        const response = await fetch('/api/check-session');
        const data = await response.json();

        console.log('📥 Session response:', data);

        if (!data.authenticated || !data.user) {
            console.log('❌ Not authenticated');
            window.location.href = '/index.html';
            return false;
        }

        // ตรวจสอบ role (อาจเป็น role หรือ role_code)
        const userRole = data.user.role || data.user.role_code;
        if (userRole !== 'owner') {
            console.log('❌ Not owner role:', userRole);
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (ต้องเป็น Owner เท่านั้น)');
            window.location.href = '/index.html';
            return false;
        }

        console.log('✅ Session valid for owner');
        return true;
    } catch (error) {
        console.error('❌ Error checking session:', error);
        alert('เกิดข้อผิดพลาดในการตรวจสอบ session กรุณาล็อกอินใหม่');
        window.location.href = '/index.html';
        return false;
    }
}

// โหลดปีการศึกษาปัจจุบัน
async function loadCurrentYear() {
    try {
        const response = await fetch('/api/academic-years/active');
        const container = document.getElementById('currentYearCard');

        if (response.ok) {
            const year = await response.json();
            container.innerHTML = renderYearCard(year, true);
        } else {
            container.innerHTML = `
                <div class="year-card">
                    <p style="text-align: center; color: #7f8c8d;">ยังไม่มีปีการศึกษาที่ active</p>
                    <p style="text-align: center;">
                        <button class="btn btn-primary" id="createFirstYearBtn">สร้างปีการศึกษาแรก</button>
                    </p>
                </div>
            `;

            // เพิ่ม event listener สำหรับปุ่มสร้างปีการศึกษาแรก
            document.getElementById('createFirstYearBtn')?.addEventListener('click', openCreateModal);
        }
    } catch (error) {
        console.error('Error loading current year:', error);
        document.getElementById('currentYearCard').innerHTML = `
            <div class="year-card">
                <p style="text-align: center; color: #f44336;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            </div>
        `;
    }
}

// โหลดปีการศึกษาทั้งหมด
async function loadAllYears() {
    try {
        const response = await fetch('/api/academic-years');
        const container = document.getElementById('allYearsContainer');

        if (response.ok) {
            const years = await response.json();

            if (years.length === 0) {
                container.innerHTML = `
                    <div class="year-card">
                        <p style="text-align: center; color: #7f8c8d;">ยังไม่มีปีการศึกษา</p>
                    </div>
                `;
            } else {
                container.innerHTML = years.map(year => renderYearCard(year, false)).join('');
            }
        } else {
            container.innerHTML = `
                <div class="year-card">
                    <p style="text-align: center; color: #f44336;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading years:', error);
        document.getElementById('allYearsContainer').innerHTML = `
            <div class="year-card">
                <p style="text-align: center; color: #f44336;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            </div>
        `;
    }
}

// สร้าง HTML สำหรับ year card
function renderYearCard(year, isCurrent = false) {
    const startDate = new Date(year.start_date).toLocaleDateString('th-TH');
    const endDate = new Date(year.end_date).toLocaleDateString('th-TH');
    const isActive = year.is_active;

    return `
        <div class="year-card ${isActive ? 'current' : 'inactive'}">
            <span class="year-badge ${isActive ? 'active' : 'inactive'}">
                ${isActive ? '🟢 ใช้งานอยู่' : '⚪ ไม่ได้ใช้งาน'}
            </span>

            <div class="year-info">
                <h3>${year.year_name}</h3>
            </div>

            <div class="year-details">
                <div class="detail-row">
                    <span class="detail-label">วันเริ่มต้น:</span>
                    <span class="detail-value">${startDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">วันสิ้นสุด:</span>
                    <span class="detail-value">${endDate}</span>
                </div>
            </div>

            <div class="year-actions">
                ${!isActive ? `
                    <button class="btn btn-success btn-sm" onclick="activateYear(${year.id})">
                        ✓ เปิดใช้งาน
                    </button>
                ` : ''}
                <button class="btn btn-info btn-sm" onclick="showStatistics(${year.id})">
                    📊 สถิติ
                </button>
                <button class="btn btn-warning btn-sm" onclick="openEditModal(${year.id})">
                    ✏️ แก้ไข
                </button>
                ${!isActive ? `
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${year.id}, '${year.year_name}')">
                        🗑️ ลบ
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ตั้งค่า event listeners
function setupEventListeners() {
    // ปุ่มสร้างปีการศึกษาใหม่
    document.getElementById('createYearBtn').addEventListener('click', openCreateModal);

    // ปุ่มปิด modal
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // ปุ่มยกเลิก
    document.getElementById('cancelBtn').addEventListener('click', closeModals);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeModals);

    // ปุ่มยืนยันการลบ
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteYear);

    // Form submit
    yearForm.addEventListener('submit', handleFormSubmit);

    // ปิด modal เมื่อคลิกนอก modal
    window.addEventListener('click', (e) => {
        if (e.target === yearModal || e.target === deleteModal || e.target === statsModal) {
            closeModals();
        }
    });

    // ปุ่มปิด stats modal
    document.querySelectorAll('.close-stats').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
}

// เปิด modal สร้างปีการศึกษาใหม่
function openCreateModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'สร้างปีการศึกษาใหม่';
    yearForm.reset();
    yearModal.classList.add('show');
}

// เปิด modal แก้ไขปีการศึกษา
async function openEditModal(id) {
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'แก้ไขปีการศึกษา';

    try {
        const response = await fetch('/api/academic-years');
        const years = await response.json();
        const year = years.find(y => y.id === id);

        if (year) {
            document.getElementById('yearName').value = year.year_name;
            document.getElementById('startDate').value = year.start_date;
            document.getElementById('endDate').value = year.end_date;
            document.getElementById('setAsActive').checked = year.is_active;
            document.getElementById('setAsActive').disabled = year.is_active;

            yearModal.classList.add('show');
        }
    } catch (error) {
        console.error('Error loading year data:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

// เปิด modal ยืนยันการลบ
function openDeleteModal(id, name) {
    currentDeleteId = id;
    document.getElementById('deleteYearName').textContent = name;
    deleteModal.classList.add('show');
}

// ปิด modals ทั้งหมด
function closeModals() {
    yearModal.classList.remove('show');
    deleteModal.classList.remove('show');
    statsModal.classList.remove('show');
}

// จัดการ form submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const yearName = document.getElementById('yearName').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const setAsActive = document.getElementById('setAsActive').checked;

    const data = {
        year_name: yearName,
        start_date: startDate,
        end_date: endDate,
        set_as_active: setAsActive
    };

    try {
        let response;

        if (currentEditId) {
            // แก้ไข
            response = await fetch(`/api/academic-years/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // สร้างใหม่
            response = await fetch('/api/academic-years', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            closeModals();
            loadCurrentYear();
            loadAllYears();
        } else {
            alert(result.error || 'เกิดข้อผิดพลาด');
        }
    } catch (error) {
        console.error('Error saving year:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}

// เปิดใช้งานปีการศึกษา
async function activateYear(id) {
    if (!confirm('คุณต้องการเปลี่ยนไปใช้งานปีการศึกษานี้หรือไม่?')) {
        return;
    }

    try {
        const response = await fetch(`/api/academic-years/${id}/activate`, {
            method: 'PUT'
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            loadCurrentYear();
            loadAllYears();
        } else {
            alert(result.error || 'เกิดข้อผิดพลาด');
        }
    } catch (error) {
        console.error('Error activating year:', error);
        alert('เกิดข้อผิดพลาดในการเปิดใช้งานปีการศึกษา');
    }
}

// ลบปีการศึกษา
async function deleteYear() {
    try {
        const response = await fetch(`/api/academic-years/${currentDeleteId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            closeModals();
            loadCurrentYear();
            loadAllYears();
        } else {
            alert(result.error || 'เกิดข้อผิดพลาด');
        }
    } catch (error) {
        console.error('Error deleting year:', error);
        alert('เกิดข้อผิดพลาดในการลบปีการศึกษา');
    }
}

// แสดงสถิติ
async function showStatistics(id) {
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = '<div class="loading">กำลังโหลด...</div>';
    statsModal.classList.add('show');

    try {
        const response = await fetch(`/api/academic-years/${id}/statistics`);
        const data = await response.json();

        if (response.ok) {
            const year = data.academic_year;
            const stats = data.statistics;

            statsContent.innerHTML = `
                <div class="year-info">
                    <h3>${year.year_name}</h3>
                    <p>${new Date(year.start_date).toLocaleDateString('th-TH')} - ${new Date(year.end_date).toLocaleDateString('th-TH')}</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card info">
                        <div class="stat-label">คำร้องขอลา</div>
                        <div class="stat-value">${stats.leave_requests}</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-label">ประวัติการลา</div>
                        <div class="stat-value">${stats.leave_history}</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-label">การจ่ายเงินเดือน</div>
                        <div class="stat-value">${stats.salary_payments}</div>
                    </div>
                </div>
            `;
        } else {
            statsContent.innerHTML = '<p style="text-align: center; color: #f44336;">เกิดข้อผิดพลาดในการโหลดสถิติ</p>';
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        statsContent.innerHTML = '<p style="text-align: center; color: #f44336;">เกิดข้อผิดพลาดในการโหลดสถิติ</p>';
    }
}
