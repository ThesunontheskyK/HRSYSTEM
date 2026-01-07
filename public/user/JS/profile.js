let isEditMode = false;
let originalData = {};
let currentUser = null;

// ฟังก์ชันเริ่มต้น
window.onload = async function () {
    const user = checkLogin();
    if (!user) return;

    currentUser = user;
    await loadUserInfo(user.userid);
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

// โหลดข้อมูลผู้ใช้
async function loadUserInfo(userId) {
    try {
        const res = await fetch(`/api/userinfo/${userId}`);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const userInfo = await res.json();

        // Debug: ตรวจสอบข้อมูลที่ได้รับ
        console.log('User info received:', userInfo);
        console.log('Salary value:', userInfo.salary);
        console.log('Current salary value:', userInfo.current_salary);

        // อัปเดตข้อมูลในหน้า
        displayUserData(userInfo);
        originalData = { ...userInfo };

        // อัปเดต sidebar
        const usernameEl = document.getElementById('username');
        const subjectnameEl = document.getElementById('subjectname');
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
        showAlert('error', 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้');
    } finally {
        // ซ่อน loading และแสดง content
        const loadingEl = document.getElementById('loading');
        const contentEl = document.getElementById('content');

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    }
}

// แสดงข้อมูลผู้ใช้
function displayUserData(user) {
    // อัปเดตการ์ดผู้ใช้
    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim();

    const displayNameEl = document.getElementById('display-name');
    const displayEmailEl = document.getElementById('display-email');
    const displayRoleEl = document.getElementById('display-role');
    const img = document.getElementById('profileImage');
    if (img) img.src = (user.image && user.image.trim()) ? user.image : '/uploads/default.png';

    if (displayNameEl) displayNameEl.textContent = fullName || 'ไม่ระบุ';
    if (displayEmailEl) displayEmailEl.textContent = user.email || 'ไม่ระบุ';
    if (displayRoleEl) displayRoleEl.textContent = getRoleText(user.role_code);

    // อัปเดตฟอร์ม
    const fields = {
        'firstname': user.firstname,
        'lastname': user.lastname,
        'email': user.email,
        'tel': user.tel,
        'age': user.age,
        'gender': user.gender,
        'nation': user.nation,
        'religion': user.religion,
        'salary': user.salary,
        'address': user.address,
        'district': user.district,
        'provience': user.provience,
        'zipcode': user.zipcode
    };

    // ตั้งค่าฟิลด์ทั่วไป
    Object.keys(fields).forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = fields[fieldId] || '';
        }
    });

    // จัดการวันที่เกิด
    const birthdateEl = document.getElementById('birthdate');
    if (birthdateEl && user.birthdate) {
        try {
            const date = new Date(user.birthdate);
            birthdateEl.value = date.toISOString().split('T')[0];
        } catch (error) {
            console.error('Error formatting birthdate:', error);
            birthdateEl.value = '';
        }
    }

    // แสดงเงินเดือนในรูปแบบที่อ่านง่าย
    const salaryEl = document.getElementById('salary');
    if (salaryEl) {
        const salary = user.current_salary || user.salary;
        console.log('Setting salary field with value:', salary);
        console.log('Salary element found:', salaryEl);
        salaryEl.value = salary ? parseFloat(salary).toLocaleString('th-TH') : '';
        console.log('Final salary field value:', salaryEl.value);
    }
}

// แปลงรหัสตำแหน่งเป็นข้อความ
function getRoleText(roleCode) {
    const roles = {
        'owner': 'เจ้าของระบบ',
        'admin_academic': 'ผู้ดูแลฝ่ายวิชาการ',
        'admin_management': 'ผู้ดูแลฝ่ายบริหาร',
        'admin_operation': 'ผู้ดูแลฝ่ายปฏิบัติการ',
        'admin_pastoral': 'ผู้ดูแลฝ่ายปกครอง',
        'admin_quality': 'ผู้ดูแลฝ่ายประกันคุณภาพ',
        'admin_resource': 'ผู้ดูแลฝ่ายทรัพยากร',
        'admin_student': 'ผู้ดูแลฝ่ายกิจการนักเรียน',
        'head_of_math': 'หัวหน้าวิชาคณิตศาสตร์',
        'head_of_eng': 'หัวหน้าวิชาภาษาอังกฤษ',
        'head_of_computer': 'หัวหน้าวิชาคอมพิวเตอร์',
        'head_of_sci': 'หัวหน้าวิชาวิทยาศาสตร์',
        'head_of_social_studie': 'หัวหน้าวิชาสังคมศึกษา',
        'head_of_thai': 'หัวหน้าวิชาภาษาไทย',
        'mathteacher': 'ครูคณิตศาสตร์',
        'engteacher': 'ครูภาษาอังกฤษ',
        'computerteacher': 'ครูคอมพิวเตอร์',
        'sciteacher': 'ครูวิทยาศาสตร์',
        'socialteacher': 'ครูสังคมศึกษา',
        'thaiteacher': 'ครูภาษาไทย'
    };
    return roles[roleCode] || roleCode || 'ไม่ระบุ';
}

