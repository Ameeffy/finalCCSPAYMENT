const transporter = require('./!Mainmailer');

const sendAdviserOrderStatusEmail = async (email, orgName, orderId, orderStatus, semesterName, status, adviserFullName) => {
    try {
        let message = `
            <h2 style="color: #0b3d2e;">Hello ${orgName},</h2>
            <p style="font-size: 16px; line-height: 1.5;">Your GCash QR code request for the <strong style="color: #0b3d2e;">${semesterName}</strong> semester has been <strong style="color: #0b3d2e;">${status}</strong>.</p>
        `;

        if (status === 'Accepted') {
            message += `
                <p style="font-size: 16px; line-height: 1.5;">Thank you for submitting your GCash QR code request. It has been successfully <strong>Accepted</strong> and will now be reviewed by the admin for final verification.</p>
                <p style="font-size: 16px; line-height: 1.5;">Please wait for further updates regarding the approval process.</p>
            `;
        } else if (status === 'Declined') {
            message += `
                <p style="font-size: 16px; line-height: 1.5; color: red;"><strong>Unfortunately, your GCash QR code request has been <strong>Declined</strong>.</p>
                <p style="font-size: 16px; line-height: 1.5;">We regret to inform you that your submission did not meet the necessary requirements. Please review your request and make any necessary adjustments before resubmitting.</p>
                <p style="font-size: 16px; line-height: 1.5;">For further assistance, please contact the administration.</p>
            `;
        }

        const subject = `Your GCash Order ID ${orderId} is ${status}`;

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: `
                <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                color: #333;
                                background-color: #f4f4f4;
                                padding: 20px;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                padding: 20px;
                                border-radius: 8px;
                                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                            }
                            h2 {
                                color: #0b3d2e;
                            }
                            p {
                                font-size: 16px;
                                line-height: 1.5;
                                color: rgb(0, 0, 0);
                            }
                            .footer {
                                margin-top: 20px;
                                font-size: 14px;
                                color: #777;
                            }
                            .footer a {
                                color: #0b3d2e;
                                text-decoration: none;
                            }
                            .logo {
                                text-align: center;
                                margin-bottom: 20px;
                            }
                            .logo img {
                                width: 150px;
                                margin-bottom: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="logo">
                                <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                            </div>
                            ${message}
                            <p><strong style="color: #0b3d2e;">Performed by:</strong> ${adviserFullName}</p>
                            <div class="footer">
                                <p>Best Regards,<br>
                                The College of Computing Studies</p>
                                <p style="font-size: 14px; color: #777; margin-top: 10px;">
                                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                                </p>
                            </div>
                        </div>
                    </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Adviser Order Status Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendAdviserOrderReportEmail = async (email, orgName, orderId, semesterName, reason, description, adviserFullName) => {
    try {
        let message = `
            <h2 style="color: #0b3d2e;">Hello ${orgName},</h2>
            <p style="font-size: 16px; line-height: 1.5;">We would like to inform you that a GCash Order report has been submitted by the adviser.</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;">Order ID:</strong> ${orderId}</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;">Semester:</strong> ${semesterName}</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;">Reason:</strong> ${reason}</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;">Description:</strong> ${description || 'No additional comments provided.'}</p>
        `;

        const subject = `Gcash Order Report - Order ID: ${orderId}`;

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: `
                <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                color: #333;
                                background-color: #f4f4f4;
                                padding: 20px;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                padding: 20px;
                                border-radius: 8px;
                                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                            }
                            h2 {
                                color: #0b3d2e;
                            }
                            p {
                                font-size: 16px;
                                color:rgb(0, 0, 0);
                                line-height: 1.5;
                            }
                            .footer {
                                margin-top: 20px;
                                font-size: 14px;
                                color: #777;
                            }
                            .footer a {
                                color: #0b3d2e;
                                text-decoration: none;
                            }
                            .logo {
                                text-align: center;
                                margin-bottom: 20px;
                            }
                            .logo img {
                                width: 150px;
                                margin-bottom: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                         <div class="logo">
                                <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                            </div>
                            ${message}
                            <p><strong style="color: #0b3d2e;">Performed by:</strong> ${adviserFullName}</p>
                            <div class="footer">
                                <p>Best Regards,<br>
                                The College of Computing Studies</p>
                                <p style="font-size: 14px; color: #777; margin-top: 10px;">
                                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                                </p>
                            </div>
                        </div>
                    </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Adviser Order Report Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

module.exports = { sendAdviserOrderStatusEmail, sendAdviserOrderReportEmail };
