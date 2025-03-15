const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const transporter = require('./!Mainmailer');

const sendPreOrderEmail = async (email, userFullName, productName, organizationName, organizationPhoto, totalAmount, totalPay, paymentMethod, preOrderId, acceptedByName, course, section, semesterName, finalOrderDetails) => {
    try {
        // Set default logo if no organization photo is provided
        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg');
        let orgPhotoPath = localLogoPath; 

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            let downloadUrl = organizationPhoto;

            // Convert Dropbox URL to direct-download link if needed
            if (organizationPhoto.includes('dropbox.com')) {
                downloadUrl = organizationPhoto.replace('?dl=0', '?raw=1'); 
            }

            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const logoFilename = `org_photo_${preOrderId}.jpg`;
            const tempFilePath = path.join(tempDir, logoFilename);

            if (!fs.existsSync(tempFilePath)) {
                try {
                    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tempFilePath, response.data);
                    orgPhotoPath = tempFilePath;
                } catch (err) {
                    console.error('Error downloading organization logo:', err.message);
                    orgPhotoPath = localLogoPath;
                }
            } else {
                console.log('Using cached organization logo:', tempFilePath);
                orgPhotoPath = tempFilePath;
            }
        }

        // Create receipt directory if it doesn't exist
        const receiptsDir = path.join(__dirname, 'receipts');
        if (!fs.existsSync(receiptsDir)) {
            fs.mkdirSync(receiptsDir, { recursive: true });
        }

        const receiptFilePath = path.join(receiptsDir, `receipt_${preOrderId}.pdf`);
        const doc = new PDFDocument({
            size: [595, 420], 
            margins: { top: 50, left: 50, right: 50, bottom: 50 } 
        });
        doc.pipe(fs.createWriteStream(receiptFilePath));

        // **Insert University Logo (Left)**
        doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });

        // **Insert Circular Organization Logo (Right)**
        const orgLogoX = 465;
        const orgLogoY = 40;
        const orgLogoSize = 80;

        doc.save();
        doc.circle(orgLogoX + orgLogoSize / 2, orgLogoY + orgLogoSize / 2, orgLogoSize / 2)
            .clip()
            .image(orgPhotoPath, orgLogoX, orgLogoY, { width: orgLogoSize, height: orgLogoSize });
        doc.restore();

        doc.text('\n\n');
        doc.fontSize(12).text('Republic of the Philippines', { align: 'center' });
        doc.text('Western Mindanao State University', { align: 'center' });
        doc.text('College Of Computing Studies', { align: 'center' });
        doc.font('Helvetica-Bold').text(organizationName, { align: 'center' });
        doc.font('Helvetica').text('Zamboanga City', { align: 'center' });

        doc.save();
        doc.opacity(0.1);
        doc.circle(300, 250, 150)
            .clip()
            .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' });
        doc.restore();

        doc.text('\n\n');
        doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, 50, doc.y, { continued: true });
        doc.text(`Academic Year: ${semesterName || 'N/A'}`, { align: 'right' });

        doc.text(`Course and Section: ${course}-${section || 'N/A'}`, { align: 'left' });

        doc.text('\n\n');
        doc.text(`Amount Received: ${totalAmount} Pesos`, { align: 'center' });
        doc.text(`Received Payment From: ${userFullName}`, { align: 'center' });
        doc.text('\n\n');
            doc.text(`Ordered Items:`, { align: 'center' });
            doc.text(finalOrderDetails, { align: 'center' });

        doc.text('\n\n');
        doc.text(`RECEIPT NO. ${preOrderId}`, 50, doc.y, { continued: true });
        doc.text(`Received By: ${acceptedByName}`, { align: 'right' });

        doc.end();

        // Compose the email
        const subject = `Pre-Order Payment Confirmation - ${preOrderId}`;
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
                text-align: center;
            }
            h2 {
                color: #0b3d2e;
                text-align: left;
            }
            h3 {
                color: #0b3d2e;
            }
            p {
                font-size: 16px;
                line-height: 1.5;
                text-align: left;
            }
            .footer {
                margin-top: 20px;
                font-size: 14px;
                color: #777;
            }
            .footer a {
                color: #0b3d2e;
                text-decoration: none;
                text-align: center;
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
                <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Organization Logo">
            </div>
            <h2>Hello ${userFullName},</h2>
            <p>Your pre-order payment for <strong>${productName}</strong> has been successfully received.</p>
           
            <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p><strong>Processed by:</strong> ${acceptedByName}</p>
            <h2 style="text-align: center;">Ordered Items:</h2>
            <p style="text-align: center;">${finalOrderDetails}</p>
            <p style="font-size: 16px; margin-top: 10px; text-align: center;">Thank you for your purchase!</p>
            <div class="footer">
                <p style="font-size: 14px; color: #777; margin-top: 5px; text-align: center;">
                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                </p>
            </div>
        </div>
    </body>
</html>

        `;

        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: [{ filename: `receipt_${preOrderId}.pdf`, path: receiptFilePath }]
        };

        await transporter.sendMail(mailOptions);
        console.log(`Pre-Order payment confirmation email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending Pre-Order email:', error.message);
    }
};
const sendPreOrderEmailupdatePreOrderTotalPay = async (email, userFullName, productName, organizationName, organizationPhoto, totalAmount, totalPay, paymentMethod, preOrderId, acceptedByName, course, section, semesterName, finalOrderDetails, status) => {
    try {
        // **Set default logo if no organization photo is provided**
        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg');
        let orgPhotoPath = localLogoPath;

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            let downloadUrl = organizationPhoto;

            // **Convert Dropbox URL to direct-download link if needed**
            if (organizationPhoto.includes('dropbox.com')) {
                downloadUrl = organizationPhoto.replace('?dl=0', '?raw=1');
            }

            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const logoFilename = `org_photo_${preOrderId}.jpg`;
            const tempFilePath = path.join(tempDir, logoFilename);

            try {
                const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(tempFilePath, response.data);
                orgPhotoPath = tempFilePath;
            } catch (err) {
                console.error('Error downloading organization logo:', err.message);
                orgPhotoPath = localLogoPath;
            }
        }

        // **Generate the PDF receipt only if "Paid"**
        let receiptFilePath = '';
        if (status === "Paid") {
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }

            receiptFilePath = path.join(receiptsDir, `receipt_${preOrderId}.pdf`);
            const doc = new PDFDocument({
                size: [595, 420], 
                margins: { top: 50, left: 50, right: 50, bottom: 50 } 
            });
            doc.pipe(fs.createWriteStream(receiptFilePath));

            // **Insert University Logo (Left)**
            doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });

            // **Insert Circular Organization Logo (Right)**
            const orgLogoX = 465;
            const orgLogoY = 40;
            const orgLogoSize = 80;

            doc.save();
            doc.circle(orgLogoX + orgLogoSize / 2, orgLogoY + orgLogoSize / 2, orgLogoSize / 2)
                .clip()
                .image(orgPhotoPath, orgLogoX, orgLogoY, { width: orgLogoSize, height: orgLogoSize });
            doc.restore();

            doc.text('\n\n');
            doc.fontSize(12).text('Republic of the Philippines', { align: 'center' });
            doc.text('Western Mindanao State University', { align: 'center' });
            doc.text('College Of Computing Studies', { align: 'center' });
            doc.font('Helvetica-Bold').text(organizationName, { align: 'center' });
            doc.font('Helvetica').text('Zamboanga City', { align: 'center' });
            

            doc.save();
            doc.opacity(0.1);
            doc.circle(300, 250, 150)
                .clip()
                .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' });
            doc.restore();

            doc.text('\n\n');

            // **Align "Date of Payment" and "Academic Year" on the same line**
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, 50, doc.y, { continued: true });
            doc.text(`Academic Year: ${semesterName || 'N/A'}`, { align: 'right' });

            doc.text(`Course and Section: ${course}-${section || 'N/A'}`, { align: 'left' });

            doc.text('\n\n');

            doc.text(`Amount Received: ₱${totalAmount} Pesos`, { align: 'center' });
            doc.text(`Received Payment From: ${userFullName}`, { align: 'center' });
           

            doc.text('\n\n');
            doc.text(`Ordered Items:`, { align: 'center' });
            doc.text(finalOrderDetails, { align: 'center' });

            doc.text('\n\n');
            doc.text(`RECEIPT NO. ${preOrderId}`, 50, doc.y, { continued: true });
            doc.text(`Received By: ${acceptedByName}`, { align: 'right' });

            doc.end();
        }


        // **Compose the email**
        const subject = `Pre-Order Payment Confirmation - ${preOrderId}`;
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
                text-align: center;
            }
            h2 {
                color: #0b3d2e;
                text-align: left;
            }
            h3 {
                color: #0b3d2e;
            }
            p {
                font-size: 16px;
                line-height: 1.5;
                text-align: left;
            }
            .footer {
                margin-top: 20px;
                font-size: 14px;
                color: #777;
            }
            .footer a {
                color: #0b3d2e;
                text-decoration: none;
                text-align: center;
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
                <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Organization Logo">
            </div>
            <h2>Hello ${userFullName},</h2>
            <p>Your pre-order payment for <strong>${productName}</strong> has been successfully processed.</p>
           
            <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p><strong>Processed by:</strong> ${acceptedByName}</p>
            ${status === "Paid" 
                ? `<p style="color: green; font-weight: bold;">Your pre-order payment has been successfully completed.</p>` 
                : `<p style="color: red; font-weight: bold;">Your payment is still pending. Please complete the remaining balance.</p>`
            }
            <h2 style="text-align: center;">Ordered Items:</h2>
            <p style="text-align: center;">${finalOrderDetails}</p>
            <p style="font-size: 16px; margin-top: 10px; text-align: center;">Thank you for your purchase!</p>
            <div class="footer">
                <p style="font-size: 14px; color: #777; margin-top: 5px; text-align: center;">
                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                </p>
            </div>
        </div>
    </body>
</html>

        `;

        // **Set up mail options with the receipt attachment only if Paid**
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: status === "Paid" ? [{ filename: `receipt_${preOrderId}.pdf`, path: receiptFilePath }] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`Pre-Order payment confirmation email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending Pre-Order email:', error.message);
    }
};


module.exports = { sendPreOrderEmail,sendPreOrderEmailupdatePreOrderTotalPay  };