// เปลี่ยนโหมดแก้ไข
function toggleEditMode() {
    isEditMode = !isEditMode;
    const formElements = document.querySelectorAll('#profileForm input:not(#email):not(#salary), #profileForm select');
    const editButton = document.getElementById('editToggle');
    const formActions = document.getElementById('form-actions');

    if (isEditMode) {
        // เปิดโหมดแก้ไข
        formElements.forEach(element => {
            element.readOnly = false;
            element.disabled = false;
        });
        if (editButton) {
            editButton.textContent = 'ยกเลิก';
            editButton.className = 'btn-cancel';
        }
        if (formActions) formActions.style.display = 'block';
        hideAlert();
    } else {
        // ปิดโหมดแก้ไข
        cancelEdit();
    }
}

// ยกเลิกการแก้ไข
function cancelEdit() {
    isEditMode = false;
    const formElements = document.querySelectorAll('#profileForm input, #profileForm select');
    const editButton = document.getElementById('editToggle');
    const formActions = document.getElementById('form-actions');

    formElements.forEach(element => {
        if (element.id !== 'email' && element.id !== 'salary') {
            element.readOnly = true;
            element.disabled = true;
        } else {
            element.readOnly = true;
        }
    });

    if (editButton) {
        editButton.textContent = 'แก้ไขข้อมูล';
        editButton.className = 'btn-edit';
    }
    if (formActions) formActions.style.display = 'none';

    // คืนค่าข้อมูลเดิม
    displayUserData(originalData);
    hideAlert();
}

