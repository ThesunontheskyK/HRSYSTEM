// ตัวแปรป้องกัน infinite loop
let isLoading = false;
let hasLoadedOnce = false;
let allRequests = [];
let filteredRequests = [];
let currentUser = null;
let userPermissions = null;

// ========== ROLE MAPPING สำหรับแสดงผล ==========
const ROLE_NAMES = {
    // ครู
    'mathteacher': 'ครูคณิตศาสตร์',
    'engteacher': 'ครูภาษาอังกฤษ',
    'computerteacher': 'ครูคอมพิวเตอร์',
    'sciteacher': 'ครูวิทยาศาสตร์',
    'socialteacher': 'ครูสังคมศึกษา',
    'thaiteacher': 'ครูภาษาไทย',
    'kindergarten_teacher': 'ครูปฐมวัย',
    
    // หัวหน้าหมวดวิชา
    'head_of_math': 'หัวหน้าหมวดคณิตศาสตร์',
    'head_of_eng': 'หัวหน้าหมวดภาษาอังกฤษ',
    'head_of_computer': 'หัวหน้าหมวดคอมพิวเตอร์',
    'head_of_sci': 'หัวหน้าหมวดวิทยาศาสตร์',
    'head_of_social_studie': 'หัวหน้าหมวดสังคมศึกษา',
    'head_of_thai': 'หัวหน้าหมวดภาษาไทย',
    
    // เจ้าหน้าที่
    'hr_staff': 'เจ้าหน้าที่บุคลากร',
    'operation_staff': 'เจ้าหน้าที่บริหาร',
    'pastoral_staff': 'เจ้าหน้าที่อภิบาล',
    'quality_staff': 'เจ้าหน้าที่มาตรฐาน',
    'resource_staff': 'เจ้าหน้าที่ทรัพยากร',
    'student_affair_staff': 'เจ้าหน้าที่กิจการนักเรียน',
    
    // ผู้บริหาร/แอดมิน
    'admin_hr': 'หัวหน้าฝ่ายบุคลากร',
    'admin_academic': 'หัวหน้าฝ่ายวิชาการ',
    'admin_student': 'หัวหน้าฝ่ายกิจการนักเรียน',
    'admin_operation': 'หัวหน้าฝ่ายบริหาร',
    'admin_quality': 'หัวหน้าฝ่ายมาตรฐาน',
    'admin_resource': 'หัวหน้าฝ่ายทรัพยากร',
    'admin_kindergarten': 'หัวหน้าแผนกปฐมวัย',
    'admin_management': 'คณะกรรมการบริหาร',
    'admin_pastoral': 'หัวหน้าฝ่ายอภิบาล'
};

// ========== SUBJECT MAPPING ==========
const SUBJECT_NAMES = {
    'Math': 'หมวดคณิตศาสตร์',
    'English': 'หมวดภาษาอังกฤษ',
    'Computer': 'หมวดคอมพิวเตอร์',
    'Science': 'หมวดวิทยาศาสตร์',
    'SocialStudies': 'หมวดสังคมศึกษา',
    'Thai': 'หมวดภาษาไทย',
    'Kindergarten': 'แผนกปฐมวัย'
};

window.onload = async function () {
    // ตั้งค่า active menu สำหรับหน้าปัจจุบัน
    if (typeof autoSetActiveMenu === 'function') {
        autoSetActiveMenu();
    }

    await checkAuthenticationAndLoadData();
    setupEventListeners();
};

// ตรวจสอบการเข้าสู่ระบบและโหลดข้อมูล
async function checkAuthenticationAndLoadData() {
    try {
        // ตรวจสอบ session
        const sessionRes = await fetch('/api/check-session');
        const sessionData = await sessionRes.json();
        
        if (!sessionData.success || !sessionData.authenticated) {
            alert('กรุณาเข้าสู่ระบบก่อน');
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = sessionData.user;
        
        // ตรวจสอบว่าเป็น admin หรือไม่
        if (!currentUser.role_group || currentUser.role_group !== 'admin') {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะแอดมินเท่านั้น)');
            window.location.href = '/admin-dashboard.html';
            return;
        }
        
        // โหลดข้อมูลสิทธิ์
        await loadUserPermissions();
        
        // โหลดข้อมูลผู้ใช้
        await loadUserInfo();
        
        // ตั้งค่า role filter ตามสิทธิ์
        setupRoleFilter();
        
        // โหลดคำร้องลา
        await loadLeaveRequests();
        
    } catch (error) {
        console.error('Authentication error:', error);
        alert('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาเข้าสู่ระบบใหม่');
        window.location.href = '/index.html';
    }
}

