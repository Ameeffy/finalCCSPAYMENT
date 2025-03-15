
const db = require('../config/db');
const transporter = require('./!Mainmailer');

// Function to send status update email for updateUserStatusWeb
const sendStatusUpdateEmailWeb = async (user_id, semester_id, section) => {
    try {
        // Fetch user details
        const [userResult] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
        const user = userResult[0];

        if (!user) {
            console.error('User not found');
            return;
        }

        // Fetch semester name
        const [semesterResult] = await db.query('SELECT * FROM semesters WHERE id = ?', [semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            console.error('Semester not found');
            return;
        }

        // Fetch COR number from semesters_users table
        const [semesterUserResult] = await db.query('SELECT * FROM semesters_users WHERE user_id = ? AND semester_id = ?', [user_id, semester_id]);
        const semesterUser = semesterUserResult[0];

        let corNumber = '';
        if (semesterUser) {
            corNumber = semesterUser.id; // Using the 'id' from semesters_users as the COR number
        }

        // Compose the email subject and body
        const subject = `Status Update: Enrollment Confirmed`;
        const message = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Hello ${user.firstname} ${user.lastname},</h2>
                        <p style="font-size: 16px; line-height: 1.5;">You are officially enrolled for the <strong>${semester.name}</strong>.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Course: <strong>${user.course}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">Section: <strong>${section}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">COR number: <strong>${corNumber}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">We are excited to have you on board! Please open your mobile applications CCSPAYMENT for further instructions.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Best regards,<br>The College of Computing Studies</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo" width="150" />
                        <p style="font-size: 14px; color: #777; margin-top: 10px;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                    </div>
                </body>
            </html>
        `;

        // Send the email
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: user.email,
            subject: subject,
            html: message
        };

        await transporter.sendMail(mailOptions);

        console.log('Email sent successfully to', user.email);

    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = { sendStatusUpdateEmailWeb };
