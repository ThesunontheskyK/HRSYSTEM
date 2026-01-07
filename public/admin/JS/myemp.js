// Global variables
let allEmployees = [];
let filteredEmployees = [];
let currentPage = 1;
let currentUser = null;
let userPermissions = null;
let availableRoles = [];
const itemsPerPage = 8;
let searchTimeout;
let isEditMode = false;
let currentEditingUserId = null;

// Initialize page when DOM loads
window.onload = async function () {
  try {
    // Check user authentication from session instead of localStorage
    const sessionResponse = await fetch('/api/check-session');
    const sessionData = await sessionResponse.json();
    
    if (!sessionData.success || !sessionData.authenticated) {
      alert('กรุณาเข้าสู่ระบบก่อน');
      window.location.href = '/index.html';
      return;
    }

    currentUser = sessionData.user;

    // Load admin info and check permission
    await loadUserInfo();
    await checkPermissions();
    await loadEmployees();
    setupEventListeners();
    
  } catch (error) {
    console.error('Initialization failed:', error);
    showError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
  }
};

// Load user information
async function loadUserInfo() {
  try {
    const res = await fetch(`/api/admininfo/${currentUser.userid}`);
    if (!res.ok) throw new Error('Failed to fetch admin info');

    const userInfo = await res.json();

    const sideImg = document.getElementById('sidebarProfilePic');
    if (sideImg) {
      const src = (userInfo.image && userInfo.image.trim()) ? userInfo.image : '/uploads/default.png';
      sideImg.src = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
    }

    // Update UI
    document.getElementById('username').innerText = `${userInfo.firstname || 'Admin'} ${userInfo.lastname || ''}`;
    document.getElementById('subjectname').innerText = `${userInfo.role_name || 'Admin'}`;

    // Check if user is admin
    if (userInfo.role_group !== 'admin') {
      throw new Error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะแอดมินเท่านั้น)');
    }

    currentUser = { ...currentUser, ...userInfo };

  } catch (error) {
    console.error('ดึงข้อมูลผู้ใช้ล้มเหลว:', error);
    throw error;
  }
}

// Check user permissions using new API
async function checkPermissions() {
  try {
    const response = await fetch('/api/my-permissions');
    if (!response.ok) throw new Error('Failed to fetch permissions');

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    userPermissions = data.data.permissions;

    // Update page header and buttons based on permissions
    updatePageHeader(data.data.permissions);
    updateUIBasedOnPermissions(data.data.permissions);

  } catch (error) {
    console.error('Permission check failed:', error);
    throw new Error('ไม่สามารถตรวจสอบสิทธิ์ได้');
  }
}

// Update page header with permission info
function updatePageHeader(permissions) {
  const mainContent = document.querySelector('.main-content .container');

  // Create or update scope info
  let scopeInfo = document.getElementById('scopeInfo');
  if (!scopeInfo) {
    scopeInfo = document.createElement('div');
    scopeInfo.id = 'scopeInfo';
    scopeInfo.className = 'alert alert-info mb-4';
    mainContent.insertBefore(scopeInfo, mainContent.firstChild);
  }

  scopeInfo.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="mdi mdi-information-outline me-2"></i>
      <div>
        <strong>ขอบเขตการดูแล:</strong> ${permissions.role_name}
        <br>
        <small class="text-muted">
          ${permissions.can_manage.includes('all') ? 'ดูแลพนักงานทุกคน' :
      `ดูแลเฉพาะ: ${permissions.manageable_roles?.map(role => getRoleName(role)).join(', ') || 'ไม่ระบุ'}`}
        </small>
      </div>
    </div>
  `;
}

// Update UI elements based on user permissions
function updateUIBasedOnPermissions(permissions) {
  const addBtn = document.getElementById('addEmployeeBtn');
  const editBtn = document.getElementById('editEmployeeBtn');
  const deleteBtn = document.getElementById('deleteEmployeeBtn');

  // Show Add/Edit/Delete buttons only for admin_hr
  if (permissions.permissions.includes('update_all_employees')) {
    if (addBtn) addBtn.style.display = 'inline-block';
    if (editBtn) editBtn.style.display = 'inline-block';
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
  } else {
    if (addBtn) addBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }
}

// Load employees using new permission-based API
async function loadEmployees() {
  showLoading(true);

  try {
    const response = await fetch('/api/adminemployees', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to load employees');
    }

    allEmployees = data.data || [];
    filteredEmployees = [...allEmployees];

    if (allEmployees.length === 0) {
      showNoEmployeesMessage();
      return;
    }

    displayEmployees();
    updateSearchInfo();

  } catch (error) {
    console.error('โหลดรายชื่อพนักงานล้มเหลว:', error);
    showError('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// Load available roles for dropdowns
async function loadAvailableRoles() {
  try {
    const response = await fetch('/api/hr/roles');
    if (!response.ok) throw new Error('Failed to fetch roles');

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    availableRoles = data.data || [];
    return availableRoles;

  } catch (error) {
    console.error('Failed to load roles:', error);
    return [];
  }
}

// Show message when no employees under management
function showNoEmployeesMessage(message = 'ไม่มีพนักงานใต้บังคับบัญชา') {
  const container = document.getElementById('employeeContainer');
  container.innerHTML = `
    <div class="col-12">
      <div class="card">
        <div class="card-body text-center py-5">
          <div class="mb-3">
            <i class="mdi mdi-account-group text-muted" style="font-size: 4rem;"></i>
          </div>
          <h5 class="text-muted">${message}</h5>
          <p class="text-muted">ท่านไม่มีสิทธิ์เข้าถึงข้อมูลพนักงานกลุ่มนี้ หรือยังไม่มีพนักงานในระบบ</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('noResults').style.display = 'none';
  document.getElementById('pagination').style.display = 'none';
}