// โหลดข้อมูลสิทธิ์ของผู้ใช้
async function loadUserPermissions() {
    try {
        const response = await fetch('/api/my-permissions');
        const data = await response.json();
        
        if (data.success) {
            userPermissions = data.data;
        } else {
            throw new Error('ไม่สามารถดึงข้อมูลสิทธิ์ได้');
        }
    } catch (error) {
        console.error('Error loading permissions:', error);
        throw error;
    }
}

// ตั้งค่า Role Filter ตามสิทธิ์ของผู้ใช้
function setupRoleFilter() {
    const roleFilter = document.getElementById('role-filter');
    if (!roleFilter || !userPermissions) return;
    
    // เคลียร์ options เดิม (ยกเว้น "ทั้งหมด")
    roleFilter.innerHTML = '<option value="all">ทั้งหมด</option>';
    
    const canManage = userPermissions.permissions.can_manage || [];
    const manageableRoles = userPermissions.permissions.manageable_roles || [];
    const userSubject = userPermissions.permissions.subject;
    
    
    // ถ้าเป็น HR - เห็นได้ทั้งหมด
    if (canManage.includes('all')) {
        addAllRolesToFilter(roleFilter);
    }
    // ถ้าเป็นฝ่ายวิชาการ - เห็นเฉพาะครูและหัวหน้าหมวดวิชา
    else if (canManage.includes('teachers')) {
        addTeacherRolesToFilter(roleFilter);
    }
    // ถ้าเป็นหัวหน้าหมวดวิชา - เห็นเฉพาะครูในหมวดตัวเอง
    else if (canManage.includes('own_subject') && userSubject) {
        addSubjectRolesToFilter(roleFilter, userSubject);
    }
    // ฝ่ายอื่น ๆ - เห็นเฉพาะคนในสายงานตัวเอง
    else if (manageableRoles.length > 0) {
        addSpecificRolesToFilter(roleFilter, manageableRoles);
    }
}

// เพิ่มตำแหน่งทั้งหมดลงใน filter (สำหรับ HR)
function addAllRolesToFilter(roleFilter) {
    // จัดกลุ่มตำแหน่ง
    const groups = {
        'ครู': [
            'mathteacher', 'engteacher', 'computerteacher', 'sciteacher', 
            'socialteacher', 'thaiteacher', 'kindergarten_teacher'
        ],
        'หัวหน้าหมวดวิชา': [
            'head_of_math', 'head_of_eng', 'head_of_computer', 
            'head_of_sci', 'head_of_social_studie', 'head_of_thai'
        ],
        'เจ้าหน้าที่': [
            'hr_staff', 'operation_staff', 'quality_staff', 
            'resource_staff', 'student_affair_staff', 'pastoral_staff'
        ],
        'ผู้บริหาร': [
            'admin_hr', 'admin_academic', 'admin_student', 'admin_operation',
            'admin_quality', 'admin_resource', 'admin_kindergarten', 
            'admin_management', 'admin_pastoral'
        ]
    };
    
    Object.keys(groups).forEach(groupName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        
        groups[groupName].forEach(roleCode => {
            const option = document.createElement('option');
            option.value = roleCode;
            option.textContent = ROLE_NAMES[roleCode] || roleCode;
            optgroup.appendChild(option);
        });
        
        roleFilter.appendChild(optgroup);
    });
}

