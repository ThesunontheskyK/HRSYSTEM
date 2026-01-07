window.onload = async function () {
  const user = checkLogin();
  if (!user) return;
  await loadUserInfo(user.userid);
  await loadCurrentAcademicYear();
  const events = await fetchMeetingEvents(user.userid);
  initCalendar(events);
};

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

// ฟังก์ชันซ่อน/แสดงเมนูสถานะคำร้องเฉพาะ head of subject
function setupMenuVisibility(userRole, roleGroup) {
  const headSubRequestsMenu = document.querySelector('a[href="headsubrequests.html"]');
  const manageMeetingsMenu = document.querySelector('a[href="manage_meetings.html"]');

  if (headSubRequestsMenu) {
    // แสดงเมนูเฉพาะ head of subject เท่านั้น
    if (userRole?.toLowerCase().startsWith('head_of_')) {
      headSubRequestsMenu.style.display = 'block';

    } else {
      // ซ่อนเมนูสำหรับ role อื่นๆ
      headSubRequestsMenu.style.display = 'none';

    }
  }

  // แสดงเมนูจัดการการประชุมสำหรับ admin และ owner
  if (manageMeetingsMenu) {
    if (roleGroup === 'admin' || roleGroup === 'owner') {
      manageMeetingsMenu.style.display = 'block';

    } else {
      manageMeetingsMenu.style.display = 'none';

    }
  }
}

// โหลดข้อมูลผู้ใช้
async function loadUserInfo(userId) {
  try {
    const res = await fetch(`/api/userinfo/${userId}`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const userInfo = await res.json();

    // อัปเดตข้อมูลในหน้า
    const userInfoEl = document.getElementById('userInfo');
    const usernameEl = document.getElementById('username');
    const subjectnameEl = document.getElementById('subjectname');
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

    // ตรวจสอบ role_group จาก localStorage หรือ API เพิ่มเติม
    let roleGroup = 'user'; // default
    try {
      const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
      roleGroup = currentUser.role_group || 'user';
    } catch (error) {
      console.warn('ไม่สามารถดึง role_group จาก localStorage:', error);
    }

    // ตรวจสอบและตั้งค่าเมนูตาม role
    setupMenuVisibility(userInfo.role_code, roleGroup);

    // บันทึก role ลงใน localStorage สำหรับใช้ในหน้าอื่น
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    currentUser.role = userInfo.role_code;
    currentUser.role_group = roleGroup;
    localStorage.setItem('loggedInUser', JSON.stringify(currentUser));

  } catch (error) {
    console.error('ดึงข้อมูลผู้ใช้ล้มเหลว:', error);

    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
      userInfoEl.innerHTML = '<span style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้</span>';
    }
  }
}

// ดึงข้อมูลการประชุมที่เกี่ยวข้องกับผู้ใช้
async function fetchMeetingEvents(userId) {
  try {
    // ดึงข้อมูลการประชุม
    const res = await fetch(`/api/meetings/user/${userId}`);
    console.log('Status:', res.status, res.statusText);

    let meetingEvents = [];
    if (!res.ok) {
      console.warn('ไม่สามารถดึงข้อมูลการประชุมเฉพาะผู้ใช้ได้ กำลังใช้ API เดิม');
      // fallback ไปใช้ API เดิม
      const fallbackRes = await fetch('/api/meetings/all');
      if (!fallbackRes.ok) {
        throw new Error(`HTTP ${fallbackRes.status}: ${fallbackRes.statusText}`);
      }
      const fallbackData = await fallbackRes.json();
      meetingEvents = Array.isArray(fallbackData) ? fallbackData : [];
    } else {
      const data = await res.json();
      // ตรวจสอบรูปแบบข้อมูล
      if (!Array.isArray(data)) {
        console.error('Data not Array:', typeof data, data);
        meetingEvents = [];
      } else {
        meetingEvents = data;
      }
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
    console.error('ข้อผิดพลาดขณะดึงข้อมูลการประชุม:', error);

    // ลองใช้ API เดิมเป็น fallback
    try {
      const fallbackRes = await fetch('/api/meetings/all');
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return Array.isArray(fallbackData) ? fallbackData : [];
      }
    } catch (fallbackError) {
      console.error('Fallback API also failed:', fallbackError);
    }

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
    const isVisible = startDate >= currentStart && startDate < currentEnd;
    return isVisible;
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

// สร้างปฏิทินและแสดงผล
function initCalendar(events) {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('ไม่พบ element #calendar');
    return;
  }

  // ประมวลผลข้อมูล events - แก้ไขให้ตรงกับข้อมูลจาก API
  const processedEvents = events.map((event, index) => {
    // ตรวจสอบและแปลงข้อมูลให้ถูกต้อง
    const processed = {
      id: event.id || `event-${index}`,
      title: event.title || 'ไม่มีชื่อ',
      start: event.start, // ข้อมูลจาก API ควรจะเป็น ISO string หรือ Date object
      end: event.end || null,
      backgroundColor: event.backgroundColor || event.color || '#3788d8',
      borderColor: event.backgroundColor || event.color || '#3788d8',
      textColor: '#ffffff', // เพิ่มสีข้อความให้ชัดเจน
      extendedProps: event.extendedProps || {} // เก็บข้อมูลเพิ่มเติม
    };

    // ตรวจสอบว่าวันที่เป็นรูปแบบที่ถูกต้อง
    if (processed.start) {
      const startDate = new Date(processed.start);
      if (isNaN(startDate.getTime())) {
        console.warn(`วันที่ไม่ถูกต้องสำหรับ event ${processed.id}:`, processed.start);
        return null; // ข้าม event ที่มีวันที่ไม่ถูกต้อง
      }
    }
    return processed;
  }).filter(event => event !== null); // กรองเฉพาะ events ที่ถูกต้อง

  try {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'th',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      buttonText: {
        today: 'วันนี้',
        month: 'เดือน',
        week: 'สัปดาห์',
        day: 'วัน'
      },
      height: 'auto', // ปรับความสูงอัตโนมัติ
      events: processedEvents,
      eventDidMount: function (info) {

      },
      datesSet: function (info) {
        updateLegendForCurrentView(info, events);
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

        alert(`${event.title}\n\nเริ่ม: ${startTime}\nสิ้นสุด: ${endTime}${extraInfo}`);
      },
      // เพิ่มการจัดการ error
      eventSourceFailure: function (errorObj) {
        console.error('Event source failure:', errorObj);
      }
    });

    calendar.render();


  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเรนเดอร์ปฏิทิน:', error);

    // แสดงข้อผิดพลาดในหน้า
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

// ฟังก์ชันออกจากระบบ
function logout() {
  if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
    localStorage.removeItem('loggedInUser');
    window.location.href = '/index.html';
  }
}