
const transporter = require('./!Mainmailer');

// Function to send OTP email with organization name and additional details
const sendOtpEmailAdmin = (email, otp, adminName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',   // Replace with your email
        to: email,
        subject: 'Your OTP Code for Admin Email Verification',
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
                        .otp {
                            font-size: 24px;
                            font-weight: bold;
                            background-color: #2a6d4f;
                            color: white;
                            padding: 10px;
                            border-radius: 4px;
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
                            width: 150px;  /* Set the width of the logo */
                            margin-bottom: 15px;  /* Space between logo and text */
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">
                            <!-- Direct URL to the logo image hosted online -->
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                        </div>
                        <h2>Dear ${adminName},</h2>
                        <p>Welcome to the <strong>College of Computing Studies</strong> admin registration.</p>
                        
                        <p>To continue, please use the following OTP (One-Time Password) code:</p>
                        
                        <div class="otp">${otp}</div>
                        
                        <p>This code is valid for 10 minutes only. Please enter it on the verification page to complete your registration.</p>

                        <p>If you did not request this, please ignore this email.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                               The College of Computing Studies<br>
                              <p style="font-size: 14px; color: #777; margin-top: 10px;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};


    const sendAccountVerifiedEmailAdmin = (email, role, userFullName) => {
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: 'Account Successfully Verified',
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
                                width: 150px; /* Set the width of the logo */
                                margin-bottom: 15px; /* Space between logo and text */
                            }
                            .success {
                                font-size: 24px;
                                font-weight: bold;
                                color: #2a6d4f;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="logo">
                                <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                            </div>
                            <h2>Dear ${userFullName},</h2>
                            <p class="success">Congratulations! Your account has been successfully verified as ${role} .</p>
                            
                            <p>You can now log in and access all features provided by the <strong>College of Computing Studies</strong>. We are thrilled to have you onboard.</p>
                            
                            <p>If you have any questions or need assistance, feel free to reach out to us.</p>
    
                            <div class="footer">
                                <p>Best Regards,<br>
                                   The College of Computing Studies Team<br>
                                   <p style="font-size: 14px; color: #777; margin-top: 10px;">
                                   Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a>
                                   </p>
                                </p>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending verification success email:', error);
            } else {
                console.log('Verification success email sent: ' + info.response);
            }
        });
    };
        
    const sendadminregisteredsuccess = (email, fullName) => {
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: 'Welcome! Your Admin Account Has Been Registered',
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
                            <h2>Dear ${fullName},</h2>
                            <p>Congratulations! You have been successfully registered as an Admin at the <strong>College of Computing Studies</strong>.</p>
                            <p>As of now your status is Pending wait for the Activation</p>
                            <p>If you have any questions, feel free to reach out.</p>
                            <div class="footer">
                                <p>Best Regards,<br>
                                The College of Computing Studies<br>
                                <p style="font-size: 14px; color: #777; margin-top: 10px;">
                                Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a>
                                </p>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending admin registration email:', error);
            } else {
                console.log('Admin registration email sent: ' + info.response);
            }
        });
    };
    const sendAdminStatusUpdateEmail = (email, fullName, status) => {
        const subject = `Your Admin Account Status Has Been Updated`;
        
        // Message Content Based on Status
        let statusMessage = '';
        if (status === 'Activated') {
            statusMessage = `
                <p>Congratulations! Your admin account has been <strong>Activated</strong>.</p>
                <p>You may now start exploring admin features and managing the system efficiently.</p>
                <p>Log in now and begin your administrative tasks.</p>
            `;
        } else {
            statusMessage = `
                <p>We’re sorry, but your admin access has been <strong>Not Activated</strong>.</p>
                <p>Your account has been disabled, and you will not be able to access admin features.</p>
                <p>If you believe this is an error, please contact the system administrator for assistance.</p>
            `;
        }
    
        // Full Email HTML
        const message = `
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
                        <h2>Dear ${fullName},</h2>
                        
                        ${statusMessage}
                        <div class="footer">
                            <p>Best Regards,<br>
                            The College of Computing Studies<br>
                            <p style="font-size: 14px; color: #777; margin-top: 10px;">
                            Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `;
    
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: subject,
            html: message
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending admin status update email:', error);
            } else {
                console.log('Admin status update email sent: ' + info.response);
            }
        });
    };
    const sendAdminRoleUpdateEmail = (email, fullName, oldRole, newRole) => {
        const subject = `Your Admin Role Has Been Updated`;
        
        // Message Content Based on Role Change
        const roleMessage = `
            <p>Your admin role has been changed.</p>
            <p><strong>Previous Role:</strong> ${oldRole}</p>
            <p><strong>New Role:</strong> ${newRole}</p>
            <p>This changes was made by the system administrator.</p>
        `;
    
        // Full Email HTML
        const message = `
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
                        <h2>Dear ${fullName},</h2>
                        ${roleMessage}
                        <div class="footer">
                            <p>Best Regards,<br>
                            The College of Computing Studies<br>
                            <p style="font-size: 14px; color: #777; margin-top: 10px;">
                            Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `;
    
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: subject,
            html: message
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending admin role update email:', error);
            } else {
                console.log('Admin role update email sent: ' + info.response);
            }
        });
    };
    module.exports = { sendOtpEmailAdmin, sendAccountVerifiedEmailAdmin,sendadminregisteredsuccess,sendAdminStatusUpdateEmail,sendAdminRoleUpdateEmail};
