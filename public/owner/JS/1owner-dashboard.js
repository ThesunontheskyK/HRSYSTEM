// ตัวแปรส่วนกลาง
let calendar;
let currentUser = null;
let allCalendarEvents = []; // เก็บข้อมูล events ทั้งหมด

// ตัวแปรสำหรับข้อมูลฟอร์ม
let departments = [];
let subjects = [];
let roles = { admin: [], user: [] };

// ระบบตรวจสอบการ Login
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

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async function() {
  try {
    
    // เช็ค Login Status
    currentUser = checkLoginStatus();
    if (!currentUser) return;
    
    
    // Debug: ตรวจสอบว่า elements สำคัญมีอยู่หรือไม่
    const toggleBtn = document.getElementById('toggleFormBtn');
    const deleteBtn = document.getElementById('deleteMeetingBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const deleteModal = document.getElementById('deleteModalOverlay');
    
    
    // โหลดข้อมูล
    await Promise.all([
      loadUserProfile(),
      loadDashboardStats(),
      loadFormData(), // เพิ่มการโหลดข้อมูลฟอร์ม
      loadCalendarData()
    ]);
    
    // Setup Event Listeners หลังจากโหลดข้อมูลเสร็จ
    setupEventListeners();
    
  } catch (error) {
    showNotification('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  }
});

// โหลดข้อมูลสำหรับฟอร์ม (departments, subjects, roles) พร้อม error handling
async function loadFormData() {
  try {


    // โหลดข้อมูลฝ่าย
    try {
      const deptResponse = await fetch('/api/meetings/departments');
      
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        
        if (deptData.success && deptData.data) {
          departments = deptData.data;
          renderDepartments();
        }
      } else {
        console.warn('Departments API failed, using fallback data');
        departments = [
          { value: 'hr', label: 'ฝ่ายบุคลากร' },
          { value: 'academic', label: 'ฝ่ายวิชาการ' },
          { value: 'student', label: 'ฝ่ายกิจการนักเรียน' }
        ];
        renderDepartments();
      }
    } catch (deptError) {
      console.error('Departments loading error:', deptError);
      departments = [
        { value: 'hr', label: 'ฝ่ายบุคลากร' },
        { value: 'academic', label: 'ฝ่ายวิชาการ' }
      ];
      renderDepartments();
    }

    // โหลดข้อมูลหมวดวิชา
    try {
      const subjectResponse = await fetch('/api/meetings/subjects');

      
      if (subjectResponse.ok) {
        const subjectData = await subjectResponse.json();

        
        if (subjectData.success && subjectData.data) {
          subjects = subjectData.data;
          renderSubjects();

        }
      } else {
        console.warn('Subjects API failed, using fallback data');
        subjects = [
          { value: 'Math', label: 'คณิตศาสตร์' },
          { value: 'English', label: 'ภาษาอังกฤษ' },
          { value: 'Thai', label: 'ภาษาไทย' }
        ];
        renderSubjects();
      }
    } catch (subjectError) {
      console.error('Subjects loading error:', subjectError);
      subjects = [
        { value: 'Math', label: 'คณิตศาสตร์' },
        { value: 'English', label: 'ภาษาอังกฤษ' }
      ];
      renderSubjects();
    }

    // โหลดข้อมูลตำแหน่ง
    try {
      const rolesResponse = await fetch('/api/meetings/roles');

      
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();

        
        if (rolesData.success && rolesData.data) {
          roles = rolesData.data;
          renderRoles();

        }
      } else {
        console.warn('Roles API failed, using fallback data');
        roles = {
          admin: [
            { value: 'admin_hr', label: 'หัวหน้าฝ่ายบุคลากร' },
            { value: 'admin_academic', label: 'หัวหน้าฝ่ายวิชาการ' }
          ],
          user: [
            { value: 'mathteacher', label: 'ครูคณิตศาสตร์' },
            { value: 'engteacher', label: 'ครูภาษาอังกฤษ' }
          ]
        };
        renderRoles();
      }
    } catch (rolesError) {
      console.error('Roles loading error:', rolesError);
      roles = {
        admin: [{ value: 'admin_hr', label: 'หัวหน้าฝ่ายบุคลากร' }],
        user: [{ value: 'mathteacher', label: 'ครูคณิตศาสตร์' }]
      };
      renderRoles();
    }


  } catch (error) {
    console.error('Critical error loading form data:', error);
    
    // ใช้ข้อมูล fallback ขั้นต่ำ
    departments = [{ value: 'all', label: 'ทุกฝ่าย' }];
    subjects = [{ value: 'All', label: 'ทุกหมวดวิชา' }];
    roles = {
      admin: [{ value: 'admin_hr', label: 'แอดมิน' }],
      user: [{ value: 'teacher', label: 'ครู' }]
    };
    
    renderDepartments();
    renderSubjects();
    renderRoles();
    
    showNotification('โหลดข้อมูลไม่สมบูรณ์ ใช้ข้อมูลพื้นฐานแทน', 'warning');
  }
}

