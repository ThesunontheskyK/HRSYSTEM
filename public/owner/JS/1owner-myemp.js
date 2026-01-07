// ตัวแปรสำหรับจัดการข้อมูล
let allEmployees = [];
let filteredEmployees = [];
let allRoles = []; // 🆕 เพิ่มตัวแปรสำหรับเก็บรายการตำแหน่ง
let currentPage = 1;
let currentUser = null;
let selectedEmployee = null;
let isEditMode = false;
let originalEmployeeData = null;
const employeesPerPage = 12;

// เช็คการ Login และสิทธิ์
function checkLoginStatus() {
  const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
  
  if (!user) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = '../index.html';
    return null;
  }
  
  // ตรวจสอบว่าเป็น Owner หรือไม่
  if (user.loginType !== 'owner' && user.role_group !== 'owner') {
    alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
    localStorage.removeItem('loggedInUser');
    window.location.href = '../index.html';
    return null;
  }
  
  return user;
}

// โหลดข้อมูลเมื่อเปิดหน้า
document.addEventListener('DOMContentLoaded', function() {
  // เช็ค Login
  currentUser = checkLoginStatus();
  if (!currentUser) return;
  
  loadUserProfile();
  loadRoles(); // 🆕 โหลดรายการตำแหน่ง
  loadEmployees();
  setupEventListeners();
});

