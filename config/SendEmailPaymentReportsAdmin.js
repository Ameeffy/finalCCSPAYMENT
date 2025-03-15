
const db = require('../config/db'); 
const transporter = require('./!Mainmailer');

// Function to send payment report email to Admin after payment is accepted or declined
const sendPaymentReportEmail = async (payment_id, status, reason, description) => {
    try {
        // Fetch payment details
        const [paymentResult] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
        const payment = paymentResult[0];
        if (!payment) throw new Error('Payment not found');

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT name, email FROM organizations WHERE id = ?', [payment.organization_id]);
        const organization = organizationResult[0];
        if (!organization) throw new Error('Organization not found');

        // Fetch semester details
        const [semesterResult] = await db.query('SELECT name FROM semesters WHERE id = ?', [payment.semester_id]);
        const semester = semesterResult[0];
        if (!semester) throw new Error('Semester not found');

        // Fetch the admin who processed the report (using admin_report_by from payment_reports table)
        const [reportResult] = await db.query('SELECT admin_report_by FROM payment_reports WHERE payment_id = ?', [payment_id]);
        const report = reportResult[0];
        if (!report) throw new Error('Report not found for this payment');

        // Fetch admin details for the person who reported the payment
        const [adminResult] = await db.query('SELECT CONCAT(firstname," ", middlename," ", lastname) AS name FROM admins WHERE id = ?', [report.admin_report_by]);
        const admin = adminResult[0];
        if (!admin) throw new Error('Admin not found for this report');

        // Compose the email
        const subject = `Payment Report for ${organization.name}`;
        const message = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Payment Report for ${organization.name}</h2>
                        <p>Payment for the <strong>${semester.name}</strong> semester has been <strong>${status}</strong>.</p>
                        <p><strong>Payment name:</strong> ${payment.name}</p>
                        <p><strong>Processed by:</strong> ${admin.name}</p>
                        <p><strong>Amount:</strong> ₱${payment.price}</p>
                        <p><strong>Reason for report:</strong> ${reason}</p>
                        ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
                        <p>Best regards,<br>The College of Computing Studies</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo" width="150" />
                        <p style="font-size: 14px; color: #777;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                    </div>
                </body>
            </html>
        `;

        // Set up mail options
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: organization.email,
            subject,
            html: message,
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Payment report email sent successfully to ${organization.email}`);
    } catch (error) {
        console.error('Error sending payment report email:', error);
    }
};

module.exports = { sendPaymentReportEmail };