// แสดงตัวเลือกฝ่าย
function renderDepartments() {
  const container = document.getElementById('department-list');
  if (!container) return;
  
  container.innerHTML = departments.map(dept => `
    <label class="checkbox-option">
      <input type="checkbox" value="${dept.value}" onchange="updateParticipantsPreview()">
      <span>${dept.label}</span>
    </label>
  `).join('');
}

// แสดงตัวเลือกหมวดวิชา
function renderSubjects() {
  const container = document.getElementById('subject-list');
  if (!container) return;
  
  container.innerHTML = subjects.map(subject => `
    <label class="checkbox-option">
      <input type="checkbox" value="${subject.value}" onchange="updateParticipantsPreview()">
      <span>${subject.label}</span>
    </label>
  `).join('');
}

// แสดงตัวเลือกตำแหน่ง
function renderRoles() {
  // ผู้ดูแลระบบ
  const adminContainer = document.getElementById('admin-roles-list');
  if (adminContainer) {
    adminContainer.innerHTML = roles.admin.map(role => `
      <label class="checkbox-option">
        <input type="checkbox" value="${role.value}" onchange="updateParticipantsPreview()">
        <span>${role.label}</span>
      </label>
    `).join('');
  }

  // ครูและบุคลากร
  const userContainer = document.getElementById('user-roles-list');
  if (userContainer) {
    userContainer.innerHTML = roles.user.map(role => `
      <label class="checkbox-option">
        <input type="checkbox" value="${role.value}" onchange="updateParticipantsPreview()">
        <span>${role.label}${role.subject ? ` (${role.subject})` : ''}</span>
      </label>
    `).join('');
  }
}

// เลือกประเภทการประชุม (ทำให้เป็น global function)
window.selectMeetingType = function(type) {
  // อัปเดต UI tabs
  document.querySelectorAll('.tab-option').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`.tab-option[data-type="${type}"]`).classList.add('active');
  
  // ตั้งค่า hidden input
  document.getElementById('meetingType').value = type;
  
  // แสดง/ซ่อน options
  document.querySelectorAll('.target-options').forEach(option => {
    option.style.display = 'none';
  });
  
  if (type === 'department') {
    document.getElementById('department-options').style.display = 'block';
  } else if (type === 'subject') {
    document.getElementById('subject-options').style.display = 'block';
  } else if (type === 'specific_roles') {
    document.getElementById('roles-options').style.display = 'block';
  }
  
  // อัปเดตตัวอย่างผู้เข้าร่วม
  updateParticipantsPreview();
};

// อัปเดตตัวอย่างผู้เข้าร่วม
function updateParticipantsPreview() {
  const previewDiv = document.getElementById('participants-preview');
  const countDiv = document.getElementById('participants-count');
  const listDiv = document.getElementById('participants-list');
  
  const meetingType = document.getElementById('meetingType').value;
  
  if (meetingType === 'all') {
    countDiv.textContent = 'ผู้เข้าร่วม: พนักงานทุกคน';
    listDiv.textContent = 'การประชุมนี้จะเชิญพนักงานทุกคนในองค์กร';
    previewDiv.style.display = 'block';
  } else {
    // ประเภทอื่นๆ แสดงจำนวนคร่าวๆ
    let selectedCount = 0;
    let selectedItems = [];
    
    if (meetingType === 'department') {
      const checkedDepts = document.querySelectorAll('#department-list input:checked');
      selectedCount = checkedDepts.length;
      selectedItems = Array.from(checkedDepts).map(input => 
        departments.find(d => d.value === input.value)?.label || input.value
      );
    } else if (meetingType === 'subject') {
      const checkedSubjects = document.querySelectorAll('#subject-list input:checked');
      selectedCount = checkedSubjects.length;
      selectedItems = Array.from(checkedSubjects).map(input => 
        subjects.find(s => s.value === input.value)?.label || input.value
      );
    } else if (meetingType === 'specific_roles') {
      const checkedRoles = document.querySelectorAll('#roles-options input:checked');
      selectedCount = checkedRoles.length;
      selectedItems = Array.from(checkedRoles).map(input => {
        const adminRole = roles.admin.find(r => r.value === input.value);
        const userRole = roles.user.find(r => r.value === input.value);
        return (adminRole || userRole)?.label || input.value;
      });
    }
    
    if (selectedCount > 0) {
      countDiv.textContent = `ผู้เข้าร่วม: ${selectedItems.join(', ')}`;
      listDiv.textContent = `เลือกแล้ว ${selectedCount} กลุ่ม`;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }
  }
}

