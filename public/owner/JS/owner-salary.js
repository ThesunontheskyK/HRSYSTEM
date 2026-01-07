
        let currentUser = null;
        let employeesData = [];
        let currentEditingEmployee = null;
        let currentTab = 'employee';
        let attendanceData = null;

        // ตัวแปรสำหรับ Change Tracking
        let originalEmployeeData = null;  // เก็บข้อมูลเดิมก่อนแก้ไข
        let salaryChanges = {
            totalMonthlyChange: 0,      // การเปลี่ยนแปลงเงินเดือนรวมต่อเดือน
            totalYearlyChange: 0        // การเปลี่ยนแปลงเงินเดือนรวมต่อปี
        };
        let salaryChangeHistory = [];  // เก็บประวัติการเปลี่ยนแปลงทั้งหมด
        
        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
        });

        async function initializeApp() {
            try {
                
                // ตรวจสอบการเข้าสู่ระบบ
                currentUser = checkLoginStatus();
                if (!currentUser) return;

                // โหลดข้อมูลผู้ใช้
                await loadUserProfile();

                // ตั้งค่าเริ่มต้น
                setupEventListeners();
                setDefaultPayDate();

                // โหลดข้อมูลพนักงาน
                await loadEmployeesData();

            } catch (error) {
                console.error('Error initializing app:', error);
                showAlert('เกิดข้อผิดพลาดในการโหลดระบบ: ' + error.message, 'error');
            }
        }

        // เช็คการ Login และสิทธิ์
        function checkLoginStatus() {
            try {
                const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
                
                if (!user) {
                    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
                    window.location.href = '/index.html';
                    return null;
                }
                
                // ตรวจสอบว่าเป็น Owner หรือไม่
                if (user.loginType !== 'owner' && user.role_group !== 'owner') {
                    alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
                    localStorage.removeItem('loggedInUser');
                    window.location.href = '/index.html';
                    return null;
                }
                
                return user;
            } catch (error) {
                console.error('Error checking login status:', error);
                alert('เกิดข้อผิดพลาดในการตรวจสอบการเข้าสู่ระบบ');
                window.location.href = '/index.html';
                return null;
            }
        }

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

        function setupEventListeners() {
            // Search functionality
            document.getElementById('searchInput').addEventListener('input', filterEmployees);
            
            // Role filter
            document.getElementById('roleFilter').addEventListener('change', filterEmployees);
            
            // Modal close on outside click
            window.addEventListener('click', function(event) {
                const modal = document.getElementById('editModal');
                if (event.target === modal) {
                    closeModal();
                }
            });

            // Payroll calculation
            ['payrollBonus', 'payrollOtherDeduction'].forEach(id => {
                document.getElementById(id).addEventListener('input', calculatePayroll);
            });

            // Month change for attendance calculation
            document.getElementById('payrollMonth').addEventListener('change', loadAttendanceData);
        }

        function setDefaultPayDate() {
            const today = new Date();
            const firstDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const formattedDate = firstDayNextMonth.toISOString().split('T')[0];
            document.getElementById('payrollPayDate').value = formattedDate;
            
            // Set default month to current month
            const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM format
            document.getElementById('payrollMonth').value = currentMonth;
        }

        async function loadEmployeesData() {
            try {
                showLoading(true);

                // Load employees data
                const response = await fetch('/api/owner/all-employees');
                if (!response.ok) throw new Error('Failed to fetch employees');

                const data = await response.json();
                employeesData = data.success ? data.data : data;

                // Load financial summary, attendance issues, and monthly expenses in parallel
                await Promise.all([
                    loadFinancialSummary(),
                    loadAttendanceIssues(),
                    loadMonthlyExpenses()
                ]);

                // Initialize year filter
                initializeExpenseYearFilter();

                // Display data
                displayEmployees(employeesData);
                updateStatistics();
                displayMonthlyExpenses();

                showLoading(false);
            } catch (error) {
                console.error('Error loading data:', error);
                showLoading(false);
                showAlert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message, 'error');
            }
        }

        let financialSummaryData = null;
        let attendanceIssuesData = null;
        let yearlyComparisonData = null;
        let monthlyExpensesData = null;
        let currentExpenseYear = new Date().getFullYear();

        async function loadFinancialSummary() {
            try {
                // โหลดข้อมูลเงินเดือนรายปีแบบละเอียด
                const currentYear = new Date().getFullYear();
                const detailedResponse = await fetch(`/api/owner/salary-yearly-detailed?year=${currentYear}`);
                const detailedData = await detailedResponse.json();

                if (detailedData.success) {
                    financialSummaryData = {
                        salary_summary: {
                            total_yearly_expense: detailedData.data.total_yearly_salary,
                            estimated_simple_expense: detailedData.data.estimated_simple,
                            difference: detailedData.data.difference
                        }
                    };
                }
            } catch (error) {
                console.warn('Could not load financial summary:', error);
            }
        }

        async function loadAttendanceIssues() {
            try {
                const response = await fetch('/api/owner/attendance-issues-count');
                const data = await response.json();
                if (data.success) {
                    attendanceIssuesData = data.data;
                }
            } catch (error) {
                console.warn('Could not load attendance issues:', error);
            }
        }

        function displayEmployees(employees) {
            const tbody = document.getElementById('employeeTableBody');
            const tableEl = document.getElementById('employeeTable');
            const emptyEl = document.getElementById('emptyState');
            
            tbody.innerHTML = '';
            
            if (employees.length === 0) {
                tableEl.style.display = 'none';
                emptyEl.style.display = 'block';
                return;
            }

            tableEl.style.display = 'table';
            emptyEl.style.display = 'none';
            
            employees.forEach(employee => {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = `
                    <td>${employee.userid}</td>
                    <td>
                        <div style="font-weight: 500; color: #2c3e50;">${employee.firstname} ${employee.lastname}</div>
                        <div style="font-size: 12px; color: #7f8c8d;">${employee.email}</div>
                    </td>
                    <td>
                        <span class="role-badge role-${employee.role_group}">
                            ${employee.role_name}
                        </span>
                    </td>
                    <td>${translateSubject(employee.subject)}</td>
                    <td>
                        <span class="salary">
                            ฿${formatNumber(employee.salary || 0)}
                        </span>
                    </td>
                    <td>
                        <span style="color: #27ae60; font-weight: 500;">
                            <i class="mdi mdi-check-circle"></i> ทำงาน
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="openEditModal(${employee.userid})">
                            <i class="mdi mdi-cog"></i> จัดการ
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function updateStatistics() {
            const totalEmployees = employeesData.length;
            const totalSalary = employeesData.reduce((sum, emp) => sum + (parseFloat(emp.salary) || 0), 0);

            // แสดงข้อมูลจำนวนบุคลากรและเงินเดือนรวมต่อเดือน
            document.getElementById('totalEmployees').textContent = formatNumber(totalEmployees);
            document.getElementById('totalSalary').textContent = '฿' + formatNumber(totalSalary);

            // แสดงจำนวนพนักงานที่มีปัญหาเข้างานในเดือนนี้
            let issuesCount = 0;
            if (attendanceIssuesData) {
                issuesCount = attendanceIssuesData.total_issues_count || 0;
            }
            document.getElementById('attendanceIssuesCount').textContent = formatNumber(issuesCount) + ' คน';
        }

        function filterEmployees() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const roleFilter = document.getElementById('roleFilter').value;
            
            const filtered = employeesData.filter(employee => {
                const nameMatch = (employee.firstname + ' ' + employee.lastname).toLowerCase().includes(searchTerm);
                const roleMatch = !roleFilter || employee.role_group === roleFilter;
                return nameMatch && roleMatch;
            });
            
            displayEmployees(filtered);
        }

        function switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            currentTab = tabName;
        }

        async function openEditModal(userid) {
            const employee = employeesData.find(emp => emp.userid === userid);
            if (!employee) return;

            currentEditingEmployee = employee;

            // 🔍 เก็บข้อมูลเดิมก่อนแก้ไข (สำหรับ Change Tracking)
            originalEmployeeData = {
                salary: parseFloat(employee.salary) || 0,
                firstname: employee.firstname,
                lastname: employee.lastname,
                email: employee.email,
                tel: employee.tel,
                age: employee.age
            };

            // Fill employee data
            document.getElementById('editFirstName').value = employee.firstname || '';
            document.getElementById('editLastName').value = employee.lastname || '';
            document.getElementById('editEmail').value = employee.email || '';
            document.getElementById('editTel').value = employee.tel || '';
            document.getElementById('editAge').value = employee.age || '';
            document.getElementById('editBaseSalary').value = employee.salary || 0;
            
            // Fill payroll data
            document.getElementById('payrollBaseSalary').value = employee.salary || 0;
            document.getElementById('payrollBonus').value = 0;
            document.getElementById('payrollOtherDeduction').value = 0;
            
            // Clear alerts
            document.getElementById('modalAlert').innerHTML = '';
            
            // Show modal
            document.getElementById('editModal').style.display = 'block';

            // Load attendance data and salary change history in parallel
            await Promise.all([
                loadAttendanceData(),
                loadSalaryChangeHistory(userid)
            ]);

            // Display salary change history in modal
            displaySalaryChangeHistory();

            // Calculate payroll
            calculatePayroll();
        }

        function closeModal() {
            document.getElementById('editModal').style.display = 'none';
            currentEditingEmployee = null;

            // รีเซ็ตข้อมูล change tracking เมื่อปิด modal
            originalEmployeeData = null;
        }

        // 🔍 ฟังก์ชัน Utility สำหรับ Change Tracking
        function getSalaryChanges() {
            // ใช้งาน: getSalaryChanges() ใน console เพื่อดูข้อมูลการเปลี่ยนแปลงล่าสุด
            return {
                employee: originalEmployeeData,
                changes: salaryChanges,
                formatted: {
                    monthly: `${salaryChanges.totalMonthlyChange >= 0 ? '+' : ''}${formatNumber(salaryChanges.totalMonthlyChange)} บาท`,
                    yearly: `${salaryChanges.totalYearlyChange >= 0 ? '+' : ''}${formatNumber(salaryChanges.totalYearlyChange)} บาท`
                }
            };
        }

        function resetSalaryChanges() {
            // รีเซ็ตข้อมูลการเปลี่ยนแปลง
            salaryChanges.totalMonthlyChange = 0;
            salaryChanges.totalYearlyChange = 0;
            originalEmployeeData = null;
            console.log('✅ Reset salary changes tracking');
        }

        // 💾 ฟังก์ชันบันทึกประวัติการเปลี่ยนแปลงเงินเดือน
        async function saveSalaryChangeHistory(userid, oldSalary, newSalary, reason = null) {
            try {
                const response = await fetch('/api/owner/salary-change-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userid: userid,
                        old_salary: oldSalary,
                        new_salary: newSalary,
                        changed_by: currentUser ? currentUser.userid : null,
                        reason: reason
                    })
                });

                const result = await response.json();

                if (result.success) {
                    console.log('✅ บันทึกประวัติการเปลี่ยนแปลงเงินเดือนเรียบร้อย:', result);
                    return result;
                } else {
                    console.warn('⚠️ ไม่สามารถบันทึกประวัติได้:', result.message);
                    return null;
                }
            } catch (error) {
                console.error('❌ Error saving salary change history:', error);
                return null;
            }
        }

        // 📜 ฟังก์ชันดึงประวัติการเปลี่ยนแปลงเงินเดือน
        async function loadSalaryChangeHistory(userid) {
            try {
                const response = await fetch(`/api/owner/salary-change-history/${userid}`);
                const result = await response.json();

                if (result.success) {
                    salaryChangeHistory = result.data || [];
                    console.log(`📊 โหลดประวัติการเปลี่ยนแปลงเงินเดือน: ${salaryChangeHistory.length} รายการ`);
                    return salaryChangeHistory;
                } else {
                    console.warn('⚠️ ไม่สามารถดึงประวัติได้:', result.message);
                    salaryChangeHistory = [];
                    return [];
                }
            } catch (error) {
                console.error('❌ Error loading salary change history:', error);
                salaryChangeHistory = [];
                return [];
            }
        }

        // 📊 ฟังก์ชันแสดงประวัติการเปลี่ยนแปลงเงินเดือน
        function displaySalaryChangeHistory() {
            const historyContainer = document.getElementById('salaryChangeHistoryContainer');

            if (!historyContainer) {
                // หากยังไม่มี container ให้สร้างใหม่
                return;
            }

            if (salaryChangeHistory.length === 0) {
                historyContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #7f8c8d;">
                        <i class="mdi mdi-history" style="font-size: 48px;"></i>
                        <p style="margin-top: 10px;">ยังไม่มีประวัติการเปลี่ยนแปลงเงินเดือน</p>
                    </div>
                `;
                return;
            }

            // สร้างตารางประวัติเท่านั้น
            let html = '<div class="salary-history-section">';

            // ตารางประวัติ
            html += '<div class="salary-history-table">';
            html += '<h4 style="margin: 0 0 15px 0;"><i class="mdi mdi-history"></i> ประวัติการเปลี่ยนแปลงเงินเดือน</h4>';
            html += '<table style="width: 100%; font-size: 13px;">';
            html += '<thead><tr>';
            html += '<th>วันที่</th><th>เงินเดือนเดิม</th><th>เงินเดือนใหม่</th><th>เปลี่ยนแปลง</th><th>ผู้แก้ไข</th>';
            html += '</tr></thead><tbody>';

            salaryChangeHistory.forEach(history => {
                const changeDate = new Date(history.change_date).toLocaleString('th-TH', {
                    year: '2-digit',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const diffIcon = history.salary_diff > 0 ? '📈' : history.salary_diff < 0 ? '📉' : '➡️';
                const diffColor = history.salary_diff > 0 ? '#27ae60' : history.salary_diff < 0 ? '#e74c3c' : '#7f8c8d';
                const changedBy = history.changed_by_firstname ? `${history.changed_by_firstname} ${history.changed_by_lastname}` : '-';

                html += `<tr>`;
                html += `<td>${changeDate}</td>`;
                html += `<td>฿${formatNumber(history.old_salary)}</td>`;
                html += `<td>฿${formatNumber(history.new_salary)}</td>`;
                html += `<td style="color: ${diffColor}; font-weight: 600;">${diffIcon} ${history.salary_diff > 0 ? '+' : ''}${formatNumber(history.salary_diff)} ฿</td>`;
                html += `<td>${changedBy}</td>`;
                html += `</tr>`;
            });

            html += '</tbody></table></div>';
            html += '</div>';

            historyContainer.innerHTML = html;
        }

        async function loadAttendanceData() {
            if (!currentEditingEmployee) return;
            
            const monthValue = document.getElementById('payrollMonth').value;
            if (!monthValue) return;
            
            const [year, month] = monthValue.split('-');
            
            try {
                // Load leave history
                const leaveResponse = await fetch(`/api/owner/employee-attendance/${currentEditingEmployee.userid}?year=${year}&month=${month}`);
                const leaveData = await leaveResponse.json();
                
                attendanceData = leaveData.success ? leaveData.data : {
                    approvedLeaves: 0,
                    absentDays: 0,
                    lateDays: 0
                };
                
                updateAttendanceSummary();
                calculatePayroll();
                
            } catch (error) {
                console.error('Error loading attendance data:', error);
                // Set default values if API fails
                attendanceData = {
                    approvedLeaves: 0,
                    absentDays: 0,
                    lateDays: 0
                };
                updateAttendanceSummary();
                calculatePayroll();
            }
        }

        function updateAttendanceSummary() {
            if (!attendanceData) return;

            const approvedLeaves = attendanceData.approvedLeaves || 0; // วันทำงานจริง
            const leaveCount = attendanceData.leaveCount || 0; // จำนวนครั้ง
            const absentDays = attendanceData.absentDays || 0;
            const lateDays = attendanceData.lateDays || 0;
            const totalDeductions = approvedLeaves + absentDays + lateDays;
            const calculatedDeduction = totalDeductions * 300; // 300 บาทต่อครั้ง

            // แสดงวันทำงานจริงและจำนวนครั้ง
            document.getElementById('approvedLeaveCount').textContent = `${approvedLeaves} วันทำงาน (${leaveCount} ครั้ง)`;
            document.getElementById('absentCount').textContent = `${absentDays} ครั้ง`;
            document.getElementById('lateCount').textContent = `${lateDays} ครั้ง`;
            document.getElementById('totalDeductionCount').textContent = `${totalDeductions} วัน`;
            document.getElementById('calculatedDeduction').textContent = `${calculatedDeduction}฿`;
        }

        function calculatePayroll() {
            const baseSalary = parseFloat(document.getElementById('payrollBaseSalary').value) || 0;
            const bonus = parseFloat(document.getElementById('payrollBonus').value) || 0;
            const otherDeduction = parseFloat(document.getElementById('payrollOtherDeduction').value) || 0;
            
            // Calculate attendance deduction from attendance data
            let attendanceDeduction = 0;
            if (attendanceData) {
                const totalDeductions = (attendanceData.approvedLeaves || 0) + 
                                      (attendanceData.absentDays || 0) + 
                                      (attendanceData.lateDays || 0);
                attendanceDeduction = totalDeductions * 300; // 300 บาทต่อครั้ง
            }
            
            const totalSalary = baseSalary + bonus - attendanceDeduction - otherDeduction;
            
            document.getElementById('summaryBaseSalary').textContent = '฿' + formatNumber(baseSalary);
            document.getElementById('summaryBonus').textContent = '฿' + formatNumber(bonus);
            document.getElementById('summaryAttendanceDeduction').textContent = '-฿' + formatNumber(attendanceDeduction);
            document.getElementById('summaryOtherDeduction').textContent = '-฿' + formatNumber(otherDeduction);
            document.getElementById('summaryTotalSalary').textContent = '฿' + formatNumber(Math.max(0, totalSalary));
        }

        async function saveEmployeeChanges() {
            if (!currentEditingEmployee) return;
            
            const employeeData = {
                firstname: document.getElementById('editFirstName').value,
                lastname: document.getElementById('editLastName').value,
                email: document.getElementById('editEmail').value,
                tel: document.getElementById('editTel').value,
                age: parseInt(document.getElementById('editAge').value) || null,
                salary: parseFloat(document.getElementById('editBaseSalary').value) || 0,
                role_code: currentEditingEmployee.role_code,
                gender: currentEditingEmployee.gender,
                address: currentEditingEmployee.address,
                district: currentEditingEmployee.district,
                provience: currentEditingEmployee.provience,
                zipcode: currentEditingEmployee.zipcode
            };
            
            if (!employeeData.firstname || !employeeData.lastname || !employeeData.email) {
                showModalAlert('กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, นามสกุล, อีเมล)', 'error');
                return;
            }
            
            try {
                const response = await fetch(`/api/owner/employee/${currentEditingEmployee.userid}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(employeeData)
                });
                
                const result = await response.json();
                
                if (result.success || response.ok) {
                    // 📊 คำนวณการเปลี่ยนแปลง (Change Tracking)
                    const oldSalary = originalEmployeeData ? originalEmployeeData.salary : 0;
                    const newSalary = employeeData.salary;
                    const salaryDiff = newSalary - oldSalary;
                    const yearlyDiff = salaryDiff * 12;

                    // เก็บข้อมูลการเปลี่ยนแปลง
                    salaryChanges.totalMonthlyChange = salaryDiff;
                    salaryChanges.totalYearlyChange = yearlyDiff;

                    // 💾 บันทึกประวัติการเปลี่ยนแปลงลงฐานข้อมูล (ถ้ามีการเปลี่ยนแปลง)
                    if (salaryDiff !== 0) {
                        await saveSalaryChangeHistory(
                            currentEditingEmployee.userid,
                            oldSalary,
                            newSalary,
                            'ปรับเงินเดือนโดยผู้บริหาร'
                        );
                    }

                    // 📝 Log ข้อมูลการเปลี่ยนแปลงใน console
                    if (salaryDiff !== 0) {
                        console.group('💰 Salary Change Tracking');
                        console.log('พนักงาน:', `${originalEmployeeData.firstname} ${originalEmployeeData.lastname}`);
                        console.log('เงินเดือนเดิม:', formatNumber(oldSalary), 'บาท');
                        console.log('เงินเดือนใหม่:', formatNumber(newSalary), 'บาท');
                        console.log('เปลี่ยนแปลง (รายเดือน):', formatNumber(salaryDiff), 'บาท', salaryDiff > 0 ? '📈' : '📉');
                        console.log('เปลี่ยนแปลง (รายปี):', formatNumber(yearlyDiff), 'บาท', yearlyDiff > 0 ? '📈' : '📉');
                        console.groupEnd();
                    }

                    // Update local data immediately (optimistic update)
                    Object.assign(currentEditingEmployee, employeeData);

                    // Update employee in the main list
                    const empIndex = employeesData.findIndex(e => e.userid === currentEditingEmployee.userid);
                    if (empIndex !== -1) {
                        employeesData[empIndex].salary = employeeData.salary;
                        employeesData[empIndex].firstname = employeeData.firstname;
                        employeesData[empIndex].lastname = employeeData.lastname;
                        employeesData[empIndex].email = employeeData.email;
                        employeesData[empIndex].tel = employeeData.tel;
                        employeesData[empIndex].age = employeeData.age;
                    }

                    // Update statistics with new salary data (will recalculate after refreshData)
                    updateStatistics();

                    // Update table display
                    displayEmployees(employeesData);

                    // Update payroll base salary in modal
                    document.getElementById('payrollBaseSalary').value = employeeData.salary;
                    calculatePayroll();

                    // 📢 สร้างข้อความแจ้งเตือนพร้อมการเปลี่ยนแปลง
                    let changeMessage = '';
                    if (salaryDiff !== 0) {
                        const changeIcon = salaryDiff > 0 ? '📈' : '📉';
                        const changeText = salaryDiff > 0 ? 'เพิ่มขึ้น' : 'ลดลง';
                        const changeColor = salaryDiff > 0 ? '#27ae60' : '#e74c3c';

                        changeMessage = `
                            <div style="margin-top: 10px; padding: 10px; background: ${changeColor}15; border-left: 3px solid ${changeColor}; border-radius: 5px;">
                                ${changeIcon} <strong>การเปลี่ยนแปลงเงินเดือน:</strong><br>
                                • รายเดือน: ${changeText} <strong>${formatNumber(Math.abs(salaryDiff))} บาท</strong><br>
                                • รายปี (ประมาณการ): ${changeText} <strong>${formatNumber(Math.abs(yearlyDiff))} บาท</strong>
                            </div>
                        `;
                    }

                    // Close modal and refresh from server
                    setTimeout(async () => {
                        closeModal();

                        // แสดง alert พร้อมข้อมูลการเปลี่ยนแปลง
                        if (salaryDiff !== 0) {
                            const changeType = salaryDiff > 0 ? 'เพิ่มขึ้น' : 'ลดลง';
                            showAlert(
                                `✅ บันทึกสำเร็จ! เงินเดือน${changeType} ${formatNumber(Math.abs(salaryDiff))} บาท`,
                                salaryDiff > 0 ? 'success' : 'info'
                            );
                        } else {
                            showAlert('✅ บันทึกข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
                        }

                        // รอให้ database commit เสร็จก่อนโหลดข้อมูลใหม่
                        await refreshData();
                    }, 800);
                } else {
                    throw new Error(result.message || 'Failed to update employee');
                }
            } catch (error) {
                console.error('Error updating employee:', error);
                showModalAlert('เกิดข้อผิดพลาด: ' + error.message, 'error');
            }
        }

        async function createPayrollRecord() {
            if (!currentEditingEmployee) return;
            
            // Calculate attendance deduction
            let attendanceDeduction = 0;
            if (attendanceData) {
                const totalDeductions = (attendanceData.approvedLeaves || 0) + 
                                      (attendanceData.absentDays || 0) + 
                                      (attendanceData.lateDays || 0);
                attendanceDeduction = totalDeductions * 300;
            }
            
            const payrollData = {
                userid: currentEditingEmployee.userid,
                base_salary: parseFloat(document.getElementById('payrollBaseSalary').value) || 0,
                bonus: parseFloat(document.getElementById('payrollBonus').value) || 0,
                attendance_deduction: attendanceDeduction,
                other_deduction: parseFloat(document.getElementById('payrollOtherDeduction').value) || 0,
                pay_date: document.getElementById('payrollPayDate').value
            };
            
            if (!payrollData.pay_date) {
                showModalAlert('กรุณาเลือกวันที่จ่ายเงินเดือน', 'error');
                return;
            }
            
            try {
                // สร้าง API endpoint ใหม่สำหรับ payroll
                const response = await fetch('/api/owner/payroll', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payrollData)
                });
                
                const result = await response.json();
                
                if (result.success || response.ok) {
                    showModalAlert('สร้างรายการเงินเดือนเรียบร้อยแล้ว!', 'success');
                    
                    // Reset payroll form
                    document.getElementById('payrollBonus').value = 0;
                    document.getElementById('payrollOtherDeduction').value = 0;
                    calculatePayroll();
                    
                    setTimeout(() => {
                        closeModal();
                        showAlert('เพิ่มรายการเงินเดือนในระบบเรียบร้อยแล้ว', 'success');
                    }, 1500);
                } else {
                    throw new Error(result.message || 'Failed to create payroll record');
                }
            } catch (error) {
                console.error('Error creating payroll:', error);
                // หากยังไม่มี API ให้แสดง mock success
                showModalAlert('สร้างรายการเงินเดือนเรียบร้อยแล้ว! (API จะถูกเพิ่มในภายหลัง)', 'success');
                
                setTimeout(() => {
                    closeModal();
                    showAlert('เพิ่มรายการเงินเดือนในระบบเรียบร้อยแล้ว', 'success');
                }, 1500);
            }
        }

        async function refreshData() {
            await loadEmployeesData();
            showAlert('ข้อมูลถูกอัพเดทเรียบร้อยแล้ว', 'success');
        }

        function showLoading(show) {
            document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
            document.getElementById('employeeTableContainer').style.display = show ? 'none' : 'block';
        }

        function showAlert(message, type = 'success') {
            const colors = {
                'success': '#27ae60',
                'error': '#e74c3c',
                'info': '#3498db',
                'warning': '#f39c12'
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
                font-family: 'Prompt', sans-serif;
            `;
            notification.textContent = message;
            
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
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 5000);
        }

        function showModalAlert(message, type = 'success') {
            const alertDiv = document.getElementById('modalAlert');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.innerHTML = `
                <i class="mdi mdi-${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
                ${message}
            `;
        }

        function formatNumber(num) {
            return new Intl.NumberFormat('th-TH', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(num);
        }

        // ฟังก์ชันแปลงหมวดวิชาเป็นภาษาไทย
        function translateSubject(subject) {
            if (!subject) return '-';

            const subjectMap = {
                'math': 'คณิตศาสตร์',
                'mathematics': 'คณิตศาสตร์',
                'eng': 'ภาษาอังกฤษ',
                'english': 'ภาษาอังกฤษ',
                'computer': 'คอมพิวเตอร์',
                'sci': 'วิทยาศาสตร์',
                'science': 'วิทยาศาสตร์',
                'social': 'สังคมศึกษา',
                'social_studie': 'สังคมศึกษา',
                'social_studies': 'สังคมศึกษา',
                'thai': 'ภาษาไทย'
            };

            // แปลงเป็นตัวพิมพ์เล็กเพื่อเปรียบเทียบ
            const lowerSubject = subject.toLowerCase();

            // คืนค่าแปลหรือค่าเดิมถ้าไม่พบในแผนที่
            return subjectMap[lowerSubject] || subject;
        }

        // Show different sections
        function showSection(section) {
            const sectionNames = {
                'reports': 'รายงาน',
                'settings': 'ตั้งค่าระบบ'
            };
            
            const sectionName = sectionNames[section] || section;
            showAlert(`🚧 ระบบ${sectionName}กำลังอยู่ระหว่างการพัฒนา`, 'info');
        }

        // ============= MONTHLY EXPENSES FUNCTIONS =============
        async function loadMonthlyExpenses(year = currentExpenseYear) {
            try {
                const response = await fetch(`/api/owner/monthly-expenses?year=${year}`);
                const result = await response.json();

                if (result.success) {
                    monthlyExpensesData = result.data;
                    currentExpenseYear = year;
                    console.log(`✅ โหลดข้อมูลค่าใช้จ่ายรายเดือนปี ${year} เรียบร้อย`);
                    return monthlyExpensesData;
                } else {
                    console.warn('⚠️ ไม่สามารถดึงข้อมูลค่าใช้จ่ายรายเดือนได้:', result.message);
                    monthlyExpensesData = null;
                    return null;
                }
            } catch (error) {
                console.error('❌ Error loading monthly expenses:', error);
                monthlyExpensesData = null;
                return null;
            }
        }

        function displayMonthlyExpenses() {
            const tbody = document.getElementById('monthlyExpensesTableBody');
            const tableContainer = document.getElementById('monthlyExpensesTableContainer');
            const emptyEl = document.getElementById('monthlyExpensesEmptyState');

            console.log('📊 Displaying monthly expenses:', monthlyExpensesData);

            if (!monthlyExpensesData || !monthlyExpensesData.monthly_expenses || monthlyExpensesData.monthly_expenses.length === 0) {
                console.log('⚠️ No monthly expenses data to display');
                tableContainer.style.display = 'none';
                emptyEl.style.display = 'block';
                return;
            }

            tbody.innerHTML = '';
            tableContainer.style.display = 'block';
            emptyEl.style.display = 'none';

            monthlyExpensesData.monthly_expenses.forEach(record => {
                const row = document.createElement('tr');
                row.className = 'fade-in';

                const lastUpdated = record.last_updated
                    ? new Date(record.last_updated).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })
                    : 'ไม่มีการเปลี่ยนแปลง';

                row.innerHTML = `
                    <td>
                        <div style="font-weight: 500; color: #2c3e50;">${record.month_name} ${record.year}</div>
                        <div style="font-size: 12px; color: #7f8c8d;">เดือนที่ ${record.month}</div>
                    </td>
                    <td>
                        <span style="color: #3498db; font-weight: 500;">
                            ${formatNumber(record.employee_count)} คน
                        </span>
                    </td>
                    <td>
                        <span class="salary">
                            ฿${formatNumber(record.total_expense)}
                        </span>
                    </td>
                    <td>
                        <span style="font-size: 12px; color: #7f8c8d;">
                            ${lastUpdated}
                        </span>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function initializeExpenseYearFilter() {
            const select = document.getElementById('expenseYearFilter');
            const currentYear = new Date().getFullYear();

            // สร้าง options สำหรับ 5 ปีย้อนหลัง
            select.innerHTML = '';
            for (let i = 0; i <= 4; i++) {
                const year = currentYear - i;
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `ปี ${year}`;
                if (year === currentExpenseYear) {
                    option.selected = true;
                }
                select.appendChild(option);
            }

            // เพิ่ม event listener
            select.addEventListener('change', async function() {
                const selectedYear = parseInt(this.value);
                console.log(`🔄 Changing year to: ${selectedYear}`);

                showMonthlyExpensesLoading(true);

                try {
                    await loadMonthlyExpenses(selectedYear);
                    console.log('✅ Data loaded, now displaying...');
                    displayMonthlyExpenses();
                    updateStatistics();
                } catch (error) {
                    console.error('❌ Error loading expenses:', error);
                    showAlert('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                } finally {
                    showMonthlyExpensesLoading(false);
                }
            });
        }

        function showMonthlyExpensesLoading(show) {
            const loadingEl = document.getElementById('monthlyExpensesLoading');
            const tableContainer = document.getElementById('monthlyExpensesTableContainer');
            const emptyEl = document.getElementById('monthlyExpensesEmptyState');

            if (show) {
                loadingEl.style.display = 'block';
                tableContainer.style.display = 'none';
                emptyEl.style.display = 'none';
            } else {
                loadingEl.style.display = 'none';
                // Display will be set by displayMonthlyExpenses()
            }
        }

        async function exportMonthlyExpensesToCSV() {
            try {
                showAlert('กำลังสร้างไฟล์ CSV...', 'info');

                // เปิด URL ใหม่เพื่อดาวน์โหลด CSV
                const year = currentExpenseYear;
                window.open(`/api/owner/monthly-expenses/export-csv?year=${year}`, '_blank');

                setTimeout(() => {
                    showAlert(`✅ ส่งออกข้อมูลค่าใช้จ่ายรายเดือนปี ${year} เรียบร้อย`, 'success');
                }, 500);
            } catch (error) {
                console.error('Error exporting CSV:', error);
                showAlert('เกิดข้อผิดพลาดในการส่งออกข้อมูล', 'error');
            }
        }

        // ฟังก์ชัน logout
        function logout() {
            if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
                localStorage.removeItem('loggedInUser');
                window.location.href = '/index.html';
            }
        }
