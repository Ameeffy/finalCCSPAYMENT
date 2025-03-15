const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const transporter = require('./!Mainmailer');

const sendOrganizationEmail = async (email, userFullName, organizationName, totalAmount, orderTransactionId, orgUserFullName, organizationPhoto, productId, course, section, semesterName, finalOrderDetails) => {
    try {
        const orderDetailsHtml = finalOrderDetails.length
        ? finalOrderDetails.map(item => `- ${item}`).join('<br>')
        : 'No items ordered.';

        console.log("Semester Name:", semesterName); // Debugging line

        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg'); // Default logo
        let orgPhotoPath = localLogoPath;

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            let downloadUrl = organizationPhoto;
            if (organizationPhoto.includes('dropbox.com')) {
                downloadUrl = organizationPhoto.replace('?dl=0', '?raw=1'); // Convert Dropbox link to direct download
            }

            const logoFilename = `${productId}.jpg`; // Generate filename based on product ID
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
                console.log('Using cached logo:', tempFilePath);
                orgPhotoPath = tempFilePath;
            }
        }

        // Generate the PDF receipt
        const doc = new PDFDocument({
            size: [595, 420], // **Set half-page size (Width: 595, Height: 420)**
            margins: { top: 50, left: 50, right: 50, bottom: 50 } // Adjusted margins
        });
        const receiptsDir = path.join(__dirname, 'receipts');
        if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });
        const receiptFilePath = path.join(receiptsDir, `receipt_${orderTransactionId}.pdf`);
        doc.pipe(fs.createWriteStream(receiptFilePath));

        // **Insert University Logo (Left)**
        doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });

        // **Insert Circular Organization Logo (Right)**
        const orgLogoX = 465; // X position
        const orgLogoY = 40;  // Y position
        const orgLogoSize = 80; // Size of the circular image

        doc.save();
        doc.circle(orgLogoX + orgLogoSize / 2, orgLogoY + orgLogoSize / 2, orgLogoSize / 2)
            .clip()
            .image(orgPhotoPath, orgLogoX, orgLogoY, { width: orgLogoSize, height: orgLogoSize });
        doc.restore();

        doc.text('\n\n');
        doc.fontSize(12).text('Republic of the Philippines', { align: 'center' });
        doc.text('Western Mindanao State University', { align: 'center' });
        doc.text('College Of Computing Studies', { align: 'center' });

        // **Make organization name bold**
        doc.font('Helvetica-Bold').text(organizationName, { align: 'center' });
        doc.font('Helvetica').text('Zamboanga City', { align: 'center' });

        // **Insert Background Image Below "Zamboanga City" (Less Visible)**
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
        doc.font('Helvetica').text(`Amount Received: ${totalAmount} Pesos`, { align: 'center' });
doc.font('Helvetica').text(`Received Payment From: ${userFullName}`, { align: 'center' });

doc.text('\n\n');
doc.font('Helvetica').text('Order Details:', { align: 'center' });
doc.font('Helvetica').text(finalOrderDetails.length ? finalOrderDetails.map(item => `- ${item}`).join('\n') : 'No items ordered.', { align: 'center' });