// รีเซ็ตฟอร์ม
function resetMeetingForm() {
  document.getElementById('addMeetingForm').reset();
  document.getElementById('meetingType').value = 'all';
  
  // รีเซ็ต tabs
  document.querySelectorAll('.tab-option').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector('.tab-option[data-type="all"]').classList.add('active');
  
  // ซ่อน options ทั้งหมด
  document.querySelectorAll('.target-options').forEach(option => {
    option.style.display = 'none';
  });
  
  // รีเซ็ต checkboxes
  document.querySelectorAll('.target-options input[type="checkbox"]').forEach(input => {
    input.checked = false;
  });
  
  // ซ่อนตัวอย่างผู้เข้าร่วม
  document.getElementById('participants-preview').style.display = 'none';
  
  // ตั้งค่าเริ่มต้น
  updateParticipantsPreview();
}

// ตั้งค่าเวลาเริ่มต้น
function setDefaultDateTime() {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0); // ชั่วโมงถัดไป
  
  const startInput = document.getElementById('meetingStart');
  if (startInput) {
    startInput.value = now.toISOString().slice(0, 16);
  }
  
  // ตั้งเวลาสิ้นสุดเป็น 2 ชั่วโมงหลังจากเริ่ม
  const endTime = new Date(now);
  endTime.setHours(endTime.getHours() + 2);
  
  const endInput = document.getElementById('meetingEnd');
  if (endInput) {
    endInput.value = endTime.toISOString().slice(0, 16);
  }
}

