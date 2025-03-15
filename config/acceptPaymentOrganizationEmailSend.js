const db = require('../config/db'); 
const transporter = require('./!Mainmailer');



const acceptPaymentOrganizationEmailSend = async (payment_id) => {
    try {
        // Fetch payment details
        const [paymentResult] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
        const payment = paymentResult[0];

        if (!payment) {
            console.error('Payment not found');
            return;
        }

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT * FROM organizations WHERE id = ?', [payment.organization_id]);
        const organization = organizationResult[0];

        if (!organization) {
            console.error('Organization not found');
            return;
        }

        // Fetch semester name
        const [semesterResult] = await db.query('SELECT * FROM semesters WHERE id = ?', [payment.semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            console.error('Semester not found');
            return;
        }

        // Compose the email subject and body
        const subject = `Payment Accepted for ${organization.name}`;
        const message = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Hello ${organization.name},</h2>
                        <p style="font-size: 16px; line-height: 1.5; ">Your requested payment for the <strong style="color: #0b3d2e;">${semester.name}</strong> has been successfully accepted.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Payment Name: <strong>${payment.name}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">Payment Type: <strong>${payment.payment_type}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">Total price: <strong>${payment.price}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">We are excited to confirm your payment for this semester and you may now start collecting your payments</p>
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
            to: organization.email,
            subject: subject,
            html: message
        };

        // Send the email using the transporter
        await transporter.sendMail(mailOptions);

        console.log('Payment accepted email sent successfully to', organization.email);

    } catch (error) {
        console.error('Error sending payment accepted email:', error);
    }
};
const acceptPaymentOrganizationEmailSendQR = async (payment_id) => {
    try {
        // Fetch payment details
        const [paymentResult] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
        const payment = paymentResult[0];

        if (!payment) {
            console.error('Payment not found');
            return;
        }

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT * FROM organizations WHERE id = ?', [payment.organization_id]);
        const organization = organizationResult[0];

        if (!organization) {
            console.error('Organization not found');
            return;
        }

        // Fetch semester name
        const [semesterResult] = await db.query('SELECT * FROM semesters WHERE id = ?', [payment.semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            console.error('Semester not found');
            return;
        }

        // Compose the email subject and body
        const subject = `${payment.name} QR Code Accepted`;
        const message = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Hello ${organization.name},</h2>
                        <p style="font-size: 16px; line-height: 1.5;">Your QR Code payment for the <strong>${semester.name}</strong> has been successfully accepted.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Payment Name: <strong>${payment.name}</strong></p>
                        <p style="font-size: 16px; line-height: 1.5;">You may now continue to receive a payments .</p>
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
            to: organization.email,
            subject: subject,
            html: message
        };

        // Send the email using the transporter
        await transporter.sendMail(mailOptions);

        console.log('Payment accepted email sent successfully to', organization.email);

    } catch (error) {
        console.error('Error sending payment accepted email:', error);
    }
};

module.exports = { acceptPaymentOrganizationEmailSend,acceptPaymentOrganizationEmailSendQR };
