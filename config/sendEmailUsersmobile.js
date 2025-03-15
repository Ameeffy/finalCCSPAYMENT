
const transporter = require('./!Mainmailer');

// Function to send OTP email with user details and role
const sendOtpEmailusersMobile = (email, otp, userFullName) => {
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
                            width: 150px; /* Set the width of the logo */
                            margin-bottom: 15px; /* Space between logo and text */
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">
                            <!-- Direct URL to the logo image hosted online -->
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                        </div>
                        <h2>Dear ${userFullName},</h2>
                        <p>Thank you for registering with us. The <strong>College of Computing Studies</strong> is excited to verify your email address and complete your registration process.</p>
                        
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

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

// Function to send account verified email
const sendAccountVerifiedEmail = (email, userFullName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com', // Replace with your email
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
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo">
                        </div>
                        <h2>Dear ${userFullName},</h2>
                        <p>Congratulations! Your account has been successfully verified.</p>
                        
                        <p>You can now log in and access all features provided by the <strong>College of Computing Studies</strong>. We are thrilled to have you onboard.</p>
                        
                        <p>If you have any questions or need assistance, feel free to reach out to us.</p>

                        <div class="footer">
                            <p>Best Regards,<br>
                               The College of Computing Studies Team<br>
                               <p style="font-size: 14px; color: #777; margin-top: 10px;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Verification email sent: ' + info.response);
        }
    });
};

module.exports = { sendOtpEmailusersMobile, sendAccountVerifiedEmail };