// โหลดโปรไฟล์ผู้ใช้
async function loadUserProfile() {
  try {
    const response = await fetch(`/api/ownerinfo/${currentUser.userid}`);
    if (response.ok) {
      const userInfo = await response.json();
      document.getElementById('username').textContent = `${userInfo.firstname} ${userInfo.lastname}`;
      document.getElementById('userInfo').textContent = `ยินดีต้อนรับคุณ ${userInfo.firstname} ${userInfo.lastname} สู่แดชบอร์ดผู้บริหาร`;
    } else {
      throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    document.getElementById('username').textContent = currentUser.firstname || 'Owner';
    document.getElementById('userInfo').textContent = 'ยินดีต้อนรับสู่แดชบอร์ดผู้บริหาร';
  }
}

// โหลดสถิติ Dashboard
async function loadDashboardStats() {
  try {
    const response = await fetch('/api/owner/dashboard-stats');
    if (response.ok) {
      const result = await response.json();
      const stats = result.data;
      updateDashboardStats(stats);
    } else {
      throw new Error('ไม่สามารถโหลดสถิติได้');
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

// อัพเดทสถิติ Dashboard
function updateDashboardStats(stats) {
  // จำนวนพนักงานทั้งหมด
  const totalEmployees = stats.employees.total_employees || 0;
  document.getElementById('totalEmployees').textContent = totalEmployees;
  document.getElementById('employeesDetail').textContent = `${totalEmployees} คนทั้งหมด`;

  // คำร้องรออนุมัติ
  const pendingRequests = stats.leave_requests.pending_requests || 0;
  document.getElementById('pendingRequests').textContent = pendingRequests;
  document.getElementById('requestsDetail').textContent = pendingRequests === 1 ? '1 คำร้อง' : `${pendingRequests} คำร้อง`;

  // ค่าใช้จ่ายเงินเดือนรายเดือน
  const totalSalary = stats.salary.total_monthly_salary || 0;
  if (totalSalary === 0) {
    document.getElementById('monthlySalary').textContent = 'NaN';
    document.getElementById('salaryDetail').textContent = 'ไม่มีข้อมูล';
  } else {
    const salaryText = totalSalary >= 1000000 ? 
      `${(totalSalary / 1000000).toFixed(1)}M` : 
      `${(totalSalary / 1000).toFixed(0)}K`;
    document.getElementById('monthlySalary').textContent = salaryText;
    document.getElementById('salaryDetail').textContent = `฿${totalSalary.toLocaleString()}`;
  }
}

// โหลดข้อมูลปฏิทิน
async function loadCalendarData() {
  try {
    // Owner ดูการประชุมทั้งหมด (ไม่ filter)
    const events = await fetchMeetingEvents();
    initCalendar(events);
    updateLegend(events);
  } catch (error) {
    console.error('Error loading calendar data:', error);
    showNotification('เกิดข้อผิดพลาดในการโหลดปฏิทิน', 'error');
  }
}

// ดึงข้อมูล meetings จาก API (Owner ดูทั้งหมด)
async function fetchMeetingEvents() {
  try {
    // ดึงข้อมูลการประชุม
    const response = await fetch('/api/meetings/all');
    let meetingEvents = [];
    if (!response.ok) {
      // Fallback ไปใช้ API เดิม
      const fallbackResponse = await fetch('/api/meetings/all');
      if (!fallbackResponse.ok) {
        throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
      }
      const data = await fallbackResponse.json();
      meetingEvents = Array.isArray(data) ? data : [];
    } else {
      const data = await response.json();
      meetingEvents = Array.isArray(data) ? data : [];
    }

    // ดึงข้อมูลวันหยุดไทย
    const holidaysRes = await fetch('/api/calendar/thai-holidays');
    let holidays = [];
    if (holidaysRes.ok) {
      const holidaysData = await holidaysRes.json();
      if (holidaysData.success && Array.isArray(holidaysData.data)) {
        holidays = holidaysData.data;
        console.log('โหลดวันหยุดไทยสำเร็จ:', holidays.length, 'วัน');
      }
    } else {
      console.warn('ไม่สามารถดึงข้อมูลวันหยุดไทยได้');
    }

    // รวมข้อมูลการประชุมและวันหยุด
    return [...meetingEvents, ...holidays];
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return [];
  }
}

// สร้าง FullCalendar
function initCalendar(events) {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // เก็บข้อมูล events ในตัวแปรส่วนกลาง
  allCalendarEvents = events;

  const processedEvents = events.map((event, index) => ({
    id: event.id || `event-${index}`,
    title: event.title || 'ไม่มีชื่อ',
    start: event.start,
    end: event.end || null,
    backgroundColor: event.backgroundColor || event.color || '#2196F3',
    borderColor: event.backgroundColor || event.color || '#2196F3',
    textColor: '#ffffff'
  })).filter(event => {
    if (event.start) {
      const startDate = new Date(event.start);
      return !isNaN(startDate.getTime());
    }
    return false;
  });

  try {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'th',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      buttonText: {
        today: 'วันนี้',
        month: 'เดือน',
        week: 'สัปดาห์'
      },
      height: 'auto',
      events: processedEvents,
      eventClick: function(info) {
        const event = info.event;
        const startTime = event.start ? event.start.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'ไม่ระบุ';
        
        const endTime = event.end ? event.end.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'ไม่ระบุ';
        
        alert(`📅 ${event.title}\n\n⏰ เริ่ม: ${startTime}\n⏰ สิ้นสุด: ${endTime}`);
      },
      // เมื่อมีการเปลี่ยนมุมมอง หรือเปลี่ยนวันที่
      datesSet: function(dateInfo) {
        updateLegendForCurrentView(dateInfo, allCalendarEvents);
      }
    });

    calendar.render();
  } catch (error) {
    console.error('Error initializing calendar:', error);
    calendarEl.innerHTML = `
      <div class="error">
        ❌ เกิดข้อผิดพลาดในการแสดงปฏิทิน<br>
        <small>${error.message}</small>
      </div>
    `;
  }
}

// อัพเดท legend สำหรับมุมมองปัจจุบัน
function updateLegendForCurrentView(dateInfo, allEvents) {
  const legendItems = document.getElementById('legend-items');
  const legendTitle = document.getElementById('legend-title');
  if (!legendItems) return;


  if (allEvents.length === 0) {
    if (legendTitle) legendTitle.textContent = 'ไม่มีกิจกรรมในระบบ';
    legendItems.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; width: 100%;">ไม่มีกิจกรรมในระบบ</div>';
    return;
  }

  const { start, end, view } = dateInfo;
  let filteredEvents = [];
  let titleText = '';

  if (view.type === 'timeGridWeek') {
    // แสดงกิจกรรมในสัปดาห์ที่กำลังดู
    filteredEvents = allEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= start && eventDate < end;
    });
    
    const weekStart = start.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    const weekEnd = new Date(end.getTime() - 1).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    titleText = `กิจกรรมในสัปดาห์ (${weekStart} - ${weekEnd})`;
    
  } else if (view.type === 'dayGridMonth') {
    // มุมมองเดือน - แสดงกิจกรรมที่กำลังจะมาถึง (7 วันข้างหน้าจากวันนี้)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    filteredEvents = allEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= now && eventDate <= nextWeek;
    });

    titleText = 'กิจกรรมที่กำลังจะมาถึง';

  } else {
    // มุมมองอื่นๆ - แสดงกิจกรรมที่กำลังจะมาถึง
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    filteredEvents = allEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= now && eventDate <= nextWeek;
    });
    
    titleText = 'กิจกรรมที่กำลังจะมาถึง';
  }

  // เรียงตามวันที่
  filteredEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

  // จำกัดการแสดงผลสูงสุด 6 รายการ
  filteredEvents = filteredEvents.slice(0, 6);

  if (legendTitle) legendTitle.textContent = titleText;

  if (filteredEvents.length === 0) {
    const periodText = view.type === 'timeGridWeek' ? 'ในสัปดาห์นี้' : 
                      view.type === 'dayGridMonth' ? 'ในเดือนนี้' : 'ใน 7 วันข้างหน้า';
    legendItems.innerHTML = `<div style="color: #666; font-style: italic; text-align: center; width: 100%; grid-column: 1 / -1;">ไม่มีกิจกรรม${periodText}</div>`;
    return;
  }

  legendItems.innerHTML = '';
  filteredEvents.forEach(event => {
    const eventDate = new Date(event.start);
    const dateStr = eventDate.toLocaleDateString('th-TH', {
      month: 'short',
      day: 'numeric'
    });

    const timeStr = eventDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const legendItemDiv = document.createElement('div');
    legendItemDiv.innerHTML = `
      <div class="legend-color" style="background-color: ${event.backgroundColor || event.color || '#2196F3'}"></div>
      <div>
        <strong>${event.title}</strong><br>
        <small>${dateStr} เวลา ${timeStr}</small>
      </div>
    `;
    legendItems.appendChild(legendItemDiv);
  });

}

