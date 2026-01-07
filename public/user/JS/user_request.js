window.onload = async function () {
  const user = checkLogin();
  if (!user) return;

  await loadUserInfo(user.userid);
  await loadCurrentAcademicYear();

  // เพิ่ม Event Listener ให้แบบฟอร์ม
  document.getElementById('leaveRequestForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    await submitLeaveRequest(user.userid);
  });

  // เพิ่ม Event Listener สำหรับการเปลี่ยนวันที่
  document.getElementById('startDate').addEventListener('change', calculateLeaveDays);
  document.getElementById('endDate').addEventListener('change', calculateLeaveDays);
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

    document.getElementById('rename').innerText = userInfo.firstname + ' ' + userInfo.lastname;
    document.getElementById('reid').innerText = "SJT-"+userInfo.userid;
    document.getElementById('repo').innerText = userInfo.role_name;
    document.getElementById('recount').innerText = userInfo.leave_count + ' ครั้ง';

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

    // ตรวจสอบและตั้งค่าเมนูตาม role (เฉพาะ head of subject)
    setupMenuVisibility(userInfo.role_code);

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

// ส่งคำร้องขอลา
async function submitLeaveRequest(userId) {
  const data = {
    userid: userId,
    leave_type: document.getElementById('leaveType').value,
    start_date: document.getElementById('startDate').value,
    end_date: document.getElementById('endDate').value,
    reason: document.getElementById('reason').value,
  };

  try {
    const res = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (res.ok) {
      // แสดงข้อความรายละเอียดการลา
      const message = `ส่งคำร้องขอลาสำเร็จ!\n\n${result.info || ''}`;
      alert(message);
      window.location.href = 'dashboard.html';
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.message);
    }
  } catch (error) {
    console.error('ส่งคำร้องไม่สำเร็จ:', error);
    alert('เกิดข้อผิดพลาดในการส่งคำร้อง');
  }
}

// คำนวณและแสดงผลจำนวนวันลา
async function calculateLeaveDays() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  // ตรวจสอบว่ามีการเลือกวันที่ครบถ้วน
  if (!startDate || !endDate) {
    document.getElementById('leaveSummary').style.display = 'none';
    return;
  }

  // ตรวจสอบว่าวันสิ้นสุดมากกว่าหรือเท่ากับวันเริ่มต้น
  if (new Date(endDate) < new Date(startDate)) {
    document.getElementById('leaveSummary').style.display = 'none';
    alert('วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น');
    return;
  }

  try {
    // เรียก API เพื่อคำนวณวันทำงาน
    const response = await fetch(`/api/leave-requests/calculate-details?start_date=${startDate}&end_date=${endDate}`);

    if (!response.ok) {
      throw new Error('ไม่สามารถคำนวณวันลาได้');
    }

    const result = await response.json();

    if (result.success) {
      const data = result.data;

      // แสดงผลข้อมูล
      document.getElementById('totalDays').textContent = `${data.totalDays} วัน`;
      document.getElementById('workingDays').textContent = `${data.workingDays} วัน`;
      document.getElementById('weekends').textContent = `${data.weekends} วัน`;
      document.getElementById('publicHolidays').textContent = `${data.publicHolidays} วัน`;

      // แสดง summary
      document.getElementById('leaveSummary').style.display = 'block';
    }
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการคำนวณวันลา:', error);
    document.getElementById('leaveSummary').style.display = 'none';
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