// โหลดข้อมูลโปรไฟล์ผู้ใช้
async function loadUserProfile() {
  try {
    const response = await fetch(`/api/ownerinfo/${currentUser.userid}`);
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

// 🆕 โหลดรายการตำแหน่งทั้งหมด
async function loadRoles() {
  try {
    const response = await fetch('/api/owner/roles');
    if (response.ok) {
      const result = await response.json();
      allRoles = result.data || [];
    } else {
      console.error('Failed to load roles');
      allRoles = [];
    }
  } catch (error) {
    console.error('Error loading roles:', error);
    allRoles = [];
  }
}

// โหลดข้อมูลพนักงานทั้งหมดจาก API
async function loadEmployees() {
  try {
    showLoading(true);
    
    const response = await fetch('/api/owner/all-employees');
    
    if (response.ok) {
      const result = await response.json();
      allEmployees = result.data || [];
      filteredEmployees = [...allEmployees];
      displayEmployees();
      updateSearchInfo();
    } else {
      throw new Error('ไม่สามารถโหลดข้อมูลพนักงานได้');
    }
  } catch (error) {
    console.error('Error loading employees:', error);
    showError('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// แสดงข้อมูลพนักงานในรูปแบบการ์ด
function displayEmployees() {
  const container = document.getElementById('employeeContainer');
  const startIndex = (currentPage - 1) * employeesPerPage;
  const endIndex = startIndex + employeesPerPage;
  const employeesToShow = filteredEmployees.slice(startIndex, endIndex);

  if (employeesToShow.length === 0) {
    showNoResults(true);
    container.innerHTML = '';
    showPagination(false);
    return;
  }

  showNoResults(false);

  container.innerHTML = employeesToShow.map(employee => {
    // สร้าง URL รูปภาพพร้อม cache busting
    const profileImage = (employee.image && employee.image.trim()) ? employee.image : '/uploads/default.png';
    const imageUrl = `${profileImage}${profileImage.includes('?') ? '&' : '?'}t=${Date.now()}`;

    return `
    <div class="employee-card">
      <div class="p-4">
        <div class="row align-items-center">
          <div class="col-lg-5">
            <div class="d-flex align-items-center">
              <img src="${imageUrl}"
                   alt="${employee.firstname} ${employee.lastname}"
                   class="employee-avatar me-3"
                   onerror="this.src='/uploads/default.png'">
              <div>
                <h5 class="mb-1">
                  <a href="#" class="employee-name" onclick="showEmployeeDetails(${employee.userid})">
                    ${employee.firstname} ${employee.lastname}
                  </a>
                </h5>
                <p class="text-muted mb-1">${employee.role_name || 'ไม่ระบุตำแหน่ง'}</p>
                <span class="role-badge ${employee.role_group}">${getRoleGroupText(employee.role_group)}</span>
              </div>
            </div>
          </div>
          <div class="col-lg-2">
            <div>
              <p class="text-muted mb-0">หมวดวิชา</p>
              <p class="mb-0">${getSubjectName(employee.subject) || '-'}</p>
            </div>
          </div>
          <div class="col-lg-2">
            <div>
              <p class="text-muted mb-0">เพศ</p>
              <p class="mb-0">${employee.gender || '-'}</p>
            </div>
          </div>
          <div class="col-lg-2">
            <div>
              <p class="text-muted mb-0">เงินเดือน</p>
              <p class="fw-bold text-success mb-0">฿${formatSalary(employee.salary)}</p>
            </div>
          </div>
          <div class="col-lg-1">
            <div class="text-end">
              <button class="btn btn-primary btn-sm" onclick="showEmployeeDetails(${employee.userid})">
                <i class="mdi mdi-eye"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  updatePagination();
}

// แสดงรายละเอียดพนักงาน
async function showEmployeeDetails(userid) {
  try {
    selectedEmployee = allEmployees.find(emp => emp.userid === userid);
    
    const response = await fetch(`/api/owneremployees/${userid}`);
    
    if (response.ok) {
      const employee = await response.json();
      originalEmployeeData = { ...employee };
      
      const modalBody = document.getElementById('employeeModalBody');
      modalBody.innerHTML = createEmployeeDetailForm(employee);
      
      // Reset edit mode
      isEditMode = false;
      toggleEditMode(false);
      
      const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
      modal.show();
    } else {
      throw new Error('ไม่สามารถโหลดข้อมูลพนักงานได้');
    }
  } catch (error) {
    console.error('Error loading employee details:', error);
    showError('เกิดข้อผิดพลาดในการโหลดรายละเอียดพนักงาน: ' + error.message);
  }
}

// 🆕 สร้าง options สำหรับ select ตำแหน่ง
function createRoleOptions(currentRoleCode) {
  if (!allRoles || allRoles.length === 0) {
    return '<option value="">ไม่พบข้อมูลตำแหน่ง</option>';
  }

  let optionsHTML = '<option value="">เลือกตำแหน่ง</option>';
  
  // จัดกลุ่มตาม role_group
  const groupedRoles = {
    'owner': [],
    'admin': [],
    'user': []
  };

  allRoles.forEach(role => {
    if (groupedRoles[role.role_group]) {
      groupedRoles[role.role_group].push(role);
    }
  });

  // สร้าง optgroup สำหรับแต่ละกลุ่ม
  if (groupedRoles.owner.length > 0) {
    optionsHTML += '<optgroup label="ผู้บริหาร">';
    groupedRoles.owner.forEach(role => {
      const selected = currentRoleCode === role.role_code ? 'selected' : '';
      optionsHTML += `<option value="${role.role_code}" ${selected}>${role.role_name}</option>`;
    });
    optionsHTML += '</optgroup>';
  }

  if (groupedRoles.admin.length > 0) {
    optionsHTML += '<optgroup label="แอดมิน">';
    groupedRoles.admin.forEach(role => {
      const selected = currentRoleCode === role.role_code ? 'selected' : '';
      optionsHTML += `<option value="${role.role_code}" ${selected}>${role.role_name}</option>`;
    });
    optionsHTML += '</optgroup>';
  }

  if (groupedRoles.user.length > 0) {
    optionsHTML += '<optgroup label="พนักงาน">';
    groupedRoles.user.forEach(role => {
      const selected = currentRoleCode === role.role_code ? 'selected' : '';
      optionsHTML += `<option value="${role.role_code}" ${selected}>${role.role_name}</option>`;
    });
    optionsHTML += '</optgroup>';
  }

  return optionsHTML;
}

// สร้างฟอร์มรายละเอียดพนักงาน - 🆕 เพิ่มฟิลด์เลือกตำแหน่ง
function createEmployeeDetailForm(employee) {
  // สร้าง URL รูปภาพพร้อม cache busting
  const profileImage = (employee.image && employee.image.trim()) ? employee.image : '/uploads/default.png';
  const imageUrl = `${profileImage}${profileImage.includes('?') ? '&' : '?'}t=${Date.now()}`;

  return `
    <div class="row">
      <div class="col-md-4 text-center">
        <img src="${imageUrl}"
             alt="${employee.firstname} ${employee.lastname}"
             class="rounded-circle mb-3"
             style="width: 150px; height: 150px; object-fit: cover;"
             onerror="this.src='/uploads/default.png'">
        <h5 id="displayName">${employee.firstname} ${employee.lastname}</h5>
        <p class="text-muted" id="displayRole">${employee.role_name || 'ไม่ระบุตำแหน่ง'}</p>
        <span class="role-badge ${employee.role_group}" id="displayRoleGroup">${getRoleGroupText(employee.role_group)}</span>
      </div>
      <div class="col-md-8">
        <form id="employeeForm">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>รหัสพนักงาน:</strong></label>
              <input type="text" class="form-control readonly-field" value="${employee.userid}" readonly>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>อีเมล:</strong></label>
              <input type="email" class="form-control" id="email" value="${employee.email || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ชื่อ:</strong></label>
              <input type="text" class="form-control" id="firstname" value="${employee.firstname || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>นามสกุล:</strong></label>
              <input type="text" class="form-control" id="lastname" value="${employee.lastname || ''}" disabled>
            </div>
            <!-- 🆕 เพิ่มฟิลด์เลือกตำแหน่ง -->
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ตำแหน่ง:</strong> <span class="text-danger">*</span></label>
              <select class="form-select" id="role_code" disabled onchange="updateRoleDisplay()">
                ${createRoleOptions(employee.role_code)}
              </select>
              <div class="form-text">⚠️ การเปลี่ยนตำแหน่งจะส่งผลต่อสิทธิ์การเข้าถึงระบบ</div>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เบอร์โทรศัพท์:</strong></label>
              <input type="tel" class="form-control" id="tel" value="${employee.tel || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>อายุ:</strong></label>
              <input type="number" class="form-control" id="age" value="${employee.age || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เพศ:</strong></label>
              <select class="form-select" id="gender" disabled>
                <option value="">เลือกเพศ</option>
                <option value="ชาย" ${employee.gender === 'ชาย' ? 'selected' : ''}>ชาย</option>
                <option value="หญิง" ${employee.gender === 'หญิง' ? 'selected' : ''}>หญิง</option>
              </select>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เงินเดือน:</strong></label>
              <input type="number" class="form-control" id="salary" value="${employee.salary || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>วันเกิด:</strong></label>
              <input type="date" class="form-control" id="birthdate" value="${employee.birthdate ? employee.birthdate.split('T')[0] : ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>สัญชาติ:</strong></label>
              <input type="text" class="form-control" id="nation" value="${employee.nation || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ศาสนา:</strong></label>
              <input type="text" class="form-control" id="religion" value="${employee.religion || ''}" disabled>
            </div>
            <div class="col-md-12 mb-3">
              <label class="form-label"><strong>ที่อยู่:</strong></label>
              <textarea class="form-control" id="address" rows="2" disabled>${employee.address || ''}</textarea>
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>อำเภอ:</strong></label>
              <input type="text" class="form-control" id="district" value="${employee.district || ''}" disabled>
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>จังหวัด:</strong></label>
              <input type="text" class="form-control" id="provience" value="${employee.provience || ''}" disabled>
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>รหัสไปรษณีย์:</strong></label>
              <input type="text" class="form-control" id="zipcode" value="${employee.zipcode || ''}" disabled>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>หมวดวิชา:</strong></label>
              <input type="text" class="form-control readonly-field" id="current_subject" value="${getSubjectName(employee.subject) || '-'}" readonly>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>วันที่เริ่มงาน:</strong></label>
              <input type="text" class="form-control readonly-field" value="${formatDate(employee.created_at)}" readonly>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

// 🆕 อัปเดตการแสดงผลเมื่อเปลี่ยนตำแหน่ง
function updateRoleDisplay() {
  const roleSelect = document.getElementById('role_code');
  const currentSubjectInput = document.getElementById('current_subject');
  
  if (!roleSelect || !roleSelect.value) return;

  const selectedRole = allRoles.find(role => role.role_code === roleSelect.value);
  if (selectedRole) {
    // อัปเดตหมวดวิชา
    const subjectName = getSubjectName(selectedRole.subject) || '-';
    if (currentSubjectInput) {
      currentSubjectInput.value = subjectName;
    }

    // อัปเดตป้ายกลุ่มสิทธิ์
    const displayRoleGroup = document.getElementById('displayRoleGroup');
    if (displayRoleGroup) {
      displayRoleGroup.textContent = getRoleGroupText(selectedRole.role_group);
      displayRoleGroup.className = `role-badge ${selectedRole.role_group}`;
    }

    // อัปเดตชื่อตำแหน่งที่แสดง
    const displayRole = document.getElementById('displayRole');
    if (displayRole) {
      displayRole.textContent = selectedRole.role_name;
    }
  }
}

// เปิด/ปิดโหมดแก้ไข
function toggleEditMode(enabled) {
  const form = document.getElementById('employeeForm');
  const inputs = form.querySelectorAll('input:not(.readonly-field), select, textarea');
  const editBtn = document.getElementById('editBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  inputs.forEach(input => {
    input.disabled = !enabled;
  });

  if (enabled) {
    form.classList.add('edit-mode');
    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelEditBtn.style.display = 'inline-block';
  } else {
    form.classList.remove('edit-mode');
    editBtn.style.display = 'inline-block';
    deleteBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';
  }

  isEditMode = enabled;
}

// ฟังก์ชันแก้ไขพนักงาน
function editEmployee() {
  if (!selectedEmployee) return;
  
  toggleEditMode(true);
  showNotification('เปิดโหมดแก้ไขข้อมูลแล้ว', 'info');
}

// ยกเลิกการแก้ไข - 🆕 รองรับทั้งการแก้ไขและการเพิ่มใหม่
function cancelEdit() {
  // ถ้าเป็นการเพิ่มพนักงานใหม่
  if (!originalEmployeeData) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
    modal.hide();
    resetModalState();
    return;
  }
  
  // ถ้าเป็นการแก้ไขพนักงานที่มีอยู่
  // คืนค่าข้อมูลเดิม
  document.getElementById('email').value = originalEmployeeData.email || '';
  document.getElementById('firstname').value = originalEmployeeData.firstname || '';
  document.getElementById('lastname').value = originalEmployeeData.lastname || '';
  document.getElementById('role_code').value = originalEmployeeData.role_code || '';
  document.getElementById('tel').value = originalEmployeeData.tel || '';
  document.getElementById('age').value = originalEmployeeData.age || '';
  document.getElementById('gender').value = originalEmployeeData.gender || '';
  document.getElementById('salary').value = originalEmployeeData.salary || '';
  document.getElementById('birthdate').value = originalEmployeeData.birthdate ? originalEmployeeData.birthdate.split('T')[0] : '';
  document.getElementById('nation').value = originalEmployeeData.nation || '';
  document.getElementById('religion').value = originalEmployeeData.religion || '';
  document.getElementById('address').value = originalEmployeeData.address || '';
  document.getElementById('district').value = originalEmployeeData.district || '';
  document.getElementById('provience').value = originalEmployeeData.provience || '';
  document.getElementById('zipcode').value = originalEmployeeData.zipcode || '';
  
  // อัปเดตการแสดงผล
  updateRoleDisplay();
  
  toggleEditMode(false);
  showNotification('ยกเลิกการแก้ไขแล้ว', 'info');
}

// บันทึกข้อมูลพนักงาน - 🆕 รองรับการเปลี่ยนตำแหน่ง
async function saveEmployee() {
  if (!selectedEmployee) return;
  
  try {
    // รวบรวมข้อมูลจากฟอร์ม
    const formData = {
      firstname: document.getElementById('firstname').value.trim(),
      lastname: document.getElementById('lastname').value.trim(),
      email: document.getElementById('email').value.trim(),
      role_code: document.getElementById('role_code').value, // 🆕 รวม role_code
      tel: document.getElementById('tel').value.trim(),
      age: document.getElementById('age').value ? parseInt(document.getElementById('age').value) : null,
      gender: document.getElementById('gender').value,
      salary: document.getElementById('salary').value ? parseFloat(document.getElementById('salary').value) : null,
      birthdate: document.getElementById('birthdate').value || null,
      nation: document.getElementById('nation').value.trim(),
      religion: document.getElementById('religion').value.trim(),
      address: document.getElementById('address').value.trim(),
      district: document.getElementById('district').value.trim(),
      provience: document.getElementById('provience').value.trim(),
      zipcode: document.getElementById('zipcode').value.trim()
    };
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!formData.firstname || !formData.lastname || !formData.email || !formData.role_code) {
      showError('กรุณากรอกชื่อ, นามสกุล, อีเมล, และเลือกตำแหน่ง');
      return;
    }
    
    // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    // 🆕 เตือนเมื่อมีการเปลี่ยนตำแหน่ง
    const roleChanged = formData.role_code !== originalEmployeeData.role_code;
    if (roleChanged) {
      const selectedRole = allRoles.find(role => role.role_code === formData.role_code);
      const originalRole = allRoles.find(role => role.role_code === originalEmployeeData.role_code);
      
      const confirmMessage = `คุณกำลังเปลี่ยนตำแหน่งจาก "${originalRole?.role_name}" เป็น "${selectedRole?.role_name}"\n\nการเปลี่ยนตำแหน่งจะส่งผลต่อสิทธิ์การเข้าถึงระบบ\nคุณต้องการดำเนินการต่อหรือไม่?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    // ส่งข้อมูลไปยัง API
    const response = await fetch(`/api/owner/employee/${selectedEmployee.userid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (roleChanged) {
        showNotification('เปลี่ยนตำแหน่งและบันทึกข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
      } else {
        showNotification('บันทึกข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
      }
      
      // อัพเดทข้อมูลในตัวแปร
      originalEmployeeData = { ...originalEmployeeData, ...formData };
      
      // อัปเดตชื่อในหัวของ modal
      document.getElementById('displayName').textContent = `${formData.firstname} ${formData.lastname}`;
      
      // ปิดโหมดแก้ไข
      toggleEditMode(false);
      
      // โหลดข้อมูลพนักงานใหม่
      setTimeout(() => {
        loadEmployees();
      }, 1000);
      
    } else {
      const error = await response.json();
      throw new Error(error.message || 'ไม่สามารถบันทึกข้อมูลได้');
    }
    
  } catch (error) {
    console.error('Error saving employee:', error);
    showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
  }
}

// ฟังก์ชันลบพนักงาน
async function deleteEmployee() {
  if (!selectedEmployee) return;
  
  // ตรวจสอบไม่ให้ลบ Owner
  if (selectedEmployee.role_group === 'owner') {
    showError('ไม่สามารถลบ Owner ได้');
    return;
  }
  
  if (!confirm(`คุณต้องการลบพนักงาน "${selectedEmployee.firstname} ${selectedEmployee.lastname}" หรือไม่?\n\nการกระทำนี้จะลบข้อมูลทั้งหมดของพนักงานรวมถึงประวัติการเข้างานและคำร้องลา\nและไม่สามารถยกเลิกได้`)) {
    return;
  }
  
  // ยืนยันอีกครั้ง
  if (!confirm('คุณแน่ใจหรือไม่? การลบนี้ไม่สามารถกู้คืนได้')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/owner/employee/${selectedEmployee.userid}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('ลบพนักงานเรียบร้อยแล้ว', 'success');
      
      // ปิด modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
      modal.hide();
      
      // โหลดข้อมูลใหม่
      setTimeout(() => {
        loadEmployees();
      }, 1000);
    } else {
      const error = await response.json();
      throw new Error(error.message || 'ไม่สามารถลบพนักงานได้');
    }
  } catch (error) {
    console.error('Error deleting employee:', error);
    showError('เกิดข้อผิดพลาดในการลบพนักงาน: ' + error.message);
  }
}

// ตั้งค่า Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const roleGroupFilter = document.getElementById('roleGroupFilter');
  const genderFilter = document.getElementById('genderFilter');

  // ค้นหาแบบ real-time
  searchInput.addEventListener('input', debounce(applyFilters, 300));
  roleGroupFilter.addEventListener('change', applyFilters);
  genderFilter.addEventListener('change', applyFilters);
  
  // ป้องกันการปิด modal เมื่ออยู่ในโหมดแก้ไข
  const employeeModal = document.getElementById('employeeModal');
  employeeModal.addEventListener('hide.bs.modal', function (event) {
    if (isEditMode) {
      event.preventDefault();
      if (confirm('คุณกำลังแก้ไขข้อมูลอยู่ คุณต้องการออกโดยไม่บันทึกหรือไม่?')) {
        cancelEdit();
        bootstrap.Modal.getInstance(employeeModal).hide();
      }
    }
  });
}

// ฟังก์ชันกรองข้อมูล
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  const roleGroupFilter = document.getElementById('roleGroupFilter').value;
  const genderFilter = document.getElementById('genderFilter').value;

  filteredEmployees = allEmployees.filter(employee => {
    // กรองตามชื่อ
    const matchesSearch = !searchTerm || 
      employee.firstname.toLowerCase().includes(searchTerm) ||
      employee.lastname.toLowerCase().includes(searchTerm) ||
      (employee.firstname + ' ' + employee.lastname).toLowerCase().includes(searchTerm) ||
      employee.email.toLowerCase().includes(searchTerm);

    // กรองตามระดับสิทธิ์
    const matchesRoleGroup = !roleGroupFilter || employee.role_group === roleGroupFilter;

    // กรองตามเพศ
    const matchesGender = !genderFilter || employee.gender === genderFilter;

    return matchesSearch && matchesRoleGroup && matchesGender;
  });

  currentPage = 1;
  displayEmployees();
  updateSearchInfo();
}

// อัปเดตข้อมูลการค้นหา
function updateSearchInfo() {
  const searchInfo = document.getElementById('searchInfo');
  const searchResultText = document.getElementById('searchResultText');
  
  if (filteredEmployees.length !== allEmployees.length) {
    searchInfo.style.display = 'block';
    searchResultText.textContent = `พบ ${filteredEmployees.length} รายการจากทั้งหมด ${allEmployees.length} รายการ`;
  } else {
    searchInfo.style.display = 'none';
  }
}

// อัปเดต Pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const pagination = document.getElementById('pagination');
  const currentPageNum = document.getElementById('currentPageNum');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');

  if (totalPages > 1) {
    pagination.style.display = 'block';
    currentPageNum.textContent = currentPage;
    
    if (currentPage === 1) {
      prevPage.classList.add('disabled');
    } else {
      prevPage.classList.remove('disabled');
    }
    
    if (currentPage === totalPages) {
      nextPage.classList.add('disabled');
    } else {
      nextPage.classList.remove('disabled');
    }
  } else {
    pagination.style.display = 'none';
  }
}

// เปลี่ยนหน้า
function changePage(direction) {
  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const newPage = currentPage + direction;
  
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    displayEmployees();
  }
}

// ล้างการค้นหา
function clearSearch() {
  document.getElementById('searchInput').value = '';
  applyFilters();
}

// รีเซ็ตตัวกรอง
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('roleGroupFilter').value = '';
  document.getElementById('genderFilter').value = '';
  filteredEmployees = [...allEmployees];
  currentPage = 1;
  displayEmployees();
  updateSearchInfo();
}

// แสดง/ซ่อน Loading
function showLoading(show) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const employeeContainer = document.getElementById('employeeContainer');
  
  if (show) {
    loadingIndicator.style.display = 'block';
    employeeContainer.style.display = 'none';
  } else {
    loadingIndicator.style.display = 'none';
    employeeContainer.style.display = 'block';
  }
}

// แสดง/ซ่อน No Results
function showNoResults(show) {
  const noResults = document.getElementById('noResults');
  if (show) {
    noResults.style.display = 'block';
  } else {
    noResults.style.display = 'none';
  }
}

// แสดง/ซ่อน Pagination
function showPagination(show) {
  const pagination = document.getElementById('pagination');
  pagination.style.display = show ? 'block' : 'none';
}

// ฟังก์ชันช่วยเหลือ
function getRoleGroupText(roleGroup) {
  switch(roleGroup) {
    case 'admin': return 'แอดมิน';
    case 'user': return 'พนักงาน';
    case 'owner': return 'เจ้าของ';
    default: return roleGroup || 'ไม่ระบุ';
  }
}

function getSubjectName(subject) {
  if (!subject) return null;
  
  const subjects = {
    'Math': 'คณิตศาสตร์',
    'English': 'ภาษาอังกฤษ',
    'Computer': 'คอมพิวเตอร์',
    'Science': 'วิทยาศาสตร์',
    'SocialStudie': 'สังคมศึกษา',
    'Thai': 'ภาษาไทย',
    'Kindergarten': 'ปฐมวัย'
  };
  return subjects[subject] || subject;
}

function formatSalary(salary) {
  if (!salary || salary === 0) return '0';
  return Number(salary).toLocaleString('th-TH');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(employee) {
  const parts = [];
  if (employee.address) parts.push(employee.address);
  if (employee.district) parts.push('อ.' + employee.district);
  if (employee.provience) parts.push('จ.' + employee.provience);
  if (employee.zipcode) parts.push(employee.zipcode);
  
  return parts.length > 0 ? parts.join(' ') : '-';
}

// Debounce function
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

// แสดงข้อความแสดงข้อผิดพลาด
function showError(message) {
  showNotification(message, 'error');
}

// แสดง notification
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

// 🆕 แสดงฟอร์มเพิ่มพนักงานใหม่
function showAddEmployeeModal() {
  const modalBody = document.getElementById('employeeModalBody');
  modalBody.innerHTML = createAddEmployeeForm();
  
  // Reset modal state
  isEditMode = true;
  selectedEmployee = null;
  originalEmployeeData = null;
  
  // แสดงปุ่มที่เหมาะสม
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').onclick = addNewEmployee;
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  
  // เปลี่ยนหัวเรื่อง modal
  document.getElementById('employeeModalLabel').innerHTML = '<i class="mdi mdi-account-plus me-2"></i>เพิ่มพนักงานใหม่';
  
  const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
  modal.show();
}

// 🆕 สร้างฟอร์มเพิ่มพนักงานใหม่
function createAddEmployeeForm() {
  return `
    <div class="row">
      <div class="col-md-4 text-center">
        <img src="/uploads/default.png"
             alt="รูปภาพ"
             class="rounded-circle mb-3"
             style="width: 150px; height: 150px; object-fit: cover;">
        <h5>พนักงานใหม่</h5>
        <p class="text-muted">กรุณากรอกข้อมูลให้ครบถ้วน</p>
      </div>
      <div class="col-md-8">
        <form id="employeeForm">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>อีเมล:</strong> <span class="text-danger">*</span></label>
              <input type="email" class="form-control" id="email" placeholder="example@school.ac.th" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>รหัสผ่าน:</strong> <span class="text-danger">*</span></label>
              <input type="password" class="form-control" id="password" placeholder="รหัสผ่าน" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ชื่อ:</strong> <span class="text-danger">*</span></label>
              <input type="text" class="form-control" id="firstname" placeholder="ชื่อ" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>นามสกุล:</strong> <span class="text-danger">*</span></label>
              <input type="text" class="form-control" id="lastname" placeholder="นามสกุล" required>
            </div>
            <!-- ฟิลด์เลือกตำแหน่ง -->
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ตำแหน่ง:</strong> <span class="text-danger">*</span></label>
              <select class="form-select" id="role_code" required onchange="updateRoleDisplay()">
                ${createRoleOptions('')}
              </select>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เบอร์โทรศัพท์:</strong></label>
              <input type="tel" class="form-control" id="tel" placeholder="เบอร์โทรศัพท์">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>อายุ:</strong></label>
              <input type="number" class="form-control" id="age" placeholder="อายุ" min="18" max="65">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เพศ:</strong></label>
              <select class="form-select" id="gender">
                <option value="">เลือกเพศ</option>
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>เงินเดือน:</strong></label>
              <input type="number" class="form-control" id="salary" placeholder="เงินเดือน" min="0">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>วันเกิด:</strong></label>
              <input type="date" class="form-control" id="birthdate">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>สัญชาติ:</strong></label>
              <input type="text" class="form-control" id="nation" placeholder="สัญชาติ" value="ไทย">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label"><strong>ศาสนา:</strong></label>
              <input type="text" class="form-control" id="religion" placeholder="ศาสนา" value="พุทธ">
            </div>
            <div class="col-md-12 mb-3">
              <label class="form-label"><strong>ที่อยู่:</strong></label>
              <textarea class="form-control" id="address" rows="2" placeholder="ที่อยู่"></textarea>
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>อำเภอ:</strong></label>
              <input type="text" class="form-control" id="district" placeholder="อำเภอ">
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>จังหวัด:</strong></label>
              <input type="text" class="form-control" id="provience" placeholder="จังหวัด">
            </div>
            <div class="col-md-4 mb-3">
              <label class="form-label"><strong>รหัสไปรษณีย์:</strong></label>
              <input type="text" class="form-control" id="zipcode" placeholder="รหัสไปรษณีย์">
            </div>
          </div>
        </form>
      </div>
    </div>
    <div class="alert alert-info mt-3">
      <i class="mdi mdi-information-outline me-2"></i>
      <strong>หมายเหตุ:</strong> ฟิลด์ที่มีเครื่องหมาย <span class="text-danger">*</span> จำเป็นต้องกรอก
    </div>
  `;
}

// 🆕 เพิ่มพนักงานใหม่
async function addNewEmployee() {
  try {
    // รวบรวมข้อมูลจากฟอร์ม
    const formData = {
      firstname: document.getElementById('firstname').value.trim(),
      lastname: document.getElementById('lastname').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      role_code: document.getElementById('role_code').value,
      tel: document.getElementById('tel').value.trim(),
      age: document.getElementById('age').value ? parseInt(document.getElementById('age').value) : null,
      gender: document.getElementById('gender').value,
      salary: document.getElementById('salary').value ? parseFloat(document.getElementById('salary').value) : null,
      birthdate: document.getElementById('birthdate').value || null,
      nation: document.getElementById('nation').value.trim(),
      religion: document.getElementById('religion').value.trim(),
      address: document.getElementById('address').value.trim(),
      district: document.getElementById('district').value.trim(),
      provience: document.getElementById('provience').value.trim(),
      zipcode: document.getElementById('zipcode').value.trim()
    };
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!formData.firstname || !formData.lastname || !formData.email || !formData.password || !formData.role_code) {
      showError('กรุณากรอกข้อมูลที่จำเป็น: ชื่อ, นามสกุล, อีเมล, รหัสผ่าน, และตำแหน่ง');
      return;
    }
    
    // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน
    if (formData.password.length < 6) {
      showError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    
    // ส่งข้อมูลไปยัง API
    const response = await fetch('/api/owner/employee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const result = await response.json();
      showNotification('เพิ่มพนักงานใหม่เรียบร้อยแล้ว', 'success');
      
      // รีเซ็ต modal state ก่อนปิด modal
      resetModalState();
      
      // ปิด modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
      modal.hide();
      
      // โหลดข้อมูลพนักงานใหม่
      setTimeout(() => {
        loadEmployees();
      }, 1000);
      
    } else {
      const error = await response.json();
      throw new Error(error.message || 'ไม่สามารถเพิ่มพนักงานได้');
    }
    
  } catch (error) {
    console.error('Error adding employee:', error);
    showError('เกิดข้อผิดพลาดในการเพิ่มพนักงาน: ' + error.message);
  }
}

// 🆕 รีเซ็ต modal state
function resetModalState() {
  // เปลี่ยนหัวเรื่องกลับ
  document.getElementById('employeeModalLabel').innerHTML = '<i class="mdi mdi-account-circle me-2"></i>รายละเอียดพนักงาน';
  
  // แสดงปุ่มปกติ
  document.getElementById('editBtn').style.display = 'inline-block';
  document.getElementById('deleteBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('saveBtn').onclick = saveEmployee; // คืนค่า onclick เดิม
  document.getElementById('cancelEditBtn').style.display = 'none';
  
  // รีเซ็ตตัวแปร
  isEditMode = false;
  selectedEmployee = null;
  originalEmployeeData = null;
}

// ฟังก์ชัน logout
function logout() {
  if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
    localStorage.removeItem('loggedInUser');
    window.location.href = '../index.html';
  }
}