// รีเฟรช calendar และ legend
async function refreshCalendar() {
  try {
    const events = await fetchMeetingEvents();
    allCalendarEvents = events; // อัพเดทตัวแปรส่วนกลาง
    
    // อัพเดท calendar events
    if (calendar) {
      // ลบ events เก่าทั้งหมด
      calendar.removeAllEvents();
      
      // เพิ่ม events ใหม่
      const processedEvents = events.map((event, index) => ({
        id: event.id || `event-${index}`,
        title: event.title || 'ไม่มีชื่อ',
        start: event.start,
        end: event.end || null,
        backgroundColor: event.backgroundColor || event.color || '#2196F3',
        borderColor: event.backgroundColor || event.color || '#2196F3',
        textColor: '#ffffff'
      })).filter(event => {
        if (event.start) {
          const startDate = new Date(event.start);
          return !isNaN(startDate.getTime());
        }
        return false;
      });

      calendar.addEventSource(processedEvents);
      
      // อัพเดท legend ตามมุมมองปัจจุบัน
      const currentView = calendar.view;
      updateLegendForCurrentView({
        start: currentView.activeStart,
        end: currentView.activeEnd,
        view: currentView
      }, allCalendarEvents);
    }
  } catch (error) {
    console.error('Error refreshing calendar:', error);
  }
}

function updateLegend(events) {
  const legendItems = document.getElementById('legend-items');
  const legendTitle = document.getElementById('legend-title');
  if (!legendItems) return;

  if (events.length === 0) {
    if (legendTitle) legendTitle.textContent = 'ไม่มีกิจกรรมในระบบ';
    legendItems.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; width: 100%;">ไม่มีกิจกรรมในระบบ</div>';
    return;
  }

  // แสดงกิจกรรมที่กำลังจะมาถึง (7 วันข้างหน้า)
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate >= now && eventDate <= nextWeek;
  }).slice(0, 6);

  if (legendTitle) legendTitle.textContent = 'กิจกรรมที่กำลังจะมาถึง';

  if (upcomingEvents.length === 0) {
    legendItems.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; width: 100%; grid-column: 1 / -1;">ไม่มีกิจกรรมใน 7 วันข้างหน้า</div>';
    return;
  }

  legendItems.innerHTML = '';
  upcomingEvents.forEach(event => {
    const eventDate = new Date(event.start);
    const dateStr = eventDate.toLocaleDateString('th-TH', {
      month: 'short',
      day: 'numeric'
    });

    const timeStr = eventDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const legendItemDiv = document.createElement('div');
    legendItemDiv.innerHTML = `
      <div class="legend-color" style="background-color: ${event.backgroundColor || event.color || '#2196F3'}"></div>
      <div>
        <strong>${event.title}</strong><br>
        <small>${dateStr} เวลา ${timeStr}</small>
      </div>
    `;
    legendItems.appendChild(legendItemDiv);
  });
}

// Setup Event Listeners
function setupEventListeners() {

  
  // จัดการ Modal สำหรับเพิ่มการประชุม
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  
  if (toggleFormBtn) {

    toggleFormBtn.onclick = () => {
      showModal(modalOverlay);
      // ตั้งเวลาเริ่มต้น
      setDefaultDateTime();
      // รีเซ็ตฟอร์ม
      resetMeetingForm();
    };
  } else {

  }
  
  if (closeModalBtn) {

    closeModalBtn.onclick = () => {

      hideModal(modalOverlay);
    };
  } else {

  }
  
  if (modalOverlay) {

    modalOverlay.onclick = (e) => {
      if (e.target === e.currentTarget) {

        hideModal(e.currentTarget);
      }
    };
  } else {
  }

  // จัดการฟอร์มเพิ่มการประชุม
  const addMeetingForm = document.getElementById('addMeetingForm');
  if (addMeetingForm) {
    addMeetingForm.addEventListener('submit', handleAddMeeting);
  }

  // จัดการ Tab ประเภทการประชุม
  const tabOptions = document.querySelectorAll('.tab-option');

  
  tabOptions.forEach((tab, index) => {
    tab.addEventListener('click', function() {
      const type = this.dataset.type;
      selectMeetingType(type);
    });
  });

  // จัดการ Modal สำหรับลบการประชุม
  const deleteMeetingBtn = document.getElementById('deleteMeetingBtn');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const deleteModalOverlay = document.getElementById('deleteModalOverlay');
  
  if (deleteMeetingBtn) {

    deleteMeetingBtn.onclick = () => {

      handleShowDeleteModal();
    };
  } else {
    console.warn('❌ Delete meeting button not found!');
  }
  
  if (closeDeleteModalBtn) {

    closeDeleteModalBtn.onclick = () => {
      hideModal(deleteModalOverlay);
    };
  } else {
    console.warn('❌ Close delete modal button not found!');
  }
  
  if (deleteModalOverlay) {

    deleteModalOverlay.onclick = (e) => {
      if (e.target === e.currentTarget) {
  
        hideModal(e.currentTarget);
      }
    };
  } else {
    console.warn('❌ Delete modal overlay not found!');
  }

}