// Search employees using API
async function searchEmployees(keyword) {
  if (!keyword.trim()) {
    filteredEmployees = [...allEmployees];
    applyCurrentFilters();
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`/api/searchemployees?keyword=${encodeURIComponent(keyword)}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Search failed');
    }

    // Apply additional filters to search results
    filteredEmployees = applyFiltersToResults(data.data || []);
    currentPage = 1;

    displayEmployees();
    updateSearchInfo(`ผลการค้นหา "${keyword}"`);

  } catch (error) {
    console.error('ค้นหาพนักงานล้มเหลว:', error);
    
    // Fallback to client-side search
    clientSideSearch(keyword);
  } finally {
    showLoading(false);
  }
}

// Fallback client-side search
function clientSideSearch(keyword) {
  const searchResults = allEmployees.filter(emp => {
    const searchStr = keyword.toLowerCase();
    return (
      emp.firstname?.toLowerCase().includes(searchStr) ||
      emp.lastname?.toLowerCase().includes(searchStr) ||
      emp.email?.toLowerCase().includes(searchStr) ||
      emp.userid?.toString().includes(searchStr) ||
      getRoleName(emp.role_code)?.toLowerCase().includes(searchStr)
    );
  });

  filteredEmployees = applyFiltersToResults(searchResults);
  currentPage = 1;
  displayEmployees();
  updateSearchInfo(`ผลการค้นหา "${keyword}" (ออฟไลน์)`);
}

// Apply filters to employee results
function applyFiltersToResults(employees) {
  let results = [...employees];

  // Filter by department
  const department = document.getElementById('departmentFilter').value;
  if (department) {
    results = results.filter(emp => emp.role_code === department);
  }

  // Filter by gender
  const gender = document.getElementById('genderFilter').value;
  if (gender) {
    results = results.filter(emp => emp.gender === gender);
  }

  return results;
}

// Apply current filters without search
function applyCurrentFilters() {
  filteredEmployees = applyFiltersToResults(allEmployees);
  currentPage = 1;
  displayEmployees();
  updateSearchInfo();
}

// Apply all filters (called by filter button)
function applyFilters() {
  const searchKeyword = document.getElementById('searchInput').value.trim();

  if (searchKeyword) {
    searchEmployees(searchKeyword);
  } else {
    applyCurrentFilters();
  }
}

// Display employees with pagination
function displayEmployees() {
  const container = document.getElementById('employeeContainer');
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const employeesToShow = filteredEmployees.slice(startIndex, endIndex);

  // Clear previous content
  container.innerHTML = '';

  // Handle no results
  if (employeesToShow.length === 0) {
    document.getElementById('noResults').style.display = 'block';
    document.getElementById('pagination').style.display = 'none';
    return;
  }

  document.getElementById('noResults').style.display = 'none';

  // Generate employee cards
  employeesToShow.forEach(emp => {
    container.appendChild(createEmployeeCard(emp));
  });

  // Update pagination
  updatePagination();
}

// Create employee card element
function createEmployeeCard(emp) {
  const roleName = getRoleName(emp.role_code);

  // ใช้รูปจริงของบุคคลากร หรือรูป default หากไม่มี
  const profileImage = (emp.image && emp.image.trim()) ? emp.image : '/uploads/default.png';
  const imageUrl = `${profileImage}${profileImage.includes('?') ? '&' : '?'}t=${Date.now()}`;

  // Create card element
  const cardDiv = document.createElement('div');
  cardDiv.className = 'candidate-list-box bookmark-post card mt-4 candidate-card';

  cardDiv.innerHTML = `
    <div class="p-4 card-body">
      <div class="align-items-center row">
        <div class="col-auto">
          <div class="candidate-list-images">
            <img src="${imageUrl}"
                 class="avatar-md img-thumbnail rounded-circle"
                 alt="${emp.firstname} ${emp.lastname}"
                 onerror="this.src='/uploads/default.png'">
          </div>
        </div>
        <div class="col-lg-5">
          <div class="candidate-list-content mt-3 mt-lg-0">
            <h5 class="fs-19 mb-0">
              <span class="primary-link">${emp.firstname} ${emp.lastname}</span>
              </span>
            </h5>
            <p class="text-muted mb-2">${roleName}</p>
            <ul class="list-inline mb-0 text-muted">
              <li class="list-inline-item">
                <i class="mdi mdi-map-marker"></i> ${emp.provience || 'ไม่ระบุ'}
              </li>
              <li class="list-inline-item">
                <i class="mdi mdi-email"></i> ${emp.email || 'ไม่ระบุ'}
              </li>
            </ul>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="mt-2 mt-lg-0 d-flex flex-wrap align-items-start gap-1">
            <span class="badge bg-soft-secondary fs-14 mt-1">ID: ${emp.userid}</span>
            ${emp.age ? `<span class="badge bg-soft-info fs-14 mt-1">อายุ ${emp.age} ปี</span>` : ''}
            ${emp.gender ? `<span class="badge bg-soft-success fs-14 mt-1">${emp.gender}</span>` : ''}
            ${emp.tel ? `<span class="badge bg-soft-warning fs-14 mt-1">${emp.tel}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="favorite-icon">
        <a href="#" onclick="viewEmployeeDetails(${emp.userid})" title="ดูรายละเอียด">
          <i class="mdi mdi-eye fs-18"></i>
        </a>
      </div>
    </div>
  `;

  return cardDiv;
}

// ฟังก์ชันแปลง role code เป็นชื่อตำแหน่ง
function getRoleName(roleCode) {
  const roleNames = {
    // ครู
    'mathteacher': 'ครูคณิตศาสตร์',
    'engteacher': 'ครูภาษาอังกฤษ',
    'computerteacher': 'ครูคอมพิวเตอร์',
    'sciteacher': 'ครูวิทยาศาสตร์',
    'socialteacher': 'ครูสังคมศึกษา',
    'thaiteacher': 'ครูภาษาไทย',
    'kindergarten_teacher': 'ครูปกมวย',

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
    'quality_staff': 'เจ้าหน้าที่มาตรการ',
    'resource_staff': 'เจ้าหน้าที่ทรัพยากร',
    'student_affair_staff': 'เจ้าหน้าที่กิจการนักเรียน',

    // Admin
    'admin_academic': 'หัวหน้าฝ่ายวิชาการ',
    'admin_hr': 'หัวหน้าฝ่ายบุคลากร',
    'admin_kindergarten': 'หัวหน้าแผนกปกมวย',
    'admin_management': 'คณะกรรมการบริหารโรงเรียน',
    'admin_operation': 'หัวหน้าฝ่ายบริหาร',
    'admin_pastoral': 'หัวหน้าฝ่ายอภิบาล',
    'admin_quality': 'หัวหน้าฝ่ายมาตรการ',
    'admin_resource': 'หัวหน้าฝ่ายทรัพยากร',
    'admin_student': 'หัวหน้าฝ่ายกิจการนักเรียน'
  };

  return roleNames[roleCode?.toLowerCase()] || roleCode || 'ไม่ระบุ';
}

// Setup event listeners
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');

  // Search input with debounce
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const keyword = this.value.trim();
      if (keyword) {
        searchEmployees(keyword);
      } else {
        applyCurrentFilters();
      }
    }, 500);
  });

  // Search on Enter key
  searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimeout);
      const keyword = this.value.trim();
      if (keyword) {
        searchEmployees(keyword);
      } else {
        applyCurrentFilters();
      }
    }
  });

  // Filter change events
  document.getElementById('departmentFilter').addEventListener('change', function () {
    if (document.getElementById('searchInput').value.trim()) {
      searchEmployees(document.getElementById('searchInput').value.trim());
    } else {
      applyCurrentFilters();
    }
  });

  document.getElementById('genderFilter').addEventListener('change', function () {
    if (document.getElementById('searchInput').value.trim()) {
      searchEmployees(document.getElementById('searchInput').value.trim());
    } else {
      applyCurrentFilters();
    }
  });
}

