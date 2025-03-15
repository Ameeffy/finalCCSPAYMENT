const transporter = require('./!Mainmailer');

const sendAdviserPaymentStatusEmail = async (email, orgName, semesterName, status, paymentName, paymentType, price, feesAndPrices, adviserFullName) => {
    try {
        const feesHtml = feesAndPrices ? 
            `<ul><strong>Fees and Prices:</strong> ${feesAndPrices.split(', ').map(fee => `<li>${fee}</li>`).join('')}</ul>` 
            : '<ul><li>None</li></ul>';

        let message = '';
        if (status === 'Accepted') {
            message = `
                <h2 style="color: #0b3d2e;">Hello ${orgName},</h2>
                <p style="font-size: 16px; line-height: 1.5;">Your requested payment for the <strong style="color: #0b3d2e;">${semesterName}</strong> semester has been successfully <strong style="color: #0b3d2e;">Accepted</strong>.</p>
                <h2style="color:rgb(0, 0, 0);">Thank you for submitting your payment. It will now be reviewed by the Admin for the final verification.,</h2style=>
                <h2 style="color:rgb(0, 0, 0);">Please wait for further updates regarding the approval process.</h2>
            `;
        } else {
            message = `
                <h2 style="color: #0b3d2e;">Hello ${orgName},</h2>
                <p style="font-size: 16px; line-height: 1.5;">We regret to inform you that your requested payment for the <strong style="color: #0b3d2e;">${semesterName}</strong> semester has been <strong>Declined</strong>.</p>
            `;
        }

        message += `
            <p style="font-size: 16px; line-height: 1.5;">Payment Name: <strong style="color: #0b3d2e;">${paymentName}</strong></p>
            <p style="font-size: 16px; line-height: 1.5;">Payment Type: <strong style="color: #0b3d2e;">${paymentType}</strong></p>
            <p style="font-size: 16px; line-height: 1.5;">Total Price: <strong style="color: #0b3d2e;" >₱${price}</strong></p>
            ${feesHtml}
        `;
        

        const subject = `Payment for "${paymentName}" is ${status}`;

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
        console.log(`Adviser Payment Status Update Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

const sendAdviserPaymentReportEmail = async (email, orgName, paymentName, reason, description, adviserFullName) => {
    try {
        let message = `
            <h2 style="color: #0b3d2e;">Hello ${orgName},</h2>
            <p style="font-size: 16px; line-height: 1.5;">We would like to inform you that a payment report has been submitted by the Adviser.</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;>Payment Name:</strong> ${paymentName}</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;>Reason:</strong> ${reason}</p>
            <p style="font-size: 16px; line-height: 1.5;"><strong style="color: #0b3d2e;>Description:</strong> ${description || 'No additional comments provided.'}</p>
        `;

        const subject = `Payment Report for "${paymentName}"`;

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
        console.log(`Adviser Payment Report Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

module.exports = { sendAdviserPaymentStatusEmail, sendAdviserPaymentReportEmail };