// ฟังก์ชันแสดง Modal
function showModal(modal) {
  if (modal) {
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    modal.style.visibility = 'visible';
    modal.classList.add('show');
    
    // Animate in
    setTimeout(() => {
      modal.style.opacity = '1';
    }, 10);
  } else {
    console.error('❌ Cannot show modal: element is null');
  }
}

// ฟังก์ชันซ่อน Modal
function hideModal(modal) {
  if (modal) {

    modal.style.opacity = '0';
    
    setTimeout(() => {
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      modal.classList.remove('show');
    }, 300);
  } else {
    console.error('❌ Cannot hide modal: element is null');
  }
}

// จัดการการเพิ่มการประชุม (รองรับทุกประเภท พร้อม fallback)
async function handleAddMeeting(e) {
  e.preventDefault();

  const title = document.getElementById('meetingTitle').value.trim();
  const start = document.getElementById('meetingStart').value;
  const end = document.getElementById('meetingEnd').value;
  const color = document.getElementById('meetingColor').value;
  const description = document.getElementById('meetingDescription').value.trim();
  const meetingType = document.getElementById('meetingType').value;
  const statusEl = document.getElementById('addMeetingStatus');

  if (!title || !start || !currentUser?.userid) {
    statusEl.innerHTML = '<div class="error">กรุณากรอกข้อมูลให้ครบ</div>';
    return;
  }

  // รวบรวมข้อมูลการประชุม
  const meetingData = {
    title,
    start,
    end,
    color,
    description,
    meeting_type: meetingType,
    created_by: currentUser.userid
  };

  // เพิ่มข้อมูลเป้าหมายตามประเภท
  if (meetingType === 'department') {
    const checkedDepts = Array.from(document.querySelectorAll('#department-list input:checked'))
      .map(input => input.value);
    if (checkedDepts.length === 0) {
      statusEl.innerHTML = '<div class="error">กรุณาเลือกอย่างน้อย 1 ฝ่าย</div>';
      return;
    }
    meetingData.target_department = checkedDepts.join(',');
  } else if (meetingType === 'subject') {
    const checkedSubjects = Array.from(document.querySelectorAll('#subject-list input:checked'))
      .map(input => input.value);
    if (checkedSubjects.length === 0) {
      statusEl.innerHTML = '<div class="error">กรุณาเลือกอย่างน้อย 1 หมวดวิชา</div>';
      return;
    }
    meetingData.target_subject = checkedSubjects.join(',');
  } else if (meetingType === 'specific_roles') {
    const checkedRoles = Array.from(document.querySelectorAll('#roles-options input:checked'))
      .map(input => input.value);
    if (checkedRoles.length === 0) {
      statusEl.innerHTML = '<div class="error">กรุณาเลือกอย่างน้อย 1 ตำแหน่ง</div>';
      return;
    }
    meetingData.target_roles = checkedRoles;
  }

  statusEl.innerHTML = '<div class="loading">กำลังเพิ่มการประชุม...</div>';

  try {
    let success = false;
    let responseData = null;

    // ลองใช้ API ขั้นสูงก่อน (สำหรับการประชุมแยกกลุ่ม)
    if (meetingType !== 'all') {
      try {
        const advancedRes = await fetch('/api/meetings/advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meetingData)
        });
        
        const advancedData = await advancedRes.json();
        
        if (advancedRes.ok && advancedData.success !== false) {
          success = true;
          responseData = advancedData;
        } else {
          console.warn('Advanced API failed:', advancedData);
          throw new Error(advancedData.error || 'Advanced API failed');
        }
      } catch (advancedError) {
        console.warn('Advanced API error, falling back to basic API:', advancedError);
        
        // ถ้า API ขั้นสูงล้มเหลว ให้ใช้ API เดิม (แต่เปลี่ยน meeting_type เป็น 'all')
        const basicMeetingData = {
          title: `${title} (${getMeetingTypeLabel(meetingType)})`,
          start,
          end,
          color,
          description: description + getSelectedTargetsDescription(meetingType),
          meeting_type: 'all', // fallback เป็น all
          created_by: currentUser.userid
        };
        
        const basicRes = await fetch('/api/addmeeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basicMeetingData)
        });
        
        const basicData = await basicRes.json();
        
        if (basicRes.ok) {
          success = true;
          responseData = basicData;
          showNotification('ใช้การประชุมแบบทุกคนแทน เนื่องจากระบบแยกกลุ่มยังไม่พร้อม', 'warning');
        } else {
          throw new Error(basicData.error || 'Basic API also failed');
        }
      }
    } else {
      // สำหรับการประชุมทุกคน ใช้ API เดิม
      const res = await fetch('/api/addmeeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        success = true;
        responseData = data;
      } else {
        throw new Error(data.error || 'API call failed');
      }
    }

    if (success) {
      statusEl.innerHTML = '<div class="success">✅ เพิ่มการประชุมเรียบร้อยแล้ว</div>';
      
      // เพิ่มลงปฏิทินทันที
      if (calendar) {
        calendar.addEvent({
          title: meetingData.title,
          start: meetingData.start,
          end: meetingData.end,
          backgroundColor: meetingData.color
        });
      }

      // ปิด modal และรีเซ็ตฟอร์ม
      setTimeout(async () => {
        hideModal(document.getElementById('modalOverlay'));
        resetMeetingForm();
        await refreshCalendar();
      }, 1000);
      
    } else {
      throw new Error('ไม่สามารถเพิ่มการประชุมได้');
    }
    
  } catch (error) {
    console.error('All APIs failed:', error);
    statusEl.innerHTML = `<div class="error">❌ ไม่สามารถเพิ่มการประชุมได้: ${error.message}</div>`;
  }
}