// Clear search input
function clearSearch() {
  document.getElementById('searchInput').value = '';
  clearTimeout(searchTimeout);
  applyCurrentFilters();
}

// Reset all filters
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('departmentFilter').value = '';
  document.getElementById('genderFilter').value = '';

  filteredEmployees = [...allEmployees];
  currentPage = 1;
  displayEmployees();
  updateSearchInfo();
}

// Update search info display
function updateSearchInfo(searchText = '') {
  const infoElement = document.getElementById('searchInfo');
  const resultTextElement = document.getElementById('searchResultText');

  let infoText = '';

  if (searchText) {
    infoText = `${searchText} - พบ ${filteredEmployees.length} คน`;
  } else {
    const hasFilters = document.getElementById('departmentFilter').value ||
      document.getElementById('genderFilter').value;

    if (hasFilters) {
      infoText = `แสดงผลการกรอง ${filteredEmployees.length} จาก ${allEmployees.length} คน`;
    } else {
      const scopeText = userPermissions?.role_name || 'ใต้บังคับบัญชา';
      infoText = `แสดงพนักงาน${scopeText} ${allEmployees.length} คน`;
    }
  }

  resultTextElement.textContent = infoText;
  infoElement.style.display = 'block';
}

// Update pagination controls
function updatePagination() {
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginationElement = document.getElementById('pagination');

  if (totalPages <= 1) {
    paginationElement.style.display = 'none';
    return;
  }

  paginationElement.style.display = 'block';
  document.getElementById('currentPageNum').textContent = `${currentPage} / ${totalPages}`;

  // Update previous button
  const prevButton = document.getElementById('prevPage');
  if (currentPage === 1) {
    prevButton.classList.add('disabled');
  } else {
    prevButton.classList.remove('disabled');
  }

  // Update next button
  const nextButton = document.getElementById('nextPage');
  if (currentPage === totalPages) {
    nextButton.classList.add('disabled');
  } else {
    nextButton.classList.remove('disabled');
  }
}

