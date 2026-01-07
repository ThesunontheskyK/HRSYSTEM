window.onload = async function () {
    const user = checkLogin();
    if (!user) return;

    await loadUserInfo(user.userid);
    await loadSalaryData(user.userid);
    await loadAttendanceData(user.userid);
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


        const userInfoEl = document.getElementById('userInfo');
        const usernameEl = document.getElementById('username');
        const subjectnameEl = document.getElementById('subjectname');
        const profileImgEl = document.getElementById('sidebarProfilePic');
        if (profileImgEl) {
            const imgSrc = userInfo.image ? userInfo.image : '/uploads/default.png';

            profileImgEl.src = `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`;
        }

        // เก็บค่าไว้ใน localStorage 
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

        // ตรวจสอบและตั้งค่าเมนูตาม role (เฉพาะ head of subject)
        setupMenuVisibility(userInfo.role_code);

        // บันทึก role ลงใน localStorage
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

async function loadSalaryData(userid) {
    try {
        const res = await fetch(`/api/userpayroll/${userid}`);
        if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลเงินเดือนได้');
        const response = await res.json();


        const data = response.success ? response.data : response;

        document.getElementById('employeeName').textContent = `${data.firstname} ${data.lastname}`;
        document.getElementById('employeeId').textContent = `SJT-${data.userid}`;
        document.getElementById('employeeRole').textContent = data.role_name || 'ไม่ระบุ';
        document.getElementById('employeeSubject').textContent = data.email || '-';

        // รายรับ
        document.getElementById('baseSalaryDisplay').textContent = formatCurrency(data.salary);
        document.getElementById('bonusDisplay').textContent = formatCurrency(data.bonus);
        document.getElementById('overtimeDisplay').textContent = "0.00 บาท";

        document.getElementById('displayBaseSalary').textContent = formatCurrency(data.salary);
        document.getElementById('displayBonus').textContent = formatCurrency(data.bonus);
        document.getElementById('displayOvertime').textContent = "0.00 บาท";
        document.getElementById('displayTotalIncome').textContent = formatCurrency((data.salary || 0) + (data.bonus || 0));

        // รายจ่าย
        document.getElementById('displayAbsenceDeduction').textContent = "0.00 บาท";
        document.getElementById('displayLeaveDeduction').textContent = formatCurrency(data.attendance_deduction || 0);
        document.getElementById('displayLateDeduction').textContent = formatCurrency(data.other_deduction || 0);
        document.getElementById('displayOtherDeduction').textContent = formatCurrency(data.other_deduction || 0);
        document.getElementById('displayTotalDeduction').textContent = formatCurrency((data.attendance_deduction || 0) + (data.other_deduction || 0));

        // สุทธิ
        document.getElementById('displayNetSalary').textContent = formatCurrency(data.total_salary || 0);

        // แสดงจำนวนวันลา (วันทำงานจริง) - จะถูกอัปเดตอีกครั้งจาก loadAttendanceData
        // เก็บค่าไว้ใน global variable 
        window.salaryLeaveCount = data.leave_count || 0;
        window.salaryLeaveRequests = data.leave_requests || 0;


        if (data.pay_date) {
            document.getElementById('lastUpdated').textContent = new Date(data.pay_date).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการโหลดเงินเดือน');
    }
}

async function loadAttendanceData(userid) {
    try {
        const res = await fetch(`/api/useratt/${userid}`);
        if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลเข้างาน');
        const response = await res.json();


        const records = response.success ? response.data : response;
        updateAttendanceTable(records);
        calculateDeductions(records);
    } catch (err) {
        console.error('loadAttendanceData error:', err);
    }
}

function updateAttendanceTable(records) {
    const tbody = document.getElementById('attendanceRecords');
    tbody.innerHTML = '';

    if (!Array.isArray(records) || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">ไม่มีข้อมูลการเข้างาน</td></tr>';
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        row.className = 'attendance-record';

        const date = new Date(record.timein);
        const thaiDate = date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        let typeText = '';
        let typeClass = '';
        let timeText = '-';

        switch (record.status) {
            case 'absent':
                typeText = 'ขาดงาน';
                typeClass = 'text-red-600';
                break;
            case 'leave':
                typeText = 'ลางาน';
                typeClass = 'text-yellow-600';
                break;
            case 'late':
                typeText = 'มาสาย';
                typeClass = 'text-orange-600';
                const timeIn = new Date(record.timein);
                const lateMinutes = Math.max(0, timeIn.getHours() * 60 + timeIn.getMinutes() - 8 * 60 - 30);
                timeText = `สาย ${lateMinutes} นาที`;
                break;
            case 'present':
                typeText = 'มาทำงาน';
                typeClass = 'text-green-600';
                break;
        }

        row.innerHTML = `
                    <td class="py-2 px-4 border-b">${thaiDate}</td>
                    <td class="py-2 px-4 border-b ${typeClass} font-medium">${typeText}</td>
                    <td class="py-2 px-4 border-b">${timeText}</td>
                    <td class="py-2 px-4 border-b">${record.note || '-'}</td>
                `;
        tbody.appendChild(row);
    });
}

function calculateDeductions(records) {
    if (!Array.isArray(records)) return;


    let absenceCount = 0;
    let leaveCount = 0;
    let lateCount = 0;

    records.forEach(record => {
        switch (record.status) {
            case 'absent':
                absenceCount++;
                break;
            case 'leave':
                leaveCount++;
                break;
            case 'late':
                lateCount++;
                break;
        }
    });

    // อัปเดตจำนวนในส่วนสถิติ
    document.getElementById('absenceCount').textContent = absenceCount;


    const leaveWorkingDays = window.salaryLeaveCount || leaveCount;
    const leaveRequests = window.salaryLeaveRequests || 0;

    if (window.salaryLeaveCount !== undefined && leaveRequests > 0) {
        document.getElementById('leaveCount').textContent = `${leaveWorkingDays} วันทำงาน (${leaveRequests} ครั้ง)`;
    } else {
        document.getElementById('leaveCount').textContent = leaveCount;
    }

    document.getElementById('lateCount').textContent = lateCount;

  
    const DEDUCTION_RATE = 300;

    const absenceDeduction = absenceCount * DEDUCTION_RATE;

    const leaveDeduction = leaveWorkingDays * DEDUCTION_RATE;
    const lateDeduction = lateCount * DEDUCTION_RATE;
    const totalDeduction = absenceDeduction + leaveDeduction + lateDeduction;

    // อัปเดตการแสดงผลในส่วนรายหัก
    document.getElementById('displayAbsenceDeduction').textContent = formatCurrency(absenceDeduction);
    document.getElementById('displayLeaveDeduction').textContent = formatCurrency(leaveDeduction);
    document.getElementById('displayLateDeduction').textContent = formatCurrency(lateDeduction);

    // คำนวณรายหักรวม (รวมรายการอื่นๆ ที่มีอยู่แล้ว)
    const otherDeductionText = document.getElementById('displayOtherDeduction').textContent;
    const otherDeduction = parseFloat(otherDeductionText.replace(/[^\d.]/g, '')) || 0;
    const finalTotalDeduction = totalDeduction + otherDeduction;

    document.getElementById('displayTotalDeduction').textContent = formatCurrency(finalTotalDeduction);

    // คำนวณเงินเดือนสุทธิใหม่
    const totalIncomeText = document.getElementById('displayTotalIncome').textContent;
    const totalIncome = parseFloat(totalIncomeText.replace(/[^\d.]/g, '')) || 0;
    const netSalary = totalIncome - finalTotalDeduction;

    document.getElementById('displayNetSalary').textContent = formatCurrency(netSalary);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0) + ' บาท';
}

// ฟังก์ชันออกจากระบบ
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}