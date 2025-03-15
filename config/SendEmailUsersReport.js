
const db = require('../config/db'); 
const transporter = require('./!Mainmailer');

// Function to send report email to user
const sendReportEmail = async (semester_user_id, user_id, semester_id, reason, comment, adminId) => {
    try {
        // Fetch user details
        const [userResult] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
        const user = userResult[0];

        if (!user) {
            console.error('User not found');
            return;
        }

        // Fetch semester details
        const [semesterResult] = await db.query('SELECT * FROM semesters WHERE id = ?', [semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            console.error('Semester not found');
            return;
        }

        // Fetch admin details
        const [adminResult] = await db.query('SELECT * FROM admins WHERE id = ?', [adminId]);
        const admin = adminResult[0];

        // Fetch the COR number from the semesters_users table
        const [semesterUserResult] = await db.query('SELECT * FROM semesters_users WHERE id = ?', [semester_user_id]);
        const semesterUser = semesterUserResult[0];

        let corNumber = semesterUser ? semesterUser.id : 'N/A';

        // Compose the email
        const subject = `User Report: ${user.firstname} ${user.lastname}`;
        const message = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Hello ${user.firstname},</h2>
                        <p>We have received a report for the user <strong>${user.firstname} ${user.lastname}</strong> in the <strong>${semester.name}</strong>.</p>
                        <p><strong>COR Number:</strong> ${corNumber}</p>
                        <p><strong>Reason for Report:</strong> ${reason}</p>
                        <p><strong>Comments:</strong> ${comment || 'No additional comments'}</p>
                        <p><strong>Reported by:</strong> ${admin ? admin.firstname + ' ' + admin.lastname : 'Unknown Admin'}</p>
                        <p>If you have any further questions, feel free to take action as necessary.</p>
                        <p>Best regards,<br>The College of Computing Studies</p>
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


module.exports = { sendReportEmail };
