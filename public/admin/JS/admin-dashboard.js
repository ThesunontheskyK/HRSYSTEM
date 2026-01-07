// ต้องมี common.js loaded ก่อน
let departments = [];
let subjects = [];
let roles = { admin: [], user: [] };

window.onload = async function () {
  const user = checkLogin(); // ใช้จาก common.js
  if (!user) return;

  // ตั้งค่า active menu สำหรับหน้าปัจจุบัน
  if (typeof autoSetActiveMenu === 'function') {
    autoSetActiveMenu();
  }

  // โหลดข้อมูลผู้ใช้
  await loadUserInfo(user.userid, true); // ใช้จาก common.js (isAdmin = true)

  // โหลดข้อมูลสำหรับฟอร์ม
  await loadFormData();

  // โหลดข้อมูลการประชุมที่เกี่ยวข้องกับ admin
  const events = await fetchMeetingEvents(user.userid);



  // สร้างปฏิทิน
  initCalendar(events);

  // เริ่มต้นการจัดการ Modal และปุ่มต่างๆ
  initEventHandlers();
};

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

    showAlert('warning', 'โหลดข้อมูลไม่สมบูรณ์ ใช้ข้อมูลพื้นฐานแทน');
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
async function fetchMeetingEvents(userId) {
  try {
    // ลองใช้ API ใหม่ที่ filter ตาม user role ก่อน
    let res = await fetch(`/api/meetings/user/${userId}`);

    let meetingEvents = [];
    if (!res.ok) {
      console.warn('ไม่สามารถใช้ API เฉพาะผู้ใช้ได้ กำลังใช้ API ทั้งหมด');
      // fallback ไปใช้ API เดิม (admin ดูได้หมด)
      res = await fetch('/api/meetings/all');
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // ตรวจสอบรูปแบบข้อมูล
    if (!Array.isArray(data)) {
      console.error('Data not Array:', typeof data, data);
      meetingEvents = [];
    } else {
      meetingEvents = data;
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
    handleError(error, 'ข้อผิดพลาดขณะดึงข้อมูลการประชุม'); // ใช้จาก common.js
    return [];
  }
}


// อัปเดตแถบรายการกิจกรรมตามมุมมองปัจจุบัน (แบบเดียวกับ owner)
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
      <div class="legend-color" style="background-color: ${event.backgroundColor || event.color || '#3788d8'}"></div>
      <div>
        <strong>${event.title}</strong><br>
        <small>${dateStr} เวลา ${timeStr}</small>
      </div>
    `;
    legendItems.appendChild(legendItemDiv);
  });
}

// อัปเดตแถบรายการกิจกรรม (ใช้สำหรับ backward compatibility)
function updateLegend(currentEvents, currentStart, currentEnd) {
  const legendItems = document.getElementById('legend-items');
  if (!legendItems) {
    console.warn('ไม่พบ element legend-items');
    return;
  }

  legendItems.innerHTML = '';

  const visibleEvents = currentEvents.filter(event => {
    const startDate = new Date(event.start);
    return startDate >= currentStart && startDate < currentEnd;
  });

  if (visibleEvents.length === 0) {
    legendItems.innerHTML = '<div class="legend-item" style="color: #666; font-style: italic;">ไม่มีกิจกรรมในช่วงเวลานี้</div>';
    return;
  }

  visibleEvents.forEach(event => {
    const startTime = new Date(event.start).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const endTime = event.end ? new Date(event.end).toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    // แสดงข้อมูลประเภทการประชุมถ้ามี
    let meetingScope = '';
    if (event.extendedProps?.meeting_scope) {
      meetingScope = `<br><small style="color: #888; font-style: italic;">${event.extendedProps.meeting_scope}</small>`;
    }

    const legendItemDiv = document.createElement('div');
    legendItemDiv.innerHTML = `
      <div class="legend-color" style="background-color: ${event.backgroundColor || '#3788d8'}"></div>
      <div>
        <strong>${event.title}</strong>${meetingScope}<br>
        <small style="color: #666;">
          ${startTime}${endTime ? ` - ${endTime}` : ''}
        </small>
      </div>
    `;
    legendItems.appendChild(legendItemDiv);
  });
}

// ตัวแปรสำหรับเก็บ calendar instance และ events
let calendar;
let allCalendarEvents = [];

// สร้างปฏิทินและแสดงผล
function initCalendar(events) {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('ไม่พบ element #calendar');
    return;
  }

  // เก็บข้อมูล events ในตัวแปรส่วนกลาง
  allCalendarEvents = events;

  // ประมวลผลข้อมูล events
  const processedEvents = events.map((event, index) => {
    const processed = {
      id: event.id || `event-${index}`,
      title: event.title || 'ไม่มีชื่อ',
      start: event.start,
      end: event.end || null,
      backgroundColor: event.backgroundColor || event.color || '#3788d8',
      borderColor: event.backgroundColor || event.color || '#3788d8',
      textColor: '#ffffff',
      extendedProps: event.extendedProps || {} // เก็บข้อมูลเพิ่มเติม
    };

    // ตรวจสอบว่าวันที่เป็นรูปแบบที่ถูกต้อง
    if (processed.start) {
      const startDate = new Date(processed.start);
      if (isNaN(startDate.getTime())) {
        console.warn(`วันที่ไม่ถูกต้องสำหรับ event ${processed.id}:`, processed.start);
        return null;
      }
    }
    return processed;
  }).filter(event => event !== null);

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
      eventDidMount: function (info) {
      },
      datesSet: function (info) {
        updateLegendForCurrentView(info, allCalendarEvents);
      },
      eventClick: function (info) {
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

        // แสดงข้อมูลเพิ่มเติมถ้ามี
        let extraInfo = '';
        if (event.extendedProps?.meeting_scope) {
          extraInfo += `\nขอบเขต: ${event.extendedProps.meeting_scope}`;
        }
        if (event.extendedProps?.description) {
          extraInfo += `\nรายละเอียด: ${event.extendedProps.description}`;
        }

        // เปลี่ยนจาก showAlert เป็น alert ธรรมดาเหมือน dashboard.js
        alert(`📅 ${event.title}\n\n⏰ เริ่ม: ${startTime}\n⏰ สิ้นสุด: ${endTime}${extraInfo}`);
      },
      eventSourceFailure: function (errorObj) {
        handleError(errorObj, 'Event source failure'); // ใช้จาก common.js
      }
    });

    calendar.render();

    // เรียกใช้ updateLegend เป็นครั้งแรก
    const currentView = calendar.view;
    updateLegendForCurrentView({
      start: currentView.activeStart,
      end: currentView.activeEnd,
      view: currentView
    }, allCalendarEvents);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเรนเดอร์ปฏิทิน:', error);

    calendarEl.innerHTML = `
      <div style="
        text-align: center; 
        padding: 40px; 
        background: #fef2f2; 
        border: 1px solid #fca5a5; 
        border-radius: 8px;
        color: #dc2626;
      ">
        <h3>❌ เกิดข้อผิดพลาดในการแสดงปฏิทิน</h3>
        <p>รายละเอียดข้อผิดพลาด: ${error.message}</p>
        <p>กรุณาตรวจสอบ Console (F12) สำหรับข้อมูลเพิ่มเติม</p>
        <button onclick="location.reload()" style="
          margin-top: 10px;
          padding: 8px 16px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">รีเฟรชหน้า</button>
      </div>
    `;
  }
}

// เริ่มต้นการจัดการ Event Handlers
function initEventHandlers() {
  // จัดการ Modal สำหรับเพิ่มการประชุม
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalOverlay = document.getElementById('modalOverlay');

  if (toggleFormBtn) {
    toggleFormBtn.onclick = () => {
      modalOverlay.style.display = 'flex';
      // ตั้งเวลาเริ่มต้น
      setDefaultDateTime();
      // รีเซ็ตฟอร์ม
      resetMeetingForm();
    };
  }

  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      modalOverlay.style.display = 'none';
    };
  }

  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
      }
    };
  }

  // จัดการฟอร์มเพิ่มการประชุม
  const addMeetingForm = document.getElementById('addMeetingForm');
  if (addMeetingForm) {
    addMeetingForm.addEventListener('submit', handleAddMeeting);
  }

  // จัดการ Tab ประเภทการประชุม
  const tabOptions = document.querySelectorAll('.tab-option');
  tabOptions.forEach(tab => {
    tab.addEventListener('click', function () {
      const type = this.dataset.type;
      selectMeetingType(type);
    });
  });

  // จัดการ Modal สำหรับลบการประชุม
  const deleteMeetingBtn = document.getElementById('deleteMeetingBtn');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const deleteModalOverlay = document.getElementById('deleteModalOverlay');

  if (deleteMeetingBtn) {
    deleteMeetingBtn.onclick = handleShowDeleteModal;
  }

  if (closeDeleteModalBtn) {
    closeDeleteModalBtn.onclick = () => {
      deleteModalOverlay.style.display = 'none';
    };
  }

  if (deleteModalOverlay) {
    deleteModalOverlay.onclick = (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
      }
    };
  }
}

// เลือกประเภทการประชุม
function selectMeetingType(type) {
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
}

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

// จัดการการเพิ่มการประชุม (รองรับทุกประเภท พร้อม fallback)
async function handleAddMeeting(e) {
  e.preventDefault();

  const title = document.getElementById('meetingTitle').value.trim();
  const start = document.getElementById('meetingStart').value;
  const end = document.getElementById('meetingEnd').value;
  const color = document.getElementById('meetingColor').value;
  const description = document.getElementById('meetingDescription').value.trim();
  const meetingType = document.getElementById('meetingType').value;
  const user = JSON.parse(localStorage.getItem('loggedInUser'));

  if (!title || !start || !user?.userid) {
    showAlert('error', 'กรุณากรอกข้อมูลให้ครบ');
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
    created_by: user.userid
  };

  // เพิ่มข้อมูลเป้าหมายตามประเภท
  if (meetingType === 'department') {
    const checkedDepts = Array.from(document.querySelectorAll('#department-list input:checked'))
      .map(input => input.value);
    if (checkedDepts.length === 0) {
      showAlert('error', 'กรุณาเลือกอย่างน้อย 1 ฝ่าย');
      return;
    }
    meetingData.target_department = checkedDepts.join(',');
  } else if (meetingType === 'subject') {
    const checkedSubjects = Array.from(document.querySelectorAll('#subject-list input:checked'))
      .map(input => input.value);
    if (checkedSubjects.length === 0) {
      showAlert('error', 'กรุณาเลือกอย่างน้อย 1 หมวดวิชา');
      return;
    }
    meetingData.target_subject = checkedSubjects.join(',');
  } else if (meetingType === 'specific_roles') {
    const checkedRoles = Array.from(document.querySelectorAll('#roles-options input:checked'))
      .map(input => input.value);
    if (checkedRoles.length === 0) {
      showAlert('error', 'กรุณาเลือกอย่างน้อย 1 ตำแหน่ง');
      return;
    }
    meetingData.target_roles = checkedRoles;
  }

  showLoading(true, 'กำลังเพิ่มการประชุม...');

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
          created_by: user.userid
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
          showAlert('warning', 'ใช้การประชุมแบบทุกคนแทน เนื่องจากระบบแยกกลุ่มยังไม่พร้อม');
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
      showAlert('success', 'เพิ่มการประชุมเรียบร้อยแล้ว');

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
      document.getElementById('modalOverlay').style.display = 'none';
      resetMeetingForm();

      // รีโหลดหน้าเพื่อดึงข้อมูลใหม่
      setTimeout(() => {
        location.reload();
      }, 1000);

    } else {
      throw new Error('ไม่สามารถเพิ่มการประชุมได้');
    }

  } catch (error) {
    console.error('All APIs failed:', error);
    handleError(error, 'ไม่สามารถเพิ่มการประชุมได้: ' + error.message);
  } finally {
    showLoading(false);
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
  document.getElementById('deleteModalOverlay').style.display = 'flex';
  const meetingListEl = document.getElementById('meetingList');
  meetingListEl.innerHTML = 'กำลังโหลด...';

  try {
    const res = await fetch('/api/meetings/all');
    const meetings = await res.json();

    if (meetings.length === 0) {
      meetingListEl.innerHTML = '<div style="text-align: center; color: #666;">ไม่มีการประชุม</div>';
      return;
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));

    // กรองเฉพาะการประชุมที่มีสิทธิ์ลบ
    const deletableMeetings = meetings.filter(meeting => canDeleteMeeting(meeting, currentUser));

    if (deletableMeetings.length === 0) {
      meetingListEl.innerHTML = '<div style="text-align: center; color: #666;">ไม่มีการประชุมที่คุณสามารถลบได้</div>';
      return;
    }

    meetingListEl.innerHTML = '';
    deletableMeetings.forEach(meeting => {
      const item = document.createElement('div');
      item.style.cssText = `
        margin-bottom: 15px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid ${meeting.backgroundColor || '#3788d8'};
      `;

      // ฟังก์ชันแปลงชื่อฝ่ายเป็นภาษาไทย
      function getDepartmentNameThai(deptCode) {
        const deptMap = {
          'hr': 'ฝ่ายบุคลากร',
          'academic': 'ฝ่ายวิชาการ',
          'student': 'ฝ่ายกิจการนักเรียน',
          'operation': 'ฝ่ายบริหาร',
          'quality': 'ฝ่ายมาตรฐาน',
          'resource': 'ฝ่ายทรัพยากร',
          'kindergarten': 'แผนกปฐมวัย',
          'pastoral': 'ฝ่ายอภิบาล',
          'management': 'คณะกรรมการบริหาร'
        };
        return deptMap[deptCode] || deptCode;
      }

      // แสดงข้อมูลประเภทการประชุม
      let meetingType = 'ทุกคน';
      if (meeting.extendedProps?.meeting_type) {
        switch (meeting.extendedProps.meeting_type) {
          case 'department':
            const deptCodes = meeting.extendedProps.target_department?.split(',') || [];
            const deptNames = deptCodes.map(code => getDepartmentNameThai(code.trim())).join(', ');
            meetingType = `ฝ่าย: ${deptNames || 'ไม่ระบุ'}`;
            break;
          case 'subject':
            meetingType = `หมวดวิชา: ${meeting.extendedProps.target_subject || 'ไม่ระบุ'}`;
            break;
          case 'specific_roles':
            meetingType = 'กลุ่มเฉพาะ';
            break;
        }
      }

      item.innerHTML = `
        <div>
          <strong style="color: #2c3e50;">${meeting.title}</strong><br>
          <small style="color: #888; font-style: italic;">ประเภท: ${meetingType}</small><br>
          <small style="color: #666;">
            📅 ${new Date(meeting.start).toLocaleString('th-TH')} -
            ${new Date(meeting.end).toLocaleString('th-TH')}
          </small><br>
          ${meeting.extendedProps?.creator_name ?
            `<small style="color: #888;">สร้างโดย: ${meeting.extendedProps.creator_name}</small><br>` :
            meeting.extendedProps?.created_by ?
            `<small style="color: #888;">สร้างโดย: User ID ${meeting.extendedProps.created_by}</small><br>` :
            ''}
          <button data-id="${meeting.id}" style="
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
        </div>
      `;

      const button = item.querySelector('button');
      button.onclick = () => handleDeleteMeeting(meeting, item);

      meetingListEl.appendChild(item);
    });

  } catch (err) {
    handleError(err, 'Error loading meetings for delete');
    meetingListEl.innerHTML = '<div style="color: red; text-align: center;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}
function canDeleteMeeting(meeting, currentUser) {
  if (!currentUser) return false;
  
  // HR (admin_hr) สามารถลบการประชุมได้ทุกการประชุม
  if (currentUser.role_code === 'admin_hr') {
    return true;
  }
  
  // Owner สามารถลบการประชุมได้ทุกการประชุม
  if (currentUser.role_group === 'owner') {
    return true;
  }
  
  // ผู้สร้างการประชุมสามารถลบการประชุมของตนเองได้
  const meetingCreatedBy = meeting.extendedProps?.created_by || meeting.created_by;
  if (meetingCreatedBy && meetingCreatedBy == currentUser.userid) {
    return true;
  }
  
  // กรณีอื่นๆ ไม่สามารถลบได้
  return false;
}

// จัดการการลบการประชุม
async function handleDeleteMeeting(meeting, itemElement) {
  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
  
  // ตรวจสอบสิทธิ์อีกครั้งก่อนลบ
  if (!canDeleteMeeting(meeting, currentUser)) {
    showAlert('error', 'คุณไม่มีสิทธิ์ลบการประชุมนี้');
    return;
  }

  const confirmDelete = confirm(`คุณต้องการลบการประชุม "${meeting.title}" หรือไม่?`);
  if (!confirmDelete) return;

  try {
    showLoading(true, 'กำลังลบการประชุม...');
    
    const delRes = await fetch(`/api/deletemeeting/${meeting.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.userid,
        userRole: currentUser.role_code
      })
    });

    if (delRes.ok) {
      showAlert('success', 'ลบการประชุมเรียบร้อยแล้ว');
      itemElement.remove();

      // ลบจากปฏิทิน
      if (calendar) {
        calendar.getEvents().forEach(ev => {
          if (
            ev.title === meeting.title &&
            ev.startStr === meeting.start &&
            ev.endStr === meeting.end
          ) {
            ev.remove();
          }
        });
      }

      // รีโหลดหน้าเพื่ออัปเดตข้อมูล
      setTimeout(() => {
        location.reload();
      }, 1000);

    } else {
      const errorData = await delRes.json().catch(() => ({}));
      if (delRes.status === 403) {
        showAlert('error', errorData.message || 'คุณไม่มีสิทธิ์ลบการประชุมนี้');
      } else {
        showAlert('error', errorData.message || 'ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    }
  } catch (err) {
    handleError(err, 'เกิดข้อผิดพลาดในการลบการประชุม');
  } finally {
    showLoading(false);
  }
}