// ฟังก์ชันช่วยสำหรับแสดง label ประเภทการประชุม
function getMeetingTypeLabel(type) {
  const labels = {
    'all': 'ทุกคน',
    'department': 'ตามฝ่าย',
    'subject': 'ตามหมวดวิชา',
    'specific_roles': 'กลุ่มเฉพาะ'
  };
  return labels[type] || type;
}

// ฟังก์ชันช่วยสำหรับสร้างคำอธิบายเป้าหมายที่เลือก
function getSelectedTargetsDescription(meetingType) {
  let description = '';
  
  if (meetingType === 'department') {
    const checkedDepts = Array.from(document.querySelectorAll('#department-list input:checked'))
      .map(input => {
        const label = departments.find(d => d.value === input.value)?.label || input.value;
        return label;
      });
    if (checkedDepts.length > 0) {
      description = `\n\nฝ่ายที่เลือก: ${checkedDepts.join(', ')}`;
    }
  } else if (meetingType === 'subject') {
    const checkedSubjects = Array.from(document.querySelectorAll('#subject-list input:checked'))
      .map(input => {
        const label = subjects.find(s => s.value === input.value)?.label || input.value;
        return label;
      });
    if (checkedSubjects.length > 0) {
      description = `\n\nหมวดวิชาที่เลือก: ${checkedSubjects.join(', ')}`;
    }
  } else if (meetingType === 'specific_roles') {
    const checkedRoles = Array.from(document.querySelectorAll('#roles-options input:checked'))
      .map(input => {
        const adminRole = roles.admin.find(r => r.value === input.value);
        const userRole = roles.user.find(r => r.value === input.value);
        return (adminRole || userRole)?.label || input.value;
      });
    if (checkedRoles.length > 0) {
      description = `\n\nตำแหน่งที่เลือก: ${checkedRoles.join(', ')}`;
    }
  }
  
  return description;
}

