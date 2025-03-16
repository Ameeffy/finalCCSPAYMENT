const transporter = require('./!Mainmailer');

const sendUnpaidTransactionEmail = async (email, userFullName, paymentName, studentId) => {
    try {
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject: `Unpaid Transaction Reminder - ${paymentName}`,
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
                                text-align: center;
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
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h2>Hello ${userFullName},</h2>
                            <p>We noticed that you have an unpaid transaction for <strong>${paymentName}</strong>.</p>
                            <p><strong>Student ID:</strong> ${studentId}</p>
                            <p>Please settle your payment as soon as possible.</p>
                            <p>If you have already made the payment, kindly ignore this message.</p>
                            <div class="footer">
                                <p>Best Regards,<br>College of Computing Studies</p>
                                <p style="font-size: 14px; color: #777; margin-top: 10px;">
                                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                                </p>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Unpaid transaction email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending unpaid transaction email:', error);
    }
};

module.exports = { sendUnpaidTransactionEmail };