doc.text('\n\n');
doc.font('Helvetica').text(`RECEIPT NO. ${orderTransactionId}`, 50, doc.y, { continued: true });
doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });


        doc.end();

        // Compose the email
        const subject = `Order Confirmation - ${orderTransactionId}`;
        let message = `
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
                        <p>Your order with <strong>${organizationName}</strong> has been successfully process.</p>
                        <p><strong>Transaction ID:</strong> ${orderTransactionId}</p>
                        <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
                        <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                        <p><strong>Status:</strong> Paid</p>
                        <p><strong>Payment Method:</strong> Cash</p>
                        <h2 style="text-align: center;">Ordered Items:</h2>
                        ${orderDetailsHtml}
                        <p style="font-size: 16px; margin-top: 10px; text-align: center;">Thank you for your order!</p>
                        <div class="footer">
                            <p style="font-size: 14px; color: #777; margin-top: 5px; text-align: center;">
                                    Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                                </p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        // Set up mail options with the receipt attachment
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: [{ filename: `receipt_${orderTransactionId}.pdf`, path: receiptFilePath }]
        };

        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending order confirmation email:', error.message);
    }
};
const TotalPay = async (
    email, 
    userFullName, 
    organizationName, 
    totalAmount, 
    orderTransactionId, 
    orgUserFullName, 
    organizationPhoto, 
    course, 
    section, 
    semesterName, 
    finalOrderDetails, 
    paymentMethod, 
    newStatus, 
    totalPay
) => {
    try {
        console.log("Semester Name:", semesterName); // Debugging line

        // **Ensure finalOrderDetails is always an array**
        if (!Array.isArray(finalOrderDetails)) {
            finalOrderDetails = typeof finalOrderDetails === 'string' 
                ? finalOrderDetails.split(', ') 
                : [];
        }

        // **Create temporary directory if it doesn't exist**
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // **Default logo path**
        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg'); 
        let orgPhotoPath = localLogoPath;

        // **Handle organization photo (Dropbox Fix)**
        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            let downloadUrl = organizationPhoto;

            // **Convert Dropbox link to direct download**
            if (organizationPhoto.includes('dropbox.com')) {
                downloadUrl = organizationPhoto.replace('?dl=0', '?raw=1');
            }

            const logoFilename = `org_photo_${orderTransactionId}.jpg`; // Use order ID for unique filename
            const tempFilePath = path.join(tempDir, logoFilename);

            try {
                const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(tempFilePath, response.data);
                orgPhotoPath = tempFilePath;
                console.log("Organization logo downloaded successfully.");
            } catch (err) {
                console.error('Error downloading organization logo:', err.message);
                orgPhotoPath = localLogoPath; // Fallback to default logo
            }
        }

        // **Generate the PDF receipt only if "Paid"**
        let receiptFilePath = '';
        if (newStatus === "Paid") {
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }

            receiptFilePath = path.join(receiptsDir, `receipt_${orderTransactionId}.pdf`);
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

            // **Date & Academic Year**
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semesterName || 'N/A'}`, { align: 'right' });

            doc.text(`Course and Section: ${course}-${section || 'N/A'}`, { align: 'left' });

            doc.text('\n\n');
            doc.font('Helvetica').text(`Amount Received: ₱${totalAmount} Pesos`, { align: 'center' });
            doc.text(`Received Payment From: ${userFullName}`, { align: 'center' });

            doc.text('\n\n');
            doc.text(`Ordered Items:\n${finalOrderDetails.join('\n')}`, { align: 'center' });

            doc.text('\n\n');
            doc.font('Helvetica').text(`RECEIPT NO. ${orderTransactionId}`, 50, doc.y, { continued: true });
            doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });

            doc.end();
        }

        // **Format ordered items for email**
        const orderDetailsHtml = finalOrderDetails.length
            ? finalOrderDetails.map(item => `<p style="text-align: center;">- ${item}</p>`).join('')
            : '<p style="text-align: center";>No items ordered.</p>';

        // **Different message for "Paid" and "Balance"**
        let statusMessage = newStatus === "Paid" 
            ? `<p>Your payment has been successfully completed.</p>` 
            : `<p>Your payment is still pending. Please complete the remaining balance.</p>`;

        // **Compose the email**
        const subject = `Order Confirmation - ${orderTransactionId}`;
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
                        <p>Your order with <strong>${organizationName}</strong> has been successfully placed.</p>
                        <p><strong>Transaction ID:</strong> ${orderTransactionId}</p>
                        <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
                        <p><strong>Total Pay:</strong> ₱${totalPay}</p>
                        <p><strong>Status:</strong> ${newStatus}</p>
                        <p><strong>Payment Method:</strong> Gcash</p>
                        <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                        ${statusMessage}
                        <h2 style="text-align: center;">Ordered Items:</h2>
                        ${orderDetailsHtml}
                    </div>
                </body>
            </html>
        `;

        
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: newStatus === "Paid" ? [{ filename: `receipt_${orderTransactionId}.pdf`, path: receiptFilePath }] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending order confirmation email:', error.message);
    }
};
const TotalPayBalance = async (email, userFullName, organizationName, totalAmount, orderTransactionId, orgUserFullName, organizationPhoto, course, section, semesterName, finalOrderDetails, paymentMethod, newStatus, productId, newTotalPay) => {
    try {
        console.log("Semester Name:", semesterName); // Debugging line

        // **Ensure finalOrderDetails is always an array**
        if (!Array.isArray(finalOrderDetails)) {
            finalOrderDetails = typeof finalOrderDetails === 'string' 
                ? finalOrderDetails.split(', ') 
                : [];
        }

        // **Create temporary directory if it doesn't exist**
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // **Default logo path**
        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg'); 
        let orgPhotoPath = localLogoPath;

        // **Handle organization photo (Dropbox Fix)**
        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            let downloadUrl = organizationPhoto;

            // **Convert Dropbox link to direct download**
            if (organizationPhoto.includes('dropbox.com')) {
                downloadUrl = organizationPhoto.replace('?dl=0', '?raw=1');
            }

            const logoFilename = `org_photo_${productId}.jpg`; // Use productId for unique filename
            const tempFilePath = path.join(tempDir, logoFilename);

            try {
                const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(tempFilePath, response.data);
                orgPhotoPath = tempFilePath;
                console.log("Organization logo downloaded successfully.");
            } catch (err) {
                console.error('Error downloading organization logo:', err.message);
                orgPhotoPath = localLogoPath; // Fallback to default logo
            }
        }

        // **Generate the PDF receipt only if "Paid"**
        let receiptFilePath = '';
        if (newStatus === "Paid") {
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }

            receiptFilePath = path.join(receiptsDir, `receipt_${orderTransactionId}.pdf`);
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

            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semesterName || 'N/A'}`, { align: 'right' });

            doc.text(`Course and Section: ${course}-${section || 'N/A'}`, { align: 'left' });

            doc.text('\n\n');
            doc.font('Helvetica').text(`Amount Received: ${totalAmount} Pesos`, { align: 'center' });
            
            doc.text(`Received Payment From: ${userFullName}`, { align: 'center' });

            doc.text('\n\n');
            doc.text(`Ordered Items:\n${finalOrderDetails.join('\n')}`, { align: 'center' });

            doc.text('\n\n');
            doc.font('Helvetica').text(`RECEIPT NO. ${orderTransactionId}`, 50, doc.y, { continued: true });
            doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });

            doc.end();
        }

        // **Format ordered items for email**
        const orderDetailsHtml = finalOrderDetails.length
            ? finalOrderDetails.map(item => `<p style="text-align: center;">- ${item}</p>`).join('')
            : '<p style="text-align: center";>No items ordered.</p>';

        // **Different message for "Paid" and "Balance"**
        let statusMessage = newStatus === "Paid" 
            ? `<p>Your payment has been successfully completed.</p>` 
            : `<p>Your payment is still pending. Please complete the remaining balance.</p>`;

        // **Compose the email**
        const subject = `Order Confirmation - ${orderTransactionId}`;
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
                        <p>Your order with <strong>${organizationName}</strong> has been successfully placed.</p>
                        <p><strong>Transaction ID:</strong> ${orderTransactionId}</p>
                        <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
                        
                        <p><strong>Status:</strong> ${newStatus}</p>
                        <p><strong>Payment Method:</strong> Gcash</p>
                        <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                        ${statusMessage}
                        <h2 style="text-align: center;">Ordered Items:</h2>
                        <h2 style="text-align: center;">${orderDetailsHtml}</h2>
                        <p style="font-size: 16px; margin-top: 10px; text-align: center;">Thank you for your order!</p>
                    </div>
                </body>
            </html>
        `;


        
        const mailOptions = {
            from: 'collegofcomputingstudies2024@gmail.com',
            to: email,
            subject,
            html: message,
            attachments: newStatus === "Paid" ? [{ filename: `receipt_${orderTransactionId}.pdf`, path: receiptFilePath }] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending order confirmation email:', error.message);
    }
};
const SendmarkOrderReceived = async (email, userFullName, orderTransactionId, organizationName, totalAmount, totalPay, paymentMethod, orgUserFullName, orderDetailsHtml) => {
    try {
        const subject = `Order Received Confirmation - ${orderTransactionId}`;
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
                        <p>Your order with <strong>${organizationName}</strong> has been successfully received.</p>
                        <p><strong>Transaction ID:</strong> ${orderTransactionId}</p>
                        <p><strong>Total Amount:</strong> ₱${totalAmount}</p>
                        <p><strong>Total Pay:</strong> ₱${totalPay}</p>
                        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                        <p><strong>Processed by:</strong> ${orgUserFullName}</p>
                        <h2 style="text-align: center;">Ordered Items:</h2>
                        <h2 style="text-align: center;">${orderDetailsHtml}</h2>
                        <p style="font-size: 16px; margin-top: 10px; text-align: center;">Thank you for your order!</p>
                        <div class="footer">
                            <p style="font-size: 14px; color: #777; margin-top: 5px; text-align: center;">
                                Follow us on <a href="https://www.facebook.com/wmsuccs">Facebook</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        await transporter.sendMail({ from: 'collegofcomputingstudies2024@gmail.com', to: email, subject, html: message });
        console.log(`Order received email sent successfully to ${email}`);
    } catch (error) {
        console.error('Error sending order received email:', error.message);
    }
};


module.exports = { sendOrganizationEmail,TotalPay,TotalPayBalance,SendmarkOrderReceived };
