// ใช้ nodemailer สำหรับการส่งอีเมล
const nodemailer = require('nodemailer');
// สร้าง transporter สำหรับส่งอีเมล
const transporter = nodemailer.createTransport({
    service: 'gmail', // ใช้ Gmail service
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true สำหรับ port 465, false สำหรับ port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // สำหรับ development
    }
});

/**
 * ส่งอีเมลรีเซ็ตรหัสผ่าน
 * @param {string} email - อีเมลผู้รับ
 * @param {string} resetToken - Token สำหรับรีเซ็ตรหัสผ่าน
 * @param {string} userName - ชื่อผู้ใช้
 * @returns {Promise} - Promise ของการส่งอีเมล
 */
async function sendPasswordResetEmail(email, resetToken, userName) {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;

        const mailOptions = {
            from: `"HR Management System" <${process.env.EMAIL_USER}>`, // ใช้ EMAIL_USER แทน EMAIL_FROM สำหรับ Gmail
            to: email,
            subject: 'รีเซ็ตรหัสผ่าน - HR Management System',
        html: `
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .container {
                        background-color: #f9f9f9;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h2 {
                        color: #007bff;
                        margin-top: 0;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #007bff;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        margin: 20px 0;
                        font-weight: bold;
                    }
                    .button:hover {
                        background-color: #0056b3;
                    }
                    .warning {
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 10px;
                        margin: 20px 0;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 12px;
                        color: #666;
                    }
                    code {
                        background-color: #e9ecef;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>🔐 รีเซ็ตรหัสผ่าน</h2>
                    <p>สวัสดีคุณ <strong>${userName}</strong>,</p>
                    <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>

                    <a href="${resetUrl}" class="button">รีเซ็ตรหัสผ่าน</a>

                    <p>หรือคัดลอกลิงค์นี้ไปวางในเบราว์เซอร์:</p>
                    <p><code>${resetUrl}</code></p>

                    <div class="warning">
                        <strong>⚠️ สำคัญ:</strong>
                        <ul>
                            <li>ลิงค์นี้จะหมดอายุใน <strong>1 ชั่วโมง</strong></li>
                            <li>ใช้ได้เพียงครั้งเดียวเท่านั้น</li>
                        </ul>
                    </div>

                    <p>ถ้าคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะยังคงปลอดภัย</p>

                    <div class="footer">
                        <p>อีเมลนี้ถูกส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                        <p>&copy; 2025 HR Management System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        throw error;
    }
}

/**
 * ตรวจสอบการตั้งค่าอีเมล
 * @returns {Promise<boolean>} - true ถ้าตั้งค่าถูกต้อง
 */
async function verifyEmailConfig() {
    try {
        await transporter.verify();
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    sendPasswordResetEmail,
    verifyEmailConfig
};