// ส่งข้อมูลการแก้ไข
function initializeFormSubmit() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // แสดง loading spinner
            const saveSpinner = document.getElementById('save-spinner');
            const submitButton = e.target.querySelector('button[type="submit"]');
            if (saveSpinner) saveSpinner.style.display = 'inline-block';
            if (submitButton) submitButton.disabled = true;

            const formData = {
                firstname: document.getElementById('firstname')?.value?.trim() || '',
                lastname: document.getElementById('lastname')?.value?.trim() || '',
                tel: document.getElementById('tel')?.value?.trim() || '',
                age: document.getElementById('age')?.value ? parseInt(document.getElementById('age').value) : null,
                gender: document.getElementById('gender')?.value || '',
                birthdate: document.getElementById('birthdate')?.value || null,
                nation: document.getElementById('nation')?.value?.trim() || '',
                religion: document.getElementById('religion')?.value?.trim() || '',
                address: document.getElementById('address')?.value?.trim() || '',
                district: document.getElementById('district')?.value?.trim() || '',
                provience: document.getElementById('provience')?.value?.trim() || '',
                zipcode: document.getElementById('zipcode')?.value?.trim() || ''
            };

            // ตรวจสอบข้อมูลที่จำเป็น
            if (!formData.firstname || !formData.lastname) {
                showAlert('error', 'กรุณากรอกชื่อและนามสกุล');
                if (saveSpinner) saveSpinner.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
                return;
            }

            try {
                const response = await fetch(`/api/profile/${currentUser.userid}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('success', 'บันทึกข้อมูลสำเร็จ');
                    originalData = { ...originalData, ...formData };

                    // อัปเดตการแสดงผล
                    displayUserData(originalData);

                    // ปิดโหมดแก้ไข
                    setTimeout(() => {
                        toggleEditMode();
                    }, 1500);
                } else {
                    showAlert('error', data.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                showAlert('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
            } finally {
                if (saveSpinner) saveSpinner.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
            }
        });
    }
}

// แสดงข้อความแจ้งเตือน
function showAlert(type, message) {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const icon = type === 'success' ? '✅' : '❌';

    alertContainer.innerHTML = `
        <div class="alert ${alertClass}" role="alert">
            <span class="alert-icon">${icon}</span>
            <span class="alert-message">${message}</span>
            <button type="button" class="alert-close" onclick="hideAlert()">
                <span>&times;</span>
            </button>
        </div>
    `;

    // Auto hide success messages
    if (type === 'success') {
        setTimeout(() => {
            hideAlert();
        }, 3000);
    }
}

// ซ่อนข้อความแจ้งเตือน
function hideAlert() {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = '';
    }
}

// ออกจากระบบ
function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/index.html';
    }
}

// เริ่มต้นการทำงานเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', function () {
    // เพิ่ม event listeners สำหรับฟอร์ม
    initializeFormSubmit();

    // ตรวจสอบข้อมูลอีเมล
    const emailEl = document.getElementById('email');
    if (emailEl) {
        emailEl.addEventListener('input', function () {
            const email = this.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (email && !emailRegex.test(email)) {
                this.setCustomValidity('กรุณากรอกอีเมลให้ถูกต้อง');
            } else {
                this.setCustomValidity('');
            }
        });
    }

    // ตรวจสอบเบอร์โทรศัพท์
    const telEl = document.getElementById('tel');
    if (telEl) {
        telEl.addEventListener('input', function () {
            const tel = this.value;
            const telRegex = /^[0-9-+\s()]*$/;

            if (tel && !telRegex.test(tel)) {
                this.setCustomValidity('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
            } else {
                this.setCustomValidity('');
            }
        });
    }

    // ตรวจสอบรหัสไปรษณีย์
    const zipcodeEl = document.getElementById('zipcode');
    if (zipcodeEl) {
        zipcodeEl.addEventListener('input', function () {
            const zipcode = this.value;
            const zipcodeRegex = /^[0-9]*$/;

            if (zipcode && !zipcodeRegex.test(zipcode)) {
                this.setCustomValidity('กรุณากรอกรหัสไปรษณีย์เป็นตัวเลขเท่านั้น');
            } else {
                this.setCustomValidity('');
            }
        });
    }
});

// ป้องกันการปิดหน้าต่างขณะแก้ไข
window.addEventListener('beforeunload', function (e) {
    if (isEditMode) {
        e.preventDefault();
        e.returnValue = '';
        return 'คุณมีการแก้ไขข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    // Ctrl+S สำหรับบันทึกข้อมูล
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isEditMode) {
            const profileForm = document.getElementById('profileForm');
            if (profileForm) {
                profileForm.dispatchEvent(new Event('submit'));
            }
        }
    }

    // Escape สำหรับยกเลิกการแก้ไข
    if (e.key === 'Escape' && isEditMode) {
        cancelEdit();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnChangeImage');
    const input = document.getElementById('imageUpload');
    const img = document.getElementById('profileImage');

    if (btn && input) {
        btn.addEventListener('click', () => input.click());

        input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            // ✅ เอา userid จากตัวแปร global currentUser (ซึ่งตั้งค่าไว้ตอน checkLogin())
            const uid =
                (window.currentUser && window.currentUser.userid) ||
                (JSON.parse(localStorage.getItem('loggedInUser') || '{}').userid);

            if (!uid) {
                alert('ไม่พบผู้ใช้ (userid) กรุณาเข้าสู่ระบบใหม่');
                // window.location.href = '/index.html';
                return;
            }

            const formData = new FormData();
            formData.append('image', file);

            try {
                const res = await fetch(`/api/profile/${uid}/image`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (img) img.src = data.image + '?t=' + Date.now(); // bust cache
                    alert('เปลี่ยนรูปสำเร็จ');
                    location.reload();

                } else {
                    alert('อัปโหลดไม่สำเร็จ: ' + (data.message || res.status));
                }
            } catch (err) {
                console.error(err);
                alert('เกิดข้อผิดพลาดในการอัปโหลด');
            } finally {
                event.target.value = ''; // reset file input
            }
        });
    }

    // ฟังก์ชันเปลี่ยนรหัสผ่าน
    const btnChangePassword = document.getElementById('btnChangePassword');
    if (btnChangePassword) {
        btnChangePassword.addEventListener('click', async () => {
            const currentPassword = document.getElementById('currentPassword')?.value;
            const newPassword = document.getElementById('newPassword')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                showAlert('error', 'กรุณากรอกข้อมูลให้ครบถ้วน');
                return;
            }

            if (newPassword.length < 6) {
                showAlert('error', 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
                return;
            }

            if (newPassword !== confirmPassword) {
                showAlert('error', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
                return;
            }

            // แสดง loading spinner
            const passwordSpinner = document.getElementById('password-spinner');
            if (passwordSpinner) passwordSpinner.style.display = 'inline-block';
            btnChangePassword.disabled = true;

            try {
                const uid = currentUser?.userid || JSON.parse(localStorage.getItem('loggedInUser') || '{}').userid;

                if (!uid) {
                    showAlert('error', 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
                    return;
                }

                const response = await fetch(`/api/profile/${uid}/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('success', 'เปลี่ยนรหัสผ่านสำเร็จ');

                    // ล้างฟอร์ม
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                } else {
                    showAlert('error', data.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
                }
            } catch (error) {
                console.error('Error changing password:', error);
                showAlert('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
            } finally {
                if (passwordSpinner) passwordSpinner.style.display = 'none';
                btnChangePassword.disabled = false;
            }
        });
    }
});
localStorage.setItem('profileImageUpdated', image);
setTimeout(() => localStorage.removeItem('profileImageUpdated'), 1000);