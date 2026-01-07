// ต้องมี common.js loaded ก่อน
window.onload = async function () {
  const admin = checkLogin(); // ใช้จาก common.js
  if (!admin) return;

  await loadUserInfo(admin.userid, true); // ใช้จาก common.js (isAdmin = true)

  // เพิ่ม Event Listener ให้แบบฟอร์ม
  document.getElementById('leaveRequestForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    await submitLeaveRequest(admin.userid);
  });
};

// ส่งคำร้องขอลา
async function submitLeaveRequest(userId) {
  const data = {
    userid: userId,
    leave_type: document.getElementById('leaveType').value,
    start_date: document.getElementById('startDate').value,
    end_date: document.getElementById('endDate').value,
    reason: document.getElementById('reason').value,
  };

  // ตรวจสอบข้อมูล
  if (!data.leave_type || !data.start_date || !data.reason.trim()) {
    showAlert('error', 'กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  showLoading(true, 'กำลังส่งคำร้อง...'); // ใช้จาก common.js

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
      showAlert('success', 'ส่งคำร้องขอลาสำเร็จ'); // ใช้จาก common.js
      setTimeout(() => {
        window.location.href = 'admin-dashboard.html';
      }, 1500);
    } else {
      showAlert('error', 'เกิดข้อผิดพลาด: ' + result.message); // ใช้จาก common.js
    }
  } catch (error) {
    handleError(error, 'เกิดข้อผิดพลาดในการส่งคำร้อง'); // ใช้จาก common.js
  } finally {
    showLoading(false); // ใช้จาก common.js
  }
}