// แสดง Modal สำหรับลบการประชุม
async function handleShowDeleteModal() {
  const deleteModalOverlay = document.getElementById('deleteModalOverlay');
  showModal(deleteModalOverlay);

  const meetingListEl = document.getElementById('meetingList');
  meetingListEl.innerHTML = '<div class="loading">กำลังโหลด...</div>';

  try {
    const allMeetings = await fetchMeetingEvents();

    // กรองเฉพาะการประชุมที่ไม่ใช่วันหยุดราชการ
    const meetings = allMeetings.filter(meeting => {
      return !(meeting.extendedProps && meeting.extendedProps.type === 'thai-holiday');
    });

    if (meetings.length === 0) {
      meetingListEl.innerHTML = '<div style="text-align: center; color: #666;">ไม่มีการประชุมในระบบ</div>';
      return;
    }

    meetingListEl.innerHTML = '';
    meetings.forEach(meeting => {
      const item = document.createElement('div');
      item.className = 'meeting-item';
      item.style.borderLeftColor = meeting.backgroundColor || meeting.color || '#2196F3';
      
      // แสดงข้อมูลประเภทการประชุม
      let meetingType = 'ทุกคน';
      if (meeting.extendedProps?.meeting_type) {
        switch (meeting.extendedProps.meeting_type) {
          case 'department':
            meetingType = `ฝ่าย: ${meeting.extendedProps.target_department || 'ไม่ระบุ'}`;
            break;
          case 'subject':
            meetingType = `หมวดวิชา: ${meeting.extendedProps.target_subject || 'ไม่ระบุ'}`;
            break;
          case 'specific_roles':
            meetingType = 'กลุ่มเฉพาะ';
            break;
        }
      }
      
      const startDate = new Date(meeting.start);
      const endDate = meeting.end ? new Date(meeting.end) : null;
      
      const dateTimeStr = startDate.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const endTimeStr = endDate ? ` - ${endDate.toLocaleString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
      })}` : '';
      
      // ตรวจสอบสิทธิ์การลบการประชุม
      const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
      const canDelete = canDeleteMeeting(meeting, currentUser);

      const deleteButton = canDelete ? `
        <button onclick="deleteMeeting(${meeting.id}, this)" style="
          margin-top: 10px;
          color: white;
          background: #e74c3c;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
        " onmouseover="this.style.backgroundColor='#c0392b'"
           onmouseout="this.style.backgroundColor='#e74c3c'">
          🗑️ ลบการประชุม
        </button>
      ` : `
        <button disabled style="
          margin-top: 10px;
          color: #999;
          background: #ccc;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: not-allowed;
        " title="คุณไม่มีสิทธิ์ลบการประชุมนี้">
          🔒 ไม่มีสิทธิ์ลบการประชุมนี้
        </button>
      `;

      item.innerHTML = `
        <div>
          <strong>${meeting.title}</strong><br>
          <small style="color: #888; font-style: italic;">ประเภท: ${meetingType}</small><br>
          <small>📅 ${dateTimeStr}${endTimeStr}</small><br>
          ${deleteButton}
        </div>
      `;

      meetingListEl.appendChild(item);
    });

  } catch (error) {
    console.error('Error loading meetings:', error);
    meetingListEl.innerHTML = '<div class="error">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// ฟังก์ชันตรวจสอบสิทธิ์การลบการประชุม
function canDeleteMeeting(meeting, currentUser) {
  if (!currentUser) return false;

  // ป้องกันการลบวันหยุดราชการ
  if (meeting.extendedProps && meeting.extendedProps.type === 'thai-holiday') {
    return false; // ไม่สามารถลบวันหยุดราชการได้
  }

  // HR (admin_hr) สามารถลบการประชุมได้ทุกการประชุม (ยกเว้นวันหยุดราชการ)
  if (currentUser.role_code === 'admin_hr') {
    return true;
  }

  // Owner สามารถลบการประชุมได้ทุกการประชุม (ยกเว้นวันหยุดราชการ)
  if (currentUser.role_group === 'owner') {
    return true;
  }

  // ผู้สร้างการประชุมสามารถลบการประชุมของตนเองได้
  if (meeting.created_by && meeting.created_by == currentUser.userid) {
    return true;
  }

  // กรณีอื่นๆ ไม่สามารถลบได้
  return false;
}

// Delete meeting (ทำให้เป็น global function)
window.deleteMeeting = async function(meetingId, buttonElement) {
  const meetingTitle = buttonElement.parentElement.querySelector('strong').textContent;
  
  if (!confirm(`คุณต้องการลบการประชุม "${meetingTitle}" หรือไม่?`)) {
    return;
  }

  const originalText = buttonElement.innerHTML;
  buttonElement.innerHTML = '⏳ กำลังลบ...';
  buttonElement.disabled = true;

  try {
    const response = await fetch(`/api/deletemeeting/${meetingId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      // Remove from DOM
      buttonElement.closest('.meeting-item').remove();
      
      showNotification('✅ ลบการประชุมเรียบร้อยแล้ว', 'success');
      
      // รีเฟรช calendar และ legend
      setTimeout(async () => {
        await refreshCalendar();
        
        // ปิด modal หากไม่มี meeting เหลือ
        const remainingMeetings = document.querySelectorAll('.meeting-item');
        if (remainingMeetings.length === 0) {
          hideModal(document.getElementById('deleteModalOverlay'));
        }
      }, 1000);
      
    } else {
      throw new Error('Failed to delete meeting');
    }
  } catch (error) {
    console.error('Error deleting meeting:', error);
    showNotification('❌ เกิดข้อผิดพลาดในการลบการประชุม', 'error');
    buttonElement.innerHTML = originalText;
    buttonElement.disabled = false;
  }
};

// Logout function (ทำให้เป็น global function)
window.logout = function() {
  if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
    localStorage.removeItem('loggedInUser');
    window.location.href = '../index.html';
  }
};

// Show notification
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
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    font-weight: 500;
    font-size: 14px;
    max-width: 300px;
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

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Auto-refresh dashboard data every 5 minutes
setInterval(async () => {
  try {
    await loadDashboardStats();
  } catch (error) {
  }
}, 5 * 60 * 1000);