// เพิ่มตำแหน่งครูและหัวหน้าหมวดวิชาลงใน filter (สำหรับฝ่ายวิชาการ)
function addTeacherRolesToFilter(roleFilter) {
    const teacherOptgroup = document.createElement('optgroup');
    teacherOptgroup.label = 'ครู';
    
    const teacherRoles = [
        'mathteacher', 'engteacher', 'computerteacher', 'sciteacher', 
        'socialteacher', 'thaiteacher', 'kindergarten_teacher'
    ];
    
    teacherRoles.forEach(roleCode => {
        const option = document.createElement('option');
        option.value = roleCode;
        option.textContent = ROLE_NAMES[roleCode] || roleCode;
        teacherOptgroup.appendChild(option);
    });
    
    roleFilter.appendChild(teacherOptgroup);
    
    const headOptgroup = document.createElement('optgroup');
    headOptgroup.label = 'หัวหน้าหมวดวิชา';
    
    const headRoles = [
        'head_of_math', 'head_of_eng', 'head_of_computer', 
        'head_of_sci', 'head_of_social_studie', 'head_of_thai'
    ];
    
    headRoles.forEach(roleCode => {
        const option = document.createElement('option');
        option.value = roleCode;
        option.textContent = ROLE_NAMES[roleCode] || roleCode;
        headOptgroup.appendChild(option);
    });
    
    roleFilter.appendChild(headOptgroup);
}

// เพิ่มตำแหน่งครูในหมวดวิชาเฉพาะลงใน filter (สำหรับหัวหน้าหมวดวิชา)
function addSubjectRolesToFilter(roleFilter, subject) {
    const subjectRoleMap = {
        'Math': ['mathteacher'],
        'English': ['engteacher'],
        'Computer': ['computerteacher'],
        'Science': ['sciteacher'],
        'SocialStudies': ['socialteacher'],
        'Thai': ['thaiteacher'],
        'Kindergarten': ['kindergarten_teacher']
    };
    
    const roles = subjectRoleMap[subject] || [];
    const subjectName = SUBJECT_NAMES[subject] || subject;
    
    if (roles.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = subjectName;
        
        roles.forEach(roleCode => {
            const option = document.createElement('option');
            option.value = roleCode;
            option.textContent = ROLE_NAMES[roleCode] || roleCode;
            optgroup.appendChild(option);
        });
        
        roleFilter.appendChild(optgroup);
    }
}

// เพิ่มตำแหน่งเฉพาะลงใน filter (สำหรับฝ่ายอื่น ๆ)
function addSpecificRolesToFilter(roleFilter, manageableRoles) {
    // จัดกลุ่มตามประเภท
    const groupedRoles = {
        'เจ้าหน้าที่': [],
        'อื่น ๆ': []
    };
    
    manageableRoles.forEach(roleCode => {
        if (roleCode.includes('_staff')) {
            groupedRoles['เจ้าหน้าที่'].push(roleCode);
        } else {
            groupedRoles['อื่น ๆ'].push(roleCode);
        }
    });
    
    Object.keys(groupedRoles).forEach(groupName => {
        if (groupedRoles[groupName].length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            
            groupedRoles[groupName].forEach(roleCode => {
                const option = document.createElement('option');
                option.value = roleCode;
                option.textContent = ROLE_NAMES[roleCode] || roleCode;
                optgroup.appendChild(option);
            });
            
            roleFilter.appendChild(optgroup);
        }
    });
}

// โหลดข้อมูลผู้ใช้
async function loadUserInfo() {
    try {
        const res = await fetch(`/api/admininfo/${currentUser.userid}`);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const userInfo = await res.json();
            const profileImgEl = document.getElementById('sidebarProfilePic');
        if (profileImgEl) {
            const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';
            profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
        }

        // เก็บค่าไว้ใน localStorage ด้วย เผื่อหน้าอื่นต้องใช้
        try {
            const currentUser2 = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            currentUser2.image = userInfo.image || '/uploads/default.png';
            localStorage.setItem('loggedInUser', JSON.stringify(currentUser2));
        } catch (_) { }
        
        // อัปเดตข้อมูลในหน้า
        const userInfoEl = document.getElementById('userInfo');
        const usernameEl = document.getElementById('username');
        const subjectnameEl = document.getElementById('subjectname');
        
        if (userInfoEl) {
            userInfoEl.innerHTML = `
                <strong>ชื่อ:</strong> ${userInfo.firstname} ${userInfo.lastname} | 
                <strong>อีเมล:</strong> ${userInfo.email} | 
                <strong>ตำแหน่ง:</strong> ${userPermissions.permissions.role_name || userInfo.role_name}
            `;
        }
        
        if (usernameEl) {
            usernameEl.textContent = `${userInfo.firstname} ${userInfo.lastname}`;
        }
        
        if (subjectnameEl) {
            subjectnameEl.textContent = userPermissions.permissions.role_name || userInfo.role_name;
        }

        // อัปเดตข้อความแสดงขอบเขตการดู
        const subjectAreaEl = document.getElementById('subjectArea');
        if (subjectAreaEl) {
            subjectAreaEl.textContent = getAdminScopeText();
        }
        
        // อัปเดตข้อความหมายเหตุ
        const infoNote = document.querySelector('.info-note p');
        if (infoNote) {
            infoNote.innerHTML = `
                <strong>หมายเหตุ:</strong> ${getAdminNoteText()}
            `;
        }
        
    } catch (error) {
        console.error('ดึงข้อมูลผู้ใช้ล้มเหลว:', error);
        
        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl) {
            userInfoEl.innerHTML = '<span style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้</span>';
        }
    }
}