// Change page function
function changePage(direction) {
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const newPage = currentPage + direction;

  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    displayEmployees();

    // Scroll to top of employee list
    document.getElementById('employeeContainer').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Show loading indicator
function showLoading(show) {
  const loadingElement = document.getElementById('loadingIndicator');
  const containerElement = document.getElementById('employeeContainer');

  if (show) {
    loadingElement.style.display = 'block';
    containerElement.style.opacity = '0.5';
  } else {
    loadingElement.style.display = 'none';
    containerElement.style.opacity = '1';
  }
}

// Show success message
function showSuccess(message) {
  const toastBody = document.getElementById('successToastBody');
  toastBody.textContent = message;
  
  const toast = new bootstrap.Toast(document.getElementById('successToast'));
  toast.show();
}

// Show error message
function showError(message) {
  console.error(message);

  // Show toast error
  const toastBody = document.getElementById('errorToastBody');
  toastBody.textContent = message;
  
  const toast = new bootstrap.Toast(document.getElementById('errorToast'));
  toast.show();
}

// View employee details (opens modal)
async function viewEmployeeDetails(userid) {
  try {
    // Get detailed employee info from API
    const response = await fetch(`/api/hr/employees/${userid}`);
    if (!response.ok) throw new Error('Failed to fetch employee details');

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    const employee = data.data;

    // Populate modal with employee details
    const modalBody = document.getElementById('employeeModalBody');
    const roleName = getRoleName(employee.role_code);

    // ใช้รูปจริงของพนักงานพร้อม cache busting
    const profileImage = (employee.image && employee.image.trim()) ? employee.image : '/uploads/default.png';
    const imageUrl = `${profileImage}${profileImage.includes('?') ? '&' : '?'}t=${Date.now()}`;

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-4 text-center">
          <img src="${imageUrl}"
               class="img-fluid rounded-circle mb-3"
               style="width: 150px; height: 150px; object-fit: cover;"
               alt="${employee.firstname} ${employee.lastname}"
               onerror="this.src='/uploads/default.png'">
        </div>
        <div class="col-md-8">
          <table class="table table-borderless">
            <tr>
              <td><strong>ชื่อ-นามสกุล:</strong></td>
              <td>${employee.firstname} ${employee.lastname}</td>
            </tr>
            <tr>
              <td><strong>ตำแหน่ง:</strong></td>
              <td>${roleName}</td>
            </tr>
            <tr>
              <td><strong>รหัสพนักงาน:</strong></td>
              <td>${employee.userid}</td>
            </tr>
            <tr>
              <td><strong>อีเมล:</strong></td>
              <td>${employee.email || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>เบอร์โทร:</strong></td>
              <td>${employee.tel || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>อายุ:</strong></td>
              <td>${employee.age ? employee.age + ' ปี' : 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>เพศ:</strong></td>
              <td>${employee.gender || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>จังหวัด:</strong></td>
              <td>${employee.provience || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>ที่อยู่:</strong></td>
              <td>${employee.address || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>วันเกิด:</strong></td>
              <td>${employee.birthdate ? new Date(employee.birthdate).toLocaleDateString('th-TH') : 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>วันที่สมัครงาน:</strong></td>
              <td>${employee.created_at ? new Date(employee.created_at).toLocaleDateString('th-TH') : 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td><strong>เงินเดือน:</strong></td>
              <td>${employee.salary ? new Intl.NumberFormat('th-TH').format(employee.salary) + ' บาท' : 'ไม่ระบุ'}</td>
            </tr>
          </table>
        </div>
      </div>
    `;

    // Store current employee ID for edit/delete functions
    currentEditingUserId = userid;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
    modal.show();

  } catch (error) {
    console.error('Error viewing employee details:', error);
    showError('ไม่สามารถโหลดรายละเอียดพนักงานได้: ' + error.message);
  }
}

// Open Add Employee Modal
async function openAddEmployeeModal() {
  isEditMode = false;
  currentEditingUserId = null;
  
  // Load available roles
  await loadAvailableRoles();
  populateRoleDropdown();
  
  // Reset form
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeFormModalLabel').innerHTML = '<i class="mdi mdi-account-plus"></i> เพิ่มพนักงานใหม่';
  document.getElementById('submitBtn').innerHTML = '<i class="mdi mdi-content-save"></i> บันทึก';
  
  // Show password field for new employee
  document.getElementById('passwordField').style.display = 'block';
  document.getElementById('password').required = true;

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('employeeFormModal'));
  modal.show();
}

// Edit Employee from Modal
async function editEmployeeFromModal() {
  if (!currentEditingUserId) {
    showError('ไม่พบรหัสพนักงานที่ต้องการแก้ไข');
    return;
  }

  try {
    // Get detailed employee info
    const response = await fetch(`/api/hr/employees/${currentEditingUserId}`);
    if (!response.ok) throw new Error('Failed to fetch employee details');

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    const employee = data.data;
    
    // Set edit mode
    isEditMode = true;
    
    // Load available roles
    await loadAvailableRoles();
    populateRoleDropdown();
    
    // Populate form with employee data
    document.getElementById('firstname').value = employee.firstname || '';
    document.getElementById('lastname').value = employee.lastname || '';
    document.getElementById('email').value = employee.email || '';
    document.getElementById('role_code').value = employee.role_code || '';
    document.getElementById('tel').value = employee.tel || '';
    document.getElementById('salary').value = employee.salary || '';
    document.getElementById('age').value = employee.age || '';
    document.getElementById('gender').value = employee.gender || '';
    document.getElementById('birthdate').value = employee.birthdate ? employee.birthdate.split('T')[0] : '';
    document.getElementById('nation').value = employee.nation || '';
    document.getElementById('religion').value = employee.religion || '';
    document.getElementById('address').value = employee.address || '';
    document.getElementById('district').value = employee.district || '';
    document.getElementById('provience').value = employee.provience || '';
    document.getElementById('zipcode').value = employee.zipcode || '';
    
    // Update modal title and button for edit mode
    document.getElementById('employeeFormModalLabel').innerHTML = '<i class="mdi mdi-account-edit"></i> แก้ไขข้อมูลพนักงาน';
    document.getElementById('submitBtn').innerHTML = '<i class="mdi mdi-content-save"></i> บันทึกการแก้ไข';
    
    // Hide password field for edit mode
    document.getElementById('passwordField').style.display = 'none';
    document.getElementById('password').required = false;

    // Close employee detail modal and open edit modal
    bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
    const editModal = new bootstrap.Modal(document.getElementById('employeeFormModal'));
    editModal.show();

  } catch (error) {
    console.error('Error loading employee for edit:', error);
    showError('ไม่สามารถโหลดข้อมูลพนักงานสำหรับแก้ไขได้: ' + error.message);
  }
}

// Delete Employee from Modal
async function deleteEmployeeFromModal() {
  if (!currentEditingUserId) {
    showError('ไม่พบรหัสพนักงานที่ต้องการลบ');
    return;
  }

  // Get employee info for confirmation
  const employee = allEmployees.find(emp => emp.userid == currentEditingUserId);
  if (!employee) {
    showError('ไม่พบข้อมูลพนักงาน');
    return;
  }

  const confirmMessage = `คุณต้องการลบพนักงาน "${employee.firstname} ${employee.lastname}" หรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้`;
  
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const response = await fetch(`/api/hr/employees/${currentEditingUserId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to delete employee');
    }

    // Close modal and refresh employee list
    bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
    showSuccess('ลบพนักงานเรียบร้อยแล้ว');
    
    // Refresh employee list
    await loadEmployees();

  } catch (error) {
    console.error('Error deleting employee:', error);
    showError('ไม่สามารถลบพนักงานได้: ' + error.message);
  }
}

// Populate role dropdown
function populateRoleDropdown() {
  const roleSelect = document.getElementById('role_code');
  roleSelect.innerHTML = '<option value="">เลือกตำแหน่ง</option>';

  availableRoles.forEach(role => {
    const option = document.createElement('option');
    option.value = role.role_code;
    option.textContent = `${role.role_name} ${role.subject ? `(${role.subject})` : ''}`;
    roleSelect.appendChild(option);
  });
}

// Submit Employee Form (Add or Edit)
async function submitEmployeeForm(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnText = submitBtn.innerHTML;
  
  // Disable submit button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="spinner-border spinner-border-sm me-2"></i>กำลังบันทึก...';

  try {
    const formData = new FormData(event.target);
    const employeeData = Object.fromEntries(formData.entries());

    let response;
    let successMessage;

    if (isEditMode && currentEditingUserId) {
      // Update existing employee
      response = await fetch(`/api/hr/employees/${currentEditingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });
      successMessage = 'แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว';
    } else {
      // Add new employee
      response = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });
      successMessage = 'เพิ่มพนักงานใหม่เรียบร้อยแล้ว';
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Operation failed');
    }

    // Close modal and show success message
    bootstrap.Modal.getInstance(document.getElementById('employeeFormModal')).hide();
    showSuccess(successMessage);
    
    // Reset form and refresh employee list
    document.getElementById('employeeForm').reset();
    await loadEmployees();

  } catch (error) {
    console.error('Error submitting employee form:', error);
    showError('เกิดข้อผิดพลาด: ' + error.message);
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

// Logout function
async function logout() {
  if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
    try {
      // Call logout API
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      // Ignore logout API errors
    }

    // Clear local storage and redirect
    localStorage.removeItem('loggedInUser');
    window.location.href = '/index.html';
  }
}