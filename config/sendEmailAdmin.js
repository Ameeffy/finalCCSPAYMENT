const transporter = require('./!Mainmailer');

const sendSemesterStatusEmail = async (email, orgName, semesterName, status) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <p>Hello ${orgName},</p>
                <p>The <strong>${semesterName}</strong> is now <strong>Activated</strong>.</p>
                
            `;
        } else {
            message = `
                <p>Hello ${orgName},</p>
                <p>We are sorry to inform you that the <strong>${semesterName}</strong> is now <strong>Not Activated</strong>.</p>
                <p>Please wait for further instructions.</p>
            `;
        }

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: `Semester Status Update: ${semesterName} is now ${status}`,
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
                            <h2>Semester Status</h2>
                            ${message}
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
        console.log(`Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

const sendGcashOrderStatusEmail = async (email, orgName, semesterName, status) => {
    try {
        let message = '';
        if (status === 'Accepted') {
            message = `
                <p>Hello ${orgName},</p>
                <p>Your GCash QR code submission for <strong>${semesterName}</strong> has been <strong>Accepted</strong>.</p>
                <p>You may now proceed with the transactions for this semester.</p>
            `;
        } else {
            message = `
                <p>Hello ${orgName},</p>
                <p>We regret to inform you that your GCash QR code submission for <strong>${semesterName}</strong> has been <strong>Declined</strong>.</p>
                <p>Please review and resubmit your QR code, or contact the administrator for further details.</p>
            `;
        }

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: `GCash QR Code Status Update: ${semesterName} - ${status}`,
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
                            <h2>GCash QR Code Status Update</h2>
                            ${message}
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
        console.log(`GCash Order Status Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendGcashOrderReportEmail = async (email, orgName, adminFullName, reason, description) => {
    try {
        const subject = `GCash Order Report Notification for ${orgName}`;

        const message = `
            <p>Hello ${orgName},</p>
            <p>Your GCash order has been reported by an administrator.</p>
            <p><strong>Reported By:</strong> ${adminFullName}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            <p>Please check your order details and take the necessary action.</p>
        `;

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
                            <h2>GCash Order Report Notification</h2>
                            ${message}
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
        console.log(`GCash Order Report Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};const sendOrganizationStatusEmail = async (email, orgName, semesterName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <p>Hello ${orgName},</p>
                <p>Your organization has been <strong>Activated</strong> for the <strong>${semesterName}</strong></p>
                <p>You may now proceed with your operations and transactions.</p>
            `;
        } else {
            message = `
                <p>Hello ${orgName},</p>
                <p>We regret to inform you that your organization has been <strong>Deactivated</strong> for the <strong>${semesterName}</strong></p>
                <p>Please contact the administrator for further details.</p>
            `;
        }

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: `Organization Status: ${status} for ${semesterName}`,
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
                            <h2>Organization Status Update</h2>
                            ${message}
                            <p><strong>Performed By:</strong> ${adminFullName}</p>
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
        console.log(`Organization Status Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendOrganizationUserRegistrationEmail = async (email, firstname, middlename, lastname, orgName, position) => {
    try {
        const subject = `Congratulations! You are now a Member of ${orgName}`;

        const message = `
            <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
            <p>We are excited to inform you that you have been successfully registered as a <strong>${position}</strong> in <strong>${orgName}</strong>.</p>
            <p>Welcome to the organization! We look forward to your contributions and participation.</p>
        `;

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
                            <h2>Welcome to ${orgName}!</h2>
                            ${message}
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
        console.log(`Organization User Registration Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendOrganizationAdviserRegistrationEmail = async (email, firstname, middlename, lastname, orgName) => {
    try {
        const subject = `Congratulations! You are now an Adviser of ${orgName}`;

        const message = `
            <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
            <p>We are pleased to inform you that you have been successfully registered as an <strong>Adviser</strong> for <strong>${orgName}</strong>.</p>
            <p>We look forward to your guidance and leadership in the organization.</p>
        `;

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
                            <h2>Welcome as an Adviser of ${orgName}!</h2>
                            ${message}
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
        console.log(`Organization Adviser Registration Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendUserPositionUpdateEmail = async (email, firstname, middlename, lastname, orgName, position, year) => {
    try {
        const subject = `Your Position in ${orgName} for Academic Year ${year} has been Updated`;

        const message = `
            <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
            <p>We are informing you that your position in <strong>${orgName}</strong> has been updated for the academic year <strong>${year}</strong>.</p>
            <p>Your new position is: <strong>${position}</strong>.</p>
            <p>Please continue your valuable contributions to the organization!</p>
        `;

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
                            <h2>Position Update Notification</h2>
                            ${message}
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
        console.log(`User Position Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

const sendUserStatusUpdateEmailAdviser = async (email, firstname, middlename, lastname, orgName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We are pleased to inform you that your account is now <strong>Activated</strong> for the <strong>${orgName}</strong> portal.</p>
                <p>You now have access to all organization-related activities.</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We regret to inform you that your account has been <strong>Deactivated</strong> for the <strong>${orgName}</strong> portal.</p>
                <p>You can no longer access the organization's portal until further notice.</p>
            `;
        }

        const subject = `Organization Portal Access: ${status}`;

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
                            <p><strong>Performed by:</strong> ${adminFullName}</p>
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
        console.log(`User Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendUserStatusUpdateEmail = async (email, firstname, middlename, lastname, orgName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We are pleased to inform you that your account is now <strong>Activated</strong> for the <strong>${orgName}</strong> portal.</p>
                <p>You now have access to all organization-related activities.</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We regret to inform you that your account has been <strong>Deactivated</strong> for the <strong>${orgName}</strong> portal.</p>
                <p>You can no longer access the organization's portal until further notice.</p>
            `;
        }

        const subject = `Organization Portal Access: ${status}`;

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
                            <p><strong>Performed by:</strong> ${adminFullName}</p>
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
        console.log(`User Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendUserStatusUpdateEmailDelete = async (email, firstname, middlename, lastname, orgName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We are pleased to inform you that your account is now <strong>Activated</strong> for the <strong>${orgName}</strong> portal.</p>
                <p>You now have access to all organization-related activities.</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We regret to inform you that you have been <strong>removed</strong> from the <strong>${orgName}</strong></p>
                <p>You can no longer access the organization's portal until further notice.</p>
            `;
        }

        const subject = `${firstname} ${middlename || ''} ${lastname} have been removed from the office of ${orgName} of the current academic year `;

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
                            <p><strong>Performed by:</strong> ${adminFullName}</p>
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
        console.log(`User Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};


const sendAdviserStatusUpdateEmail = async (email, firstname, middlename, lastname, orgName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We are pleased to inform you that your account is now <strong>Activated</strong> as an adviser for the <strong>${orgName}</strong>.</p>
                <p>You now have to manage their Payments and Qr Codes</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We regret to inform you that your account has been <strong>Deactivated</strong> as an adviser for the <strong>${orgName}</strong>.</p>
                <p>You can no longer connected to this Organization</p>
            `;
        }

        const subject = `Adviser Portal Access: ${status}`;

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
                        <p><strong>Performed by:</strong> ${adminFullName}</p>
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
        console.log(`Adviser Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
const sendAdviserStatusUpdateEmailDelete = async (email, firstname, middlename, lastname, orgName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>
                <p>We are pleased to inform you that your account is now <strong>Activated</strong> as an adviser for the <strong>${orgName}</strong>.</p>
                <p>You now have full access to the organization's portal and responsibilities.</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>

                <p>We regret to inform you that you have been <strong>removed</strong> from the <strong>${orgName}</strong></p>
                <p>You can no longer access the organization's portal until further notice.</p>
            `;
        }

        const subject = `${firstname} ${middlename || ''} ${lastname} have been removed from the office of ${orgName} of the current academic year `;

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
                            <p><strong>Performed by:</strong> ${adminFullName}</p>
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
        console.log(`Adviser Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

const sendOrganizationStatusEmailDelete = async (email, orgName, semesterName, status, adminFullName) => {
    try {
        let message = '';
        if (status === 'Activated') {
            message = `
                <p>Hello ${orgName},</p>
                <p>Your organization has been <strong>Activated</strong> for the <strong>${semesterName}</strong>.</p>
                <p>You may now proceed with your operations and transactions.</p>
            `;
        } else {
            message = `
                <h2>${orgName}</h2>
                <p>Hello ${firstname} ${middlename || ''} ${lastname},</p>

                <p>We regret to inform you that you have been <strong>removed</strong> from the <strong>${orgName}</strong></p>
                <p>You can no longer access the organization's portal until further notice.</p>
            `;
        }

    
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: `${orgName} have been removed from the current academic year`,
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
                            <h2>Organization Status Update</h2>
                            ${message}
                            <p><strong>Performed By:</strong> ${adminFullName}</p>
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
        console.log(`Organization Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};
module.exports = { sendSemesterStatusEmail, sendGcashOrderStatusEmail, sendGcashOrderReportEmail, sendOrganizationStatusEmail, sendOrganizationUserRegistrationEmail, 
    sendOrganizationAdviserRegistrationEmail, sendUserPositionUpdateEmail, sendUserStatusUpdateEmail, sendUserStatusUpdateEmailAdviser, sendUserStatusUpdateEmailDelete,sendAdviserStatusUpdateEmail,
    sendAdviserStatusUpdateEmailDelete,sendOrganizationStatusEmailDelete  };