// ฟังก์ชันแสดงขอบเขตการดู
function getAdminScopeText() {
    if (!userPermissions) return 'ไม่ระบุขอบเขต';
    
    const canManage = userPermissions.permissions.can_manage;
    if (canManage && canManage.includes('all')) {
        return 'ทุกคน';
    } else if (canManage && canManage.includes('teachers')) {
        return 'ครูและหัวหน้าหมวดวิชาทั้งหมด';
    } else if (userPermissions.permissions.subject) {
        const subjectName = SUBJECT_NAMES[userPermissions.permissions.subject] || userPermissions.permissions.subject;
        return subjectName;
    } else if (userPermissions.permissions.manageable_roles) {
        return `${userPermissions.permissions.manageable_roles.length} ตำแหน่ง`;
    }
    return 'ไม่ระบุขอบเขต';
}

// ฟังก์ชันแสดงข้อความหมายเหตุ
function getAdminNoteText() {
    if (!userPermissions) return '';
    
    const roleName = userPermissions.permissions.role_name;
    const canManage = userPermissions.permissions.can_manage;
    
    if (canManage && canManage.includes('all')) {
        return 'ท่านสามารถเห็นและจัดการคำร้องของทุกคนในระบบ';
    } else if (canManage && canManage.includes('teachers')) {
        return 'ท่านสามารถเห็นและจัดการคำร้องของครูและหัวหน้าหมวดวิชาทั้งหมด';
    } else if (canManage && canManage.includes('own_subject')) {
        const subjectName = SUBJECT_NAMES[userPermissions.permissions.subject] || userPermissions.permissions.subject;
        return `ท่านสามารถเห็นและจัดการคำร้องของครูใน${subjectName}เท่านั้น`;
    } else {
        return `ท่านสามารถเห็นและจัดการคำร้องของผู้ใต้บังคับบัญชาตามสายงาน`;
    }
}

// โหลดคำร้องลาตามสิทธิ์
async function loadLeaveRequests() {
    // ป้องกันการเรียกซ้ำ
    if (isLoading) {
        return;
    }
    
    isLoading = true;
    
    try {
        showLoadingState();
        
        if (!userPermissions) {
            throw new Error('ไม่พบข้อมูลสิทธิ์ของผู้ใช้');
        }
        
        
        // เรียก API ดึงคำร้องทั้งหมดตามสิทธิ์
        const response = await fetch('/api/leave-requests/all');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'ไม่สามารถดึงข้อมูลคำร้องได้');
        }
        
        // ประมวลผลข้อมูลคำร้อง
        const requests = Array.isArray(data.data) ? data.data : [];
        
        // เรียงลำดับตามวันที่ส่งคำร้อง (ใหม่ไปเก่า)
        allRequests = requests.sort((a, b) => 
            new Date(b.submitted_at) - new Date(a.submitted_at)
        );
        
        // ตั้งค่า filteredRequests เป็นข้อมูลทั้งหมด
        filteredRequests = [...allRequests];
        
        
        if (allRequests.length === 0) {
            showEmptyRequestMessage('ไม่มีคำร้องลาในขอบเขตสิทธิ์ของท่าน');
        } else {
            renderRequestList(filteredRequests);
        }
        
        updateStatistics(filteredRequests);
        hasLoadedOnce = true;
        
    } catch (error) {
        console.error('ข้อผิดพลาดในการโหลดคำร้อง:', error);
        showErrorMessage(error.message);
    } finally {
        isLoading = false;
    }
}

