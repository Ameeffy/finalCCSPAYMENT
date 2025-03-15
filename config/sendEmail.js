
const transporter = require('./!Mainmailer');

// Function to send OTP email with organization name and additional details
const sendOtpEmail = (email, otp, orgName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',   // Replace with your email
        to: email,
        subject: 'Your OTP Code for Email Verification',
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
                        
                        <h2>Dear ${orgName},</h2>
                        <p>Thank you for registering with us. The <strong>College of Computing Studies</strong> is excited to verify your email address and complete your registration process.</p>
                        
                        <p>To continue, please use the following OTP (One-Time Password) code:</p>
                        
                        <div class="otp">${otp}</div>
                        
                        <p>This code is valid for 10 minutes only. Please enter it on the verification page to complete your registration.</p>

                        <p>If you did not request this, please ignore this email.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                            <div class="logo">
                            <!-- Direct URL to the logo image hosted online -->
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                        </div>
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
const sendotpforgotpasswordusersalogin = (email, otp, userFullName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',  // Your sender email
        to: email,
        subject: 'Password Reset OTP - College of Computing Studies',
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
                            text-align: center;
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
                            width: 150px;  /* Adjust logo size */
                            margin-bottom: 15px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                        </div>
                        <h2>Password Reset Request</h2>
                       <p>Hello, <strong>${userFullName}</strong>,</p>
                        <p>We received a request to reset your password for the <strong>College of Computing Studies</strong> portal.</p>
                        
                        <p>Your One-Time Password (OTP) for password reset is:</p>
                        
                        <div class="otp">${otp}</div>
                        
                        <p>This OTP is valid for 10 minutes only. Please enter it in the password reset page to continue.</p>

                        <p>If you did not request this, please ignore this email.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                            College of Computing Studies<br>
                            <a href="https://www.facebook.com/wmsuccs">Visit us on Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    // Send email using Nodemailer
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending OTP email:', error);
        } else {
            console.log('OTP email sent: ' + info.response);
        }
    });
};
const sendPasswordResetConfirmation = (email, userFullName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',
        to: email,
        subject: 'Password Successfully Changed - College of Computing Studies',
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
                        <h2>Password Change Confirmation</h2>
                        <p>Hello, <strong>${userFullName}</strong>,</p>
                        <p>We want to inform you that your password for the <strong>College of Computing Studies</strong> portal has been successfully changed.</p>
                        
                        <p>If you did not make this change, please reset your password immediately or contact support.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                            College of Computing Studies<br>
                            <a href="https://www.facebook.com/wmsuccs">Visit us on Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending password reset confirmation email:', error);
        } else {
            console.log('Password reset confirmation email sent: ' + info.response);
        }
    });
};
const sendTransactionReportEmail = (email, userFullName, orgUserFullName, organizationName, reason, description, transaction_id) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',
        to: email,
        subject: `Transaction Report - ${transaction_id}`, // Fixed incorrect subject syntax
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
                        <h2>Hello${userFullName},</h2>
                       
                        <p>A transaction associated with your account has been reported by <strong style="color: #0b3d2e;">${orgUserFullName}</strong> from the <strong style="color: #0b3d2e;">${organizationName}</strong>.</p>

                        <p><strong>Transaction ID:</strong> ${transaction_id}</p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p><strong>Description:</strong> ${description}</p>
                        
                        <p>If you have any concerns regarding this report, please contact the College of Computing Studies support team.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                            College of Computing Studies<br>
                            <a href="https://www.facebook.com/wmsuccs">Visit us on Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending transaction report email:', error);
        } else {
            console.log(`Transaction report email sent to ${email}: ${info.response}`);
        }
    });
};



// Function to send order message email notification
const sendOrderMessageEmail = (email, userFullName, organizationName, sentByName, message) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',
        to: email,
        subject: `New Message from ${organizationName}`,
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
                        <h2>Hello ${userFullName},</h2>

                        <p>You have received a new message from <strong style="color: #0b3d2e;">${sentByName}</strong> at <strong style="color: #0b3d2e;">${organizationName}</strong> regarding your order transaction.</p>

                        <p><strong>Message:</strong></p>
                        <p>"${message}"</p>

                        <p>If you have any concerns or questions, please contact the organization.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                            College of Computing Studies<br>
                            <a href="https://www.facebook.com/wmsuccs">Visit us on Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending order message email:", error);
        } else {
            console.log(`Order message email sent to ${email}: ${info.response}`);
        }
    });
};



module.exports = { sendOtpEmail,sendotpforgotpasswordusersalogin,sendPasswordResetConfirmation,sendTransactionReportEmail, sendOrderMessageEmail };
