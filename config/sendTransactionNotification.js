
const fs = require('fs');
const path = require('path');
const transporter = require('./!Mainmailer');

const sendTransactionNotification = async (email, firstname, middlename, lastname, organizationName, paymentName, paymentStatus, totalAmount, transactionId, paymentMethod, orgUserFullName, balance, semesterName, year, receiptFilePath, finalOrderDetails) => {
    try {
        const subject = `Transaction Number - "${transactionId}" for ${paymentName} `;
        let message = '';

        // Start of HTML structure with updated styling
        message = `
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
                            <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="CCS Logo">
                        </div>
        `;

        if (paymentStatus === 'Paid') {
            message += `
                <h2>Hello ${firstname} ${middlename} ${lastname},</h2>
                <p>Your payment for the <strong style="color: #0b3d2e;">${paymentName}</strong> from <strong style="color: #0b3d2e;">${organizationName}</strong> has been successfully processed.</p>
                <p><strong>Total Payment:</strong> ₱${totalAmount}</p>
                <p><strong>Transaction ID:</strong> ${transactionId}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                <p><strong>Semester:</strong> ${semesterName}</p>
                <p>Your payment status is: <strong style="color: #0b3d2e;">${paymentStatus}</strong></p>
            `;
        } else if (paymentStatus === 'Balance') {
            message += `
                <h2>Hello ${firstname} ${middlename} ${lastname},</h2>
                <p>Your payment for the <strong style="color: #0b3d2e;">${paymentName}</strong> from <strong style="color: #0b3d2e;">${organizationName}</strong> has been partially processed.</p>
                <p><strong style="color: #0b3d2e;">Please upload your promissory notes</p>
                <p><strong>Total Payment:</strong> ₱${totalAmount}</p>
                <p><strong>Remaining Balance:</strong> ₱${balance}</p>
                <p><strong>Transaction ID:</strong> ${transactionId}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                <p><strong>Semester:</strong> ${semesterName}</p>
                <p>Your payment status is: <strong style="color: #0b3d2e;">${paymentStatus}</strong></p>
            `;
        }

        // Closing the email body with footer
        message += `
                <div style="text-align: center; margin-top: 20px;">
                        
                        <p style="font-size: 14px; color: #777; margin-top: 10px;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                    </div>
            </div>
        </body>
        </html>
        `;

        // Set up mail options with the attachment if the payment status is 'Paid'
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: paymentStatus === 'Paid' ? [
                {
                    filename: `receipt_${transactionId}.pdf`,
                    path: receiptFilePath 
                }
            ] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`Payment status email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending transaction notification email:', error);
    }
};

module.exports = { sendTransactionNotification };