// แสดงสถานะโหลด
function showLoadingState() {
    const requestList = document.getElementById('request-list');
    if (requestList) {
        requestList.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    <div class="loading-content">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="animate-spin">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <p>กำลังโหลดข้อมูลคำร้อง...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// แปลง role code เป็นชื่อตำแหน่ง
function getRoleName(roleCode) {
    return ROLE_NAMES[roleCode?.toLowerCase()] || roleCode || 'ไม่ระบุตำแหน่ง';
}

// แปลง role code เป็นชื่อหมวดวิชา
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
        'head_of_thai': 'หมวดภาษาไทย',
        'kindergarten_teacher': 'แผนกปฐมวัย',
        
        // เจ้าหน้าที่
        'hr_staff': 'ฝ่ายบุคลากร',
        'operation_staff': 'ฝ่ายบริหาร',
        'pastoral_staff': 'ฝ่ายอภิบาล',
        'quality_staff': 'ฝ่ายมาตรฐาน',
        'resource_staff': 'ฝ่ายทรัพยากร',
        'student_affair_staff': 'ฝ่ายกิจการนักเรียน'
    };
    return subjectMap[roleCode?.toLowerCase()] || '';
}

// ตั้งค่า Event Listeners สำหรับการค้นหาและกรอง
function setupEventListeners() {
    // ค้นหา
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 300);
        });
    }
    
    // กรองสถานะ
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    
    // กรองประเภท
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }
    
    // กรองตำแหน่ง
    const roleFilter = document.getElementById('role-filter');
    if (roleFilter) {
        roleFilter.addEventListener('change', applyFilters);
    }
}

// ใช้ตัวกรองทั้งหมด
function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    const roleFilter = document.getElementById('role-filter')?.value || 'all';
    
    filteredRequests = allRequests.filter(request => {
        // กรองการค้นหา
        const matchesSearch = searchTerm === '' || 
            `${request.firstname} ${request.lastname}`.toLowerCase().includes(searchTerm) ||
            request.userid?.toString().includes(searchTerm) ||
            getLeaveTypeText(request.leave_type).toLowerCase().includes(searchTerm) ||
            (request.role_name || getRoleName(request.role_code))?.toLowerCase().includes(searchTerm);
        
        // กรองสถานะ
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        
        // กรองประเภท
        const matchesType = typeFilter === 'all' || request.leave_type === typeFilter;
        
        // กรองตำแหน่ง
        const matchesRole = roleFilter === 'all' || request.role_code === roleFilter;
        
        return matchesSearch && matchesStatus && matchesType && matchesRole;
    });
    
    renderRequestList(filteredRequests);
    updateStatistics(filteredRequests);
}

