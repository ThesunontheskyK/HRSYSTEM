// ต้องมี common.js loaded ก่อน
let isEditMode = false;
let originalData = {};
let currentUser = null;

// ฟังก์ชันเริ่มต้น
window.onload = async function () {
    currentUser = checkLogin(); // ใช้จาก common.js
    if (!currentUser) return;

    // ตั้งค่า active menu สำหรับหน้าปัจจุบัน
    if (typeof autoSetActiveMenu === 'function') {
        autoSetActiveMenu();
    }

    await loadUserProfile(currentUser.userid);
};

// โหลดข้อมูลโปรไฟล์ผู้ใช้
async function loadUserProfile(userId) {
    try {
        showLoading(true, 'กำลังโหลดข้อมูลผู้ใช้...'); // ใช้จาก common.js

        const userInfo = await loadUserInfo(userId); // ใช้จาก common.js
        if (userInfo) {
            displayUserData(userInfo);
            originalData = { ...userInfo };
        }

    } catch (error) {
        handleError(error, 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้'); // ใช้จาก common.js
    } finally {
        // ซ่อน loading และแสดง content
        showLoading(false); // ใช้จาก common.js
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
    if (displayRoleEl) displayRoleEl.textContent = getRoleText(user.role_code); // ใช้จาก common.js

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
        const salary = user.salary || user.current_salary;
        salaryEl.value = salary ? parseFloat(salary).toLocaleString('th-TH') : '';
    }
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

            showLoading(true, 'กำลังบันทึกข้อมูล...'); // ใช้จาก common.js

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
                showAlert('error', 'กรุณากรอกชื่อและนามสกุล'); // ใช้จาก common.js
                showLoading(false);
                return;
            }

            // ตรวจสอบอีเมลและเบอร์โทรศัพท์
            if (formData.tel && !validatePhone(formData.tel)) { // ใช้จาก common.js
                showAlert('error', 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
                showLoading(false);
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
                    showAlert('success', 'บันทึกข้อมูลสำเร็จ'); // ใช้จาก common.js
                    originalData = { ...originalData, ...formData };

                    // อัปเดตการแสดงผล
                    displayUserData(originalData);

                    // ปิดโหมดแก้ไข
                    setTimeout(() => {
                        toggleEditMode();
                    }, 1500);
                } else {
                    showAlert('error', data.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'); // ใช้จาก common.js
                }
            } catch (error) {
                handleError(error, 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'); // ใช้จาก common.js
            } finally {
                showLoading(false); // ใช้จาก common.js
            }
        });
    }
}

// แสดงข้อความแจ้งเตือน (ใช้ฟังก์ชันจาก common.js แทน)
function showAlert(type, message) {
    // ใช้ showAlert จาก common.js
    window.showAlert(type, message);
}

// ซ่อนข้อความแจ้งเตือน
function hideAlert() {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = '';
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

            if (email && !validateEmail(email)) { // ใช้จาก common.js
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

            if (tel && !validatePhone(tel)) { // ใช้จาก common.js
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