// แสดงข้อความเมื่อไม่มีข้อมูล
function showEmptyRequestMessage(message = 'ไม่มีคำร้องที่ตรงกับเงื่อนไขการค้นหา') {
    const requestList = document.getElementById('request-list');
    if (requestList) {
        requestList.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 60px 20px; text-align: center;">
                    <div style="color: #666;">
                        <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">📋</div>
                        <h3 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 18px;">ไม่พบคำร้อง</h3>
                        <p style="margin: 0; color: #666; font-size: 14px;">${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// แสดงข้อความ error
function showErrorMessage(errorMessage) {
    const requestList = document.getElementById('request-list');
    if (requestList) {
        requestList.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 60px 20px; text-align: center;">
                    <div style="color: #e74c3c;">
                        <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.6;">⚠️</div>
                        <h3 style="color: #e74c3c; margin: 0 0 10px 0; font-size: 18px;">เกิดข้อผิดพลาด</h3>
                        <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                        <p style="margin: 0 0 15px 0; font-size: 12px; color: #999;">${errorMessage}</p>
                        <button onclick="manualRefresh()" style="
                            margin-top: 10px;
                            padding: 10px 20px;
                            background: #e74c3c;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-family: 'Prompt', sans-serif;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.3s;
                        " onmouseover="this.style.backgroundColor='#c0392b'"
                           onmouseout="this.style.backgroundColor='#e74c3c'">🔄 ลองใหม่</button>
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
        return;
    }

    requestList.innerHTML = '';
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        row.className = 'request-card hover:bg-gray-50';
        
        const statusText = getStatusText(request.status);
        const statusClass = getStatusClass(request.status);
        const leaveTypeText = getLeaveTypeText(request.leave_type);
        
        // จัดรูปแบบวันที่
        const submittedDate = formatDate(request.submitted_at);
        const startDate = formatDate(request.start_date);
        const endDate = formatDate(request.end_date);
        const leavePeriod = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        
        // ใช้ชื่อจากข้อมูลที่ได้มา หรือจาก role_name
        const displayRoleName = request.role_name || getRoleName(request.role_code);
        
        row.innerHTML = `
            <td class="table-cell">
                <div class="text-sm font-medium text-gray-900">REQ-${String(request.id).padStart(4, '0')}</div>
            </td>
            <td class="table-cell">
                <div class="flex items-center">
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${request.firstname || ''} ${request.lastname || ''}</div>
                        <div class="text-xs text-gray-400">รหัส: ${request.userid || '-'}</div>
                    </div>
                </div>
            </td>
            <td class="table-cell">
                <div class="text-sm text-gray-900">${displayRoleName}</div>
               
            </td>
            <td class="table-cell">
                <div class="text-sm text-gray-900">${leaveTypeText}</div>
            </td>
            <td class="table-cell">
                <div class="text-sm text-gray-900">${submittedDate}</div>
            </td>
            <td class="table-cell">
                <div class="text-sm text-gray-900">${leavePeriod}</div>
            </td>
            <td class="table-cell">
                <span class="badge ${statusClass}">${statusText}</span>
            </td>
            <td class="table-cell">
                <div class="flex space-x-2">
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
        btn.addEventListener('click', function() {
            const requestId = parseInt(this.getAttribute('data-id'));
            const request = requests.find(r => r.id === requestId);
            if (request) {
                openRequestModal(request);
            }
        });
    });

    // ปุ่มอนุมัติ
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', function() {
            const requestId = parseInt(this.getAttribute('data-id'));
            if (confirm('คุณต้องการอนุมัติคำร้องนี้หรือไม่?')) {
                updateRequestStatus(requestId, 'approved');
            }
        });
    });

    // ปุ่มปฏิเสธ
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', function() {
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
        'modal-requester-position': request.role_name || getRoleName(request.role_code) || 'ไม่ระบุตำแหน่ง',
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
            const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP ${res.status}`);
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
    notification.className = `notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} transition-opacity duration-500 flex items-center z-50`;
    
    const icon = document.createElement('span');
    icon.className = 'mr-2';
    icon.innerHTML = type === 'success' ? 
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>' : 
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>';
    
    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// ฟังก์ชันรีเฟรช
function refreshRequests() {
    if (isLoading) return; // ป้องกันการเรียกซ้ำ
    
    showNotification('กำลังรีเฟรชข้อมูล...', 'success');
    isLoading = false; // รีเซ็ต flag
    loadLeaveRequests();
}

// ฟังก์ชันส่งออกข้อมูล
function exportRequests() {
    if (filteredRequests.length === 0) {
        showNotification('ไม่มีข้อมูลให้ส่งออก', 'error');
        return;
    }
    
    // สร้าง CSV
    const headers = ['รหัสคำร้อง', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'ประเภทการลา', 'วันที่ขอ', 'วันที่ลา', 'สถานะ', 'เหตุผล'];
    const csvContent = [
        headers.join(','),
        ...filteredRequests.map(request => [
            `REQ-${String(request.id).padStart(4, '0')}`,
            `"${request.firstname} ${request.lastname}"`,
            `"${request.role_name || getRoleName(request.role_code)}"`,
            `"${getLeaveTypeText(request.leave_type)}"`,
            formatDate(request.submitted_at),
            `"${formatDate(request.start_date)} - ${formatDate(request.end_date)}"`,
            `"${getStatusText(request.status)}"`,
            `"${request.reason || '-'}"`
        ].join(','))
    ].join('\n');
    
    // ดาวน์โหลดไฟล์
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leave_requests_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('ส่งออกข้อมูลสำเร็จ', 'success');
}

// ฟังก์ชันออกจากระบบ
async function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                window.location.href = '/index.html';
            } else {
                // ถ้า logout ไม่สำเร็จ ก็ redirect ไปยัง login page อยู่ดี
                window.location.href = '/index.html';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // ถ้าเกิด error ก็ redirect ไปยัง login page อยู่ดี
            window.location.href = '/index.html';
        }
    }
}