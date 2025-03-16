const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


const axios = require('axios');
const PDFDocument = require('pdfkit');

const { initializeDropbox } = require('../config/dropboxConfig'); 

// Example usage inside a function
async function uploadFileToDropbox() {
    const dropbox = await initializeDropbox();
    if (!dropbox) {
        console.error("Dropbox initialization failed.");
        return;
    }

    try {
        const response = await dropbox.filesUpload({
            path: '/test-file.txt',
            contents: 'Hello, Dropbox!'
        });
        console.log('File uploaded:', response);
    } catch (error) {
        console.error('Dropbox upload error:', error);
    }
}

const { sendBalanceProductTransactionEmail } = require('../config/sendEmailBalanceTransaction');

exports.notifyProductTransactionBalance = async (req, res) => {
    try {
        const organizationId = req.userId;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        // Query to get transactions with "Balance" status
        const query = `
            SELECT 
                pt.order_transaction_id,
                pt.total_pay,
                pt.payment_method,
                pt.status,
                u.firstname,
                u.middlename,
                u.lastname,
                u.email
            FROM product_transaction pt
            JOIN users u ON pt.user_id = u.id
            WHERE pt.status = 'Balance'
            AND pt.order_transaction_id IN (
                SELECT DISTINCT pfo.order_transaction_id
                FROM product_transaction_final_order pfo
                JOIN products p ON pfo.product_id = p.product_id
                WHERE p.organization_id = ?
            );
        `;

        const [transactions] = await db.query(query, [organizationId]);

        if (transactions.length === 0) {
            return res.status(200).json({ message: "No balance transactions found." });
        }

        // Loop through transactions and send email
        for (const transaction of transactions) {
            const userFullName = `${transaction.firstname} ${transaction.middlename || ''} ${transaction.lastname}`.trim();
            await sendBalanceProductTransactionEmail(
                transaction.email,
                userFullName,
                transaction.order_transaction_id,
                transaction.total_pay
            );
        }

        res.status(200).json({ message: "Balance transaction emails sent successfully." });
    } catch (error) {
        console.error("Error notifying product transaction balances:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
const { sendBalanceTransactionEmail } = require('../config/sendEmailBalanceTransaction');

// Function to notify users with balance transactions
exports.notifyBalanceTransactions = async (req, res) => {
    try {
        const organizationId = req.userId;

        // Fetch transactions with "Balance" status
        const [transactions] = await db.query(`
            SELECT t.id, t.transaction_id, t.balance, t.payment_id, t.user_id, p.name AS payment_name, 
                   u.firstname, u.middlename, u.lastname, u.email 
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            JOIN users u ON t.user_id = u.id
            WHERE p.organization_id = ? AND t.payment_status = 'Balance'
        `, [organizationId]);

        if (transactions.length === 0) {
            return res.status(200).json({ message: "No balance transactions found." });
        }

        // Send email notifications
        for (const transaction of transactions) {
            const userFullName = `${transaction.firstname} ${transaction.middlename || ''} ${transaction.lastname}`.trim();
            await sendBalanceTransactionEmail(
                transaction.email,
                userFullName,
                transaction.payment_name,
                transaction.balance,
                transaction.transaction_id
            );
        }

        res.status(200).json({ message: "Balance transaction emails sent successfully." });
    } catch (error) {
        console.error("Error notifying balance transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.organizationsdetailsPresident = async (req, res) => {
    const orgUserId = req.orgIduser; 

    try {
        const [result] = await db.query(`
            SELECT position FROM organizations_users WHERE id = ?
        `, [orgUserId]);

        if (result.length === 0) {
            return res.status(404).json({ msg: 'Organization User not found' });
        }

        // Check if the position is "President"
        if (result[0].position !== "President") {
            return res.status(403).json({ msg: 'Access denied. Only Presidents can view this page.' });
        }

        return res.json({ msg: 'Access granted' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.getOrganizationsPaymentsWithTotal = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                p.id AS payment_id,
                p.name AS payment_name,
                o.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year,
                IFNULL(SUM(t.total_amount), 0) AS total_amount
            FROM payments p
            JOIN organizations o ON p.organization_id = o.id
            JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN transactions t ON p.id = t.payment_id
            WHERE p.organization_id = ? AND p.status = 'Accepted'
            GROUP BY p.id, p.name, o.name, s.name, s.year
            ORDER BY s.year DESC, total_amount DESC;
        `;

        const [payments] = await db.query(query, [organizationId]);

        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for this organization and semester(s).' });
        }

        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.error('Error fetching payments with total transactions:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

exports.getAllProductTransactionsBySemesterOrganization = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                s.id AS semester_id,
                s.name AS semester_name,
                s.year AS semester_year,
                org.name AS organization_name,
                IFNULL(SUM(pt.total_pay), 0) AS total_pay
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON pt.semester_id = s.id
            WHERE p.organization_id = ?
            GROUP BY s.id, s.name, s.year, org.name
            ORDER BY s.year DESC, org.name ASC;
        `;

        const [transactions] = await db.query(query, [organizationId]);

        if (transactions.length === 0) {
            return res.status(200).json({ message: 'No product transactions found.' });
        }

        res.status(200).json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching total product transactions by semester for organization:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getAllProductTransactionsBySemesterAdmin = async (req, res) => {
    try {
        // ✅ Query to fetch total payments grouped by semester & organization
        const query = `
            SELECT 
                s.id AS semester_id,
                s.name AS semester_name,
                s.year AS semester_year,
                org.name AS organization_name,
                IFNULL(SUM(pt.total_pay), 0) AS total_pay
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON pt.semester_id = s.id
            GROUP BY s.id, s.name, s.year, org.name
            ORDER BY s.year DESC, org.name ASC;
        `;

        // ✅ Execute query
        const [transactions] = await db.query(query);

        if (transactions.length === 0) {
            return res.status(200).json({ message: 'No product transactions found.' });
        }

        res.status(200).json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching total product transactions by semester for admin:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ✅ Fetch all payments and total transactions for admin (without adviser filter)
exports.getAdminPaymentsWithTotal = async (req, res) => {
    try {
        // ✅ Query to fetch payments, total transactions, organization name, and semester year
        const query = `
            SELECT 
                p.id AS payment_id,
                p.name AS payment_name,
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year,  -- ✅ Get the actual year from semesters
                IFNULL(SUM(t.total_amount), 0) AS total_amount
            FROM payments p
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON p.semester_id = s.id  -- ✅ Join semesters to get the correct year
            LEFT JOIN transactions t ON p.id = t.payment_id
            WHERE p.status = 'Accepted'
            GROUP BY p.id, p.name, org.name, s.year
            ORDER BY p.created_at DESC;
        `;

        // ✅ Execute query
        const [payments] = await db.query(query);

        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for this organization and semester(s).' });
        }

        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.error('Error fetching payments with total transactions:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getTransactionStatusCountsusers = async (req, res) => {
    try {
        const userId = req.userId; // Extract user ID from token
        const [result] = await db.execute(`
            SELECT 
                SUM(CASE WHEN payment_status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN payment_status IN ('Balance', 'Balance Gcash') THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN payment_status = 'Decline' THEN 1 ELSE 0 END) AS declined_count
            FROM transactions WHERE user_id = ?
        `, [userId]);

        res.json(result[0]); 
    } catch (error) {
        console.error('Error fetching transaction status counts:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get product transaction status counts for the logged-in user
exports.getProductTransactionStatusCountsusers = async (req, res) => {
    try {
        const userId = req.userId; // Extract user ID from token
        const [result] = await db.execute(`
            SELECT 
                SUM(CASE WHEN status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN status = 'Balance' THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN status = 'Declined' THEN 1 ELSE 0 END) AS declined_count
            FROM product_transaction WHERE user_id = ?
        `, [userId]);

        res.json(result[0]); 
    } catch (error) {
        console.error('Error fetching product transaction status counts:', error);
        res.status(500).json({ error: 'Server error' });
    }
};



const { sendotpforgotpasswordusersalogin } = require('../config/sendEmail');

// Send OTP for Forgot Password
exports.sendOtpForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if the email exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = users[0];

        // Construct full name, handling null middlename
        const userFullName = [user.firstname, user.middlename, user.lastname]
            .filter(name => name && name.trim() !== '')
            .join(' ');

        // Generate a secure OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Ensure the OTP is valid for only 10 minutes
        const otpExpiration = new Date(Date.now() + 10 * 60000); // 10 minutes from now

        // Store OTP in the database
        await db.query('UPDATE users SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [otp, otpExpiration, email]);

        // Send OTP via email
        await sendotpforgotpasswordusersalogin(email, otp, userFullName);

        return res.status(200).json({ success: true, msg: 'OTP sent successfully', redirectTo: 'forgotpassword.html' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
// Verify OTP for Forgot Password
exports.verifyOtpForgotPassword = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE email = ? AND otp = ?', [email, otp]);

        if (users.length === 0) {
            return res.status(400).json({ success: false, msg: 'Invalid OTP' });
        }

        return res.status(200).json({ success: true, msg: 'OTP verified', redirectTo: 'forgotresetpasswordlogin.html' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
exports.resendOtpForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = users[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await db.query('UPDATE users SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [otp, new Date(), email]);

        await sendotpforgotpasswordusersalogin(email, otp, `${user.firstname} ${user.middlename} ${user.lastname}`);

        return res.status(200).json({ success: true, msg: 'OTP resent successfully' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
// Reset Password
const { sendPasswordResetConfirmation } = require('../config/sendEmail');

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Validate password length
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, msg: 'Password must be at least 8 characters long' });
        }

        // Check if user exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = users[0];

        // Generate user full name safely
        const userFullName = [user.firstname, user.middlename, user.lastname]
            .filter(name => name && name.trim() !== '')
            .join(' ');

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP from database
        await db.query('UPDATE users SET password = ?, otp = NULL WHERE email = ?', [hashedPassword, email]);

        // Send confirmation email
        sendPasswordResetConfirmation(email, userFullName);

        return res.status(200).json({ success: true, msg: 'Password reset successfully. Please log in with your new password.', redirectTo: 'adminlogin.html' });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
exports.switchButton = async (req, res) => {
    try {
        const userId = req.AdviserID; // Extract user ID from token

        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }

        // Check if user exists in the admins table
        const [adminResult] = await db.query('SELECT user_id FROM admins WHERE user_id = ?', [userId]);

        if (adminResult.length === 0) {
            return res.json({ showSwitch: false }); // No match in admins, hide button
        }

        // Check if user exists in the users table
        const [userResult] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);

        if (userResult.length === 0) {
            return res.json({ showSwitch: false }); // No match in users, hide button
        }

        return res.json({ showSwitch: true }); // Matches in both tables, show button
    } catch (error) {
        console.error('Error checking switch button visibility:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};
const { sendadminregisteredsuccess } = require('../config/sendEmailusersAdmin'); 

exports.registerAdmin = async (req, res) => {
    try {
        const { userId } = req.body;
        const created_by = req.userId;  // Get the admin's user ID

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        // Check if the user is already registered as an admin
        const [existingAdmin] = await db.query('SELECT * FROM admins WHERE user_id = ?', [userId]);

        if (existingAdmin.length > 0) {
            return res.status(400).json({ success: false, message: 'User is already registered as an admin' });
        }

        // Check if the user is an activated adviser in any organization
        const [adviserResult] = await db.query('SELECT * FROM organizations_adviser WHERE user_id = ? AND status = "Activated"', [userId]);

        if (adviserResult.length > 0) {
            return res.status(400).json({ success: false, message: 'This teacher is currently advising an organization and cannot be an admin' });
        }

        // Get user details
        const [userResult] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = userResult[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Insert into admins table
        const [insertAdminResult] = await db.query(
            `INSERT INTO admins (user_id, idnumber, username, email, password, role, status, created_at, gender, firstname, middlename, lastname, created_by)
             VALUES (?, ?, ?, ?, ?, 'Admin', 'Not Activated', NOW(), ?, ?, ?, ?, ?)`, 
            [user.id, user.idnumber, user.username, user.email, user.password, user.gender, user.firstname, user.middlename, user.lastname, created_by]
        );

        const newAdminId = insertAdminResult.insertId;  // Get the ID of the newly inserted admin

        // Insert log into admin_logs table
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, performed_by, created_at)
             VALUES (?, ?, ?, NOW())`, 
            [newAdminId, 'Registered a new admin', created_by]
        );

        // Send email notification
        const adminEmail = user.email;
        const adminFullName = `${user.firstname} ${user.middlename ? user.middlename + ' ' : ''}${user.lastname}`;
        
        await sendadminregisteredsuccess(adminEmail, adminFullName);

        res.json({ success: true, message: 'Admin registered successfully, log recorded, and email sent' });
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};







exports.allsemesterlogs = async (req, res) => {
    try {
        const [logs] = await db.query(`
            SELECT sl.*, s.name AS semester_name, 
                   CONCAT(a.firstname, ' ', COALESCE(a.middlename, ''), ' ', a.lastname) AS performed_by
            FROM semesters_logs sl
            JOIN semesters s ON sl.semester_id = s.id
            JOIN admins a ON sl.performed_by = a.id
            ORDER BY sl.created_at DESC;
        `);

        res.json(logs);
    } catch (error) {
        console.error('Error fetching all semester logs:', error.message);
        res.status(500).json({ error: 'Failed to retrieve semester logs. Please try again later.' });
    }
};

exports.getPreOrderDetails = async (req, res) => {
    try {
        const { preOrderId } = req.params;

        // Fetch the product_id from pre_order
        const [preOrder] = await db.query(`SELECT product_id FROM pre_order WHERE id = ?`, [preOrderId]);
        if (preOrder.length === 0) {
            return res.status(404).json({ error: 'Pre-order not found' });
        }

        const productId = preOrder[0].product_id;

        // Fetch organization_id from products
        const [product] = await db.query(`SELECT organization_id FROM products WHERE product_id = ?`, [productId]);
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const organizationId = product[0].organization_id;

        // Fetch organization details (name and logo)
        const [organization] = await db.query(
            `SELECT name, photo AS logo FROM organizations WHERE id = ?`, 
            [organizationId]
        );
        if (organization.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Fetch the latest gcashorder for that organization
        const [latestGcashOrder] = await db.query(
            `SELECT id, qrcodepicture FROM gcashorder WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
            [organizationId]
        );

        return res.status(200).json({
            organization: {
                name: organization[0].name,
                logo: organization[0].logo,
            },
            gcashOrder: latestGcashOrder.length > 0 ? latestGcashOrder[0] : null
        });

    } catch (error) {
        console.error('Error fetching pre-order details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



exports.payPreOrderBalance = async (req, res) => {
    try {
        const { pre_order_id, amount_paid } = req.body;
        const created_by = req.orgIduser; // User paying the balance

        if (!pre_order_id || amount_paid === undefined || amount_paid <= 0) {
            return res.status(400).json({ message: "Invalid request. Pre-Order ID and valid payment amount are required." });
        }

        // Fetch current pre-order details
        const [preOrderResult] = await db.query(`
            SELECT user_id, total_amount, total_pay, status, proof_of_payment, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
            FROM pre_order 
            WHERE id = ? AND status IN ('Balance', 'Balance Gcash')
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or not in 'Balance' status." });
        }

        const { user_id, total_amount, total_pay, proof_of_payment, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = preOrderResult[0];

        const newTotalPay = parseFloat(total_pay) + parseFloat(amount_paid);

        if (amount_paid > (total_amount - total_pay)) {
            return res.status(400).json({ message: "Payment exceeds remaining balance." });
        }

        // **Fix: Ensure correct status change when fully paid**
        const newStatus = newTotalPay >= total_amount ? "Paid" : "Balance";

        // Update pre_order with new total_pay and status
        await db.query(`
            UPDATE pre_order 
            SET total_pay = ?, status = ? 
            WHERE id = ?
        `, [newTotalPay, newStatus, pre_order_id]);

        // Log the payment update in pre_order_logs
        await db.query(`
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, proof_of_payment, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [pre_order_id, `Additional payment of ₱${amount_paid} added`, newStatus, created_by, proof_of_payment]);

        // Fetch product name
        const [productResult] = await db.query(`SELECT name, organization_id FROM products WHERE product_id = ?`, [product_id]);
        if (productResult.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        const { name: productName, organization_id } = productResult[0];

        // Fetch organization details (name & photo)
        const [organizationResult] = await db.query(`SELECT name, photo FROM organizations WHERE id = ?`, [organization_id]);
        if (organizationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }
        const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

        // Fetch user details including course and section
        const [userResult] = await db.query(`SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = ?`, [user_id]);
        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        const { firstname, middlename, lastname, email, course, section } = userResult[0];
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

        // Fetch organization user (accepted_by) first name only
        const [acceptedUserResult] = await db.query(`SELECT firstname FROM organizations_users WHERE id = ?`, [created_by]);
        if (acceptedUserResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization user not found." });
        }
        const { firstname: acceptedByName } = acceptedUserResult[0];

        // Fetch the latest semester name
        const [latestSemesterResult] = await db.query(`
            SELECT name FROM semesters ORDER BY id DESC LIMIT 1
        `);
        if (latestSemesterResult.length === 0) {
            return res.status(404).json({ error: 'Semester not found.' });
        }
        const { name: semesterName } = latestSemesterResult[0];

        // **Get ordered items (only if quantity > 0)**
        let orderedItems = [];
        if (quantity > 0) orderedItems.push(`${quantity}x ${productName}`);
        if (smallquantity > 0) orderedItems.push(`${smallquantity}x Small ${productName}`);
        if (mediumquantity > 0) orderedItems.push(`${mediumquantity}x Medium ${productName}`);
        if (largequantity > 0) orderedItems.push(`${largequantity}x Large ${productName}`);
        if (xlargequantity > 0) orderedItems.push(`${xlargequantity}x X-Large ${productName}`);

        const finalOrderDetails = orderedItems.length > 0 ? orderedItems.join(', ') : "No items ordered.";

        // **Send email with PDF receipt**
        await sendPreOrderEmailupdatePreOrderTotalPay(email, userFullName, productName, organizationName, organizationPhoto, total_amount, newTotalPay, payment_method, pre_order_id, acceptedByName, course, section, semesterName, finalOrderDetails, newStatus);

        return res.status(200).json({ message: `Pre-Order balance payment updated. Status is now ${newStatus}.` });

    } catch (error) {
        console.error("Error processing balance payment:", error);
        return res.status(500).json({ message: "Failed to process balance payment." });
    }
};



exports.handleBalanceApproval = async (req, res) => {
    try {
        const { pre_order_id, action } = req.body;
        const created_by = req.orgIduser; // The person who accepts/declines the balance

        if (!pre_order_id || !["Accepted", "Declined"].includes(action)) {
            return res.status(400).json({ message: "Invalid request. Missing or incorrect parameters." });
        }

        // Fetch pre_order details
        const [preOrderResult] = await db.query(`
            SELECT status FROM pre_order WHERE id = ? AND status = 'Pending Balance'
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or already processed." });
        }

        // Determine the new status
        const newStatus = action === "Accepted" ? "Balance Gcash" : "Balance";

        // Update pre_order status
        await db.query(`
            UPDATE pre_order 
            SET status = ?, accepted_by = ?
            WHERE id = ?
        `, [newStatus, created_by, pre_order_id]);

        // Insert log into pre_order_logs
        await db.query(`
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [pre_order_id, `Balance payment ${action}`, newStatus, created_by]);

        res.status(200).json({ message: `Pre-Order balance ${action} successfully.` });
    } catch (error) {
        console.error("Error handling balance approval:", error);
        res.status(500).json({ message: "Failed to process balance approval." });
    }
};

const { sendPreOrderEmailupdatePreOrderTotalPay } = require('../config/SendEmailPreorder');

exports.updatePreOrderTotalPay = async (req, res) => {
    try {
        const { pre_order_id, total_pay } = req.body;
        const created_by = req.orgIduser;

        if (!pre_order_id || !total_pay || total_pay < 1) {
            return res.status(400).json({ message: "Invalid request. Missing or incorrect parameters." });
        }

        // Fetch current pre_order details
        const [preOrderResult] = await db.query(`
            SELECT user_id, total_amount, total_pay, status, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
            FROM pre_order 
            WHERE id = ?
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found." });
        }

        const { user_id, total_amount, total_pay: currentTotalPay, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = preOrderResult[0];

        if (total_pay > total_amount) {
            return res.status(400).json({ message: `Total pay cannot exceed ₱${total_amount}.` });
        }

        // **Fix: Compare using Math.abs() to avoid floating-point precision issues**
        const newStatus = Math.abs(total_amount - total_pay) < 0.01 ? "Paid" : "Balance";

        // Update pre_order total_pay and status
        await db.query(`
            UPDATE pre_order 
            SET total_pay = ?, status = ?
            WHERE id = ?
        `, [total_pay, newStatus, pre_order_id]);

        // Insert log into pre_order_logs
        await db.query(`
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [pre_order_id, `Added payment: ₱${total_pay}`, newStatus, created_by]);

        // Fetch product name
        const [productResult] = await db.query(`SELECT name, organization_id FROM products WHERE product_id = ?`, [product_id]);
        if (productResult.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        const { name: productName, organization_id } = productResult[0];

        // Fetch organization details (name & photo)
        const [organizationResult] = await db.query(`SELECT name, photo FROM organizations WHERE id = ?`, [organization_id]);
        if (organizationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }
        const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

        // Fetch user details including course and section
        const [userResult] = await db.query(`SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = ?`, [user_id]);
        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        const { firstname, middlename, lastname, email, course, section } = userResult[0];
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

        // Fetch organization user (accepted_by) first name only
        const [acceptedUserResult] = await db.query(`SELECT firstname FROM organizations_users WHERE id = ?`, [created_by]);
        if (acceptedUserResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization user not found." });
        }
        const { firstname: acceptedByName } = acceptedUserResult[0];

        // Fetch the latest semester name
        const [latestSemesterResult] = await db.query(`
            SELECT name FROM semesters ORDER BY id DESC LIMIT 1
        `);
        if (latestSemesterResult.length === 0) {
            return res.status(404).json({ error: 'Semester not found.' });
        }
        const { name: semesterName } = latestSemesterResult[0];

        // **Get ordered items (only if quantity > 0)**
        let orderedItems = [];
        if (quantity > 0) orderedItems.push(`${quantity}x ${productName}`);
        if (smallquantity > 0) orderedItems.push(`${smallquantity}x Small ${productName}`);
        if (mediumquantity > 0) orderedItems.push(`${mediumquantity}x Medium ${productName}`);
        if (largequantity > 0) orderedItems.push(`${largequantity}x Large ${productName}`);
        if (xlargequantity > 0) orderedItems.push(`${xlargequantity}x X-Large ${productName}`);

        const finalOrderDetails = orderedItems.length > 0 ? orderedItems.join(', ') : "No items ordered.";

        // **Send email with PDF receipt**
        await sendPreOrderEmailupdatePreOrderTotalPay(email, userFullName, productName, organizationName, organizationPhoto, total_amount, total_pay, payment_method, pre_order_id, acceptedByName, course, section, semesterName, finalOrderDetails, newStatus);

        return res.status(200).json({ message: `Pre-Order payment updated. Status is now ${newStatus}.` });

    } catch (error) {
        console.error("Error updating total pay:", error);
        return res.status(500).json({ message: "Failed to update total pay." });
    }
};


exports.handleGcashPreOrder = async (req, res) => {
    try {
        const { pre_order_id, action } = req.body;
        const created_by = req.orgIduser; // The person who accepts/declines the order

        if (!pre_order_id || !["Accepted", "Declined"].includes(action)) {
            return res.status(400).json({ message: "Invalid request. Missing or incorrect parameters." });
        }

        // Fetch pre_order details
        const [preOrderResult] = await db.query(`
            SELECT proof_of_payment FROM pre_order WHERE id = ? AND payment_method = 'Gcash' AND status = 'Pending'
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or already processed." });
        }

        const proofOfPayment = preOrderResult[0].proof_of_payment;

        // Update pre_order status
        await db.query(`
            UPDATE pre_order 
            SET status = ?, accepted_by = ?
            WHERE id = ?
        `, [action, created_by, pre_order_id]);

        // Insert log into pre_order_logs with proof_of_payment
        await db.query(`
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, proof_of_payment, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [pre_order_id, `Pre-Order marked as ${action}`, action, created_by, proofOfPayment]);

        res.status(200).json({ message: `Pre-Order ${action} successfully.` });
    } catch (error) {
        console.error("Error handling GCash Pre-Order:", error);
        res.status(500).json({ message: "Failed to process GCash Pre-Order." });
    }
};
const BalancepreOrderStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const preOrderId = req.body.pre_order_id;
        const dir = `uploads/pre_orders/${userId}/${preOrderId}`;

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Set up multer upload
const BalanceuploadPreOrderProof = multer({ storage: BalancepreOrderStorage });

// **Upload Proof of Payment for Pre-Orders**
exports.BalanceupdatePreOrderProofOfPayment = [
    BalanceuploadPreOrderProof.single('proof_of_payment'),
    async (req, res) => {
        try {
            const { pre_order_id } = req.body;
            const proofOfPaymentFile = req.file;

            if (!proofOfPaymentFile) {
                return res.status(400).json({ message: 'No proof of payment uploaded.' });
            }

            // Generate a unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = proofOfPaymentFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ message: 'File path is invalid' });
            }
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder path
            const folderPath = `/uploads/new/pre_order_proof_of_payment`;

            // Check and create Dropbox folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update the pre_order with proof_of_payment
            const query = `
    UPDATE pre_order
    SET proof_of_payment = ?, status = 'Pending Balance'
    WHERE id = ? AND user_id = ?
`;

const [result] = await db.execute(query, [proofOfPaymentLink, pre_order_id, req.userId]);


            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Pre-Order not found or you do not have permission to update this payment.' });
            }

            // Log the update in pre_order_logs, including proof_of_payment link
            await db.query(`
                INSERT INTO pre_order_logs (pre_order_id, action, status, proof_of_payment, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `, [pre_order_id, "Proof of payment for Balance", "Pending", proofOfPaymentLink]);

            res.status(200).json({
                message: 'Proof of payment updated successfully.',
                proofOfPaymentLink,
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ message: 'An error occurred while updating the proof of payment.' });
        }
    }
];

const preOrderStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const preOrderId = req.body.pre_order_id;
        const dir = `uploads/pre_orders/${userId}/${preOrderId}`;

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Set up multer upload
const uploadPreOrderProof = multer({ storage: preOrderStorage });

// **Upload Proof of Payment for Pre-Orders**
exports.updatePreOrderProofOfPayment = [
    uploadPreOrderProof.single('proof_of_payment'),
    async (req, res) => {
        try {
            const { pre_order_id } = req.body;
            const proofOfPaymentFile = req.file;

            if (!proofOfPaymentFile) {
                return res.status(400).json({ message: 'No proof of payment uploaded.' });
            }

            // Generate a unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = proofOfPaymentFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ message: 'File path is invalid' });
            }
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder path
            const folderPath = `/uploads/new/pre_order_proof_of_payment`;

            // Check and create Dropbox folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update the pre_order with proof_of_payment
            const query = `
                UPDATE pre_order
                SET proof_of_payment = ?
                WHERE id = ? AND user_id = ?
            `;

            const [result] = await db.execute(query, [proofOfPaymentLink, pre_order_id, req.userId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Pre-Order not found or you do not have permission to update this payment.' });
            }

            // Log the update in pre_order_logs, including proof_of_payment link
            await db.query(`
                INSERT INTO pre_order_logs (pre_order_id, action, status, proof_of_payment, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `, [pre_order_id, "Proof of payment uploaded", "Pending", proofOfPaymentLink]);

            res.status(200).json({
                message: 'Proof of payment updated successfully.',
                proofOfPaymentLink,
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ message: 'An error occurred while updating the proof of payment.' });
        }
    }
];
const RpreOrderStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const preOrderId = req.body.pre_order_id;
        const dir = `uploads/pre_orders/${userId}/${preOrderId}`;

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Set up multer upload
const RuploadPreOrderProof = multer({ storage: RpreOrderStorage });

// **Upload Proof of Payment for Pre-Orders**
exports.RupdatePreOrderProofOfPayment = [
    RuploadPreOrderProof.single('proof_of_payment'),
    async (req, res) => {
        try {
            const { pre_order_id } = req.body;
            const proofOfPaymentFile = req.file;

            if (!proofOfPaymentFile) {
                return res.status(400).json({ message: 'No proof of payment uploaded.' });
            }

            // Generate a unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = proofOfPaymentFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ message: 'File path is invalid' });
            }
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder path
            const folderPath = `/uploads/new/pre_order_proof_of_payment`;

            // Check and create Dropbox folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update the pre_order with proof_of_payment
            const query = `
    UPDATE pre_order
    SET proof_of_payment = ?, status = 'Pending'
    WHERE id = ? AND user_id = ?
`;

const [result] = await db.execute(query, [proofOfPaymentLink, pre_order_id, req.userId]);


            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Pre-Order not found or you do not have permission to update this payment.' });
            }

            // Log the update in pre_order_logs, including proof_of_payment link
            await db.query(`
                INSERT INTO pre_order_logs (pre_order_id, action, status, proof_of_payment, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `, [pre_order_id, "New Proof Of payment Uploaded", "Pending", proofOfPaymentLink]);

            res.status(200).json({
                message: 'Proof of payment updated successfully.',
                proofOfPaymentLink,
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ message: 'An error occurred while updating the proof of payment.' });
        }
    }
];

exports.removePreOrderusers = async (req, res) => { 
    try {
        const { pre_order_id } = req.body;
        const performed_by = req.userId; // User who removes the pre-order

        if (!pre_order_id) {
            return res.status(400).json({ message: "Pre-Order ID is required." });
        }

        // Fetch the pre-order details
        const [preOrderResult] = await db.query(`
            SELECT po.*, p.pre_order_limit, p.organization_id
            FROM pre_order po
            JOIN products p ON po.product_id = p.product_id
            WHERE po.id = ? AND po.status = 'Pending'
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or is not in Pending status." });
        }

        const preOrder = preOrderResult[0];
        const restoredLimit = preOrder.pre_order_limit + 
            preOrder.quantity + preOrder.smallquantity + preOrder.mediumquantity + 
            preOrder.largequantity + preOrder.xlargequantity;

        // Restore the pre_order_limit in products table
        await db.query(`
            UPDATE products 
            SET pre_order_limit = ?
            WHERE product_id = ?
        `, [restoredLimit, preOrder.product_id]);

        // Log the pre-order removal in products_logs
        await db.query(`
            INSERT INTO products_logs (product_id, created_at, action, updated_at, performed_by)
            VALUES (?, NOW(), ?, NOW(), ?)
        `, [
            preOrder.product_id, 
            `Pre-Order removed and restored ${preOrder.quantity + preOrder.smallquantity + preOrder.mediumquantity + preOrder.largequantity + preOrder.xlargequantity} to Pre-order Limit.`,
            performed_by
        ]);

        // Delete the pre-order
        await db.query(`DELETE FROM pre_order WHERE id = ?`, [pre_order_id]);

        res.json({ success: true, message: "Pre-Order removed successfully, and pre_order_limit restored." });
    } catch (error) {
        console.error("Error removing Pre-Order:", error);
        res.status(500).json({ success: false, message: "Failed to remove Pre-Order." });
    }
};

exports.getOrderStatus = async (req, res) => {
    try {
        const organization = req.userId; // Get organization ID from token

        // Fetch current order_status
        const [orgStatus] = await db.query(
            `SELECT order_status FROM organizations WHERE id = ?`, [organization]
        );

        if (orgStatus.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        res.json({ success: true, order_status: orgStatus[0].order_status });
    } catch (error) {
        console.error("Error fetching order status:", error);
        res.status(500).json({ success: false, message: "Failed to fetch order status." });
    }
};

exports.toggleOrderStatus = async (req, res) => {
    try {
        const organization = req.userId; // Get organization ID from token
        const created_by = req.orgIduser; // Get user who performed the action

        // Fetch current order_status
        const [orgStatus] = await db.query(
            `SELECT order_status FROM organizations WHERE id = ?`, [organization]
        );

        if (orgStatus.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        // Determine new status
        const currentStatus = orgStatus[0].order_status;
        const newStatus = currentStatus === "Accept Order" ? "Don't Accept Order" : "Accept Order";

        // Update order_status in organizations table
        await db.query(
            `UPDATE organizations SET order_status = ? WHERE id = ?`,
            [newStatus, organization]
        );

        // Log the status change
        const actionMessage = `Order status changed to "${newStatus}".`;
        await db.query(
            `INSERT INTO organization_order_status_logs (organization_id, action, created_by) VALUES (?, ?, ?)`,
            [organization, actionMessage, created_by]
        );

        res.json({ success: true, message: `Order status updated to "${newStatus}"`, newStatus });
    } catch (error) {
        console.error("Error toggling order status:", error);
        res.status(500).json({ success: false, message: "Failed to update order status." });
    }
};


exports.getUserPreOrders = async (req, res) => {
    const userId = req.userId;

    try {
        const [preOrders] = await db.query(`
            SELECT po.*, p.name AS product_name 
            FROM pre_order po
            JOIN products p ON po.product_id = p.product_id
            WHERE po.user_id = ?
            ORDER BY po.updated_at DESC
        `, [userId]);

        res.json(preOrders);
    } catch (error) {
        console.error("Error fetching user's pre-orders:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getUserPreOrderLogs = async (req, res) => {
    const { pre_order_id } = req.params;

    try {
        const [logs] = await db.query(`
            SELECT * FROM pre_order_logs 
            WHERE pre_order_id = ?
            ORDER BY created_at DESC
        `, [pre_order_id]);

        res.json(logs);
    } catch (error) {
        console.error("Error fetching pre-order logs:", error);
        res.status(500).json({ message: "Server error" });
    }
};


exports.removePreOrderusera = async (req, res) => {
    try {
        const { pre_order_id } = req.body;
        const accepted_by = req.orgIduser; // User who removes the pre-order
        const organization = req.userId;
        if (!pre_order_id) {
            return res.status(400).json({ message: "Pre-Order ID is required." });
        }

        // Fetch the pre-order details
        const [preOrderResult] = await db.query(`
            SELECT po.*, p.pre_order_limit
            FROM pre_order po
            JOIN products p ON po.product_id = p.product_id
            WHERE po.id = ? AND po.status = 'Pending'
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or is not in Pending status." });
        }

        const preOrder = preOrderResult[0];

        // Restore the pre_order_limit to products table
        const restoredLimit = preOrder.pre_order_limit + 
            preOrder.quantity + preOrder.smallquantity + preOrder.mediumquantity + 
            preOrder.largequantity + preOrder.xlargequantity;

        await db.query(`
            UPDATE products 
            SET pre_order_limit = ?
            WHERE product_id = ?
        `, [restoredLimit, preOrder.product_id]);

        // Log the pre-order removal in pre_order_logs
        await db.query(`
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [pre_order_id, `Pre-Order removed and restored ${preOrder.quantity + preOrder.smallquantity + preOrder.mediumquantity + preOrder.largequantity + preOrder.xlargequantity} to Pre-order Limit.`, 'Cancelled', accepted_by]);

        // Log the pre-order removal in products_logs
        await db.query(`
            INSERT INTO products_logs (product_id, organization_id, created_at, action, updated_at, created_by)
            VALUES (?, ?, NOW(), ?, NOW(), ?)
        `, [preOrder.product_id, organization, `Pre-Order removal restored ${preOrder.quantity + preOrder.smallquantity + preOrder.mediumquantity + preOrder.largequantity + preOrder.xlargequantity} to Pre-order Limit.`, accepted_by]);

        // Delete the pre-order
        await db.query(`DELETE FROM pre_order WHERE id = ?`, [pre_order_id]);

        res.json({ success: true, message: "Pre-Order removed successfully, and pre_order_limit restored." });
    } catch (error) {
        console.error("Error removing Pre-Order:", error);
        res.status(500).json({ success: false, message: "Failed to remove Pre-Order." });
    }
};

exports.placePreOrderAsTransaction = async (req, res) => {
    try {
        const { pre_order_id } = req.body;

        if (!pre_order_id) {
            return res.status(400).json({ message: "Pre-Order ID is required." });
        }

        

        // Fetch pre-order details including user_id
        const [preOrderResult] = await db.query(`
            SELECT po.*,p.name, p.quantity AS available_quantity, 
                    p.smallquantity AS available_small, 
                    p.mediumquantity AS available_medium, 
                    p.largequantity AS available_large, 
                    p.xlargequantity AS available_xlarge
            FROM pre_order po
            JOIN products p ON po.product_id = p.product_id
            WHERE po.id = ? AND po.status = 'Paid'
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(400).json({ message: "Pre-Order not found or not marked as Paid." });
        }

        const preOrder = preOrderResult[0];
        const userId = preOrder.user_id;
        const acceptedBy = preOrder.accepted_by; 
        const proofOfPayment = preOrder.proof_of_payment;// Get accepted_by from pre_order

        if (!userId) {
            return res.status(400).json({ message: "User ID cannot be null." });
        }

        // Validate product stock before processing
        if (preOrder.quantity > preOrder.available_quantity) {
            return res.status(400).json({ message: `Not enough stock for Quantity.` });
        }
        if (preOrder.smallquantity > preOrder.available_small) {
            return res.status(400).json({ message: `Not enough stock for Small quantity.` });
        }
        if (preOrder.mediumquantity > preOrder.available_medium) {
            return res.status(400).json({ message: `Not enough stock for Medium quantity.` });
        }
        if (preOrder.largequantity > preOrder.available_large) {
            return res.status(400).json({ message: `Not enough stock for Large quantity.` });
        }
        if (preOrder.xlargequantity > preOrder.available_xlarge) {
            return res.status(400).json({ message: `Not enough stock for X-Large quantity.` });
        }

        // Generate a unique order transaction ID
        const currentYear = new Date().getFullYear().toString();
        const orderTransactionId = `${currentYear}${Math.floor(100000 + Math.random() * 900000)}`;

        const [latestSemester] = await db.query(`
            SELECT id FROM semesters ORDER BY id DESC LIMIT 1
        `);

        if (latestSemester.length === 0) {
            return res.status(404).json({ message: 'Semester not found' });
        }

        const semesterId = latestSemester[0].id;

        // Insert into product_transaction table
        const transactionQuery = `
            INSERT INTO product_transaction (
                user_id,
                order_transaction_id,
                order_item,
                status,
                payment_method,
                total_amount,
                total_pay,
                accepted_by,
                proof_of_payment,
                semester_id
            )
            VALUES (?, ?, ?, 'Paid', ?, ?, ?, ?, ?, ?)
        `;
        const orderItemDetails = JSON.stringify({
            product_id: preOrder.product_id,
            product_name: preOrder.name,
            quantity: preOrder.quantity,
            smallquantity: preOrder.smallquantity,
            mediumquantity: preOrder.mediumquantity,
            largequantity: preOrder.largequantity,
            xlargequantity: preOrder.xlargequantity
        });

        await db.query(transactionQuery, [
            userId,
            orderTransactionId,
            orderItemDetails,
            preOrder.payment_method,
            preOrder.total_amount,
            preOrder.total_pay,
            acceptedBy,
            proofOfPayment,
            semesterId
        ]);

        // Insert into product_transaction_logs (NOW INCLUDES accepted_by)
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                total_pay,
                accepted_by,
                proof_of_payment,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, 'Paid', ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        // Generate a detailed log message with quantities deducted
        let logMessage = `Successfully placed order from Pre-Order for ${preOrder.name}. Deducted: `;
        let deductedQuantities = [];
        if (preOrder.quantity > 0) deductedQuantities.push(`${preOrder.quantity} Quantity`);
        if (preOrder.smallquantity > 0) deductedQuantities.push(`${preOrder.smallquantity} Small`);
        if (preOrder.mediumquantity > 0) deductedQuantities.push(`${preOrder.mediumquantity} Medium`);
        if (preOrder.largequantity > 0) deductedQuantities.push(`${preOrder.largequantity} Large`);
        if (preOrder.xlargequantity > 0) deductedQuantities.push(`${preOrder.xlargequantity} X-Large`);
        logMessage += deductedQuantities.join(', ');

        await db.query(logQuery, [
            userId,
            orderTransactionId,
            logMessage,
            preOrder.payment_method,
            preOrder.total_amount,
            preOrder.total_pay,
            acceptedBy,
            proofOfPayment
        ]);

        // Insert into product_transaction_final_order
        const finalOrderInsertQuery = `
            INSERT INTO product_transaction_final_order (
                user_id,
                order_transaction_id,
                product_id,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(finalOrderInsertQuery, [
            userId,
            orderTransactionId,
            preOrder.product_id,
            preOrder.quantity,
            preOrder.smallquantity,
            preOrder.mediumquantity,
            preOrder.largequantity,
            preOrder.xlargequantity
        ]);

        // Update product stock
        const updateProductQuery = `
            UPDATE products
            SET 
                quantity = quantity - ?,
                smallquantity = smallquantity - ?,
                mediumquantity = mediumquantity - ?,
                largequantity = largequantity - ?,
                xlargequantity = xlargequantity - ?
            WHERE product_id = ?
        `;

        await db.query(updateProductQuery, [
            preOrder.quantity,
            preOrder.smallquantity,
            preOrder.mediumquantity,
            preOrder.largequantity,
            preOrder.xlargequantity,
            preOrder.product_id
        ]);

        // Log the stock update
        const productLogQuery = `
            INSERT INTO products_logs (
                product_id,
                organization_id,
                created_at,
                action,
                updated_at,
                created_by,
                performed_by,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            )
            VALUES (?, NULL, NOW(), ?, NOW(), NULL, ?, ?, ?, ?, ?, ?)
        `;

        const productLogMessage = `Stock reduced due to order placement from Pre-Order. Deducted: ${deductedQuantities.join(', ')}`;
        await db.query(productLogQuery, [
            preOrder.product_id,
            productLogMessage,
            userId,
            -preOrder.quantity,
            -preOrder.smallquantity,
            -preOrder.mediumquantity,
            -preOrder.largequantity,
            -preOrder.xlargequantity
        ]);

        await db.query(`UPDATE pre_order SET transaction_status = 'Done Order Transaction' WHERE id = ?`, [pre_order_id]);

        res.status(200).json({ message: "Order placed successfully from Pre-Order", orderTransactionId });
    } catch (err) {
        console.error("Error processing Pre-Order to Order Transaction:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


const { sendPreOrderEmail } = require('../config/SendEmailPreorder');

exports.markPreOrderAsPaid = async (req, res) => {
    try {
        const { pre_order_id } = req.body;
        const accepted_by = req.orgIduser; // Organization user accepting the payment

        if (!pre_order_id || !accepted_by) {
            return res.status(400).json({ success: false, message: "Pre-Order ID and accepted_by are required." });
        }

        // Fetch the pre-order details
        const [preOrderResult] = await db.query(`
            SELECT user_id, total_amount, total_pay, status, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
            FROM pre_order 
            WHERE id = ?
        `, [pre_order_id]);

        if (preOrderResult.length === 0) {
            return res.status(404).json({ success: false, message: "Pre-Order not found." });
        }

        const { user_id, total_amount, total_pay, status, payment_method, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = preOrderResult[0];

        // Fetch product name
        const [productResult] = await db.query(`SELECT name, organization_id FROM products WHERE product_id = ?`, [product_id]);
        if (productResult.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const { name: productName, organization_id } = productResult[0];

        // Fetch organization details (name & photo)
        const [organizationResult] = await db.query(`SELECT name, photo FROM organizations WHERE id = ?`, [organization_id]);
        if (organizationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

        // Fetch user details including course and section
        const [userResult] = await db.query(`SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = ?`, [user_id]);
        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const { firstname, middlename, lastname, email, course, section } = userResult[0];
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

        // Fetch organization user (accepted_by) first name only
        const [acceptedUserResult] = await db.query(`SELECT firstname FROM organizations_users WHERE id = ?`, [accepted_by]);
        if (acceptedUserResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization user not found." });
        }

        const { firstname: acceptedByName } = acceptedUserResult[0];

        // Fetch the latest semester name
        const [latestSemesterResult] = await db.query(`
            SELECT name FROM semesters ORDER BY id DESC LIMIT 1
        `);
        if (latestSemesterResult.length === 0) {
            return res.status(404).json({ error: 'Semester not found.' });
        }
        const { name: semesterName } = latestSemesterResult[0];

        // **Get ordered items (only if quantity > 0)**
        let orderedItems = [];
        if (quantity > 0) orderedItems.push(`${quantity}x ${productName}`);
        if (smallquantity > 0) orderedItems.push(`${smallquantity}x Small ${productName}`);
        if (mediumquantity > 0) orderedItems.push(`${mediumquantity}x Medium ${productName}`);
        if (largequantity > 0) orderedItems.push(`${largequantity}x Large ${productName}`);
        if (xlargequantity > 0) orderedItems.push(`${xlargequantity}x X-Large ${productName}`);

        const finalOrderDetails = orderedItems.length > 0 ? orderedItems.join(', ') : "No items ordered.";

        // Update the pre_order status to "Paid"
        const updateQuery = `
            UPDATE pre_order 
            SET status = 'Paid', total_pay = ?, accepted_by = ? 
            WHERE id = ?
        `;
        await db.query(updateQuery, [total_amount, accepted_by, pre_order_id]);

        // Insert into pre_order_logs table
        const logQuery = `
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        const logMessage = `Pre-Order marked as Paid. Total Paid: ₱${total_amount}.`;
        await db.query(logQuery, [pre_order_id, logMessage, 'Paid', accepted_by]);

        // **Send email with PDF receipt**
        await sendPreOrderEmail(email, userFullName, productName, organizationName, organizationPhoto, total_amount, total_pay, payment_method, pre_order_id, acceptedByName, course, section, semesterName, finalOrderDetails);

        res.json({ success: true, message: "Pre-Order marked as Paid successfully, and email sent." });
    } catch (error) {
        console.error("Error updating Pre-Order:", error);
        res.status(500).json({ success: false, message: "Failed to update Pre-Order status." });
    }
};




// Fetch pre-orders based on organization_id
exports.getPreOrders = async (req, res) => {
    const organizationId = req.userId; // Ensure this retrieves the organization ID

    try {
        const query = `
            SELECT po.*, 
                   p.name AS product_name,
                   CONCAT(u.firstname, ' ', COALESCE(u.middlename, ''), ' ', u.lastname) AS user_fullname,
                   CONCAT(org.firstname, ' ', COALESCE(org.middlename, ''), ' ', org.lastname) AS accepted_by_name
            FROM pre_order po
            JOIN products p ON po.product_id = p.product_id
            JOIN users u ON po.user_id = u.id
            LEFT JOIN organizations_users org ON po.accepted_by = org.id
            WHERE p.organization_id = ?
            ORDER BY po.updated_at DESC
        `;

        const [preOrders] = await db.query(query, [organizationId]);

        if (!preOrders.length) {
            return res.status(404).json({ msg: 'No pre-orders found' });
        }

        return res.json(preOrders);
    } catch (err) {
        console.error('Error fetching pre-orders:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};



// Fetch pre-order logs based on pre_order_id
exports.getPreOrderLogs = async (req, res) => {
    const { pre_order_id } = req.params;

    try {
        const query = `
            SELECT logs.*, 
                   COALESCE(users.firstname, '') AS firstname, 
                   COALESCE(users.middlename, '') AS middlename, 
                   COALESCE(users.lastname, '') AS lastname
            FROM pre_order_logs logs
            LEFT JOIN organizations_users users ON logs.accepted_by = users.id
            WHERE logs.pre_order_id = ?
            ORDER BY logs.created_at DESC
        `;

        const [logs] = await db.query(query, [pre_order_id]);

        if (!logs.length) {
            return res.status(404).json({ msg: 'No logs found for this pre-order' });
        }

        // Ensure full name is properly formatted
        const formattedLogs = logs.map(log => ({
            ...log,
            accepted_by: log.firstname || log.middlename || log.lastname
                ? `${log.firstname} ${log.middlename ? log.middlename + ' ' : ''}${log.lastname}`
                : `User ID: ${log.accepted_by}` // Fallback if no user info is found
        }));

        return res.json(formattedLogs);
    } catch (err) {
        console.error('Error fetching pre-order logs:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};




exports.createPreOrder = async (req, res) => {
    try {
        const { product_id, user_id, quantity = 0, small = 0, medium = 0, large = 0, xlarge = 0, payment_method } = req.body;

        if (!product_id || !user_id || !payment_method) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }
        // **Check if the user already has a pending pre-order**
        const [existingPreOrder] = await db.query(`
            SELECT id FROM pre_order WHERE user_id = ? AND status = 'Pending'
        `, [user_id]);

        if (existingPreOrder.length > 0) {
            return res.status(400).json({ success: false, message: "You already have a pending pre-order. Please complete or cancel it before placing a new one." });
        }

        // Fetch product details (name, price, pre_order_limit)
        const [productResult] = await db.query(`SELECT name, price, pre_order_limit FROM products WHERE product_id = ?`, [product_id]);
        if (productResult.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const product = productResult[0];
        const unit_price = product.price; // Price per unit

        // Calculate the total price based on the selected quantity
        const totalOrderQuantity = quantity + small + medium + large + xlarge;
        const total_amount = unit_price * totalOrderQuantity; // Multiply unit price by total quantity

        if (totalOrderQuantity <= 0) {
            return res.status(400).json({ success: false, message: "Pre-Order quantity must be greater than zero." });
        }

        const updatedLimit = (product.pre_order_limit || 0) - totalOrderQuantity;
        if (updatedLimit < 0) {
            return res.status(400).json({ success: false, message: "Insufficient pre-order limit." });
        }

        const total_pay = 0; // Always 0 initially
        const accepted_by = 'None'; // Default
        const product_name = product.name; // Fetch product name

        // Insert into pre_order table
        const preOrderQuery = `
            INSERT INTO pre_order (product_id, user_id, total_amount, total_pay, status, accepted_by, payment_method, quantity, smallquantity, mediumquantity, largequantity, xlargequantity, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const [preOrderResult] = await db.query(preOrderQuery, [
            product_id, user_id, total_amount, total_pay, accepted_by, payment_method,
            quantity, small, medium, large, xlarge
        ]);

        const pre_order_id = preOrderResult.insertId;

        // Construct detailed action message with selected sizes
        let selectedQuantities = [];
        if (quantity > 0) selectedQuantities.push(`${quantity} Quantity`);
        if (small > 0) selectedQuantities.push(`${small} Small`);
        if (medium > 0) selectedQuantities.push(`${medium} Medium`);
        if (large > 0) selectedQuantities.push(`${large} Large`);
        if (xlarge > 0) selectedQuantities.push(`${xlarge} X-Large`);

        const detailedQuantities = selectedQuantities.length > 0 ? selectedQuantities.join(', ') : 'No quantity selected';

        // Insert into pre_order_logs table
        const logQuery = `
            INSERT INTO pre_order_logs (pre_order_id, action, status, accepted_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        const logMessage = `Pre-Order placed for "${product_name}" with ${detailedQuantities}.`;
        await db.query(logQuery, [pre_order_id, logMessage, 'Pending', accepted_by]);

        // Update pre_order_limit in products table
        const updateProductQuery = `
            UPDATE products 
            SET pre_order_limit = ? 
            WHERE product_id = ?
        `;
        await db.query(updateProductQuery, [updatedLimit, product_id]);

        // Insert into products_logs
        const productLogQuery = `
            INSERT INTO products_logs (product_id, organization_id, created_at, action, updated_at, performed_by)
            VALUES (?, ?, NOW(), ?, NOW(), ?)
        `;
        const productLogMessage = `Pre-Order placed for "${product_name}". Decreased pre_order_limit by ${detailedQuantities}.`;
        await db.query(productLogQuery, [product_id, req.organizationId, productLogMessage, user_id]);

        res.json({ success: true, message: "Pre-Order placed successfully." });
    } catch (error) {
        console.error("Error creating Pre-Order:", error);
        res.status(500).json({ success: false, message: "Failed to create Pre-Order." });
    }
};






exports.updatePreOrderLimit = async (req, res) => {
    try {
        const { product_id, pre_order_limit } = req.body;
        const updated_by = req.userId; // Use req.userId for authenticated user

        if (!product_id || pre_order_limit === undefined) {
            return res.status(400).json({ success: false, message: "Product ID and new Pre-Order Limit are required." });
        }

        // Get the current Pre-Order limit before updating
        const [currentProduct] = await db.query(`SELECT pre_order_limit FROM products WHERE product_id = ?`, [product_id]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const previous_limit = currentProduct[0].pre_order_limit || 0; // Default to 0 if null

        // Update the pre-order limit
        const updateQuery = `
            UPDATE products 
            SET pre_order_limit = ? 
            WHERE product_id = ? AND status = 'Pre-Order'
        `;
        await db.query(updateQuery, [pre_order_limit, product_id]);

        // Log the action with previous and new limit
        const logQuery = `
            INSERT INTO products_logs (product_id, organization_id, created_at, action, updated_at, created_by)
            VALUES (?, ?, NOW(), ?, NOW(), ?)
        `;
        const logMessage = `Pre-Order limit set from ${previous_limit} to ${pre_order_limit}.`;

        await db.query(logQuery, [product_id, req.userId, logMessage, updated_by]);

        res.json({ success: true, message: "Pre-Order limit updated successfully." });
    } catch (error) {
        console.error("Error updating Pre-Order limit:", error);
        res.status(500).json({ success: false, message: "Failed to update Pre-Order limit." });
    }
};


// Remove the Pre-Order status
exports.removePreOrder = async (req, res) => {
    try {
        const { product_id } = req.body;
        const removed_by = req.userId; // Assuming req.userId is the authenticated user

        if (!product_id) {
            return res.status(400).json({ success: false, message: "Product ID is required." });
        }

        // Get the current total stock
        const [product] = await db.query(`
            SELECT 
                COALESCE(quantity, 0) + COALESCE(xsmallquantity, 0) + COALESCE(smallquantity, 0) + 
                COALESCE(mediumquantity, 0) + COALESCE(largequantity, 0) + COALESCE(xlargequantity, 0) + 
                COALESCE(xxlargequantity, 0) + COALESCE(xxxlargequantity, 0) AS total_stock
            FROM products 
            WHERE product_id = ? AND status = 'Pre-Order'
        `, [product_id]);

        if (product.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found or not in Pre-Order." });
        }

        const total_stock = product[0].total_stock;

        // Determine new status based on total stock
        const newStatus = total_stock > 0 ? 'Available' : 'Out of Stock';

        // Update product status
        const updateQuery = `
            UPDATE products 
            SET status = ?
            WHERE product_id = ? AND status = 'Pre-Order'
        `;
        await db.query(updateQuery, [newStatus, product_id]);

        // Log the action
        const logQuery = `
            INSERT INTO products_logs (product_id, organization_id, created_at, action, updated_at, created_by)
            VALUES (?, ?, NOW(), ?, NOW(), ?)
        `;
        const logMessage = `Pre-Order status removed. New status: ${newStatus}.`;

        await db.query(logQuery, [product_id, req.userId, logMessage, removed_by]);

        res.json({ success: true, message: `Pre-Order status removed successfully. Product is now '${newStatus}'.` });
    } catch (error) {
        console.error("Error removing Pre-Order status:", error);
        res.status(500).json({ success: false, message: "Failed to remove Pre-Order status." });
    }
};

exports.setPreOrder = async (req, res) => {
    try {
        const { product_id, pre_order_limit } = req.body;
        const created_by = req.orgIduser; // Assuming the logged-in admin/user ID

        if (!product_id || pre_order_limit === undefined) {
            return res.status(400).json({ success: false, message: "Product ID and Pre-Order Limit are required." });
        }

        // Update product status to "Pre-Order" and set limit
        const updateQuery = `
            UPDATE products 
            SET status = 'Pre-Order', pre_order_limit = ? 
            WHERE product_id = ?
        `;
        await db.query(updateQuery, [pre_order_limit, product_id]);

        // Log the pre-order action in `products_logs`
        const logQuery = `
            INSERT INTO products_logs (product_id, organization_id, created_at, action, updated_at, created_by, quantity)
            VALUES (?, ?, NOW(), ?, NOW(), ?, ?)
        `;

        const logMessage = `Product set to Pre-Order with a limit of ${pre_order_limit}.`;

        await db.query(logQuery, [product_id, req.userId, logMessage, created_by, pre_order_limit]);

        res.json({ success: true, message: "Product is now available for pre-order." });
    } catch (error) {
        console.error("Error updating product for pre-order:", error);
        res.status(500).json({ success: false, message: "Failed to update product for pre-order." });
    }
};

exports.updateProductStatus = async (req, res) => {
    try {
        const query = `
            UPDATE products 
            SET status = 
                CASE 
                    -- If status is Pre-Order and total quantity is 0, keep it unchanged
                    WHEN status = 'Pre-Order' AND 
                         (COALESCE(quantity, 0) + COALESCE(xsmallquantity, 0) + COALESCE(smallquantity, 0) + 
                          COALESCE(mediumquantity, 0) + COALESCE(largequantity, 0) + COALESCE(xlargequantity, 0) + 
                          COALESCE(xxlargequantity, 0) + COALESCE(xxxlargequantity, 0)) = 0
                        THEN 'Pre-Order'

                    -- If status is Available and total quantity is 0, change to Out of Stock
                    WHEN status = 'Available' AND 
                         (COALESCE(quantity, 0) + COALESCE(xsmallquantity, 0) + COALESCE(smallquantity, 0) + 
                          COALESCE(mediumquantity, 0) + COALESCE(largequantity, 0) + COALESCE(xlargequantity, 0) + 
                          COALESCE(xxlargequantity, 0) + COALESCE(xxxlargequantity, 0)) = 0
                        THEN 'Out of Stock'

                    -- If total quantity is greater than 0 and not Pre-Order, set to Available
                    WHEN status != 'Pre-Order' AND 
                         (COALESCE(quantity, 0) + COALESCE(xsmallquantity, 0) + COALESCE(smallquantity, 0) + 
                          COALESCE(mediumquantity, 0) + COALESCE(largequantity, 0) + COALESCE(xlargequantity, 0) + 
                          COALESCE(xxlargequantity, 0) + COALESCE(xxxlargequantity, 0)) > 0
                        THEN 'Available'

                    ELSE status -- Keep status unchanged for all other cases
                END
        `;

        await db.query(query);
        res.json({ success: true, message: 'Product statuses updated successfully.' });
    } catch (error) {
        console.error('Error updating product statuses:', error);
        res.status(500).json({ success: false, message: 'Failed to update product statuses.' });
    }
};




exports.getOrganizationLogo = async (req, res) => {
    const organizationId = req.userId;

    const connection = await db.getConnection();

    try {
        const [organization] = await connection.query('SELECT photo FROM organizations WHERE id = ?', [organizationId]);
        if (!organization.length || !organization[0].photo) {
            return res.status(200).json({ photo: "img/logo.png" }); // Default logo
        }

        return res.status(200).json({ photo: organization[0].photo });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error', error: err.message });
    } finally {
        connection.release();
    }
};
const uploadDir = path.join(__dirname, '../uploads/logostorage');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for logo uploads
const logostorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Save in logostorage directory
    },
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});
const logoupload = multer({ storage: logostorage });



exports.uploadOrganizationLogo = [
    logoupload.single('logoupload'), // Middleware for file upload
    async (req, res) => {
        const organizationId = req.userId; // Organization ID
        const logoFile = req.file; // Uploaded file

        if (!logoFile) {
            return res.status(400).json({ msg: 'Logo image is required' });
        }

        const connection = await db.getConnection();

        try {
            // Fetch organization name
            const [organization] = await connection.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organization.length) {
                throw new Error('Organization not found');
            }
            const organizationName = organization[0].name;

            // Read file content
            const filePathOnDisk = path.resolve(logoFile.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define organization folder in Dropbox
            const organizationFolderPath = `/uploads/${organizationName}/Photo`;

            // Check if folder exists before creating it
            try {
                await dropbox.filesGetMetadata({ path: organizationFolderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${organizationFolderPath}" already exists.`);
                } else {
                    console.log(`Creating folder: ${organizationFolderPath}`);
                    await dropbox.filesCreateFolderV2({ path: organizationFolderPath });
                }
            }

            // Upload logo to Dropbox
            const dropboxPath = `${organizationFolderPath}/${logoFile.filename}`;
            console.log(`Uploading file to Dropbox at: ${dropboxPath}`);
            
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
                mode: { ".tag": "overwrite" } // Ensures file gets replaced if it exists
            });

            const filePath = dropboxUploadResponse.result?.path_display || dropboxPath;

            // Generate a shared link
            let dropboxSharedLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: filePath,
                });
                dropboxSharedLink = sharedLinkResponse.result?.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: filePath });
                if (existingLinks.result.links.length > 0) {
                    dropboxSharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Store logo link in the database under "photo" field
            await connection.query('UPDATE organizations SET photo = ? WHERE id = ?', [dropboxSharedLink, organizationId]);

            // Remove file from local storage after upload
            fs.unlinkSync(filePathOnDisk);

            return res.status(201).json({ msg: 'Logo uploaded successfully', logoUrl: dropboxSharedLink });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ msg: 'Server error', error: err.message });
        } finally {
            connection.release();
        }
    }
];

exports.getOrganizationAcademicLogs = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token

        const query = `
            SELECT 'User' AS type, oul.user_id, oul.position, oul.year, o.name AS organization_name, 
                   ou.firstname, ou.middlename, ou.lastname
            FROM organizations_users_logs oul
            JOIN organizations_users ou ON oul.organizations_users_id = ou.id
            JOIN organizations o ON oul.organizations_id = o.id
            WHERE oul.organizations_id = ?

            UNION ALL

            SELECT 'Adviser' AS type, oal.user_id, oal.position, oal.year, o.name AS organization_name, 
                   u.firstname, u.middlename, u.lastname
            FROM organizations_adviser_logs oal
            JOIN users u ON oal.user_id = u.id
            JOIN organizations o ON oal.organizations_id = o.id
            WHERE oal.organizations_id = ?

            ORDER BY year DESC;
        `;

        const [results] = await db.query(query, [organizationId, organizationId]);

        if (results.length === 0) {
            return res.status(404).json({ organizations: {} });
        }

        // Define position hierarchy
        const positionHierarchy = {
            "Adviser": 1,
            "President": 2, 
            "Vice-President": 3, 
            "Secretary": 4, 
            "Treasurer": 5, 
            "Auditor": 6, 
            "PIO": 7, 
            "Member": 8
            
        };

        // Group users & advisers by year
        let groupedData = {};
        results.forEach(person => {
            if (!groupedData[person.year]) {
                groupedData[person.year] = { year: person.year, organization: person.organization_name, records: [] };
            }
            person.full_name = `${person.firstname} ${person.middlename ? person.middlename + " " : ""}${person.lastname}`;
            groupedData[person.year].records.push(person);
        });

        // Sort records within each group by position hierarchy
        Object.values(groupedData).forEach(group => {
            group.records.sort((a, b) => {
                const rankA = positionHierarchy[a.position] || 99;
                const rankB = positionHierarchy[b.position] || 99;
                return rankA - rankB;
            });
        });

        res.status(200).json({ organizations: Object.values(groupedData) });
    } catch (error) {
        console.error("Error fetching organization academic logs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};





exports.getAdviserOrganizationUsers = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT 
                oul.user_id, 
                oul.position, 
                oul.year, 
                o.name AS organization_name,
                ou.firstname, ou.middlename, ou.lastname
            FROM organizations_adviser_logs oal
            JOIN organizations_users_logs oul 
                ON oal.organizations_id = oul.organizations_id 
                AND oal.year = oul.year
            JOIN organizations_users ou 
                ON oul.organizations_users_id = ou.id
            JOIN organizations o 
                ON oul.organizations_id = o.id
            WHERE oal.user_id = ?
            ORDER BY oul.year DESC;
        `;

        const [results] = await db.query(query, [adviserId]);

        if (results.length === 0) {
            return res.status(404).json({ organizations: {} });
        }

        // Define position hierarchy
        const positionHierarchy = {
            "President": 1, 
            "Vice-President": 2, 
            "Secretary": 3, 
            "Treasurer": 4, 
            "Auditor": 5, 
            "PIO": 6, 
            "Member": 7
        };

        // Group by Organization & Year
        let groupedData = {};
        results.forEach(user => {
            const key = `${user.organization_name}-${user.year}`;
            if (!groupedData[key]) {
                groupedData[key] = { organization: user.organization_name, year: user.year, users: [] };
            }
            // Add full name to user details
            user.full_name = `${user.firstname} ${user.middlename ? user.middlename + " " : ""}${user.lastname}`;
            groupedData[key].users.push(user);
        });

        // Sort users within each group by position hierarchy
        Object.values(groupedData).forEach(group => {
            group.users.sort((a, b) => {
                const rankA = positionHierarchy[a.position] || 99;
                const rankB = positionHierarchy[b.position] || 99;
                return rankA - rankB;
            });
        });

        res.status(200).json({ organizations: Object.values(groupedData) });
    } catch (error) {
        console.error("Error fetching adviser organization users:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};



exports.getAdviserPaymentCount = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT COUNT(*) AS totalPayments
            FROM payments
            WHERE adviser_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({ totalPayments: result[0].totalPayments || 0 });
    } catch (error) {
        console.error('Error fetching adviser payments count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAdviserGcashOrderCount = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT COUNT(*) AS totalGcashOrders
            FROM gcashorder
            WHERE adviser_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({ totalGcashOrders: result[0].totalGcashOrders || 0 });
    } catch (error) {
        console.error('Error fetching adviser Gcash orders count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAdviserOrganization = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT DISTINCT o.name AS organization_name, oal.year
            FROM organizations_adviser_logs oal
            JOIN organizations_logs ol ON oal.organizations_id = ol.organization_id
            JOIN organizations o ON ol.organization_id = o.id
            WHERE oal.user_id = ?
            ORDER BY oal.year DESC;
        `;

        const [results] = await db.query(query, [adviserId]);

        if (results.length === 0) {
            return res.status(404).json({ organizations: [] });
        }

        res.status(200).json({ organizations: results });
    } catch (error) {
        console.error('Error fetching adviser organizations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};




exports.getAdviserGcashOrderReportCount = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT COUNT(*) AS report_count
            FROM gcashorder_reports
            WHERE reported_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({
            totalReports: result[0].report_count || 0
        });
    } catch (error) {
        console.error('Error fetching adviser GCash order report count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAdviserPaymentCounts = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT 
                SUM(CASE WHEN p.adviser_status = 'Accepted' THEN 1 ELSE 0 END) AS accepted_count,
                SUM(CASE WHEN p.adviser_status = 'Declined' THEN 1 ELSE 0 END) AS declined_count
            FROM payments p
            WHERE p.adviser_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({
            accepted: result[0].accepted_count || 0,
            declined: result[0].declined_count || 0
        });
    } catch (error) {
        console.error('Error fetching adviser payment counts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAdviserQrCodeCounts = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT 
                SUM(CASE WHEN g.adviser_status = 'Accepted' THEN 1 ELSE 0 END) AS accepted_count,
                SUM(CASE WHEN g.adviser_status = 'Declined' THEN 1 ELSE 0 END) AS declined_count
            FROM gcashorder g
            WHERE g.adviser_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({
            accepted: result[0].accepted_count || 0,
            declined: result[0].declined_count || 0
        });
    } catch (error) {
        console.error('Error fetching QR code counts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAdviserPaymentReportCount = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT COUNT(*) AS report_count
            FROM payment_reports
            WHERE adviser_report_by = ?;
        `;

        const [result] = await db.query(query, [adviserId]);

        res.status(200).json({
            totalReports: result[0].report_count || 0
        });
    } catch (error) {
        console.error('Error fetching adviser payment report count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.adminAllPaymentsTransactionsDashboard = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        const queryPayments = `
            SELECT 
                t.id,
                t.transaction_id,
                t.user_id,
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                p.name AS payment_name,
                t.payment_status,
                t.received_by,
                ou.firstname AS received_by_firstname,
                ou.middlename AS received_by_middlename,
                ou.lastname AS received_by_lastname,
                t.created_at
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN organizations_users ou ON t.received_by = ou.id
            WHERE p.status = 'Accepted'
              AND DATE(t.created_at) BETWEEN ? AND ?
            ORDER BY t.created_at DESC
        `;

        const queryOrders = `
            SELECT 
                pt.order_transaction_id,
                pt.status,
                pt.order_status,
                pt.user_id,
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                pt.accepted_by,
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,
                pt.created_at
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            LEFT JOIN users u ON pt.user_id = u.id
            LEFT JOIN organizations_users ou ON pt.accepted_by = ou.id
            WHERE DATE(pt.created_at) BETWEEN ? AND ?
            ORDER BY pt.created_at DESC
        `;

        const [payments] = await db.query(queryPayments, [start_date, end_date]);
        const [orders] = await db.query(queryOrders, [start_date, end_date]);

        res.status(200).json({ payments, orders });

    } catch (error) {
        console.error("Error fetching payment and order transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.adminTotalAmountPayments = async (req, res) => {
    try {
        const query = `
            SELECT 
                IFNULL(SUM(t.total_amount), 0) AS total_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE t.payment_status NOT IN ('Declined')
        `;

        const [result] = await db.query(query);
        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching total payments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


exports.adminTotalPayTransactions = async (req, res) => {
    try {
        const query = `
            SELECT 
                IFNULL(SUM(pt.total_pay), 0) AS total_transactions,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Cash' THEN pt.total_pay ELSE 0 END), 0) AS total_cash,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Gcash' THEN pt.total_pay ELSE 0 END), 0) AS total_gcash
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
        `;

        const [result] = await db.query(query);
        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching product transaction totals:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getAllPaymentsTransactionsByOrgDashboard = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        let { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        const queryPayments = `
            SELECT 
                t.id,
                t.transaction_id,
                t.user_id,
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                p.name AS payment_name,
                t.payment_status,
                t.received_by,
                ou.firstname AS received_by_firstname,
                ou.middlename AS received_by_middlename,
                ou.lastname AS received_by_lastname,
                t.created_at
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN organizations_users ou ON t.received_by = ou.id
            WHERE p.organization_id = ? 
              AND p.status = 'Accepted'
              AND DATE(t.created_at) BETWEEN ? AND ?
            ORDER BY t.created_at DESC
        `;

        const queryOrders = `
            SELECT 
                pt.order_transaction_id,
                pt.status,
                pt.order_status,
                pt.user_id,
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                pt.accepted_by,
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,
                pt.created_at
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            LEFT JOIN users u ON pt.user_id = u.id
            LEFT JOIN organizations_users ou ON pt.accepted_by = ou.id
            WHERE p.organization_id = ?
              AND DATE(pt.created_at) BETWEEN ? AND ?
            ORDER BY pt.created_at DESC
        `;

        const [payments] = await db.query(queryPayments, [organizationId, start_date, end_date]);
        const [orders] = await db.query(queryOrders, [organizationId, start_date, end_date]);

        res.status(200).json({ payments, orders });

    } catch (error) {
        console.error("Error fetching payment and order transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


exports.getProductReviewStats = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                p.product_id,
                p.name AS product_name,
                IFNULL(SUM(pfo.quantity + pfo.smallquantity + pfo.mediumquantity + pfo.largequantity + pfo.xlargequantity), 0) AS total_quantity
            FROM product_transaction_final_order pfo
            JOIN products p ON pfo.product_id = p.product_id
            WHERE p.organization_id = ?
            GROUP BY p.product_id, p.name
            ORDER BY total_quantity DESC
        `;

        const [products] = await db.query(query, [organizationId]);

        if (products.length === 0) {
            return res.status(404).json({ msg: 'No product sales data found' });
        }

        // Determine highest and lowest sold products
        const highestSold = products[0]; // Most sold product
        const lowestSold = products[products.length - 1]; // Least sold product

        // All products except the highest and lowest are considered "average sold"
        const averageSoldProducts = products.filter(p => p !== highestSold && p !== lowestSold);

        res.status(200).json({
            highestSold,
            lowestSold,
            averageSoldProducts
        });

    } catch (error) {
        console.error("Error fetching product review stats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getMonthlyTotals = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                DATE_FORMAT(t.created_at, '%Y-%m') AS month,
                IFNULL(SUM(t.total_amount), 0) AS total_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash_transactions
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE p.organization_id = ? 
              AND t.payment_status NOT IN ('Declined')
            GROUP BY month
            ORDER BY month ASC
        `;

        const query2 = `
            SELECT 
                DATE_FORMAT(pt.created_at, '%Y-%m') AS month,
                IFNULL(SUM(pt.total_pay), 0) AS total_product_transactions,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Cash' THEN pt.total_pay ELSE 0 END), 0) AS total_cash_product_transactions,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Gcash' THEN pt.total_pay ELSE 0 END), 0) AS total_gcash_product_transactions
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            WHERE p.organization_id = ? 
            GROUP BY month
            ORDER BY month ASC
        `;

        const [transactions] = await db.query(query, [organizationId]);
        const [productTransactions] = await db.query(query2, [organizationId]);

        res.status(200).json({ transactions, productTransactions });

    } catch (error) {
        console.error("Error fetching monthly totals:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.adminGetMonthlyTotals = async (req, res) => { 
    try {
        const query = `
            SELECT 
                DATE_FORMAT(t.created_at, '%Y-%m') AS month,
                IFNULL(SUM(t.total_amount), 0) AS total_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash_transactions
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE t.payment_status NOT IN ('Declined')
            GROUP BY month
            ORDER BY month ASC
        `;

        const query2 = `
            SELECT 
                DATE_FORMAT(pt.created_at, '%Y-%m') AS month,
                IFNULL(SUM(pt.total_pay), 0) AS total_product_transactions,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Cash' THEN pt.total_pay ELSE 0 END), 0) AS total_cash_product_transactions,
                IFNULL(SUM(CASE WHEN pt.payment_method = 'Gcash' THEN pt.total_pay ELSE 0 END), 0) AS total_gcash_product_transactions
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            GROUP BY month
            ORDER BY month ASC
        `;

        const [transactions] = await db.query(query);
        const [productTransactions] = await db.query(query2);

        res.status(200).json({ transactions, productTransactions });

    } catch (error) {
        console.error("Error fetching monthly totals:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getProductQuantitiesByOrganization = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                p.product_id,
                p.name AS product_name,
                IFNULL(SUM(p.quantity + p.smallquantity + p.mediumquantity + p.largequantity + p.xlargequantity), 0) AS total_quantity
            FROM products p
            WHERE p.organization_id = ?
            GROUP BY p.product_id, p.name
            ORDER BY total_quantity ASC
        `;

        const [products] = await db.query(query, [organizationId]);

        if (products.length === 0) {
            return res.status(404).json({ msg: 'No product quantity data found' });
        }

        res.status(200).json({ products });

    } catch (error) {
        console.error("Error fetching product quantities:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};




// Backend Route (totalPayPerOrganization)
exports.totalPayPerOrganization = async (req, res) => {
    try {
        const organizationId = req.userId;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                COALESCE(SUM(pt.total_pay), 0) AS total_transactions,
                COALESCE(SUM(CASE WHEN pt.payment_method = 'Cash' THEN pt.total_pay END), 0) AS total_cash,
                COALESCE(SUM(CASE WHEN pt.payment_method = 'Gcash' THEN pt.total_pay END), 0) AS total_gcash
            FROM product_transaction pt
            WHERE pt.order_transaction_id IN (
                SELECT DISTINCT pfo.order_transaction_id
                FROM product_transaction_final_order pfo
                JOIN products p ON pfo.product_id = p.product_id
                WHERE p.organization_id = ?
            );
        `;

        const [result] = await db.query(query, [organizationId]);
        
        // Ensure the response always has numerical values, even if no data is found
        res.status(200).json({
            total_transactions: result[0]?.total_transactions || 0,
            total_cash: result[0]?.total_cash || 0,
            total_gcash: result[0]?.total_gcash || 0
        });

    } catch (error) {
        console.error("Error fetching total pay per organization:", error);
        res.status(500).json({ 
            error: "Internal server error",
            message: error.message
        });
    }
};







exports.getProductTransactionStatusCounts = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                SUM(CASE WHEN pt.status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN pt.status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN pt.status = 'Balance' THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN pt.status = 'Declined' THEN 1 ELSE 0 END) AS declined_count
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            WHERE p.organization_id = ?
        `;

        const [result] = await db.query(query, [organizationId]);

        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching product transaction status counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get transaction count for different statuses
exports.getTransactionStatusCounts = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                SUM(CASE WHEN t.payment_status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN t.payment_status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN t.payment_status IN ('Balance', 'Balance Gcash') THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN t.payment_status = 'Decline' THEN 1 ELSE 0 END) AS declined_count
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE p.organization_id = ? 
              AND p.status = 'Accepted'
        `;

        const [result] = await db.query(query, [organizationId]);

        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching transaction status counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.adminTransactionStatusCounts = async (req, res) => {
    try {
        const query = `
            SELECT 
                SUM(CASE WHEN t.payment_status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN t.payment_status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN t.payment_status IN ('Balance', 'Balance Gcash') THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN t.payment_status = 'Decline' THEN 1 ELSE 0 END) AS declined_count
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE p.status = 'Accepted'
        `;

        const [result] = await db.query(query);
        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching transaction status counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getReportsCount = async (req, res) => {
    try {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM usersreport) AS users_reports,
                (SELECT COUNT(*) FROM transactions_reports) AS transactions_reports,
                (SELECT COUNT(*) FROM product_transaction_reports) AS product_transaction_reports,
                (SELECT COUNT(*) FROM gcashorder_reports) AS gcashorder_reports,
                (SELECT COUNT(*) FROM payment_reports) AS payment_reports
        `;

        const [result] = await db.query(query);
        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching report counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// Get product transaction status counts across all organizations (Admin View)
exports.adminProductTransactionStatusCounts = async (req, res) => {
    try {
        const query = `
            SELECT 
                SUM(CASE WHEN pt.status IN ('Pending', 'Pending Balance') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN pt.status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
                SUM(CASE WHEN pt.status = 'Balance' THEN 1 ELSE 0 END) AS balance_count,
                SUM(CASE WHEN pt.status = 'Declined' THEN 1 ELSE 0 END) AS declined_count
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
        `;

        const [result] = await db.query(query);
        res.status(200).json(result[0]);

    } catch (error) {
        console.error("Error fetching product transaction status counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.acceptedPaymentsTotalAmountAndPaymentMethodCount = async (req, res) => { 
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        // Fetch all semesters, including those without payments
        const [semesters] = await db.query(`
            SELECT id, name, year FROM semesters 
            ORDER BY id DESC
        `);

        if (semesters.length === 0) {
            return res.status(400).json({ error: 'No active semesters found.' });
        }

        // Fetch payments and match by semester_id or year
        const query = `
            SELECT 
                s.id AS semester_id,
                s.name AS semester_name,
                s.year AS semester_year,
                p.name AS payment_name,
                p.year AS payment_year,
                IFNULL(SUM(t.total_amount), 0) AS total_amount,
                COUNT(t.id) AS transaction_count,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash_amount,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash_amount
            FROM semesters s
            LEFT JOIN payments p ON (
                p.semester_id = s.id OR (p.year IS NOT NULL AND p.year = s.year)
            ) AND p.organization_id = ? AND p.status = 'Accepted'
            LEFT JOIN transactions t ON p.id = t.payment_id 
                AND t.payment_status NOT IN ('Declined')
            GROUP BY s.id, s.name, s.year, p.name, p.year
            ORDER BY s.id DESC, total_amount DESC
        `;

        const [payments] = await db.query(query, [organizationId]);

        res.status(200).json({ semesters, payments });

    } catch (error) {
        console.error("Error fetching total transaction amounts by payment method:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};




exports.adminAcceptedPaymentsTotalAmountAndPaymentMethodCount = async (req, res) => { 
    try {
        // Fetch all semesters, including those without payments
        const [semesters] = await db.query(`
            SELECT id, name, year FROM semesters 
            ORDER BY id DESC
        `);

        if (semesters.length === 0) {
            return res.status(400).json({ error: 'No active semesters found.' });
        }

        // Fetch payments and match by semester_id or year (WITHOUT organization_id)
        const query = `
            SELECT 
                s.id AS semester_id,
                s.name AS semester_name,
                s.year AS semester_year,
                p.name AS payment_name,
                p.year AS payment_year,
                IFNULL(SUM(t.total_amount), 0) AS total_amount,
                COUNT(t.id) AS transaction_count,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash_amount,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash_amount
            FROM semesters s
            LEFT JOIN payments p ON (
                p.semester_id = s.id OR (p.year IS NOT NULL AND p.year = s.year)
            ) AND p.status = 'Accepted'  -- Removed organization_id filtering
            LEFT JOIN transactions t ON p.id = t.payment_id 
                AND t.payment_status NOT IN ('Declined')
            GROUP BY s.id, s.name, s.year, p.name, p.year
            ORDER BY s.id DESC, total_amount DESC
        `;

        const [payments] = await db.query(query);

        res.status(200).json({ semesters, payments });

    } catch (error) {
        console.error("Error fetching total transaction amounts by payment method:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.totalAmountPaymentOrganization = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                IFNULL(SUM(t.total_amount), 0) AS total_transactions,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Cash' THEN t.total_amount ELSE 0 END), 0) AS total_cash,
                IFNULL(SUM(CASE WHEN t.payment_method = 'Gcash' THEN t.total_amount ELSE 0 END), 0) AS total_gcash
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            WHERE p.organization_id = ? 
              AND t.payment_status NOT IN ('Declined')
        `;
        const [result] = await db.query(query, [organizationId]);
        
        res.status(200).json(result[0]);
    } catch (error) {
        console.error("Error fetching total payments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


exports.getPaymentsTransactionsBySemester = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        // Get all semesters
        const [semesters] = await db.query("SELECT id, name FROM semesters ORDER BY id DESC;");

        // Get total payments per semester
        const [payments] = await db.query(`
            SELECT s.id AS semester_id, s.name AS semester_name, 
                SUM(t.total_amount) AS total_amount
            FROM transactions t
            JOIN payments p ON t.payment_id = p.id
            JOIN semesters s ON p.semester_id = s.id
            WHERE p.organization_id = ? 
              AND t.payment_status NOT IN ('Declined')
            GROUP BY s.id, s.name;
        `, [organizationId]);

        // Get total product transactions per semester
        const [orders] = await db.query(`
            SELECT s.id AS semester_id, s.name AS semester_name, 
                SUM(pt.total_pay) AS total_pay
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN semesters s ON pt.semester_id = s.id  
            WHERE p.organization_id = ?
            GROUP BY s.id, s.name;
        `, [organizationId]);

        res.status(200).json({ semesters, payments, orders });

    } catch (error) {
        console.error("Error fetching semester transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


exports.getActivePaymentsByOrganization = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                p.id AS payment_id, 
                p.name AS payment_name, 
                s.name AS semester_name,
                IFNULL(SUM(t.total_amount), 0) AS total_transactions
            FROM payments p
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN transactions t ON p.id = t.payment_id AND t.payment_status NOT IN ('Declined')
            WHERE p.organization_id = ? 
              AND p.status = 'Accepted'
            GROUP BY p.id, p.name, s.name
        `;
        const [payments] = await db.query(query, [organizationId]);
        res.status(200).json({ payments });
    } catch (error) {
        console.error("Error fetching active payments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getActivePayments = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id AS payment_id, 
                p.name AS payment_name, 
                s.name AS semester_name,
                IFNULL(SUM(t.total_amount), 0) AS total_transactions
            FROM payments p
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN transactions t ON p.id = t.payment_id AND t.payment_status NOT IN ('Declined')
            WHERE p.status = 'Accepted'
            GROUP BY p.id, p.name, s.name
        `;
        const [payments] = await db.query(query);
        res.status(200).json({ payments });
    } catch (error) {
        console.error("Error fetching active payments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// NEW FUNCTION: Get Transactions by Payment
exports.getTransactionsByPaymentActive = async (req, res) => {
    try {
        const { paymentId } = req.params;
        if (!paymentId) {
            return res.status(400).json({ error: "Payment ID is required" });
        }
        const query = `
            SELECT 
                id, 
                transaction_id,
                payment_method,
                total_amount, 
                payment_status, 
                created_at
            FROM transactions
            WHERE payment_id = ?
        `;
        const [transactions] = await db.query(query, [paymentId]);
        res.status(200).json({ transactions });
    } catch (error) {
        console.error("Error fetching transactions for payment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


exports.getAllProductTransactionReports = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization ID from token
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required.' });
        }

        const query = `
            SELECT 
                ptr.id,
                ptr.user_id,
                ptr.order_transaction_id,
                ptr.created_by,
                ptr.reasons,
                ptr.comments,
                ptr.status,
                ptr.created_at,
                u.firstname AS user_firstname,
                u.lastname AS user_lastname,
                u.middlename AS user_middlename,
                a.firstname AS admin_firstname,
                a.lastname AS admin_lastname,
                a.middlename AS admin_middlename
            FROM product_transaction_reports ptr
            JOIN product_transaction pt ON ptr.order_transaction_id = pt.order_transaction_id
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            LEFT JOIN users u ON ptr.user_id = u.id
            LEFT JOIN organizations_users a ON ptr.created_by = a.id
            WHERE p.organization_id = ?
            ORDER BY ptr.created_at DESC
        `;

        const [reports] = await db.query(query, [organizationId]);

        if (reports.length === 0) {
            return res.status(200).json({ message: "No order transaction reports available" });
        }

        res.status(200).json(reports);
    } catch (error) {
        console.error('Error fetching product transaction reports:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getAllProductTransactions = async (req, res) => {
    try {
        const query = `
            SELECT 
                pt.id,
                pt.user_id,
                pt.order_transaction_id,
                pt.order_item,
                pt.status,
                pt.payment_method,
                pt.total_amount,
                pt.total_pay,
                pt.accepted_by,
                u.firstname AS user_firstname,
                u.lastname AS user_lastname,
                a.firstname AS accepted_by_firstname,
                a.lastname AS accepted_by_lastname
            FROM product_transaction pt
            LEFT JOIN users u ON pt.user_id = u.id
            LEFT JOIN admin_users a ON pt.accepted_by = a.id
            ORDER BY pt.created_at DESC
        `;
        const [transactions] = await db.query(query);

        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching product transactions:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getFilteredPaymentsByUser = async (req, res) => {
    try {
        const { userId, semesterId } = req.body;
        const organizationId = req.userId; // Get organization ID from authenticated user

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        if (!semesterId) {
            return res.status(400).json({ error: 'Semester ID is required' });
        }

        // ✅ Get the user's active semester and year
        const [userActiveSemester] = await db.query(
            `SELECT s.id AS semester_id, s.year 
             FROM semesters_users su 
             INNER JOIN semesters s ON su.semester_id = s.id 
             WHERE su.user_id = ? 
             AND su.status = "Active"
             AND su.semester_id = ?`, 
            [userId, semesterId]
        );

        // ❌ If the user is NOT active in the semester, deny access
        if (userActiveSemester.length === 0) {
            return res.status(403).json({ error: 'User is not enrolled in this semester.' });
        }

        const activeYear = userActiveSemester[0].year; // Get user's active year

        // ✅ Fetch only payments for the active semester OR those with a matching year
        const [payments] = await db.query(
            `SELECT p.id, p.name, p.payment_type, p.price, p.semester_id, p.year 
             FROM payments p 
             WHERE p.organization_id = ? 
             AND p.status = 'Accepted' 
             AND (
                 (p.semester_id = ?) -- Payment matches the active semester
                 OR 
                 (p.year IS NOT NULL AND p.year = ?) -- Payment has a matching year
             )
             AND p.id NOT IN (
                 SELECT DISTINCT t.payment_id 
                 FROM transactions t 
                 WHERE t.user_id = ? 
                 AND t.payment_status NOT IN ('Declined')
             )`,
            [organizationId, semesterId, activeYear, userId]
        );

        if (payments.length === 0) {
            return res.status(404).json({ error: 'No available payments for this user in this semester.' });
        }

        res.status(200).json(payments);
    } catch (error) {
        console.error('Error fetching filtered payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};










exports.getOrganizationUserHistory = async (req, res) => {
    const { userId } = req.params;
    
    try {
        const query = `
            SELECT 
                ouh.id, 
                ouh.status, 
                ouh.action, 
                ouh.created_at, 
                a.firstname AS admin_firstname, 
                a.middlename AS admin_middlename, 
                a.lastname AS admin_lastname
            FROM organizations_users_history ouh
            LEFT JOIN admins a ON ouh.created_by = a.id
            WHERE ouh.organizations_users_id = ?
            ORDER BY ouh.created_at DESC;
        `;

        const [history] = await db.query(query, [userId]);
        
        res.status(200).json({ history });
    } catch (error) {
        console.error('Error fetching organization user history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getOrganizationLogs = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const query = `
            SELECT 
                l.id, 
                l.organization_id, 
                l.action, 
                l.status, 
                l.semester_id, 
                l.created_by, 
                l.created_at,
                CONCAT_WS(' ', a.firstname, a.middlename, a.lastname) AS admin_fullname
            FROM organizations_logs l
            LEFT JOIN admins a ON l.created_by = a.id
            WHERE l.organization_id = ?
            ORDER BY l.created_at DESC
        `;
        const [logs] = await db.query(query, [organizationId]);
        res.status(200).json({ logs });
    } catch (error) {
        console.error("Error fetching organization logs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getOrganizationsYearGrouped = async (req, res) => {
    try {
        // Query to join organizations_year with organizations info and admin info,
        // concatenating admin names into one field "admin_fullname"
        const query = `
            SELECT 
                oy.organization_id, 
                oy.year, 
                oy.status, 
                oy.created_by, 
                oy.created_at, 
                o.name AS organization_name, 
                o.email AS organization_email,
                CONCAT_WS(' ', a.firstname, a.middlename, a.lastname) AS admin_fullname
            FROM organizations_year oy
            LEFT JOIN organizations o ON oy.organization_id = o.id
            LEFT JOIN admins a ON oy.created_by = a.id
            ORDER BY oy.year, o.name;
        `;
        const [rows] = await db.query(query);

        // Group the results by the "year" field
        const grouped = rows.reduce((acc, row) => {
            if (!acc[row.year]) {
                acc[row.year] = [];
            }
            acc[row.year].push(row);
            return acc;
        }, {});

        res.status(200).json({ grouped });
    } catch (error) {
        console.error("Error fetching organizations year grouped:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const { sendOrganizationStatusEmailDelete } = require('../config/sendEmailAdmin');

exports.deleteOrganizationYear = async (req, res) => {
    try {
        const { organizationId, year } = req.body;
        const adminId = req.userId; // Admin ID who performs the deletion

        if (!organizationId || !year) {
            return res.status(400).json({ error: 'Organization ID and Year are required.' });
        }

        // Fetch organization details
        const [organizationResult] = await db.query(`
            SELECT name, email FROM organizations WHERE id = ?
        `, [organizationId]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ error: 'Organization not found.' });
        }

        const { name: organizationName, email: organizationEmail } = organizationResult[0];

        // Fetch semester details
        const [semesterResult] = await db.query(`
            SELECT id, name FROM semesters WHERE year = ?
        `, [year]);

        if (semesterResult.length === 0) {
            return res.status(404).json({ error: 'Semester not found.' });
        }

        const { id: semesterId, name: semesterName } = semesterResult[0];

        // Fetch admin details
        const [adminResult] = await db.query(`
            SELECT firstname, middlename, lastname FROM admins WHERE id = ?
        `, [adminId]);

        if (adminResult.length === 0) {
            return res.status(404).json({ error: 'Admin not found.' });
        }

        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        // Delete from organizations_year
        await db.query('DELETE FROM organizations_year WHERE organization_id = ? AND year = ?', [organizationId, year]);

        // Update organization status to "Not Activated"
        await db.query('UPDATE organizations SET status = "Not Activated" WHERE id = ?', [organizationId]);

        // Add history logging
        const action = `Removed from the academic year "${year}"`;
        const logQuery = `
            INSERT INTO organizations_logs (organization_id, action, status, semester_id, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.query(logQuery, [organizationId, action, 'Not Activated', semesterId, adminId]);

        // Send email notification
        await sendOrganizationStatusEmailDelete(organizationEmail, organizationName, semesterName, 'Not Activated', adminFullName);

        res.status(200).json({ message: 'Organization removed from academic year, status updated, log recorded, and email sent successfully.' });
    } catch (error) {
        console.error("Error deleting organization year:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};



exports.addPaymentComment = async (req, res) => {
    const adviserId = req.AdviserID;
    const { paymentId, comment } = req.body;

    if (!paymentId || !comment) {
        return res.status(400).json({ success: false, message: 'Payment ID and comment are required.' });
    }

    try {
        // Insert comment into payments_comments
        const query = `INSERT INTO payments_comments (payment_id, adviser_by, comment) VALUES (?, ?, ?)`;
        await db.query(query, [paymentId, adviserId, comment]);

        // Log the comment in payment_logs
        const action = `Adviser commented on payment`;
        await db.query(
            `INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by) VALUES (?, 'Commented', ?, 'None', ?)`,
            [paymentId, action, adviserId]
        );

        // Update payments table to notify the organization
        await db.query(`UPDATE payments SET comment_status = 'New comments' WHERE id = ?`, [paymentId]);

        res.status(201).json({ success: true, message: 'Comment added successfully.' });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getPaymentComments = async (req, res) => {
    const { paymentId } = req.params;

    try {
        const query = `
            SELECT 
                pc.id, 
                pc.comment, 
                pc.created_at, 
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name
            FROM payments_comments pc
            LEFT JOIN users u ON pc.adviser_by = u.id
            WHERE pc.payment_id = ?
            ORDER BY pc.created_at DESC;
        `;

        const [comments] = await db.query(query, [paymentId]);

        // If comments exist, mark them as read in the payments table
        if (comments.length > 0) {
            await db.query(`UPDATE payments SET comment_status = 'Already read' WHERE id = ?`, [paymentId]);
        }

        res.status(200).json({ success: true, comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


exports.updateOrganizationFeesPriceFees = async (req, res) => {
    const orgUserId = req.orgIduser; // Extracted from the token
    const { paymentId, fees, adviser_by } = req.body; // Ensure adviser_by is extracted

    if (!paymentId || !fees || !Array.isArray(fees)) {
        return res.status(400).json({ success: false, message: 'Invalid payment ID or fees data.' });
    }

    try {
        // Calculate the total price from fees
        const totalPrice = fees.reduce((total, fee) => total + parseFloat(fee.price || 0), 0);

        // Initialize fieldsToUpdate as a modifiable variable
        let fieldsToUpdate = fees
            .map((fee, index) => `fees${index + 1} = ?, pricefees${index + 1} = ?`)
            .join(', ');
        const values = fees.flatMap(fee => [fee.name, fee.price]);

        // Ensure to reset fields not included in the current update
        for (let i = fees.length + 1; i <= 5; i++) {
            fieldsToUpdate += `, fees${i} = NULL, pricefees${i} = NULL`;
        }

        // Add the total price to the fieldsToUpdate and query values
        fieldsToUpdate += `, price = ?, priceandfees_status = 'New prices and fees'`;
        values.push(totalPrice);

        // Add paymentId and orgUserId to the query parameters
        values.push(paymentId);

        const query = `
            UPDATE payments
            SET ${fieldsToUpdate}
            WHERE id = ?;
        `;

        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'Failed to update fees or payment not found.' });
        }

        // Handle `adviser_by` properly
        const adviserByValue = adviser_by && adviser_by !== 'None' ? adviser_by : null;

        const action = `Fees and prices were updated by Organization`;
        await db.query(
            `INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by, organization_by)
            VALUES (?, 'Updated', ?, 'None', ?, ? )`,
            [paymentId, action, adviserByValue, orgUserId]
        );

        res.status(200).json({ success: true, message: 'Fees and total price updated successfully.' });
    } catch (error) {
        console.error('Error updating fees and prices:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


// Mark as "Already seen" when viewing payment details
exports.markPricesFeesAsSeen = async (req, res) => {
    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ success: false, message: 'Payment ID is required.' });
    }

    try {
        await db.query(`UPDATE payments SET priceandfees_status = 'Already seen' WHERE id = ?`, [paymentId]);
        res.status(200).json({ success: true, message: 'Price and fees status updated to Already seen.' });
    } catch (error) {
        console.error('Error updating price and fees status:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getTransactionsByOrganizations = async (req, res) => {
    try {
        const organizationId = req.userId;

        const query = `
            SELECT 
                t.id,
                t.user_id,
                t.payment_id,
                t.transaction_id,
                t.payment_status,
                t.payment_method,
                t.total_amount,
                t.balance,
                t.promissory_note,
                t.proof_of_payment,
                t.created_at,
                t.received_by,
                p.name AS payment_name,
                p.price AS payment_price,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS received_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name
            FROM 
                transactions t
            LEFT JOIN 
                payments p ON t.payment_id = p.id
            LEFT JOIN 
                organizations o ON p.organization_id = o.id
            LEFT JOIN 
                organizations_users ou ON t.received_by = ou.id
            LEFT JOIN 
                users u ON t.user_id = u.id
            WHERE 
                o.id = ?
            ORDER BY 
                t.created_at DESC;
        `;

        const [transactions] = await db.query(query, [organizationId]);
        res.status(200).json({ transactions });
    } catch (error) {
        console.error('Error fetching transactions by organization:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getAllTransactions = async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id,
                t.user_id,
                t.payment_id,
                t.transaction_id,
                t.payment_status,
                t.payment_method,
                t.total_amount,
                t.balance,
                t.promissory_note,
                t.proof_of_payment,
                t.created_at,
                t.received_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS received_by_name,
                p.name AS payment_name,
                p.price AS payment_price
            FROM 
                transactions t
            LEFT JOIN 
                users u ON t.user_id = u.id
            LEFT JOIN 
                organizations_users ou ON t.received_by = ou.id
            LEFT JOIN 
                payments p ON t.payment_id = p.id
            ORDER BY 
                t.created_at DESC;
        `;

        const [transactions] = await db.query(query);
        res.status(200).json({ transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getTransactionReports = async (req, res) => {
    try {
        const organizationId = req.userId; // Get organization ID from the authenticated user

        const query = `
            SELECT 
                tr.id, 
                tr.transaction_id, 
                tr.reported_by, 
                tr.reason, 
                tr.description, 
                tr.created_at, 
                CONCAT(u.firstname, ' ', u.lastname) AS reported_by_name,
                t.payment_id, 
                p.name AS payment_name,
                CONCAT(us.firstname, ' ', us.middlename, ' ', us.lastname) AS user_full_name -- Get user's full name
            FROM 
                transactions_reports tr
            LEFT JOIN transactions t ON tr.transaction_id = t.transaction_id
            LEFT JOIN payments p ON t.payment_id = p.id
            LEFT JOIN organizations_users u ON tr.reported_by = u.id
            LEFT JOIN users us ON t.user_id = us.id -- Join with users table to get user details
            WHERE p.organization_id = ? -- Filter by organization ID
            ORDER BY tr.created_at DESC;
        `;

        const [reports] = await db.query(query, [organizationId]); // Pass the organization ID as a parameter
        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching transaction reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTransactionReportsAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ error: 'Adviser ID is required.' });
        }

        // ✅ Fetch adviser's assigned organizations and semesters (All years)
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ error: 'No organization logs found for the adviser.' });
        }

        // ✅ Prepare organization IDs and semester IDs for query
        const organizationsSemesters = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            semester_id: log.semester_id
        }));

        // ✅ Query to fetch transaction reports based on adviser's assigned organizations & semesters
        const query = `
            SELECT 
                tr.id, 
                tr.transaction_id, 
                tr.reported_by, 
                tr.reason, 
                tr.description, 
                tr.created_at, 
                CONCAT(u.firstname, ' ', u.lastname) AS reported_by_name,
                t.payment_id, 
                p.name AS payment_name,
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year,
                CONCAT(us.firstname, ' ', us.middlename, ' ', us.lastname) AS user_full_name -- Get user's full name
            FROM transactions_reports tr
            LEFT JOIN transactions t ON tr.transaction_id = t.transaction_id
            LEFT JOIN payments p ON t.payment_id = p.id
            LEFT JOIN organizations org ON p.organization_id = org.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users u ON tr.reported_by = u.id
            LEFT JOIN users us ON t.user_id = us.id -- Join with users table to get user details
            WHERE (${organizationsSemesters.map(() => '(p.organization_id = ? AND p.semester_id = ?)').join(' OR ')})
            ORDER BY tr.created_at DESC;
        `;

        // ✅ Prepare parameters for query
        const queryParams = organizationsSemesters.flatMap(({ organizations_id, semester_id }) => [organizations_id, semester_id]);

        // ✅ Execute query
        const [reports] = await db.query(query, queryParams);

        if (reports.length === 0) {
            return res.status(200).json({ message: 'No transaction reports available' });
        }

        res.status(200).json(reports);
    } catch (error) {
        console.error('Error fetching transaction reports for adviser:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};



exports.getAllProductTransactionReportsAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ error: 'Adviser ID is required.' });
        }

        // ✅ Fetch adviser's assigned organizations and semesters (All years)
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ error: 'No organization logs found for the adviser.' });
        }

        // ✅ Prepare organization IDs and semester IDs for query
        const organizationIds = adviserLogs.map(log => log.organizations_id);
        const semesterIds = adviserLogs.map(log => log.semester_id);

        // ✅ Query to fetch product transaction reports based on adviser's assigned organizations & semesters
        const query = `
            SELECT 
                ptr.id,
                ptr.user_id,
                ptr.order_transaction_id,
                ptr.created_by,
                ptr.reasons,
                ptr.comments,
                ptr.status,
                ptr.created_at,

                -- User details
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,

                -- Admin (Created by) details
                a.firstname AS admin_firstname,
                a.middlename AS admin_middlename,
                a.lastname AS admin_lastname,

                -- Organization and Semester details
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year

            FROM product_transaction_reports ptr
            JOIN product_transaction pt ON ptr.order_transaction_id = pt.order_transaction_id
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON pt.semester_id = s.id
            LEFT JOIN users u ON ptr.user_id = u.id
            LEFT JOIN organizations_users a ON ptr.created_by = a.id
            WHERE p.organization_id IN (?) AND pt.semester_id IN (?)
            ORDER BY ptr.created_at DESC
        `;

        // ✅ Execute query with proper parameters
        const [reports] = await db.query(query, [organizationIds, semesterIds]);

        if (reports.length === 0) {
            return res.status(200).json({ message: 'No product transaction reports available' });
        }

        res.status(200).json({ success: true, reports });
    } catch (error) {
        console.error('Error fetching product transaction reports for adviser:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getAllProductTransactionsBySemesterAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ success: false, message: 'Adviser ID is required.' });
        }

        // ✅ Fetch adviser's assigned organizations and semesters
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'No organization logs found for the adviser.' });
        }

        // ✅ Prepare organization IDs and semester IDs for query
        const organizationsSemesters = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            semester_id: log.semester_id
        }));

        // ✅ Query to fetch total payments grouped by semester & organization
        const query = `
            SELECT 
                s.id AS semester_id,
                s.name AS semester_name,
                s.year AS semester_year,
                org.name AS organization_name,
                IFNULL(SUM(pt.total_pay), 0) AS total_pay
            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON pt.semester_id = s.id
            WHERE (${organizationsSemesters.map(() => '(p.organization_id = ? AND pt.semester_id = ?)').join(' OR ')})
            GROUP BY s.id, s.name, s.year, org.name
            ORDER BY s.year DESC, org.name ASC;
        `;

        // ✅ Prepare parameters for query
        const queryParams = organizationsSemesters.flatMap(({ organizations_id, semester_id }) => [organizations_id, semester_id]);

        // ✅ Execute query
        const [transactions] = await db.query(query, queryParams);

        if (transactions.length === 0) {
            return res.status(200).json({ message: 'No product transactions found for this adviser.' });
        }

        res.status(200).json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching total product transactions by semester for adviser:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};



const { sendTransactionReportEmail } = require('../config/sendEmail'); // Import email function

exports.addTransactionReport = async (req, res) => {
    const { transaction_id, reason, description } = req.body;
    const reported_by = req.orgIduser; // Assume user ID comes from middleware

    if (!transaction_id || !reason) {
        return res.status(400).json({ success: false, message: "Transaction ID and reason are required." });
    }

    try {
        // Fetch transaction details
        const [transactionResult] = await db.query(`
            SELECT t.user_id, t.payment_id, u.firstname AS user_firstname, u.middlename AS user_middlename, u.lastname AS user_lastname, u.email
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.transaction_id = ?
        `, [transaction_id]);

        if (transactionResult.length === 0) {
            return res.status(404).json({ success: false, message: "Transaction not found." });
        }

        const transaction = transactionResult[0];
        const userFullName = [transaction.user_firstname, transaction.user_middlename, transaction.user_lastname]
            .filter(name => name && name.trim() !== '')
            .join(' ');

        const userEmail = transaction.email;

        // Fetch organization user details
        const [orgUserResult] = await db.query(`
            SELECT firstname FROM organizations_users WHERE id = ?
        `, [reported_by]);

        if (orgUserResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization user not found." });
        }

        const orgUserFullName = orgUserResult[0].firstname;

        // Fetch organization name
        const [organizationResult] = await db.query(`
            SELECT o.name AS organization_name
            FROM payments p
            JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = ?
        `, [transaction.payment_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const organizationName = organizationResult[0].organization_name;

        // Insert transaction report
        await db.query(`
            INSERT INTO transactions_reports (transaction_id, reported_by, reason, description)
            VALUES (?, ?, ?, ?)
        `, [transaction_id, reported_by, reason, description]);

        // Send email notification
        sendTransactionReportEmail(userEmail, userFullName, orgUserFullName, organizationName, reason, description,transaction_id);

        res.status(201).json({ success: true, message: "Transaction report added successfully and email sent." });
    } catch (error) {
        console.error("Error adding transaction report:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

exports.getReportsByOrg = async (req, res) => {
    const orgId = req.userId; // Assuming userId corresponds to organization_id in the organizations table

    try {
        const query = `
    SELECT 
        gor.id AS report_id,
        o.id AS order_id,
        o.status AS order_status,
        o.created_at AS order_created_at,
        org.name AS organization_name,
        gor.reason,
        gor.description,
        gor.created_at AS report_created_at,
        CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name,
        CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_reported_by_name
    FROM 
        gcashorder_reports gor
    LEFT JOIN gcashorder o ON gor.order_id = o.id
    LEFT JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN admins a ON gor.reported_by_admin = a.id
    LEFT JOIN users u ON gor.reported_by = u.id
    WHERE org.id = ?
    ORDER BY gor.created_at DESC;
`;


        const [reports] = await db.query(query, [orgId]);

        if (reports.length === 0) {
            return res.status(404).json({ success: false, message: 'No reports found for this organization' });
        }

        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

exports.checkOrderStatusAndMessage = async (req, res) => {
    const userId = req.userId;  // Get user_id from authenticated user

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    try {
        // Query to get all orders for this user
        const orderQuery = `SELECT order_transaction_id, order_status FROM product_transaction WHERE user_id = ?`;
        const [orderResult] = await db.query(orderQuery, [userId]);

        if (orderResult.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found for this user' });
        }

        const matchingOrders = [];

        // Iterate through each order to check if any match with 'Not yet received' and a message
        for (let order of orderResult) {
            const { order_transaction_id, order_status } = order;

            if (order_status === 'Not yet received') {
                // If order status is 'Not yet received', check for related messages
                const messageQuery = `
    SELECT om.*, ou.firstname, ou.lastname 
    FROM organization_messages om
    JOIN organizations_users ou ON om.sent_by = ou.id
    WHERE om.order_transaction_id = ? AND om.user_id = ? 
    ORDER BY om.created_at DESC
`;

                const [messageResult] = await db.query(messageQuery, [order_transaction_id, userId]);

                if (messageResult.length > 0) {
                    // Found a message for the matching order
                    matchingOrders.push({
                        orderStatus: order_status,
                        message: messageResult[0].message,
                        organization_id: messageResult[0].sent_by,
                        order_transaction_id,
                        organization_name: `${messageResult[0].firstname} ${messageResult[0].lastname}`,
                    });
                }
            }
        }

        // If there are matching orders with 'Not yet received' and messages
        if (matchingOrders.length > 0) {
            return res.status(200).json({
                success: true,
                orders: matchingOrders,
            });
        } else {
            return res.status(200).json({ success: false, message: 'No matching orders or messages found' });
        }

    } catch (error) {
        console.error('Error checking order status and messages:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

  


exports.validateCurrentPassword = async (req, res) => {
    const { currentPassword } = req.body;
    const userId = req.userId; // Extracted from middleware

    try {
        // Fetch user data
        const [result] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        if (result.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = result[0];

        // Verify the provided current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, msg: 'Current password is incorrect' });
        }

        // If validation is successful
        return res.status(200).json({ success: true, msg: 'Current password is correct' });
    } catch (error) {
        console.error('Error validating current password:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};


const { SendmarkOrderReceived } = require('../config/SendOrganizationEmail'); // Import mail service

exports.markOrderReceived = async (req, res) => {
    const { order_transaction_id } = req.body;
    const orgUserId = req.orgIduser; // Organization user ID

    if (!order_transaction_id) {
        return res.status(400).json({ success: false, message: 'Order Transaction ID is required' });
    }

    try {
        // Step 1: Retrieve order details
        const getOrderQuery = `
            SELECT pt.*, u.email, u.firstname, u.middlename, u.lastname
            FROM product_transaction pt
            JOIN users u ON pt.user_id = u.id  -- ✅ Fixed user column
            WHERE pt.order_transaction_id = ?
        `;
        const [orderDetails] = await db.query(getOrderQuery, [order_transaction_id]);

        if (orderDetails.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const order = orderDetails[0]; // Get first row
        const { user_id, email, firstname, middlename, lastname, total_amount, total_pay, payment_method, status, accepted_by } = order;
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;
        const actionMessage = 'Order item received';

        // Step 2: Fetch organization and org user details
        const [organizationResult] = await db.query(`
            SELECT name FROM organizations
            WHERE id = (SELECT organization_id FROM products WHERE product_id =
            (SELECT product_id FROM product_transaction_final_order WHERE order_transaction_id = ? LIMIT 1))
        `, [order_transaction_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ message: "Organization not found." });
        }
        const { name: organizationName } = organizationResult[0];

        const [orgUserResult] = await db.query(`
            SELECT firstname FROM organizations_users WHERE id = ?
        `, [orgUserId]);

        if (orgUserResult.length === 0) {
            return res.status(404).json({ message: "Organization user not found." });
        }
        const { firstname: orgUserFullName } = orgUserResult[0];

        // Step 3: Fetch ordered items
        const [orderedItems] = await db.query(`
            SELECT p.name, f.quantity, f.smallquantity, f.mediumquantity, f.largequantity, f.xlargequantity
            FROM product_transaction_final_order f
            JOIN products p ON f.product_id = p.product_id
            WHERE f.order_transaction_id = ?
        `, [order_transaction_id]);

        let orderDetailsHtml = orderedItems.length
            ? orderedItems.map(({ name, quantity, smallquantity, mediumquantity, largequantity, xlargequantity }) => {
                let items = [];
                if (quantity > 0) items.push(`${quantity}x ${name}`);
                if (smallquantity > 0) items.push(`${smallquantity}x Small ${name}`);
                if (mediumquantity > 0) items.push(`${mediumquantity}x Medium ${name}`);
                if (largequantity > 0) items.push(`${largequantity}x Large ${name}`);
                if (xlargequantity > 0) items.push(`${xlargequantity}x X-Large ${name}`);
                return `<p style="text-align: center;">- ${items.join(', ')}</p>`;
            }).join('')
            : '<p style="text-align: center;">No items ordered.</p>';

        // Step 4: Update order status
        const updateOrderQuery = `
            UPDATE product_transaction
            SET order_status = 'Order received', updated_at = NOW()
            WHERE order_transaction_id = ?
        `;
        const [updateResult] = await db.query(updateOrderQuery, [order_transaction_id]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Step 5: Log order status update
        const logQuery = `
            INSERT INTO product_transaction_logs
            (user_id, order_transaction_id, action_message, status, order_status, payment_method, total_amount, total_pay, accepted_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [
            user_id,
            order_transaction_id,
            actionMessage,
            status,
            'Order received',
            payment_method,
            total_amount,
            total_pay,
            accepted_by
        ]);

        // Step 6: Send email notification to the user
        await SendmarkOrderReceived(email, userFullName, order_transaction_id, organizationName, total_amount, total_pay, payment_method, orgUserFullName, orderDetailsHtml);

        // Step 7: Respond with success
        res.status(200).json({ success: true, message: 'Order marked as received successfully, and email notification sent' });

    } catch (error) {
        console.error('Error marking order as received:', error);
        res.status(500).json({ success: false, message: 'Error marking order as received' });
    }
};




const { sendOrderMessageEmail } = require('../config/sendEmail'); // Import email function

exports.sendMessage = async (req, res) => {
    const { user_id, message, order_transaction_id } = req.body;
    const sent_by = req.orgIduser; // Organization user ID from the request

    if (!user_id || !message || !order_transaction_id) {
        return res.status(400).json({ success: false, message: "User ID, Message, and Order Transaction ID are required" });
    }

    try {
        // Fetch organization name based on `order_transaction_id`
        const [orgResult] = await db.query(`
            SELECT o.id AS organization_id, o.name AS organization_name
            FROM product_transaction_final_order pfo
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations o ON p.organization_id = o.id
            WHERE pfo.order_transaction_id = ?
        `, [order_transaction_id]);

        if (orgResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found for this transaction." });
        }

        const organization = orgResult[0];

        // Fetch user details (Full Name & Email)
        const [userResult] = await db.query(`
            SELECT firstname, middlename, lastname, email FROM users WHERE id = ?
        `, [user_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const user = userResult[0];
        const userFullName = [user.firstname, user.middlename, user.lastname]
            .filter(name => name && name.trim() !== '')
            .join(' ');

        const userEmail = user.email;

        // Fetch sender details (Organization User Firstname)
        const [orgUserResult] = await db.query(`
            SELECT firstname FROM organizations_users WHERE id = ?
        `, [sent_by]);

        if (orgUserResult.length === 0) {
            return res.status(404).json({ success: false, message: "Organization user not found." });
        }

        const sentByName = orgUserResult[0].firstname;

        // Insert message into `organization_messages`
        const query = `
            INSERT INTO organization_messages (user_id, sent_by, message, order_transaction_id, status)
            VALUES (?, ?, ?, ?, 'sent')
        `;
        await db.query(query, [user_id, sent_by, message, order_transaction_id]);

        // Send email notification
        sendOrderMessageEmail(userEmail, userFullName, organization.organization_name, sentByName, message);

        res.status(200).json({ success: true, message: "Message sent successfully and email notification sent." });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};





exports.getAllLogs = async (req, res) => {
    try {
        const userId = req.userId;

        // Single query combining logs from all tables
        const combinedLogsQuery = `
            SELECT 
                id, 
                user_id, 
                action, 
                NULL AS action_message, 
                NULL AS status, 
                NULL AS order_transaction_id, 
                NULL AS payment_method, 
                NULL AS transaction_id, 
                NULL AS total_amount, 
                NULL AS balance, 
                NULL AS proof_of_payment, 
                NULL AS order_status,
                created_at
            FROM user_logs
            WHERE user_id = ?

            UNION ALL

            SELECT 
                id, 
                user_id, 
                NULL AS action, 
                action_message, 
                status, 
                order_transaction_id, 
                payment_method, 
                NULL AS transaction_id, 
                total_amount, 
                NULL AS balance, 
                proof_of_payment, 
                order_status,
                created_at
            FROM product_transaction_logs
            WHERE user_id = ?

            UNION ALL

            SELECT 
                id, 
                user_id, 
                action, 
                NULL AS action_message, 
                payment_status AS status, 
                NULL AS order_transaction_id, 
                payment_method, 
                transaction_id, 
                total_amount, 
                balance, 
                proof_of_payment, 
                NULL AS order_status,
                created_at
            FROM transactions_history
            WHERE user_id = ?

            ORDER BY created_at DESC;
        `;

        // Execute the query
        const [combinedLogs] = await db.query(combinedLogsQuery, [userId, userId, userId]);

        // Return the logs
        return res.status(200).json({
            success: true,
            logs: combinedLogs
        });

    } catch (error) {
        console.error("Error fetching logs:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};



  

const { sendotpusersforgotpassword } = require('../config/sendEmailusers');

exports.verifyUser = async (req, res) => {
    const { email } = req.body;  // Only using email for verification

    try {
        // Query to find user by email
        const [result] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        // Check if the user exists
        if (result.length === 0) {
            return res.status(400).json({ msg: 'User not found' });
        }

        // Generate a new OTP for password reset
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP in the database
        await db.query('UPDATE users SET otp = ?, otp_sent_at = ? WHERE email = ?', [
            otp,
            new Date(),
            email,
        ]);

        // Fetch user details
        const user = result[0];
        const userFullName = `${user.firstname} ${user.middlename} ${user.lastname}`;

        // Send OTP email
        await sendotpusersforgotpassword(email, otp, userFullName);

        // Respond with success message
        return res.status(200).json({
            success: true,
            msg: 'OTP has been sent to your email. Please check your inbox.',
        });

    } catch (err) {
        console.error('Error sending OTP for password reset:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};


exports.forgotpasswordotpverified = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Check if user exists
        const [userResult] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userResult.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = userResult[0];

        // Check if OTP is valid
        if (user.otp !== otp) {
            // Increment failed attempts
            await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = ?', [email]);

            // Check if failed attempts exceed 5
            if (user.otp_attempts + 1 >= 5) {
                return res.status(429).json({ success: false, msg: 'Too many incorrect attempts. Try again later.' });
            }

            return res.status(400).json({ success: false, msg: 'Invalid OTP. Please try again.' });
        }

        // OTP is valid, reset attempts and issue JWT
        await db.query('UPDATE users SET otp_attempts = 0 WHERE email = ?', [email]);

        const token = jwt.sign({ id: user.id }, 'jwtSecret', { expiresIn: '8h' });

        return res.status(200).json({ success: true, token });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

exports.forgotpasswordresend = async (req, res) => {
    const { email } = req.body;

    try {
        // Check if user exists
        const [userResult] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userResult.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = userResult[0];  // ✅ Fixed variable name
        const userFullName = `${user.firstname} ${user.middlename ? user.middlename + ' ' : ''}${user.lastname}`;

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Update OTP in database
        await db.query('UPDATE users SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [
            otp,
            new Date(),
            email,
        ]);

        // Send OTP via email
        await sendotpusersforgotpassword(email, otp, userFullName);

        return res.status(200).json({ success: true, msg: 'OTP has been resent. Please check your email.' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};


  
  exports.changePassworduser = async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.userId;  // Retrieve userId from the request object
  
    if (!userId) {
        return res.status(400).json({ msg: 'User ID is missing' });
    }
  
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
  
        // Update password in the database for the logged-in user
        const [result] = await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
  
        if (result.affectedRows === 0) {
            return res.status(400).json({ msg: 'Error updating password' });
        }

        // Log the password change action in the user_logs table with created_by as null
        const logQuery = 'INSERT INTO user_logs (user_id, action, created_by, created_at) VALUES (?, ?, ?, NOW())';
        await db.query(logQuery, [userId, 'Forgot Password Success', null]);

        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

  


const announcementStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Define directory path based on organization_id
      const organizationId = req.userId; // Organization ID from JWT (assumed userId)
      const dir = `uploads/announcements/${organizationId}`;
  
      // Create directory if it doesn't exist
      fs.mkdirSync(dir, { recursive: true });
  
      // Use the organization-specific directory
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const fileName = Date.now() + path.extname(file.originalname);
      cb(null, fileName);
    }
  });
  
  // Multer middleware for file upload
  const uploadAnnouncement = multer({ storage: announcementStorage });
  
  // Add announcement handler
  exports.addAnnouncement = [
    uploadAnnouncement.single('announcementpicture'),
    async (req, res) => {
      const { description } = req.body;
      const organizationId = req.userId; // Organization ID from JWT (assumed userId)
      const orgUserId = req.orgIduser; // Created by (organization user)
  
      // If a picture is uploaded, the filename will be in req.file
      const announcementPicture = req.file ? req.file.filename : null;
  
      const query = `
        INSERT INTO announcement (announcementpicture, description, organization_id, created_by)
        VALUES (?, ?, ?, ?)
      `;
  
      db.query(query, [announcementPicture, description, organizationId, orgUserId], (err, result) => {
        if (err) {
          console.error('Error adding announcement:', err);
          return res.status(500).send('Error adding announcement');
        }
        res.status(201).send('Announcement added successfully');
      });
    }
  ];
  // Get all announcements function
  exports.getAnnouncements = async (req, res) => {
    const organizationId = req.userId;  // Assuming organization_id is available in req.userId
    
    try {
      const [results] = await db.query(
        `SELECT * FROM announcement 
         WHERE id IN (
           SELECT MAX(id) 
           FROM announcement 
           WHERE organization_id = ? 
           GROUP BY organization_id
         )`, [organizationId]
      );  // Execute query with organization_id filter and subquery to fetch the latest announcement
      
      if (results.length === 0) {
        return res.status(404).send('No announcements found for this organization');
      }
  
      res.status(200).json(results);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      res.status(500).send('Error fetching announcements');
    }
  };
  exports.getAnnouncementsMobile = async (req, res) => {
    try {
        // Query to get the latest announcements for each organization
        const [results] = await db.query(`
            SELECT * 
            FROM announcement 
            WHERE id IN (
                SELECT MAX(id) 
                FROM announcement 
                GROUP BY organization_id 
            )
            ORDER BY created_at DESC
        `);
        

        // Map over the results to add the full URL for announcement pictures
        const announcementsWithImageUrl = results.map(announcement => {
            const announcementImageUrl = `https://utterly-stable-arachnid.ngrok-free.app/uploads/announcements/${announcement.organization_id}/${announcement.announcementpicture}`;
            return {
                ...announcement,
                announcementpictureUrl: announcementImageUrl,  // Add the full URL for the announcement picture
            };
        });

        // Send the response with the updated data
        res.status(200).json(announcementsWithImageUrl);
    } catch (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).send('Error fetching announcements');
    }
};

  
  
  
exports.changePassword = async (req, res) => {
    const { newPassword } = req.body;  // Only new password is needed
    const userId = req.userId; // User ID from the auth middleware

    // Check if new password is provided
    if (!newPassword) {
        return res.status(400).json({ success: false, msg: 'New password is required' });
    }

    try {
        // Fetch the user data from the database
        const userQuery = 'SELECT * FROM users WHERE id = ?';
        const [user] = await db.query(userQuery, [userId]);

        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
        await db.query(updateQuery, [hashedPassword, userId]);

        // Log the password change in the user_logs table with `created_by` as null
        const logQuery = 'INSERT INTO user_logs (user_id, action, created_by, created_at) VALUES (?, ?, ?, NOW())';
        await db.query(logQuery, [userId, 'Password Changed', null]);

        // Return success response
        return res.status(200).json({ success: true, msg: 'Password changed successfully' });

    } catch (error) {
        console.error('Error changing password:', error);
        // Return a server error message
        return res.status(500).json({ success: false, msg: 'Failed to change password' });
    }
};




exports.getGcashOrdersMobile = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT 
                go.id, 
                go.qrcodepicture, 
                go.gcashnumber, 
                go.organization_id AS gcashorganization_id, 
                go.created_by, 
                o.name AS organization_name, 
                ou.firstname AS created_by_name
            FROM gcashorder go
            JOIN organizations o ON go.organization_id = o.id
            JOIN organizations_users ou ON go.created_by = ou.id
            JOIN product_transaction_final_order ptfo ON ptfo.order_transaction_id = go.id
            JOIN products p ON ptfo.product_id = p.product_id
            WHERE go.id IN (
                SELECT MAX(id) 
                FROM gcashorder 
                GROUP BY go.organization_id
            )
            AND go.organization_id = p.organization_id
        `);

        if (results.length === 0) {
            return res.status(404).json({ msg: 'No GCash orders found' });
        }

        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching GCash orders:', error);
        res.status(500).json({ msg: 'Failed to fetch GCash orders' });
    }
};


const gcashStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Define directory path based on organization_id
        const organizationId = req.userId; // Organization ID from JWT (assumed userId)
        const dir = `uploads/gcashorders/${organizationId}`;
    
        // Create directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
    
        // Use the organization-specific directory
        cb(null, dir);
      },
      filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname);
        cb(null, fileName);
      }
});

// Multer upload middleware
const gcashUpload = multer({ storage: gcashStorage });

// Insert GCash Order
exports.insertGcashOrder = async (req, res) => {
    const organizationId = req.userId; // Assume from middleware
    const orgUserId = req.orgIduser;   // Assume from middleware
    const qrcodepicture = req.file;

    if (!qrcodepicture) {
        return res.status(400).json({ msg: 'QR code picture is required' });
    }

    try {
        // Fetch organization name
        const [orgResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
        if (!orgResult.length) {
            return res.status(400).json({ msg: 'Organization not found' });
        }
        const organizationName = orgResult[0].name;

        // Fetch organization user's name and position
        const [orgUserResult] = await db.query(
            `SELECT firstname, lastname, position FROM organizations_users WHERE id = ?`,
            [orgUserId]
        );
        if (!orgUserResult.length) {
            return res.status(400).json({ msg: 'Organization user not found' });
        }
        const { firstname, lastname, position } = orgUserResult[0];
        const orgUserFolder = `${firstname}_${lastname}_${position}`;

        // Generate a unique filename for the QR code picture
        const uniqueFilename = `${uuidv4()}${path.extname(qrcodepicture.originalname)}`;

        // Read the file content from disk
        const filePathOnDisk = path.resolve(qrcodepicture.path);
        const fileContent = fs.readFileSync(filePathOnDisk);

        // Initialize Dropbox
        const dropbox = await initializeDropbox();
        if (!dropbox) {
            throw new Error('Failed to initialize Dropbox.');
        }

        // Create a folder in Dropbox for the organization and user
        const folderPath = `/uploads/${organizationName}/QRCODESCREATEORDERS/${orgUserFolder}`;

        // Check if folder exists before creating it
        try {
            await dropbox.filesGetMetadata({ path: folderPath });
        } catch (error) {
            if (error.status === 409) {
                console.log(`Folder "${folderPath}" already exists. Proceeding...`);
            } else {
                console.log(`Creating folder: ${folderPath}`);
                await dropbox.filesCreateFolderV2({ path: folderPath });
            }
        }

        // Upload file to the Dropbox folder
        const dropboxPath = `${folderPath}/${uniqueFilename}`;
        console.log(`Uploading file to Dropbox at: ${dropboxPath}`);

        const dropboxUploadResponse = await dropbox.filesUpload({
            path: dropboxPath,
            contents: fileContent,
            mode: { ".tag": "overwrite" } // Ensures file gets replaced if it exists
        });

        // Generate shared link for the uploaded file
        let dropboxSharedLink;
        try {
            const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                path: dropboxUploadResponse.result.path_display,
            });
            dropboxSharedLink = sharedLinkResponse.result?.url.replace('dl=0', 'raw=1');
        } catch (err) {
            console.log('Error creating shared link, trying existing link...');
            const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
            if (existingLinks.result.links.length > 0) {
                dropboxSharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
            } else {
                throw new Error('Failed to generate shared link');
            }
        }

        // Fetch the latest semester ID
        const [semesterResult] = await db.query('SELECT id FROM semesters ORDER BY created_at DESC LIMIT 1');
        if (!semesterResult.length) {
            return res.status(400).json({ msg: 'No active semester found' });
        }
        const latestSemesterId = semesterResult[0].id;

        // Insert data into the database
        const query = `
            INSERT INTO gcashorder (qrcodepicture, organization_id, created_by, semester_id)
            VALUES (?, ?, ?, ?)
        `;
        await db.query(query, [dropboxSharedLink, organizationId, orgUserId, latestSemesterId]);

        res.status(200).json({ msg: 'GCash order created successfully', qrcode: dropboxSharedLink });

        // Remove file from local storage after upload
        fs.unlinkSync(filePathOnDisk);
        
    } catch (error) {
        console.error('Error inserting GCash order:', error);
        res.status(500).json({ msg: 'Failed to create GCash order' });
    }
};



// Get All GCash Orders
exports.getGcashOrders = async (req, res) => {
    const organizationId = req.userId; // Getting organizationId from middleware

    try {
        const [results] = await db.query(`
            SELECT 
                go.id, 
                go.qrcodepicture, 
                go.organization_id, 
                go.created_at,
                go.created_by, 
                go.adviser_status,
                go.adviser_by,
                go.status,
                go.accepted_by,
                o.name AS organization_name, 
                ou.firstname AS created_by_name
            FROM gcashorder go
            JOIN organizations o ON go.organization_id = o.id
            JOIN organizations_users ou ON go.created_by = ou.id
            WHERE go.organization_id = ?
            ORDER BY go.created_at DESC
        `, [organizationId]); // Use organizationId in the query to filter results

        if (results.length === 0) {
            return res.status(404).json({ msg: 'No GCash orders found for this organization' });
        }

        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching GCash orders:', error);
        res.status(500).json({ msg: 'Failed to fetch GCash orders' });
    }
};

exports.getGcashOrdersall = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT 
                go.id, 
                go.qrcodepicture, 
                go.organization_id, 
                go.created_at,
                go.created_by, 
                go.adviser_status,
                go.adviser_by,
                go.status,
                go.accepted_by,
                o.name AS organization_name, 

                -- Get full name for created_by
                CONCAT(u1.firstname, ' ', COALESCE(u1.middlename, ''), ' ', u1.lastname) AS created_by_name,

                -- Get full name for adviser_by
                CONCAT(u2.firstname, ' ', COALESCE(u2.middlename, ''), ' ', u2.lastname) AS adviser_by_name

            FROM gcashorder go
            JOIN organizations o ON go.organization_id = o.id
            JOIN organizations_users ou ON go.created_by = ou.id
            JOIN users u1 ON ou.user_id = u1.id  -- Join users table to get created_by name
            LEFT JOIN users u2 ON go.adviser_by = u2.id -- Join users table to get adviser_by name

            ORDER BY go.created_at DESC
        `);

        if (results.length === 0) {
            return res.status(404).json({ msg: 'No GCash orders found' });
        }

        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching GCash orders:', error);
        res.status(500).json({ msg: 'Failed to fetch GCash orders' });
    }
};




exports.deleteGcashOrder = async (req, res) => {
    const { id } = req.params; // Extract the order ID from the route parameters

    try {
        // Check if the order exists and has Adviser_status as "Pending"
        const [order] = await db.query(
            'SELECT * FROM gcashorder WHERE id = ? AND adviser_status = ?',
            [id, 'Pending']
        );

        if (!order.length) {
            return res.status(404).json({ msg: 'Order not found or not eligible for deletion.' });
        }

        // Delete the order from the database
        await db.query('DELETE FROM gcashorder WHERE id = ?', [id]);

        return res.status(200).json({ msg: 'Order deleted successfully.' });
    } catch (error) {
        console.error('Error deleting GCash order:', error);
        return res.status(500).json({ msg: 'Failed to delete GCash order.' });
    }
};

// Middleware for GCash upload
exports.gcashUploadMiddleware = gcashUpload.single('qrcodepicture');

const proofOfPaymentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const dir = `uploads/uploadqruser/${userId}/`;

        // Create directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`); // Unique filename
    },
});

const proofOfPaymentUpload = multer({ storage: proofOfPaymentStorage });

// Update Transaction Balance: Handles proof_of_payment file upload
exports.updateTransactionBalanceProof = [
    proofOfPaymentUpload.single('proof_of_payment'),  // Handle single file upload for proof_of_payment
    async (req, res) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { transaction_id } = req.body;
            const userId = req.userId;

            // Check if the transaction exists
            const query = `
                SELECT 
                    t.transaction_id,
                    t.payment_id,
                    t.payment_status,
                    t.payment_method,
                    t.total_amount,
                    t.balance,
                    t.promissory_note,
                    t.proof_of_payment,
                    t.created_at,
                    t.received_by
                FROM transactions t
                WHERE t.transaction_id = ? AND t.user_id = ?
            `;
            const params = [transaction_id, userId];

            const [transaction] = await db.execute(query, params);
            if (transaction.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            // Fetch payment details
            const [paymentDetails] = await db.query('SELECT organization_id, name FROM payments WHERE id = ?', [transaction[0].payment_id]);
            if (!paymentDetails.length) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            const { organization_id: organizationId, name: paymentName } = paymentDetails[0];

            // Fetch organization name
            const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organizationResult.length) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            const organizationName = organizationResult[0].name;

            // Fetch user details
            const [userResult] = await db.query(
                'SELECT firstname, lastname, middlename FROM users WHERE id = ?',
                [userId]
            );
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            const { firstname, lastname, middlename } = userResult[0];
            const userFolder = `${firstname}_${middlename}_${lastname}`;

            // Generate a unique filename for the proof_of_payment
            const proofOfPaymentFile = req.file;
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(proofOfPaymentFile.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create a folder in Dropbox for the organization, payment, and user
            const folderPath = `/uploads/${organizationName}/Payments/${paymentName}/${userFolder}`;
            try {
                await dropbox.filesCreateFolderV2({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    throw error;
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update transaction with proof_of_payment
            const updateQuery = `
                UPDATE transactions
                SET
                    proof_of_payment = ?, payment_status = 'Pending Balance', payment_method = 'Gcash',
                    updated_at = NOW()
                WHERE
                    transaction_id = ? AND user_id = ?
            `;

            await db.query(updateQuery, [proofOfPaymentLink, transaction_id, userId]);

            // Insert transaction history
            const insertHistoryQuery = `
                INSERT INTO transactions_history (
                    transaction_id,
                    user_id,
                    payment_id,
                    payment_status,
                    payment_method,
                    total_amount,
                    balance,
                    action,
                    promissory_note,
                    proof_of_payment,
                    created_at,
                    received_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            `;

            const insertHistoryParams = [
                transaction_id,
                userId,
                transaction[0].payment_id,
                'Pending Balance',
                'Gcash',
                transaction[0].total_amount,
                transaction[0].balance,
                'New Proof of payment Uploaded',  // Action
                transaction[0].promissory_note,
                proofOfPaymentLink,  // Updated proof_of_payment
                transaction[0].received_by  // Retain received_by
            ];

            await db.query(insertHistoryQuery, insertHistoryParams);

            return res.status(200).json({ message: 'Transaction updated and history recorded successfully!', proofOfPaymentLink });
        } catch (error) {
            console.error('Error in updateTransactionBalanceProof:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },
];

const promissoryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const dir = `uploads/uploadqruserpromissory/${userId}/`;

        // Create directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`); // Unique filename
    },
});

const promissoryNoteUpload = multer({ storage: promissoryStorage });

// Update Transaction Balance: Only handles promissory_note
exports.updateTransactionBalance = [
    promissoryNoteUpload.single('promissory_note'), // Handle single file upload for promissory_note
    async (req, res) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { transaction_id } = req.body;
            const userId = req.userId;

            // Check if transaction exists
            const query = `
                SELECT 
                    t.transaction_id,
                    t.payment_id,
                    t.payment_status,
                    t.payment_method,
                    t.total_amount,
                    t.balance,
                    t.promissory_note,
                    t.proof_of_payment,
                    t.created_at,
                    t.received_by
                FROM transactions t
                WHERE t.transaction_id = ? AND t.user_id = ?
            `;
            const [transaction] = await db.execute(query, [transaction_id, userId]);

            if (transaction.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No promissory note uploaded' });
            }

            const promissoryNoteFile = req.file;

            // Fetch payment details
            const [paymentDetails] = await db.query('SELECT organization_id, name FROM payments WHERE id = ?', [transaction[0].payment_id]);
            if (!paymentDetails.length) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            const { organization_id: organizationId, name: paymentName } = paymentDetails[0];

            // Fetch organization name
            const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organizationResult.length) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            const organizationName = organizationResult[0].name;

            // Fetch user details
            const [userResult] = await db.query(
                'SELECT firstname, lastname, middlename FROM users WHERE id = ?',
                [userId]
            );
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            const { firstname, lastname, middlename } = userResult[0];
            const userFolder = `${firstname}_${middlename}_${lastname}`;

            // Generate unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(promissoryNoteFile.originalname)}`;

            // Ensure file path is valid
            const filePathOnDisk = promissoryNoteFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ error: 'File path is invalid' });
            }

            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create Dropbox folder
            const folderPath = `/uploads/${organizationName}/Promissory notes/${paymentName}/${userFolder}`;
            try {
                await dropbox.filesCreateFolderV2({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    throw error;
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link
            let promissoryNoteLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                promissoryNoteLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    promissoryNoteLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update transaction
            const updateQuery = `
                UPDATE transactions
                SET promissory_note = ?, updated_at = NOW()
                WHERE transaction_id = ? AND user_id = ?
            `;
            await db.query(updateQuery, [promissoryNoteLink, transaction_id, userId]);

            // Record history
            const insertHistoryQuery = `
                INSERT INTO transactions_history (
                    transaction_id,
                    user_id,
                    payment_id,
                    payment_status,
                    payment_method,
                    total_amount,
                    balance,
                    action,
                    promissory_note,
                    proof_of_payment,
                    created_at,
                    received_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            `;
            await db.query(insertHistoryQuery, [
                transaction_id,
                userId,
                transaction[0].payment_id,
                transaction[0].payment_status,
                transaction[0].payment_method,
                transaction[0].total_amount,
                transaction[0].balance,
                'Promissory Note Uploaded',
                promissoryNoteLink,
                transaction[0].proof_of_payment,
                transaction[0].received_by,
            ]);

            res.status(200).json({ message: 'Transaction updated and history recorded successfully!', promissoryNoteLink });
        } catch (error) {
            console.error('Error in updateTransactionBalance:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
];

  

  exports.getPaymentDetailsBalance = async (req, res) => {
    const { transactionId } = req.body; // Extract transactionId from the request body
    const userId = req.userId; // Extract userId from the authenticated user (set by middleware)

    if (!transactionId) {
        return res.status(400).json({ message: 'Transaction ID is required' });
    }

    try {
        // Query to fetch the transaction details with joins for payments, organizations, and semesters
        const query = `
            SELECT 
                t.transaction_id,
                t.total_amount,
                t.payment_status,
                t.payment_method,
                t.balance,

                t.promissory_note,
                t.created_at,
                p.name AS payment_name,
                p.price AS payment_price,
                p.qrcode_picture,
                o.name AS organization_name,
                o.id AS organization_id,
                s.name AS semester_name
            FROM 
                transactions t
            JOIN 
                payments p ON t.payment_id = p.id
            JOIN 
                organizations o ON p.organization_id = o.id
            JOIN 
                semesters s ON p.semester_id = s.id
            WHERE 
                t.user_id = ? AND t.transaction_id = ?
        `;
        const params = [userId, transactionId];

        const [transactionDetails] = await db.execute(query, params);

        if (transactionDetails.length > 0) {
            const details = transactionDetails[0];

            // Construct the full URL for the qrcode_picture
        

            res.status(200).json(details); // Return the first matching transaction
        } else {
            res.status(404).json({ message: 'Transaction not found' });
        }
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
  



const usersOrderStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId; // Get the userId from authenticated user
        const orderTransactionId = req.body.order_transaction_id;
        const dir = `uploads/proof_of_payment/${userId}/${orderTransactionId}`;

        // Create the directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`); // Unique filename
    }
});

// Set up multer upload
const uploadProofOfPayment = multer({ storage: usersOrderStorage });

exports.updateProofOfPayment = [
    uploadProofOfPayment.single('proof_of_payment'), // Upload the file
    async (req, res) => {
        try {
            const { order_transaction_id, gcashorder_id } = req.body;
            const proofOfPaymentFile = req.file;

            if (!proofOfPaymentFile) {
                return res.status(400).json({ message: 'No proof of payment uploaded.' });
            }

            // Generate a unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = proofOfPaymentFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ message: 'File path is invalid' });
            }
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder path
            const folderPath = `/uploads/new/proofofpaymentfolder`;

            // Check and create Dropbox folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update the transaction with proof_of_payment and gcashorder_id
            const query = `
                UPDATE product_transaction
                SET proof_of_payment = ?, gcashorder_id = ?
                WHERE order_transaction_id = ? AND user_id = ?
            `;

            const [result] = await db.execute(query, [proofOfPaymentLink, gcashorder_id, order_transaction_id, req.userId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Transaction not found or you do not have permission to update this payment.' });
            }

            res.status(200).json({
                message: 'Proof of payment updated successfully.',
                proofOfPaymentLink,
                gcashorder_id,
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ message: 'An error occurred while updating the proof of payment.' });
        }
    }
];

exports.updateProofOfPaymentBalance = [
    uploadProofOfPayment.single('proof_of_payment'), // Upload the file
    async (req, res) => {
        try {
            const { order_transaction_id, gcashorder_id } = req.body;
            const proofOfPaymentFile = req.file;

            if (!proofOfPaymentFile) {
                return res.status(400).json({ message: 'No proof of payment uploaded.' });
            }

            // Generate a unique filename
            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPaymentFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = proofOfPaymentFile.path;
            if (!filePathOnDisk) {
                return res.status(400).json({ message: 'File path is invalid' });
            }
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder path
            const folderPath = `/uploads/new/proofofpaymentfolder`;

            // Check and create Dropbox folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update the transaction with proof_of_payment and status
            const updateQuery = `
                UPDATE product_transaction
                SET proof_of_payment = ?, gcashorder_id = ?, status = 'Pending Balance'
                WHERE order_transaction_id = ? AND user_id = ?
            `;

            await db.execute(updateQuery, [proofOfPaymentLink, gcashorder_id, order_transaction_id, req.userId]);

            // Log the action into `product_transaction_logs`
            const logQuery = `
                INSERT INTO product_transaction_logs (
                    user_id,
                    order_transaction_id,
                    action_message,
                    status,
                    payment_method,
                    total_amount,
                    total_pay,
                    proof_of_payment,
                    accepted_by,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;

            const [transaction] = await db.query(`
                SELECT total_amount, total_pay, accepted_by
                FROM product_transaction
                WHERE order_transaction_id = ?
            `, [order_transaction_id]);

            if (!transaction || transaction.length === 0) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            const { total_amount, total_pay, accepted_by } = transaction[0];

            const actionMessage = `New Proof of payment`;

            await db.query(logQuery, [
                req.userId,
                order_transaction_id,
                actionMessage,
                'Pending Balance',
                'Gcash',
                total_amount,
                total_pay,
                proofOfPaymentLink,
                accepted_by
            ]);

            res.status(200).json({
                message: 'Proof of payment updated successfully and transaction set to Pending Balance.',
                proofOfPaymentLink,
                gcashorder_id,
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ message: 'An error occurred while updating the proof of payment.' });
        }
    }
];





  exports.getTransactionDetailsOrders = async (req, res) => {
    const userId = req.userId; // Get the userId from the authenticated request

    try {
        // Validate if the userId is provided
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        // Query to fetch the latest transaction details for the user
        const query = `
            SELECT 
                pt.id AS transaction_id, 
                pt.user_id, 
                pt.order_transaction_id, 
                pt.order_item, 
                pt.status, 
                pt.order_status, 
                pt.payment_method, 
                pt.proof_of_payment,
                pt.total_amount, 
                pt.total_pay, 
                pt.accepted_by, 
                pt.created_at, 
                pt.updated_at, 
                
                -- Concatenating product-related fields
                GROUP_CONCAT(p.product_image ORDER BY pfo.id SEPARATOR ', ') AS product_images,
                GROUP_CONCAT(p.name ORDER BY pfo.id SEPARATOR ', ') AS product_names,
                GROUP_CONCAT(p.price ORDER BY pfo.id SEPARATOR ', ') AS product_prices,
                GROUP_CONCAT(p.category ORDER BY pfo.id SEPARATOR ', ') AS product_categories,
                GROUP_CONCAT(p.quantity ORDER BY pfo.id SEPARATOR ', ') AS product_quantities,
                GROUP_CONCAT(CONCAT(pfo.quantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_quantities,
                GROUP_CONCAT(CONCAT(pfo.smallquantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_smallquantities,
                GROUP_CONCAT(CONCAT(pfo.mediumquantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_mediumquantities,
                GROUP_CONCAT(CONCAT(pfo.largequantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_largequantities,
                GROUP_CONCAT(CONCAT(pfo.xlargequantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_xlargequantities,
                GROUP_CONCAT(pfo.order_transaction_id ORDER BY pfo.id SEPARATOR ', ') AS order_transaction_ids,
                
                -- Fetch the accepted_by user's details
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,

                -- Fetch the user_id's details (the user who made the transaction)
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                
                -- Get the GCash order details
                go.id,
                go.qrcodepicture, 
                go.organization_id AS gcashorganization_id,
                p.organization_id AS productorganization_id

            FROM 
                product_transaction pt
            JOIN 
                product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN 
                products p ON pfo.product_id = p.product_id
            LEFT JOIN 
                organizations_users ou ON pt.accepted_by = ou.id  -- Join to get accepted_by user details
            LEFT JOIN 
                users u ON pt.user_id = u.id  -- Join to get the user details who made the transaction
            LEFT JOIN
                gcashorder go ON go.organization_id = p.organization_id  -- Join to fetch GCash order details
            WHERE
                pt.user_id = ?  -- Fetch records for the authenticated user
            AND go.id = (
                SELECT MAX(go2.id)  -- Ensure we get the latest GCash order based on ID
                FROM gcashorder go2
                WHERE go2.organization_id = p.organization_id  -- Filter GCash order by the correct organization
            )
            GROUP BY
                pt.id, pt.user_id, pt.order_transaction_id, pt.order_item, pt.status, pt.order_status, pt.payment_method, 
                pt.proof_of_payment, pt.total_amount, pt.total_pay, pt.accepted_by, pt.created_at, pt.updated_at, 
                ou.firstname, ou.middlename, ou.lastname, u.firstname, u.middlename, u.lastname, 
                go.qrcodepicture, go.organization_id, p.organization_id
            ORDER BY 
                pt.created_at DESC
            LIMIT 1
        `;

        const [rows] = await db.execute(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No transaction found for this user.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ message: 'An error occurred while fetching transaction details.' });
    }
};





  
  
  

exports.getProductTransactionDetails = async (req, res) => {
  const { orderTransactionId } = req.body; // Get orderTransactionId from the request body
  const userId = req.userId; // Get the authenticated user's ID from middleware

  if (!orderTransactionId) {
    return res.status(400).json({ message: 'Order transaction ID is required' });
  }

  try {
    // Query to fetch product details
    const query = `
      SELECT 
        ptfo.product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.price,
        ptfo.quantity,
        ptfo.smallquantity,
        ptfo.mediumquantity,
        ptfo.largequantity,
        ptfo.xlargequantity,
        pt.order_transaction_id,
        pt.total_amount,
        pt.total_pay,
        pt.payment_method,
        pt.status,
        pt.order_status,
        pt.created_at,
        pt.updated_at
      FROM product_transaction_final_order ptfo
      JOIN products p ON ptfo.product_id = p.product_id
      JOIN product_transaction pt ON ptfo.order_transaction_id = pt.order_transaction_id
      WHERE ptfo.order_transaction_id = ? AND pt.user_id = ?;
    `;

    // Execute the query
    const [productDetails] = await db.execute(query, [orderTransactionId, userId]);

    if (productDetails.length > 0) {
      res.status(200).json(productDetails);
    } else {
      res.status(404).json({ message: 'No product details found for this order' });
    }
  } catch (error) {
    console.error('Error fetching product transaction details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getProductTransactionDetailsBalance = async (req, res) => {
    const { orderTransactionId } = req.body;
    const userId = req.userId;

    if (!orderTransactionId) {
      return res.status(400).json({ message: 'Order transaction ID is required' });
    }

    try {
      // Query to fetch product details including the latest GCash QR Code
      const query = `
        SELECT 
          ptfo.product_id,
          p.name AS product_name,
          p.description AS product_description,
          p.price,
          ptfo.quantity,
          ptfo.smallquantity,
          ptfo.mediumquantity,
          ptfo.largequantity,
          ptfo.xlargequantity,
          pt.order_transaction_id,
          pt.total_amount,
          pt.total_pay,
          pt.payment_method,
          pt.status,
          pt.order_status,
          pt.created_at,
          pt.updated_at,
          go.id,
          go.qrcodepicture AS latest_qrcode
        FROM product_transaction_final_order ptfo
        JOIN products p ON ptfo.product_id = p.product_id
        JOIN product_transaction pt ON ptfo.order_transaction_id = pt.order_transaction_id
        LEFT JOIN gcashorder go ON go.organization_id = p.organization_id
        WHERE ptfo.order_transaction_id = ? AND pt.user_id = ?
        ORDER BY go.id DESC LIMIT 1;
      `;

      const [productDetails] = await db.execute(query, [orderTransactionId, userId]);

      if (productDetails.length > 0) {
        res.status(200).json(productDetails);
      } else {
        res.status(404).json({ message: 'No product details found for this order' });
      }
    } catch (error) {
      console.error('Error fetching product transaction details:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
};


exports.getProductTransactionDetailsHistory = async (req, res) => {
    const { orderTransactionId } = req.body; // Get orderTransactionId from the request body
    const userId = req.userId; // Get the authenticated user's ID from middleware
  
    if (!orderTransactionId) {
      return res.status(400).json({ message: 'Order transaction ID is required' });
    }
  
    try {
      // Query to fetch product transaction details and order by created_at desc
      const query = `
        SELECT 
          pt.id,
          pt.user_id,
          pt.order_transaction_id,
          pt.action_message,
          pt.status,
          pt.order_status,
          pt.payment_method,
          pt.total_amount,
          pt.accepted_by,
          pt.created_at,
          pt.updated_at,
          u.firstname AS accepted_by_firstname,
          u.middlename AS accepted_by_middlename,
          u.lastname AS accepted_by_lastname
        FROM product_transaction_logs pt
        LEFT JOIN organizations_users u ON pt.accepted_by = u.id
        WHERE pt.order_transaction_id = ? AND pt.user_id = ?
        ORDER BY pt.created_at DESC;  -- Order by created_at in descending order
      `;
  
      // Execute the query
      const [productDetails] = await db.execute(query, [orderTransactionId, userId]);
  
      if (productDetails.length > 0) {
        res.status(200).json(productDetails); // Return the product transaction details
      } else {
        res.status(404).json({ message: 'No product transaction details found for this order' });
      }
    } catch (error) {
      console.error('Error fetching product transaction details:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
};


exports.getTransactionDetails = async (req, res) => {
    const { transactionId } = req.body; // Extract transactionId from the request body
    const userId = req.userId; // Extract userId from the authenticated user (set by middleware)
  
    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }
  
    try {
      // Query to fetch the transaction details with joins for payments, organizations, and semesters
      const query = `
        SELECT 
          t.transaction_id,
          t.total_amount,
          t.payment_status,
          t.payment_method,
          t.created_at,
          p.name AS payment_name,
          p.price AS payment_price,
          o.name AS organization_name,
          s.name AS semester_name
        FROM 
          transactions t
        JOIN 
          payments p ON t.payment_id = p.id
        JOIN 
          organizations o ON p.organization_id = o.id
        JOIN 
          semesters s ON p.semester_id = s.id
        WHERE 
          t.user_id = ? AND t.transaction_id = ?
      `;
      const params = [userId, transactionId];
  
      const [transactionDetails] = await db.execute(query, params);
  
      if (transactionDetails.length > 0) {
        res.status(200).json(transactionDetails[0]); // Return the first matching transaction
      } else {
        
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error); // Log the error for debugging
      res.status(500).json({ message: 'Internal server error' }); // Respond with a generic error message
    }
  };

  exports.getTransactionDetailsHistory = async (req, res) => { 
    const { transactionId } = req.body;
    const userId = req.userId; 

    try {
        const query = `
          SELECT 
            t.transaction_id,
            t.total_amount,
            t.payment_status,
            t.payment_method,
            t.action,
            t.received_by,
            t.created_at,
            p.name AS payment_name,
            p.price AS payment_price,
            o.name AS organization_name,
            s.name AS semester_name,
            u.firstname AS received_by_firstname,
            u.middlename AS received_by_middlename,
            u.lastname AS received_by_lastname
          FROM 
            transactions_history t
          JOIN 
            payments p ON t.payment_id = p.id
          JOIN 
            organizations o ON p.organization_id = o.id
          JOIN 
            semesters s ON p.semester_id = s.id
          LEFT JOIN 
            organizations_users u ON t.received_by = u.id
          WHERE 
            t.user_id = ? AND t.transaction_id = ?  -- Filter by both userId and transactionId
          ORDER BY 
            t.created_at DESC
        `;
  
        const params = [userId, transactionId];  // Include both userId and transactionId in the params
        const [transactionDetails] = await db.execute(query, params);
  
        if (transactionDetails.length > 0) {
            res.status(200).json(transactionDetails); // Return the transaction details
        } else {
            res.status(404).json({ message: 'No transactions found' });
        }
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};



  
  

exports.getRecentOrders = async (req, res) => {
    
    const userId = req.userId; // Extract user ID from the request (set by the middleware)
  
    try {
      // Query to fetch recent orders from the product_transaction and product_transaction_final_order tables
      const query = 'SELECT * FROM product_transaction WHERE user_id = ? ORDER BY created_at DESC';
      
      const [orders] = await db.execute(query, [userId]);
  
      if (orders.length > 0) {
        res.status(200).json(orders); // Return the orders as JSON response
      } else {
        
      }
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
exports.getTransactions = async (req, res) => {
    
    const userId = req.userId; // Get the user ID from the request object (set by middleware)
  
    try {
      // Query to fetch transactions for the authenticated user
      const query = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC';
      const [transactions] = await db.execute(query, [userId]);
  
      // Return the transactions to the client
      if (transactions.length > 0) {
        res.status(200).json(transactions);
      } else {
        
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

exports.fetchProductLogs = async (req, res) => {
    const { productId } = req.params;

    try {
        // Fetch logs related to the given product and include the user details for both 'created_by' and 'performed_by'
        const query = `
            SELECT pl.*, 
                ou.firstname AS created_by_firstname, 
                ou.middlename AS created_by_middlename, 
                ou.lastname AS created_by_lastname, 
                u.firstname AS performed_by_firstname, 
                u.middlename AS performed_by_middlename, 
                u.lastname AS performed_by_lastname
            FROM products_logs pl
            LEFT JOIN organizations_users ou ON pl.created_by = ou.id
            LEFT JOIN users u ON pl.performed_by = u.id
            WHERE pl.product_id = ?
            ORDER BY pl.created_at DESC
        `;
        
        const [logs] = await db.query(query, [productId]);

        if (logs.length === 0) {
            return res.status(404).json({ message: 'No logs found for this product.' });
        }

        // Return the product logs with the user details
        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching product logs:', error);
        res.status(500).json({ message: 'Error fetching product logs.' });
    }
};
exports.getOrganizationProductLogs = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization making the request

        // Fetch product logs specific to the organization
        const logsQuery = `
            SELECT 
                pl.id,
                p.name AS product_name,  -- Get product name
                pl.action,
                pl.created_at,
                o.name AS organization_name,  -- Get organization name
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS created_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS performed_by_name
            FROM 
                products_logs pl
            LEFT JOIN products p ON pl.product_id = p.product_id  -- Join products table
            LEFT JOIN organizations o ON p.organization_id = o.id  -- Join organizations table
            LEFT JOIN organizations_users ou ON pl.created_by = ou.id
            LEFT JOIN users u ON pl.performed_by = u.id
            WHERE o.id = ?  -- Filter by organization ID
            ORDER BY pl.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery, [organizationId]);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching organization product logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const { sendOrganizationEmail } = require('../config/SendOrganizationEmail');

exports.addOrder = async (req, res) => {
    const { userId, totalAmount, products } = req.body;

    // Validate input
    if (!userId || !totalAmount || !products || products.length === 0) {
        return res.status(400).json({ message: 'Invalid input data' });
    }

    const orderTransactionId = generateOrderTransactionId(); // Generate a unique transaction ID
    const orgUserId = req.orgIduser; // Assuming this is available from the request context

    try {

        const [latestSemester] = await db.query(`
            SELECT id FROM semesters ORDER BY id DESC LIMIT 1
        `);

        if (latestSemester.length === 0) {
            return res.status(404).json({ message: 'Semester not found' });
        }

        const semesterId = latestSemester[0].id;

        const pendingOrderQuery = `
            SELECT * FROM product_transaction
            WHERE user_id = ? AND status = 'Pending'
        `;
        const [existingPendingOrder] = await db.query(pendingOrderQuery, [userId]);

        if (existingPendingOrder.length > 0) {
            return res.status(400).json({ message: 'You already have a pending order. Please complete or cancel it before placing a new order.' });
        }

        const productTransactionQuery = `
            INSERT INTO product_transaction
            (user_id, order_transaction_id, order_item, status, payment_method, total_amount, total_pay, accepted_by, semester_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.execute(productTransactionQuery, [
            userId,
            orderTransactionId,
            'none', // Default value for `order_item`
            'Paid', // Initial status
            'Cash', // Default payment method
            totalAmount,
            totalAmount,
            orgUserId,
            semesterId // User who accepted the transaction
        ]);

        // Loop through products and check stock
        for (const product of products) {
            const { productId, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = product;

            const currentProductQuery = `
    SELECT product_id, name, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
    FROM products
    WHERE product_id = ?
`;
const [currentProduct] = await db.query(currentProductQuery, [productId]);

// If any of the quantities requested exceed the available stock, reject the order
if (smallquantity > currentProduct[0].smallquantity) {
    return res.status(400).json({ message: `Not enough small quantity for product "${currentProduct[0].name}" (ID: ${productId})` });
}
if (mediumquantity > currentProduct[0].mediumquantity) {
    return res.status(400).json({ message: `Not enough medium quantity for product "${currentProduct[0].name}" (ID: ${productId})` });
}
if (largequantity > currentProduct[0].largequantity) {
    return res.status(400).json({ message: `Not enough large quantity for product "${currentProduct[0].name}" (ID: ${productId})` });
}
if (xlargequantity > currentProduct[0].xlargequantity) {
    return res.status(400).json({ message: `Not enough xlarge quantity for product "${currentProduct[0].name}" (ID: ${productId})` });
}
if (quantity > currentProduct[0].quantity) {
    return res.status(400).json({ message: `Not enough total quantity for product "${currentProduct[0].name}" (ID: ${productId})` });
}

            // Prepare action message and quantities to update
            let actionMessage = "Order placed, ";
            let updatedQuantities = [];

            // Only include the quantities that have a non-zero deduction
            if (quantity > 0) {
                updatedQuantities.push(`${quantity} quantity`);
            }
            if (smallquantity > 0) {
                updatedQuantities.push(`${smallquantity} smallquantity`);
            }
            if (mediumquantity > 0) {
                updatedQuantities.push(`${mediumquantity} mediumquantity`);
            }
            if (largequantity > 0) {
                updatedQuantities.push(`${largequantity} largequantity`);
            }
            if (xlargequantity > 0) {
                updatedQuantities.push(`${xlargequantity} xlargequantity`);
            }

            // If there are quantities to deduct, append them to the action message
            if (updatedQuantities.length > 0) {
                actionMessage += updatedQuantities.join(", ");
            } else {
                actionMessage = "No quantities to deduct.";
            }

            // Update the product quantities
            const updateProductQuery = `
                UPDATE products
                SET 
                    quantity = quantity - ?,
                    smallquantity = smallquantity - ?,
                    mediumquantity = mediumquantity - ?,
                    largequantity = largequantity - ?,
                    xlargequantity = xlargequantity - ?
                WHERE product_id = ?
            `;
            await db.execute(updateProductQuery, [
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity,
                productId
            ]);

            // Log the action for this product
            const logProductActionQuery = `
                INSERT INTO products_logs (
                    product_id,
                    organization_id,
                    created_at,
                    action,
                    updated_at,
                    created_by,
                    performed_by,
                    quantity,
                    smallquantity,
                    mediumquantity,
                    largequantity,
                    xlargequantity
                )
                VALUES (?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
            `;
            await db.execute(logProductActionQuery, [
                productId,
                new Date(),
                actionMessage,
                new Date(),
                userId,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            ]);
        }

        // Insert products into `product_transaction_final_order` table
        let finalOrderDetails = [];

        // Insert products into `product_transaction_final_order` table
        for (const product of products) {
            const { productId, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = product;

            // Fetch product details
            const [productDetails] = await db.query(`
                SELECT product_id, name 
                FROM products 
                WHERE product_id = ?
            `, [productId]);

            if (productDetails.length === 0) continue;

            const productName = productDetails[0].name;

            // Check if any quantity > 0
            let orderedItems = [];
            if (quantity > 0) orderedItems.push(`${quantity}x ${productName}`);
            if (smallquantity > 0) orderedItems.push(`${smallquantity}x Small ${productName}`);
            if (mediumquantity > 0) orderedItems.push(`${mediumquantity}x Medium ${productName}`);
            if (largequantity > 0) orderedItems.push(`${largequantity}x Large ${productName}`);
            if (xlargequantity > 0) orderedItems.push(`${xlargequantity}x X-Large ${productName}`);

            if (orderedItems.length > 0) {
                finalOrderDetails.push(...orderedItems);

                await db.execute(`
                    INSERT INTO product_transaction_final_order
                    (user_id, order_transaction_id, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [userId, orderTransactionId, productId, quantity, smallquantity, mediumquantity, largequantity, xlargequantity]);
            }
        }

        

        // Insert into `product_transaction_logs` table
        const logQuery = `
            INSERT INTO product_transaction_logs
            (user_id, order_transaction_id, action_message, status, payment_method, total_amount, total_pay, accepted_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const actionMessage = `Order placed with total amount ₱${totalAmount}`;
        await db.execute(logQuery, [
            userId,
            orderTransactionId,
            actionMessage,
            'Paid', // Initial status
            'Cash', // Payment method
            totalAmount,
            totalAmount,
            orgUserId
        ]);

        // Fetch user details
const [userResult] = await db.query(`
    SELECT firstname, middlename, lastname, email, course, section
    FROM users 
    WHERE id = ?
`, [userId]);

if (userResult.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
}

const { firstname, middlename, lastname, email, course, section } = userResult[0];
const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

// Fetch organization details including photo
const [organizationResult] = await db.query(`
    SELECT name, photo
    FROM organizations 
    WHERE id = (SELECT organization_id FROM products WHERE product_id = ? LIMIT 1)
`, [products[0].productId]);

if (organizationResult.length === 0) {
    return res.status(404).json({ error: 'Organization not found.' });
}

const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

// Fetch the user who accepted the transaction from `organizations_users`
const [orgUserResult] = await db.query(`
    SELECT firstname, middlename, lastname 
    FROM organizations_users 
    WHERE id = ?
`, [orgUserId]);

if (orgUserResult.length === 0) {
    return res.status(404).json({ error: 'Organization user not found.' });
}

const orgUserFullName = `${orgUserResult[0].firstname}`;

// Fetch the latest semester based on the highest ID
const [latestSemesterResult] = await db.query(`
    SELECT name FROM semesters ORDER BY id DESC LIMIT 1
`);

if (latestSemesterResult.length === 0) {
    return res.status(404).json({ error: 'Semester not found.' });
}

const { name: semesterName } = latestSemesterResult[0];

// **Pass `organizationPhoto` to function**
await sendOrganizationEmail(email, userFullName, organizationName, totalAmount, orderTransactionId, orgUserFullName, organizationPhoto, products[0].productId, course, section, semesterName, finalOrderDetails);



        res.status(200).json({ message: 'Order created successfully', orderTransactionId });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Error creating order' });
    }
};

// Helper function to generate a unique order transaction ID
function generateOrderTransactionId() {
    const currentYear = new Date().getFullYear().toString();
    const uniqueNumber = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
    return `${currentYear}${uniqueNumber}`;
}






  
 
exports.getProductTransactionLogs = async (req, res) => {
    const { orderTransactionId } = req.params;

    try {
        const query = `
            SELECT 
                ptl.id, 
                ptl.user_id, 
                ptl.order_transaction_id, 
                ptl.action_message, 
                ptl.status, 
                ptl.payment_method, 
                ptl.total_amount, 
                ptl.total_pay, 
                ptl.accepted_by,
                ptl.proof_of_payment, 
                ptl.created_at, 
                ptl.updated_at,
                -- Fetch the accepted_by user's details
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname
            FROM 
                product_transaction_logs ptl
            LEFT JOIN
                organizations_users ou ON ptl.accepted_by = ou.id  -- Join to get accepted_by user details
            WHERE 
                ptl.order_transaction_id = ?
            ORDER BY 
                ptl.created_at DESC
        `;
        
        const [logs] = await db.query(query, [orderTransactionId]);

        if (!logs || logs.length === 0) {
            return res.status(404).json({ message: 'No logs found for this transaction' });
        }

        res.status(200).json(logs);
    } catch (err) {
        console.error('Error fetching product transaction logs:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};



const { TotalPayBalance } = require('../config/SendOrganizationEmail');

exports.updateBalancePayment = async (req, res) => {
    try {
        const { totalPay, paymentMethod, proof_of_payment } = req.body; // Added proof_of_payment
        const { orderTransactionId } = req.params;
        const orgUserId = req.orgIduser; // Organization user (accepted_by)

        const parsedTotalPay = parseFloat(totalPay);
        if (isNaN(parsedTotalPay) || parsedTotalPay <= 0) {
            return res.status(400).json({ message: 'Invalid payment amount provided' });
        }

        const [transaction] = await db.query(
            'SELECT * FROM product_transaction WHERE order_transaction_id = ?',
            [orderTransactionId]
        );

        if (!transaction.length) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const currentTransaction = transaction[0];
        const { total_amount, total_pay: currentTotalPay, user_id: userId, status, proof_of_payment: existingProof } = currentTransaction;

        if (status !== 'Balance' && status !== 'Processing Balance') {
            return res.status(400).json({ message: 'Payment can only be processed for Balance transactions' });
        }

        const validCurrentTotalPay = isNaN(currentTotalPay) ? 0 : parseFloat(currentTotalPay);
        const newTotalPay = parseFloat((validCurrentTotalPay + parsedTotalPay).toFixed(2));

        if (newTotalPay > total_amount) {
            return res.status(400).json({ message: 'Payment exceeds total amount' });
        }

        let newStatus = 'Balance';
        if (Math.abs(newTotalPay - total_amount) < 0.01) {
            newStatus = 'Paid';
        }

        // Update the product transaction table
        await db.query(
            'UPDATE product_transaction SET total_pay = ?, status = ?, accepted_by = ?, proof_of_payment = ?, updated_at = NOW() WHERE order_transaction_id = ?',
            [newTotalPay, newStatus, orgUserId, proof_of_payment || existingProof, orderTransactionId]
        );

        // Log the transaction
        const actionMessage = `Balance Payment = ₱${parsedTotalPay}`;
        await db.query(
            'INSERT INTO product_transaction_logs (order_transaction_id, user_id, accepted_by, action_message, payment_method, total_amount, total_pay, status, proof_of_payment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [orderTransactionId, userId, orgUserId, actionMessage, paymentMethod, total_amount, newTotalPay, newStatus, proof_of_payment || existingProof]
        );

        // **Fetch additional details for email and PDF**
        const [userResult] = await db.query(`
            SELECT firstname, middlename, lastname, email, course, section
            FROM users WHERE id = ?
        `, [userId]);

        if (userResult.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const { firstname, middlename, lastname, email, course, section } = userResult[0];
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

        const [organizationResult] = await db.query(`
            SELECT name, photo FROM organizations
            WHERE id = (SELECT organization_id FROM products WHERE product_id =
            (SELECT product_id FROM product_transaction_final_order WHERE order_transaction_id = ? LIMIT 1))
        `, [orderTransactionId]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ message: "Organization not found." });
        }

        const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

        const [orgUserResult] = await db.query(`
            SELECT firstname FROM organizations_users WHERE id = ?
        `, [orgUserId]);

        if (orgUserResult.length === 0) {
            return res.status(404).json({ message: "Organization user not found." });
        }

        const { firstname: orgUserFullName } = orgUserResult[0];

        const [latestSemesterResult] = await db.query(`
            SELECT name FROM semesters ORDER BY id DESC LIMIT 1
        `);

        if (latestSemesterResult.length === 0) {
            return res.status(404).json({ message: "Semester not found." });
        }

        const { name: semesterName } = latestSemesterResult[0];

        // **Fetch ordered items**
        const [orderedItems] = await db.query(`
            SELECT p.name, f.quantity, f.smallquantity, f.mediumquantity, f.largequantity, f.xlargequantity
            FROM product_transaction_final_order f
            JOIN products p ON f.product_id = p.product_id
            WHERE f.order_transaction_id = ?
        `, [orderTransactionId]);

        let finalOrderDetails = orderedItems
            .map(({ name, quantity, smallquantity, mediumquantity, largequantity, xlargequantity }) => {
                let items = [];
                if (quantity > 0) items.push(`${quantity}x ${name}`);
                if (smallquantity > 0) items.push(`${smallquantity}x Small ${name}`);
                if (mediumquantity > 0) items.push(`${mediumquantity}x Medium ${name}`);
                if (largequantity > 0) items.push(`${largequantity}x Large ${name}`);
                if (xlargequantity > 0) items.push(`${xlargequantity}x X-Large ${name}`);
                return items.join(', ');
            })
            .filter(item => item) // Remove empty entries
            .join('<br>');

        // **Send email with PDF receipt**
        await TotalPayBalance(email, userFullName, organizationName, total_amount, orderTransactionId, orgUserFullName, organizationPhoto, course, section, semesterName, finalOrderDetails, paymentMethod, newStatus, newTotalPay);

        return res.status(200).json({ message: 'Balance payment updated successfully', newStatus, proof_of_payment });

    } catch (error) {
        console.error('Error updating balance payment:', error);
        return res.status(500).json({ message: 'An internal server error occurred' });
    }
};






const { TotalPay } = require('../config/SendOrganizationEmail');

exports.updateTotalPay = async (req, res) => { 
    const { orderTransactionId } = req.params; 
    const { totalPay, paymentMethod } = req.body;
    const orgUserId = req.orgIduser; 

    try {
        const selectQuery = `
            SELECT total_amount, status, user_id, proof_of_payment
            FROM product_transaction
            WHERE order_transaction_id = ?
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction || transaction.length === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const { total_amount, status, user_id, proof_of_payment } = transaction[0];

        if (status !== 'Accepted') {
            return res.status(400).json({ message: 'Payment can only be processed for accepted transactions' });
        }

        if (totalPay > total_amount) {
            return res.status(400).json({ message: 'Payment exceeds total amount' });
        }

        let newStatus = 'Balance'; 
        if (Math.abs(totalPay - total_amount) < 0.01) { 
            newStatus = 'Paid';
        }

        const updateQuery = `
            UPDATE product_transaction
            SET total_pay = ?, status = ?, accepted_by = ?, updated_at = NOW()
            WHERE order_transaction_id = ?
        `;
        await db.query(updateQuery, [totalPay, newStatus, orgUserId, orderTransactionId]);

        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                total_pay,
                proof_of_payment,
                accepted_by,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const actionMessage = `Total pay = ₱${totalPay}`;
        await db.query(logQuery, [
            user_id,                   
            orderTransactionId,        
            actionMessage,             
            newStatus,                 
            paymentMethod || 'Gcash',  
            total_amount,              
            totalPay,                  
            proof_of_payment,          
            orgUserId                  
        ]);

        // **Fetch additional details for email and PDF**
        const [userResult] = await db.query(`
            SELECT firstname, middlename, lastname, email, course, section
            FROM users WHERE id = ?
        `, [user_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const { firstname, middlename, lastname, email, course, section } = userResult[0];
        const userFullName = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`;

        const [organizationResult] = await db.query(`
            SELECT name, photo FROM organizations
            WHERE id = (SELECT organization_id FROM products WHERE product_id =
            (SELECT product_id FROM product_transaction_final_order WHERE order_transaction_id = ? LIMIT 1))
        `, [orderTransactionId]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ message: "Organization not found." });
        }

        const { name: organizationName, photo: organizationPhoto } = organizationResult[0];

        const [orgUserResult] = await db.query(`
            SELECT firstname FROM organizations_users WHERE id = ?
        `, [orgUserId]);

        if (orgUserResult.length === 0) {
            return res.status(404).json({ message: "Organization user not found." });
        }

        const { firstname: orgUserFullName } = orgUserResult[0];

        const [latestSemesterResult] = await db.query(`
            SELECT name FROM semesters ORDER BY id DESC LIMIT 1
        `);

        if (latestSemesterResult.length === 0) {
            return res.status(404).json({ message: "Semester not found." });
        }

        const { name: semesterName } = latestSemesterResult[0];

        // **Fetch ordered items**
        const [orderedItems] = await db.query(`
            SELECT p.name, f.quantity, f.smallquantity, f.mediumquantity, f.largequantity, f.xlargequantity
            FROM product_transaction_final_order f
            JOIN products p ON f.product_id = p.product_id
            WHERE f.order_transaction_id = ?
        `, [orderTransactionId]);

        let finalOrderDetails = orderedItems
            .map(({ name, quantity, smallquantity, mediumquantity, largequantity, xlargequantity }) => {
                let items = [];
                if (quantity > 0) items.push(`${quantity}x ${name}`);
                if (smallquantity > 0) items.push(`${smallquantity}x Small ${name}`);
                if (mediumquantity > 0) items.push(`${mediumquantity}x Medium ${name}`);
                if (largequantity > 0) items.push(`${largequantity}x Large ${name}`);
                if (xlargequantity > 0) items.push(`${xlargequantity}x X-Large ${name}`);
                return items.join(', ');
            })
            .filter(item => item) // Remove empty entries
            .join('<br>');

        // **Send email with PDF receipt**
        await TotalPay(email, userFullName, organizationName, total_amount, orderTransactionId, orgUserFullName, organizationPhoto, course, section, semesterName, finalOrderDetails, paymentMethod, newStatus, totalPay);

        res.status(200).json({ message: 'Payment updated successfully', newStatus });
    } catch (err) {
        console.error('Error updating payment:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};





// Accept Order function
exports.acceptOrder = async (req, res) => {
    const { orderTransactionId } = req.params; // Get orderTransactionId from the URL
    const orgUserId = req.orgIduser; // Get orgUserId from the request object (middleware should set this)
    
    if (!orgUserId) {
        return res.status(400).json({ message: 'Organization user not authenticated' });
    }

    try {
        // Fetch the user_id, total_amount, and proof_of_payment from the product_transaction table
        const selectQuery = `
            SELECT user_id, total_amount, proof_of_payment
            FROM product_transaction
            WHERE order_transaction_id = ? AND status = 'Pending'
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction || transaction.length === 0) {
            return res.status(404).json({ message: 'Order not found or already processed' });
        }

        const userId = transaction[0].user_id; // Extract the user_id from the result
        const totalAmount = transaction[0].total_amount; // Extract the total_amount from the result
        const proofOfPayment = transaction[0].proof_of_payment; // Extract proof_of_payment

        // Update the order status to 'Accepted' and set the 'accepted_by' field to orgUserId
        const updateQuery = `
            UPDATE product_transaction
            SET status = 'Accepted', accepted_by = ?, updated_at = NOW()
            WHERE order_transaction_id = ? AND status = 'Pending'
        `;
        const [result] = await db.query(updateQuery, [orgUserId, orderTransactionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found or already accepted' });
        }

        // Log the action in the product_transaction_logs table, including proof_of_payment
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                proof_of_payment,  -- Added proof_of_payment field
                accepted_by,
                created_at,
                updated_at
            )
            VALUES (?, ?, 'Accepted Order', 'Accepted', ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [
            userId,            // The original user_id
            orderTransactionId,
            'Gcash',           // Set payment method as "Gcash"
            totalAmount,       // Use the total_amount from the product_transaction table
            proofOfPayment,    // Insert the proof_of_payment from product_transaction
            orgUserId          // Set the orgUserId as the accepted_by
        ]);

        res.status(200).json({ message: 'Order accepted successfully' });
    } catch (err) {
        console.error('Error accepting order:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


exports.declineOrder = async (req, res) => {
    const { orderTransactionId } = req.params; // Get orderTransactionId from the URL
    const orgUserId = req.orgIduser; // Get orgUserId from the request object

    if (!orgUserId) {
        return res.status(400).json({ message: 'Organization user not authenticated' });
    }

    try {
        // Fetch the user_id, total_amount, and proof_of_payment from the product_transaction table
        const selectQuery = `
            SELECT user_id, total_amount, proof_of_payment
            FROM product_transaction
            WHERE order_transaction_id = ? AND status = 'Pending'
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction || transaction.length === 0) {
            return res.status(404).json({ message: 'Order not found or already processed' });
        }

        const userId = transaction[0].user_id; // Extract the user_id from the result
        const totalAmount = transaction[0].total_amount; // Extract the total_amount from the result
        const proofOfPayment = transaction[0].proof_of_payment; // Extract proof_of_payment

        // Fetch the order details from product_transaction_final_order for this transaction
        const selectFinalOrderQuery = `
            SELECT product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
            FROM product_transaction_final_order
            WHERE order_transaction_id = ?
        `;
        const [finalOrder] = await db.query(selectFinalOrderQuery, [orderTransactionId]);

        if (!finalOrder || finalOrder.length === 0) {
            return res.status(404).json({ message: 'Order details not found in final order' });
        }

        // For each product in the final order, update the product quantities in the products table
        for (let i = 0; i < finalOrder.length; i++) {
            const { product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity } = finalOrder[i];

            // Update the product quantities in the products table
            const updateProductQuery = `
                UPDATE products
                SET 
                    quantity = quantity + ?, 
                    smallquantity = smallquantity + ?, 
                    mediumquantity = mediumquantity + ?, 
                    largequantity = largequantity + ?, 
                    xlargequantity = xlargequantity + ?
                WHERE product_id = ?
            `;
            await db.query(updateProductQuery, [
                quantity, smallquantity, mediumquantity, largequantity, xlargequantity, product_id
            ]);

            // Log the quantity retrieval action in products_logs
            const logProductQuery = `
                INSERT INTO products_logs (
                    product_id, 
                    organization_id, 
                    created_at, 
                    action, 
                    updated_at, 
                    created_by, 
                    performed_by, 
                    quantity, 
                    smallquantity, 
                    mediumquantity, 
                    largequantity, 
                    xlargequantity
                )
                VALUES (?, NULL, NOW(), 'Order Quantity Retrieved (Declined)', NOW(), ?, NULL, ?, ?, ?, ?, ?)
            `;

            await db.query(logProductQuery, [
                product_id, // The product_id from the order
                orgUserId, // The user who is performing the action (this could be the same as orgUserId)
                quantity, 
                smallquantity, 
                mediumquantity, 
                largequantity, 
                xlargequantity
            ]);
        }

        // Update the order status to 'Declined'
        const updateQuery = `
            UPDATE product_transaction
            SET status = 'Declined', accepted_by = ?, updated_at = NOW()
            WHERE order_transaction_id = ? AND status = 'Pending'
        `;
        const [result] = await db.query(updateQuery, [orgUserId, orderTransactionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found or already declined' });
        }

        // Log the action in the product_transaction_logs table, including proof_of_payment
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                proof_of_payment,  -- Added proof_of_payment field
                accepted_by,
                created_at,
                updated_at
            )
            VALUES (?, ?, 'Declined Order', 'Declined', ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [
            userId,            // The original user_id
            orderTransactionId,
            'Gcash',           // Set payment method as "Gcash"
            totalAmount,       // Use the total_amount from the product_transaction table
            proofOfPayment,    // Insert the proof_of_payment from product_transaction
            orgUserId          // Set the orgUserId as the accepted_by
        ]);

        res.status(200).json({ message: 'Order declined and quantities updated successfully' });
    } catch (err) {
        console.error('Error declining order:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


exports.acceptBalancePayment = async (req, res) => {
    const { orderTransactionId } = req.params;
    const orgUserId = req.orgIduser; // Logged-in admin ID

    if (!orgUserId) {
        return res.status(400).json({ message: 'Organization user not authenticated' });
    }

    try {
        // Fetch transaction details
        const selectQuery = `
            SELECT user_id, total_amount, total_pay, proof_of_payment
            FROM product_transaction
            WHERE order_transaction_id = ? AND status = 'Pending Balance'
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction.length) {
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        const userId = transaction[0].user_id;
        const totalAmount = transaction[0].total_amount;
        const totalPay = transaction[0].total_pay;
        const proofOfPayment = transaction[0].proof_of_payment;

        // Update transaction status to 'Processing Balance'
        const updateQuery = `
            UPDATE product_transaction
            SET status = 'Processing Balance', accepted_by = ?, updated_at = NOW()
            WHERE order_transaction_id = ? AND status = 'Pending Balance'
        `;
        const [result] = await db.query(updateQuery, [orgUserId, orderTransactionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        // Log the action including `total_pay`
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                total_pay,
                proof_of_payment,
                accepted_by,
                created_at,
                updated_at
            )
            VALUES (?, ?, 'Accepted Balance Payment', 'Processing Balance', 'Gcash', ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [userId, orderTransactionId, totalAmount, totalPay, proofOfPayment, orgUserId]);

        res.status(200).json({ message: 'Balance payment accepted successfully' });
    } catch (err) {
        console.error('Error accepting balance payment:', err);
        res.status(500).json({ message: 'An error occurred' });
    }
};
exports.declineBalancePayment = async (req, res) => {
    const { orderTransactionId } = req.params;
    const orgUserId = req.orgIduser;

    if (!orgUserId) {
        return res.status(400).json({ message: 'Organization user not authenticated' });
    }

    try {
        // Fetch transaction details
        const selectQuery = `
            SELECT user_id, total_amount, total_pay, proof_of_payment
            FROM product_transaction
            WHERE order_transaction_id = ? AND status = 'Pending Balance'
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction.length) {
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        const userId = transaction[0].user_id;
        const totalAmount = transaction[0].total_amount;
        const totalPay = transaction[0].total_pay;
        const proofOfPayment = transaction[0].proof_of_payment;

        // Update transaction status back to 'Balance'
        const updateQuery = `
            UPDATE product_transaction
            SET status = 'Balance', accepted_by = ?, updated_at = NOW()
            WHERE order_transaction_id = ? AND status = 'Pending Balance'
        `;
        const [result] = await db.query(updateQuery, [orgUserId, orderTransactionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        // Log the action including `total_pay`
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                total_pay,
                proof_of_payment,
                accepted_by,
                created_at,
                updated_at
            )
            VALUES (?, ?, 'Declined Balance Payment', 'Balance', 'Gcash', ?, ?, ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [userId, orderTransactionId, totalAmount, totalPay, proofOfPayment, orgUserId]);

        res.status(200).json({ message: 'Balance payment declined successfully' });
    } catch (err) {
        console.error('Error declining balance payment:', err);
        res.status(500).json({ message: 'An error occurred' });
    }
};

exports.submitDeclineReport = async (req, res) => {
    const { orderTransactionId } = req.params;
    const { reasons, comments } = req.body;
    const orgUserId = req.orgIduser;

    if (!orgUserId) {
        return res.status(400).json({ message: 'Organization user not authenticated' });
    }

    try {
        // Fetch transaction details
        const selectQuery = `
            SELECT user_id
            FROM product_transaction
            WHERE order_transaction_id = ?
        `;
        const [transaction] = await db.query(selectQuery, [orderTransactionId]);

        if (!transaction.length) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const userId = transaction[0].user_id;

        // Insert report into `product_transaction_reports`
        const reportQuery = `
            INSERT INTO product_transaction_reports (
                user_id, 
                order_transaction_id, 
                created_by, 
                reasons, 
                comments, 
                status, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, 'Reported', NOW())
        `;
        await db.query(reportQuery, [userId, orderTransactionId, orgUserId, reasons, comments]);

        res.status(200).json({ message: 'Decline report submitted successfully' });
    } catch (err) {
        console.error('Error submitting decline report:', err);
        res.status(500).json({ message: 'An error occurred while submitting the report' });
    }
};





exports.getAllProductTransactions = async (req, res) => {  
    // Assuming organizationId comes from req.userId, but if it's passed differently, adjust accordingly
    const organizationId = req.userId;

    try {
        const [transactions] = await db.query(`
            SELECT 
                pt.id, 
                pt.user_id, 
                pt.order_transaction_id, 
                pt.order_item, 
                pt.status, 
                pt.order_status, 
                pt.payment_method, 
                pt.proof_of_payment,
                pt.total_amount, 
                pt.total_pay, 
                
                pt.accepted_by, 
                pt.created_at, 
                pt.updated_at, 
                GROUP_CONCAT(
                    p.product_image ORDER BY pfo.id SEPARATOR ', '
                ) AS product_images,
                GROUP_CONCAT(
                    p.name ORDER BY pfo.id SEPARATOR ', '
                ) AS product_names,
                GROUP_CONCAT(
                    p.price ORDER BY pfo.id SEPARATOR ', '
                ) AS product_prices,
                GROUP_CONCAT(
                    p.category ORDER BY pfo.id SEPARATOR ', '
                ) AS product_categories,
                GROUP_CONCAT(
                    p.quantity ORDER BY pfo.id SEPARATOR ', '
                ) AS product_quantities,
                GROUP_CONCAT(
                    CONCAT(pfo.quantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_quantities,
                GROUP_CONCAT(
                    CONCAT(pfo.smallquantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_smallquantities,
                GROUP_CONCAT(
                    CONCAT(pfo.mediumquantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_mediumquantities,
                GROUP_CONCAT(
                    CONCAT(pfo.largequantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_largequantities,
                GROUP_CONCAT(
                    CONCAT(pfo.xlargequantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_xlargequantities,
                GROUP_CONCAT(
                    pfo.order_transaction_id ORDER BY pfo.id SEPARATOR ', '
                ) AS order_transaction_ids,
                
                -- Fetch the accepted_by user's details
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,

                -- Fetch the user_id's details (the user who made the transaction)
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname

            FROM 
                product_transaction pt
            JOIN 
                product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN 
                products p ON pfo.product_id = p.product_id
            LEFT JOIN
                organizations_users ou ON pt.accepted_by = ou.id  -- Join to get accepted_by user details
            LEFT JOIN
                users u ON pt.user_id = u.id  -- Join to get the user details who made the transaction
            WHERE
                p.organization_id = ?
            GROUP BY
                pt.id, pt.user_id, pt.order_transaction_id, pt.order_item, pt.status, pt.proof_of_payment, pt.payment_method, pt.total_amount, 
                pt.accepted_by, pt.created_at, pt.updated_at, ou.firstname, ou.middlename, ou.lastname, u.firstname, u.middlename, u.lastname
            ORDER BY 
                pt.updated_at DESC
        `, [organizationId]);

        // If no transactions were found
        if (transactions.length === 0) {
            return res.status(404).json({ msg: 'No transactions found for the specified organization' });
        }

        // Process each transaction to filter out zeros from quantities
        const processedTransactions = transactions.map(transaction => {
            // Parse and filter out zero values from the quantities
            const filterZeroValues = (quantities) => {
                return quantities.split(',').filter(q => parseInt(q) !== 0).join(', ');
            };

            transaction.order_quantities = filterZeroValues(transaction.order_quantities);
            transaction.order_smallquantities = filterZeroValues(transaction.order_smallquantities);
            transaction.order_mediumquantities = filterZeroValues(transaction.order_mediumquantities);
            transaction.order_largequantities = filterZeroValues(transaction.order_largequantities);
            transaction.order_xlargequantities = filterZeroValues(transaction.order_xlargequantities);

            // Return the modified transaction
            return transaction;
        });

        // Return the processed transactions as a JSON response
        return res.json(processedTransactions);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.getAllProductTransactionsAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ success: false, message: 'Adviser ID is required.' });
        }

        // ✅ Fetch adviser's assigned organizations and semesters (All years)
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'No organization logs found for the adviser.' });
        }

        // ✅ Prepare organization IDs and semester IDs for query
        const organizationsSemesters = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            semester_id: log.semester_id
        }));

        // ✅ Fetch all product transactions for the adviser's assigned organizations & years
        const query = `
            SELECT 
                pt.id, 
                pt.user_id, 
                pt.order_transaction_id, 
                pt.order_item, 
                pt.status, 
                pt.order_status, 
                pt.payment_method, 
                pt.proof_of_payment,
                pt.total_amount, 
                pt.total_pay, 
                pt.accepted_by, 
                pt.created_at, 
                pt.updated_at, 
                
                -- Get related product details
                GROUP_CONCAT(p.product_image ORDER BY pfo.id SEPARATOR ', ') AS product_images,
                GROUP_CONCAT(p.name ORDER BY pfo.id SEPARATOR ', ') AS product_names,
                GROUP_CONCAT(p.price ORDER BY pfo.id SEPARATOR ', ') AS product_prices,
                GROUP_CONCAT(p.category ORDER BY pfo.id SEPARATOR ', ') AS product_categories,
                GROUP_CONCAT(p.quantity ORDER BY pfo.id SEPARATOR ', ') AS product_quantities,
                
                -- Order quantity breakdown
                GROUP_CONCAT(CONCAT(pfo.quantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_quantities,
                GROUP_CONCAT(CONCAT(pfo.smallquantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_smallquantities,
                GROUP_CONCAT(CONCAT(pfo.mediumquantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_mediumquantities,
                GROUP_CONCAT(CONCAT(pfo.largequantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_largequantities,
                GROUP_CONCAT(CONCAT(pfo.xlargequantity, 'x') ORDER BY pfo.id SEPARATOR ', ') AS order_xlargequantities,

                -- Fetch order's organization
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year,

                -- Fetch user details
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS accepted_by_name

            FROM product_transaction pt
            JOIN product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN products p ON pfo.product_id = p.product_id
            JOIN organizations org ON p.organization_id = org.id  -- ✅ Get organization details
            JOIN semesters s ON pt.semester_id = s.id  -- ✅ Get semester details
            LEFT JOIN users u ON pt.user_id = u.id
            LEFT JOIN organizations_users ou ON pt.accepted_by = ou.id
            WHERE (${organizationsSemesters.map(() => '(p.organization_id = ? AND pt.semester_id = ?)').join(' OR ')})
            GROUP BY pt.id, pt.user_id, pt.order_transaction_id, pt.order_item, pt.status, pt.payment_method, pt.total_amount, 
                pt.accepted_by, pt.created_at, pt.updated_at, org.name, s.name, s.year, u.firstname, u.middlename, u.lastname, ou.firstname, ou.lastname
            ORDER BY pt.updated_at DESC;
        `;

        // ✅ Prepare parameters for query
        const queryParams = organizationsSemesters.flatMap(({ organizations_id, semester_id }) => [organizations_id, semester_id]);

        // ✅ Execute query
        const [transactions] = await db.query(query, queryParams);

        if (transactions.length === 0) {
            return res.status(404).json({ success: false, message: 'No product transactions found for this adviser.' });
        }

        res.status(200).json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching product transactions for adviser:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getAllProductTransactionsNoAuth = async (req, res) => {
    try {
        const [transactions] = await db.query(`
            SELECT 
                pt.id, 
                pt.user_id, 
                pt.order_transaction_id, 
                pt.order_item, 
                pt.status, 
                pt.order_status, 
                pt.payment_method, 
                pt.proof_of_payment,
                pt.total_amount, 
                pt.total_pay, 
                pt.accepted_by, 
                pt.created_at, 
                pt.updated_at, 
                GROUP_CONCAT(
                    p.product_image ORDER BY pfo.id SEPARATOR ', '
                ) AS product_images,
                GROUP_CONCAT(
                    p.name ORDER BY pfo.id SEPARATOR ', '
                ) AS product_names,
                GROUP_CONCAT(
                    p.price ORDER BY pfo.id SEPARATOR ', '
                ) AS product_prices,
                GROUP_CONCAT(
                    p.category ORDER BY pfo.id SEPARATOR ', '
                ) AS product_categories,
                GROUP_CONCAT(
                    p.quantity ORDER BY pfo.id SEPARATOR ', '
                ) AS product_quantities,
                GROUP_CONCAT(
                    CONCAT(pfo.quantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_quantities,
                GROUP_CONCAT(
                    CONCAT(pfo.smallquantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_smallquantities,
                GROUP_CONCAT(
                    CONCAT(pfo.mediumquantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_mediumquantities,
                GROUP_CONCAT(
                    CONCAT(pfo.largequantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_largequantities,
                GROUP_CONCAT(
                    CONCAT(pfo.xlargequantity, 'x') ORDER BY pfo.id SEPARATOR ', '
                ) AS order_xlargequantities,
                GROUP_CONCAT(
                    pfo.order_transaction_id ORDER BY pfo.id SEPARATOR ', '
                ) AS order_transaction_ids,

                -- Fetch the accepted_by user's details
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,

                -- Fetch the user_id's details (the user who made the transaction)
                u.firstname AS user_firstname,
                u.middlename AS user_middlename,
                u.lastname AS user_lastname,
                
                -- Fetch organization name
                o.name AS organization_name
                
            FROM 
                product_transaction pt
            JOIN 
                product_transaction_final_order pfo ON pt.order_transaction_id = pfo.order_transaction_id
            JOIN 
                products p ON pfo.product_id = p.product_id
            LEFT JOIN
                organizations_users ou ON pt.accepted_by = ou.id  -- Join to get accepted_by user details
            LEFT JOIN
                users u ON pt.user_id = u.id  -- Join to get the user details who made the transaction
            LEFT JOIN
                organizations o ON p.organization_id = o.id -- Fetch organization details
            GROUP BY
                pt.id, pt.user_id, pt.order_transaction_id, pt.order_item, pt.status, pt.proof_of_payment, pt.payment_method, pt.total_amount, 
                pt.accepted_by, pt.created_at, pt.updated_at, ou.firstname, ou.middlename, ou.lastname, u.firstname, u.middlename, u.lastname, o.name
            ORDER BY 
                pt.updated_at DESC
        `);

        // If no transactions were found
        if (transactions.length === 0) {
            return res.status(404).json({ msg: 'No transactions found' });
        }

        // Process each transaction to filter out zeros from quantities
        const processedTransactions = transactions.map(transaction => {
            const filterZeroValues = (quantities) => {
                return quantities.split(',').filter(q => parseInt(q) !== 0).join(', ');
            };

            transaction.order_quantities = filterZeroValues(transaction.order_quantities);
            transaction.order_smallquantities = filterZeroValues(transaction.order_smallquantities);
            transaction.order_mediumquantities = filterZeroValues(transaction.order_mediumquantities);
            transaction.order_largequantities = filterZeroValues(transaction.order_largequantities);
            transaction.order_xlargequantities = filterZeroValues(transaction.order_xlargequantities);

            return transaction;
        });

        return res.json(processedTransactions);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.getProductTransactionLogsa = async (req, res) => {
    try {
        const { orderTransactionId } = req.params;

        const query = `
            SELECT 
                ptl.action_message, 
                ptl.status, 
                ptl.order_status, 
                ptl.payment_method, 
                ptl.total_amount, 
                ptl.total_pay, 
                ptl.accepted_by, 
                ou.firstname AS accepted_by_firstname,
                ou.middlename AS accepted_by_middlename,
                ou.lastname AS accepted_by_lastname,
                ptl.proof_of_payment,
                ptl.created_at
            FROM product_transaction_logs ptl
            LEFT JOIN organizations_users ou ON ptl.accepted_by = ou.id
            WHERE ptl.order_transaction_id = ?
            ORDER BY ptl.created_at DESC
        `;

        const [logs] = await db.query(query, [orderTransactionId]);

        if (logs.length === 0) {
            return res.status(404).json({ msg: 'No logs found for this order transaction' });
        }

        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching product transaction logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};






exports.placeOrder = async (req, res) => {
    const { cartItems, paymentMethod, totalAmount } = req.body;
    const userId = req.userId; // Get userId from the JWT token

    if (!userId) {
        return res.status(400).json({ message: 'User not authenticated' });
    }

    if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ message: 'No items in cart' });
    }

    if (!paymentMethod || !totalAmount) {
        return res.status(400).json({ message: 'Payment method and total amount are required' });
    }

    try {
        const currentYear = new Date().getFullYear().toString();
        const orderTransactionId = `${currentYear}${Math.floor(100000 + Math.random() * 900000)}`;

        // Iterate through the cart items to validate quantities
        for (let item of cartItems) {
            const {
                product_id,
                quantity = 0,
                smallquantity = 0,
                mediumquantity = 0,
                largequantity = 0,
                xlargequantity = 0
            } = item;

            // Get the current quantities of the product
            const currentProductQuery = `
    SELECT product_id, name, quantity, smallquantity, mediumquantity, largequantity, xlargequantity
    FROM products
    WHERE product_id = ?
`;
const [currentProduct] = await db.query(currentProductQuery, [product_id]);

// If any of the quantities requested exceed the available stock, reject the order
if (smallquantity > currentProduct[0].smallquantity) {
    return res.status(400).json({ message: `Not enough small quantity for product "${currentProduct[0].name}" (ID: ${product_id})` });
}
if (mediumquantity > currentProduct[0].mediumquantity) {
    return res.status(400).json({ message: `Not enough medium quantity for product "${currentProduct[0].name}" (ID: ${product_id})` });
}
if (largequantity > currentProduct[0].largequantity) {
    return res.status(400).json({ message: `Not enough large quantity for product "${currentProduct[0].name}" (ID: ${product_id})` });
}
if (xlargequantity > currentProduct[0].xlargequantity) {
    return res.status(400).json({ message: `Not enough xlarge quantity for product "${currentProduct[0].name}" (ID: ${product_id})` });
}
if (quantity > currentProduct[0].quantity) {
    return res.status(400).json({ message: `Not enough total quantity for product "${currentProduct[0].name}" (ID: ${product_id})` });
}

        }

        // Prepare the order items for the order
        const orderItems = cartItems.map(item => {
            const filteredItem = {
                productId: item.product_id,  // Add product_id to the order item
                quantity: item.quantity > 0 ? item.quantity : undefined,
                smallquantity: item.smallquantity > 0 ? item.smallquantity : undefined,
                mediumquantity: item.mediumquantity > 0 ? item.mediumquantity : undefined,
                largequantity: item.largequantity > 0 ? item.largequantity : undefined,
                xlargequantity: item.xlargequantity > 0 ? item.xlargequantity : undefined,
            };

            // Remove keys that have undefined values (quantities that are 0)
            Object.keys(filteredItem).forEach(key => {
                if (filteredItem[key] === undefined) {
                    delete filteredItem[key];
                }
            });

            return filteredItem;
        });

        const [latestSemester] = await db.query(`
            SELECT id FROM semesters ORDER BY id DESC LIMIT 1
        `);

        if (latestSemester.length === 0) {
            return res.status(404).json({ message: 'Semester not found' });
        }

        const semesterId = latestSemester[0].id;

        // Insert into product_transaction table
        const query = `
            INSERT INTO product_transaction (
                user_id,
                order_transaction_id,
                order_item,
                status,
                payment_method,
                total_amount,
                accepted_by,
                semester_id
            )
            VALUES (?, ?, ?, 'Pending', ?, ?, 'None', ?)
        `;
        const [result] = await db.query(query, [
            userId,
            orderTransactionId,
            JSON.stringify(orderItems),
            paymentMethod,
            totalAmount,
            semesterId
        ]);

        if (result.affectedRows === 0) {
            return res.status(500).json({ message: 'Failed to place the order' });
        }

         const actionMessage = "Successfully order";
        const logQuery = `
            INSERT INTO product_transaction_logs (
                user_id,
                order_transaction_id,
                action_message,
                status,
                payment_method,
                total_amount,
                
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, 'Pending', ?, ?, NOW(), NOW())
        `;
        await db.query(logQuery, [
            userId,
            orderTransactionId,
            actionMessage,
            paymentMethod,
            totalAmount
        ]);


        // Insert into product_transaction_final_order and update product quantities
        const finalOrderInsertQuery = `
            INSERT INTO product_transaction_final_order (
                user_id,
                order_transaction_id,
                product_id,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const updateProductQuery = `
            UPDATE products
            SET 
                quantity = quantity - ?,
                smallquantity = smallquantity - ?,
                mediumquantity = mediumquantity - ?,
                largequantity = largequantity - ?,
                xlargequantity = xlargequantity - ?
            WHERE product_id = ?
        `;

        const logProductActionQuery = `
            INSERT INTO products_logs (
                product_id,
                organization_id,
                created_at,
                action,
                updated_at,
                created_by,
                performed_by,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            )
            VALUES (?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        `;

        for (let item of cartItems) {
            const {
                product_id,
                quantity = 0,
                smallquantity = 0,
                mediumquantity = 0,
                largequantity = 0,
                xlargequantity = 0
            } = item;

            // Get the current quantities of the product
            const currentProductQuery = `
                SELECT quantity, smallquantity, mediumquantity, largequantity, xlargequantity
                FROM products
                WHERE product_id = ?
            `;
            const [currentProduct] = await db.query(currentProductQuery, [product_id]);

            // Prepare action message and quantities to update
            let actionMessage = "Order placed, ";
            let updatedQuantities = [];

            // Only include the quantities that have a non-zero deduction
            if (quantity > 0) {
                updatedQuantities.push(`${quantity} quantity`);
            }
            if (smallquantity > 0) {
                updatedQuantities.push(`${smallquantity} smallquantity`);
            }
            if (mediumquantity > 0) {
                updatedQuantities.push(`${mediumquantity} mediumquantity`);
            }
            if (largequantity > 0) {
                updatedQuantities.push(`${largequantity} largequantity`);
            }
            if (xlargequantity > 0) {
                updatedQuantities.push(`${xlargequantity} xlargequantity`);
            }

            // If there are quantities to deduct, append them to the action message
            if (updatedQuantities.length > 0) {
                actionMessage += updatedQuantities.join(", ");
            } else {
                actionMessage = "No quantities to deduct.";
            }

            // Insert into product_transaction_final_order
            await db.query(finalOrderInsertQuery, [
                userId,
                orderTransactionId,
                product_id,
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity
            ]);

            // Update product quantities in products table
            await db.query(updateProductQuery, [
                quantity,
                smallquantity,
                mediumquantity,
                largequantity,
                xlargequantity,
                product_id
            ]);

            // Log the quantity changes in products_logs
            await db.query(logProductActionQuery, [
                product_id,
                new Date(),
                actionMessage,
                new Date(),
                userId,
                -quantity,
                -smallquantity,
                -mediumquantity,
                -largequantity,
                -xlargequantity
            ]);
        }

        // Delete the products from the addtocart table after placing the order
        const productIds = cartItems.map(item => item.product_id);
        const deleteQuery1 = `DELETE FROM addtocart WHERE user_id = ? AND product_id IN (?)`;
        await db.query(deleteQuery1, [userId, productIds]);

        // Delete the products from the revieworders table after placing the order
        const deleteQuery2 = `DELETE FROM revieworders WHERE user_id = ? AND product_id IN (?)`;
        await db.query(deleteQuery2, [userId, productIds]);

        // Return success message
        res.status(200).json({ message: 'Order placed successfully', orderTransactionId });
    } catch (err) {
        console.error('Error placing order:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};











exports.deleteReviewOrders = async (req, res) => {
    const userId = req.userId;  // Get userId from the JWT token

    // Ensure the user ID exists
    if (!userId) {
        return res.status(400).json({ message: 'User not authenticated' });
    }

    try {
        // Query to delete all review orders for this user
        const query = `
            DELETE FROM revieworders WHERE user_id = ?
        `;
        
        const [result] = await db.query(query, [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No review orders found for this user to delete.' });
        }

        // Return success message
        res.status(200).json({ message: 'Review orders deleted successfully.' });

    } catch (err) {
        console.error('Error deleting review orders:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
exports.getReviewOrders = async (req, res) => {
    const userId = req.userId;  // Get userId from the JWT token

    // Ensure the user ID exists
    if (!userId) {
        return res.status(400).json({ message: 'User not authenticated' });
    }

    try {
        // Query the database to get the user's review orders
        const query = `
            SELECT ro.id, ro.product_id,p.name, ro.quantity, ro.smallquantity, ro.mediumquantity, ro.largequantity, ro.xlargequantity, p.price, p.product_image
            FROM revieworders ro
            JOIN products p ON ro.product_id = p.product_id
            WHERE ro.user_id = ?
        `;
        
        const [orders] = await db.query(query, [userId]);

        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user.' });
        }

        // Return the review orders to the frontend
        res.status(200).json(orders);

    } catch (err) {
        console.error('Error fetching review orders:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
exports.handleReviewOrder = async (req, res) => { 
    const { cartItems } = req.body;
    const userId = req.userId;  // Get user ID from JWT token

    if (!userId) {
        return res.status(400).json({ message: 'User not authenticated' });
    }

    try {
        // Check if user already has a pending order
        const pendingOrderQuery = `
            SELECT * FROM product_transaction
            WHERE user_id = ? AND status = 'Pending'
        `;
        const [existingPendingOrder] = await db.query(pendingOrderQuery, [userId]);

        if (existingPendingOrder.length > 0) {
            return res.status(400).json({ message: 'You already have a pending order. Please complete or cancel it before placing a new order.' });
        }

        // Check if user exists
        const [userExists] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (!userExists || userExists.length === 0) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: 'No items in cart' });
        }

        // Loop through cart items and validate stock availability & order acceptance
        for (const item of cartItems) {
            const { productId, quantity, smallQuantity, mediumQuantity, largeQuantity, xlargeQuantity } = item;
            
            // Query to check product status, stock, and store order acceptance
            const currentProductQuery = `
                SELECT p.product_id, p.quantity, p.smallquantity, p.mediumquantity, p.largequantity, p.xlargequantity, 
                       p.name, p.organization_id, p.status AS product_status, o.order_status, o.name AS orgname
                FROM products p
                JOIN organizations o ON p.organization_id = o.id
                WHERE p.product_id = ?
            `;
            const [currentProduct] = await db.query(currentProductQuery, [productId]);

            if (!currentProduct || currentProduct.length === 0) {
                return res.status(400).json({ message: `Product with ID ${productId} does not exist` });
            }

            const product = currentProduct[0];

            // 🔹 **Check if store is accepting orders**
            if (product.order_status !== 'Accept Order') {
                return res.status(400).json({ message: `The "${product.orgname}" is not currently accepting orders.` });
            }

            // 🔹 **Check if product is in "Pre-Order" status**
            if (product.product_status === 'Pre-Order') {
                return res.status(400).json({
                    message: `The product "${product.name}" is currently on Pre-Order and cannot be added to the review order.`
                });
            }

            // Check if requested quantities are available
            if (smallQuantity > product.smallquantity) {
                return res.status(400).json({
                    message: `Not enough small quantity for "${product.name}". Available: ${product.smallquantity} stocks left`
                });
            }
            if (mediumQuantity > product.mediumquantity) {
                return res.status(400).json({
                    message: `Not enough medium quantity for "${product.name}". Available: ${product.mediumquantity} stocks left`
                });
            }
            if (largeQuantity > product.largequantity) {
                return res.status(400).json({
                    message: `Not enough large quantity for "${product.name}". Available: ${product.largequantity} stocks left`
                });
            }
            if (xlargeQuantity > product.xlargequantity) {
                return res.status(400).json({
                    message: `Not enough xlarge quantity for "${product.name}". Available: ${product.xlargequantity} stocks left`
                });
            }
            if (quantity > product.quantity) {
                return res.status(400).json({
                    message: `Not enough quantity for "${product.name}". Available: ${product.quantity} stocks left`
                });
            }
        }

        // Insert review orders
        const values = cartItems.map(item => [
            userId, 
            item.productId,
            item.quantity,
            item.smallQuantity,
            item.mediumQuantity,
            item.largeQuantity,
            item.xlargeQuantity
        ]);

        const insertQuery = `
            INSERT INTO revieworders (user_id, product_id, quantity, smallquantity, mediumquantity, largequantity, xlargequantity)
            VALUES ?
        `;

        await db.query(insertQuery, [values]);

        res.status(200).json({ message: 'Review orders added successfully' });

    } catch (err) {
        console.error('Error handling review order:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};








exports.updateCartItemQuantity = async (req, res) => {
    const { cartItemId } = req.params;
    const { size, quantity } = req.body; // Get size and quantity from the request body
    const userId = req.userId; // Assuming userId is available from middleware
  
    // Define valid column names for the quantities
    const validColumns = ['quantity', 'smallquantity', 'mediumquantity', 'largequantity', 'xlargequantity'];
  
    try {
      // Check if the cart item exists for the user
      const query = `
        SELECT * FROM addtocart 
        WHERE id = ? AND user_id = ?
      `;
      const [cartItem] = await db.execute(query, [cartItemId, userId]);
  
      if (cartItem.length === 0) {
        return res.status(404).json({ message: 'Cart item not found.' });
      }
  
      // Check if the size corresponds to a valid column in the table
      if (!validColumns.includes(size)) {
        return res.status(400).json({ message: 'Invalid size specified.' });
      }
  
      // Update the quantity for the specified size
      const updateQuery = `
        UPDATE addtocart 
        SET ${size} = ? 
        WHERE id = ? AND user_id = ?
      `;
      await db.execute(updateQuery, [quantity, cartItemId, userId]);
  
      return res.status(200).json({ message: 'Cart item quantity updated successfully.' });
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      return res.status(500).json({ message: 'Failed to update cart item quantity.' });
    }
  };
  
  exports.getUserCarthome = async (req, res) => {
    const userId = req.userId; // Assuming userId is available from middleware

    try {
        // Query to fetch cart items along with product and organization details
        const query = `
            SELECT 
                c.id, 
                c.product_id, 
                p.name AS product_name, 
                p.price, 
                p.product_image, 
                p.organization_id, 
                c.addtocart_totalnumber,
                o.name AS organization_name,
                o.photo,
                c.quantity,
                c.smallquantity, 
                c.mediumquantity,
                c.largequantity,
                c.xlargequantity
            FROM addtocart c
            JOIN products p ON c.product_id = p.product_id
            JOIN organizations o ON p.organization_id = o.id
            WHERE c.user_id = ?
        `;
        
        // Execute the query
        const [cartItems] = await db.execute(query, [userId]);

        // If no items found, return empty array or appropriate message
        if (cartItems.length === 0) {
            return res.status(200).json({ message: "No items in cart" });
        }

        
       

        // Send the response with the cart items
        return res.status(200).json(cartItems);
    } catch (error) {
        console.error('Error fetching cart:', error);
        return res.status(500).json({ message: 'Failed to fetch cart.' });
    }
};

exports.getUserTransactionCount = async (req, res) => {
    try {
        const userId = req.userId; // Extract user ID from token
        const [result] = await db.execute('SELECT COUNT(*) AS transactionCount FROM transactions WHERE user_id = ?', [userId]);

        res.json({ transactionCount: result[0].transactionCount });
    } catch (error) {
        console.error('Error fetching transaction count:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get count of product transactions for the logged-in user
exports.getUserProductTransactionCount = async (req, res) => {
    try {
        const userId = req.userId; // Extract user ID from token
        const [result] = await db.execute('SELECT COUNT(*) AS productTransactionCount FROM product_transaction WHERE user_id = ?', [userId]);

        res.json({ productTransactionCount: result[0].productTransactionCount });
    } catch (error) {
        console.error('Error fetching product transaction count:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getUserCart = async (req, res) => {
    const userId = req.userId; // Assuming userId is available from middleware

    try {
        // Query to fetch cart items along with product and organization details
        const query = `
            SELECT 
                c.id, 
                c.product_id, 
                p.name AS product_name, 
                p.price, 
                o.photo,
                p.product_image, 
                p.organization_id, 
                c.addtocart_totalnumber,
                o.name AS organization_name,
                c.quantity,
                c.smallquantity, 
                c.mediumquantity,
                c.largequantity,
                c.xlargequantity
            FROM addtocart c
            JOIN products p ON c.product_id = p.product_id
            JOIN organizations o ON p.organization_id = o.id
            WHERE c.user_id = ?
        `;
        
        // Execute the query
        const [cartItems] = await db.execute(query, [userId]);

        // If no items found, return empty array or appropriate message
        if (cartItems.length === 0) {
            return res.status(200).json({ message: "No items in cart" });
        }

        // Update product_image URLs dynamically
       
        // Send the response with the cart items
        return res.status(200).json(cartItems);
    } catch (error) {
        console.error('Error fetching cart:', error);
        return res.status(500).json({ message: 'Failed to fetch cart.' });
    }
};
  
  
  // Delete item from user's cart
  exports.deleteCartItem = async (req, res) => {
    const { cartItemId } = req.params;
    const userId = req.userId; // Assuming userId is available from middleware
  
    try {
      const query = `
        DELETE FROM addtocart
        WHERE id = ? AND user_id = ?
      `;
      await db.execute(query, [cartItemId, userId]);
  
      return res.status(200).json({ message: 'Cart item deleted successfully.' });
    } catch (error) {
      console.error('Error deleting cart item:', error);
      return res.status(500).json({ message: 'Failed to delete cart item.' });
    }
  };
  exports.addToCart = async (req, res) => {
    const { user_id, product_id, quantity, size } = req.body; // Ensure to get quantity and size from the body
  
    try {
      if (!user_id || !product_id || !quantity) {
        return res.status(400).json({ message: 'User ID, Product ID, and Quantity are required.' });
      }
  
      let sizeColumn;
      // Check if size is provided, otherwise use default 'quantity' field
      if (size) {
        // Dynamically set the column name based on the selected size
        switch (size) {
          case 'small':
            sizeColumn = 'smallquantity';
            break;
          case 'medium':
            sizeColumn = 'mediumquantity';
            break;
          case 'large':
            sizeColumn = 'largequantity';
            break;
          case 'xlarge':
            sizeColumn = 'xlargequantity';
            break;
          default:
            return res.status(400).json({ message: 'Invalid size.' });
        }
      } else {
        // Use default quantity field if no size is provided
        sizeColumn = 'quantity';
      }
  
      // Check if the product is already in the user's cart for the selected size or quantity
      const checkQuery = `
      SELECT * FROM addtocart 
      WHERE user_id = ? AND product_id = ? AND ${sizeColumn} > 0
    `;
    const [existingCart] = await db.execute(checkQuery, [user_id, product_id]);

    if (existingCart.length > 0) {
      // If the product with the selected size already exists in the cart, reject the request
      return res.status(400).json({ message: `This product of ${size || 'default'} already exists in the cart.` });
    }
  
      // Insert into addtocart table if product is not already in the cart
      const insertQuery = `
        INSERT INTO addtocart (user_id, product_id, ${sizeColumn}, created_at, updated_at, created_by)
        VALUES (?, ?, ?, NOW(), NOW(), ?)
      `;
      const createdBy = user_id; // Assuming the user creating the cart item
      const [result] = await db.execute(insertQuery, [
        user_id, 
        product_id, 
        quantity, // Set the quantity for the selected size or default quantity
        createdBy,
      ]);
  
      return res.status(201).json({ message: 'Product added to cart successfully!', id: result.insertId });
    } catch (error) {
      console.error('Error adding to cart:', error);
      return res.status(500).json({ message: 'Failed to add product to cart.' });
    }
  };
  
  
  
  
  


exports.checkExistingTransaction = async (req, res) => {
    try {
      const { payment_id } = req.body;
      const userId = req.userId;
  
      const query = `
        SELECT * FROM transactions 
        WHERE user_id = ? AND payment_id = ? 
        AND payment_status IN ('Paid', 'Balance', 'Pending', 'Processing', 'Pending Balance')
      `;
      
      const [existingTransaction] = await db.query(query, [userId, payment_id]);
  
      res.status(200).json({ exists: existingTransaction.length > 0 });
    } catch (error) {
      console.error('Error checking existing transaction:', error);
      res.status(500).json({ error: 'An error occurred while checking for existing transactions.' });
    }
  };
  

  exports.addAmount = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { total_amount } = req.body;
        const payment_method = 'Gcash';
        const orgUserId = req.orgIduser;

        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        const [paymentDetails] = await db.query(
            `SELECT price, id, name, organization_id, semester_id FROM payments WHERE id = (SELECT payment_id FROM transactions WHERE transaction_id = ?)`,
            [transactionId]
        );

        if (paymentDetails.length === 0) {
            return res.status(404).json({ message: 'Payment ID not found.' });
        }

        const { price, id: paymentId, name: paymentName, organization_id, semester_id } = paymentDetails[0];
        let balance = total_amount - price;  // Balance reflects the difference
        let payment_status = 'Paid';  // Default status

        // Check balance and set the status accordingly
        if (balance < 0) { // This means not enough was paid
            payment_status = 'Balance'; // Not fully paid
            balance = -Math.abs(balance); // Make sure the balance is positive but displayed as negative
        } else if (balance > 0) { // This means too much was paid
            return res.status(400).json({ message: 'Total amount exceeds the price.' });
        } else {
            balance = 0; // If the balance is exactly zero
        }

        await db.query(
            `UPDATE transactions SET payment_method = ?, total_amount = ?, balance = ?, payment_status = ?, received_by = ?, updated_at = NOW() WHERE transaction_id = ?`,
            [payment_method, total_amount, balance, payment_status, orgUserId, transactionId]
        );

        const actionMessage = `Received total of ₱${total_amount}`;
        await db.query(
            `INSERT INTO transactions_history (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, received_by, action, created_at) 
             SELECT user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, ?, ?, NOW() FROM transactions WHERE transaction_id = ?`,
            [orgUserId, actionMessage, transactionId]
        );

        const [organizationResult] = await db.query(
            `SELECT name, photo FROM organizations WHERE id = ?`,
            [organization_id]
        );
        const organizationName = organizationResult[0].name;
        let organizationPhoto = organizationResult[0].photo;

        const [semesterResult] = await db.query(
            `SELECT name, year FROM semesters WHERE id = ?`,
            [semester_id]
        );
        const semester = semesterResult[0];

        const [userResult] = await db.query(
            `SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = (SELECT user_id FROM transactions WHERE transaction_id = ?)`,
            [transactionId]
        );
        const user = userResult[0];

        const [orgUserDetails] = await db.query(
            `SELECT firstname, lastname, middlename FROM organizations_users WHERE id = ?`,
            [orgUserId]
        );
        const orgUserFullName = `${orgUserDetails[0].firstname}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg');
        let orgPhotoPath = localLogoPath;

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            const logoFilename = `${paymentId}.jpg`;
            const tempFilePath = path.join(tempDir, logoFilename);

            if (!fs.existsSync(tempFilePath)) {
                try {
                    const response = await axios.get(organizationPhoto, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tempFilePath, response.data);
                    orgPhotoPath = tempFilePath;
                } catch (err) {
                    console.error('Error downloading organization logo:', err);
                    orgPhotoPath = localLogoPath;
                }
            } else {
                orgPhotoPath = tempFilePath;
            }
        }

        let receiptFilePath = '';
        if (payment_status === 'Paid') {
            const doc = new PDFDocument({ size: [595, 420], margins: { top: 50, left: 50, right: 50, bottom: 50 } });
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }
            receiptFilePath = path.join(receiptsDir, `receipt_${transactionId}.pdf`);
            doc.pipe(fs.createWriteStream(receiptFilePath));

            doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });

    // **Insert Circular Organization Logo (Right)**
    const orgLogoX = 465; // X position
    const orgLogoY = 40;  // Y position
    const orgLogoSize = 80; // Size of the circular image

    // **Clip the logo into a circular shape**
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
    doc.font('Helvetica').text('Zamboanga City', { align: 'center' }); // Reset to normal

            doc.save(); 
doc.opacity(0.1); // **Set Transparency to 10% (Less Visible)**
doc.circle(300, 250, 150) // **Create Circular Clip (Center X: 300, Y: 250, Radius: 150)**
    .clip()
    .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' }); // **Centered Background Image**  
doc.restore(); // Restore Original State


    doc.text('\n\n');
            
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semester.name}`, { align: 'right' });
            doc.text(`Course and Section: ${user.course}-${user.section}`, { align: 'left' });
            doc.text('\n\n');
            doc.text(`Amount Received: ${total_amount}`, { align: 'center' });
            doc.text(`Received Payment From ${user.firstname} ${user.middlename} ${user.lastname}`, { align: 'center' });
            doc.text(`As Payment For ${paymentName}`, { align: 'center' });
            doc.text('\n\n');
            doc.text(`RECEIPT NO. ${transactionId}`, { align: 'left', continued: true });
            doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });
            doc.end();
        }

        await sendTransactionNotification(
            user.email,
            user.firstname,
            user.middlename,
            user.lastname,
            organizationName,
            paymentName,
            payment_status,
            total_amount,
            transactionId,
            payment_method,
            orgUserFullName,
            balance,
            semester.name,
            semester.year,
            receiptFilePath
        );

        res.status(200).json({ success: true, message: 'Transaction updated and receipt sent successfully.' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ success: false, error: 'Error updating transaction.' });
    }
};


// Accept Payment
exports.acceptPaymentGcash = async (req, res) => {
    try {
        const { transactionId } = req.params; // Retrieve the transaction ID from request parameters
        const orgUserId = req.orgIduser; // Retrieve the organization user ID from the request

        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        // Update the transaction's payment status and set the received_by field
        const updateTransactionQuery = `
            UPDATE transactions 
            SET 
                payment_status = 'Balance Gcash', 
                received_by = ?, 
                updated_at = NOW() 
            WHERE 
                transaction_id = ?`;

        await db.query(updateTransactionQuery, [orgUserId, transactionId]);

        // Prepare the action message for logging in `transactions_history`
        const actionMessage = 'New payment balance accepted.';

        // Insert a record into the `transactions_history` table by copying data from the `transactions` table
        const logHistoryQuery = `
            INSERT INTO transactions_history (
                transaction_id, 
                user_id, 
                payment_id, 
                payment_status, 
                payment_method, 
                total_amount, 
                balance, 
                proof_of_payment, 
                promissory_note, 
                received_by, 
                action, 
                created_at
            )
            SELECT 
                transaction_id, 
                user_id, 
                payment_id, 
                payment_status, 
                payment_method, 
                total_amount, 
                balance, 
                proof_of_payment, 
                promissory_note, 
                ?, ?, NOW()
            FROM 
                transactions 
            WHERE 
                transaction_id = ?`;

        await db.query(logHistoryQuery, [orgUserId, actionMessage, transactionId]);

        res.status(200).json({ success: true, message: 'New payment balance accepted.' });
    } catch (error) {
        console.error('Error accepting payment:', error);
        res.status(500).json({ success: false, error: 'Error accepting payment.' });
    }
};



// Decline Payment
exports.declinePaymentGcash = async (req, res) => {
    try {
        const { transactionId } = req.params; // Retrieve the transaction ID from request parameters
        const orgUserId = req.orgIduser; // Retrieve the organization user ID from the request

        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        // Update the transaction's payment status and set the received_by field
        const updateTransactionQuery = `
            UPDATE transactions 
            SET 
                payment_status = 'Balance', 
                received_by = ?, 
                updated_at = NOW() 
            WHERE 
                transaction_id = ?`;

        await db.query(updateTransactionQuery, [orgUserId, transactionId]);

        // Prepare the action message for logging in `transactions_history`
        const actionMessage = 'New payment balance declined';

        // Insert a record into the `transactions_history` table by copying data from the `transactions` table
        const logHistoryQuery = `
            INSERT INTO transactions_history (
                transaction_id, 
                user_id, 
                payment_id, 
                payment_status, 
                payment_method, 
                total_amount, 
                balance, 
                proof_of_payment, 
                promissory_note, 
                received_by, 
                action, 
                created_at
            )
            SELECT 
                transaction_id, 
                user_id, 
                payment_id, 
                'Declined',  -- Override payment_status to "Declined"
                payment_method, 
                total_amount, 
                balance, 
                proof_of_payment, 
                promissory_note, 
                ?, ?, NOW()
            FROM 
                transactions 
            WHERE 
                transaction_id = ?`;

        await db.query(logHistoryQuery, [orgUserId, actionMessage, transactionId]);

        res.status(200).json({ success: true, message: 'Payment declined and status updated to Decline.' });
    } catch (error) {
        console.error('Error declining payment:', error);
        res.status(500).json({ success: false, error: 'Error declining payment.' });
    }
};


// Accept Payment
exports.acceptPayment = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const orgUserId = req.orgIduser; // Retrieve the orgUserId from the request
        
        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        // Update transaction to Processing
        const query = `
            UPDATE transactions 
            SET payment_status = 'Processing', received_by = ?, updated_at = NOW() 
            WHERE transaction_id = ?`;

        await db.query(query, [orgUserId, transactionId]);

        // Log action in transactions_history with the action message
        const actionMessage = 'Payment accepted and status updated to Processing.';
        
        await db.query(
            `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, received_by, action, created_at)
            SELECT transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note,  ?, ?, NOW()
            FROM transactions WHERE transaction_id = ?`,
            [orgUserId, actionMessage, transactionId]
        );

        res.status(200).json({ success: true, message: 'Payment accepted and status updated to Processing.' });
    } catch (error) {
        console.error('Error accepting payment:', error);
        res.status(500).json({ success: false, error: 'Error accepting payment.' });
    }
};

// Decline Payment
exports.declinePayment = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const orgUserId = req.orgIduser; // Retrieve the orgUserId from the request
        
        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        // Update transaction to Decline
        const query = `
            UPDATE transactions 
            SET payment_status = 'Decline', received_by = ?, updated_at = NOW() 
            WHERE transaction_id = ?`;

        await db.query(query, [orgUserId, transactionId]);

        // Log action in transactions_history with the action message
        const actionMessage = 'Payment declined and status updated to Decline.';

        await db.query(
            `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note,  received_by, action, created_at)
            SELECT transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, ?, ?, NOW()
            FROM transactions WHERE transaction_id = ?`,
            [orgUserId, actionMessage, transactionId]
        );

        res.status(200).json({ success: true, message: 'Payment declined and status updated to Decline.' });
    } catch (error) {
        console.error('Error declining payment:', error);
        res.status(500).json({ success: false, error: 'Error declining payment.' });
    }
};


  

exports.getPaymentDetails = async (req, res) => {
    try {
        const { payment_id } = req.body;
        if (!payment_id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Query the database for payment details including organization_id
        const query = `
            SELECT p.name, p.price, p.qrcode_picture, p.organization_id, 
                   o.name AS organization_name, 
                   o.photo AS organization_photo
            FROM payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = ?`;
        
        const [paymentDetails] = await db.query(query, [payment_id]);

        if (paymentDetails.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const { name, price, qrcode_picture, organization_name, organization_photo } = paymentDetails[0];

        // Return the details with organization name and photo
        return res.status(200).json({ 
            name, 
            price, 
            qrcode_picture, 
            organization: {
                name: organization_name,
                photo: organization_photo
            }
        });

    } catch (error) {
        console.error('Error fetching payment details:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};



  
const userqrstorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const paymentId = req.body.payment_id;
        const dir = `uploads/uploadqruser/${userId}/${paymentId}`;

        // Create directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`); // Unique filename
    },
});

const userqrupload = multer({ storage: userqrstorage });

exports.addTransaction = [
    userqrupload.single('proof_of_payment'), // Handle image upload
    async (req, res) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const {
                payment_id,
                transaction_id,
                payment_status,
                payment_method,
                total_amount,
                balance,
                promissory_note
            } = req.body;

            // Check if a transaction already exists
            const checkQuery = `
                SELECT * FROM transactions 
                WHERE user_id = ? AND payment_id = ? 
                AND payment_status IN ('Paid', 'Balance', 'Pending', 'Processing')
            `;
            const [existingTransaction] = await db.query(checkQuery, [req.userId, payment_id]);

            if (existingTransaction.length > 0) {
                return res.status(400).json({ error: 'Transaction for this payment already exists' });
            }

            const transactionStatus = payment_status || 'Pending';
            const paymentMethod = payment_method || 'Gcash';
            const totalAmount = total_amount || 0;
            const balanceAmount = balance || totalAmount;
            const promissoryNote = promissory_note || null;
            const proofOfPayment = req.file;

            // Fetch payment details
            const [paymentDetails] = await db.query('SELECT organization_id, name FROM payments WHERE id = ?', [payment_id]);
            if (!paymentDetails.length) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            const { organization_id: organizationId, name: paymentName } = paymentDetails[0];

            // Fetch organization name
            const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organizationResult.length) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            const organizationName = organizationResult[0].name;

            // Fetch user details
            const [userResult] = await db.query(
                'SELECT firstname, lastname, middlename FROM users WHERE id = ?',
                [req.userId]
            );
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            const { firstname, lastname, middlename } = userResult[0];
            const userFolder = `${firstname}_${middlename}_${lastname}`;

            const uniqueFilename = `${uuidv4()}${path.extname(proofOfPayment.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(proofOfPayment.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create Dropbox folder
            const folderPath = `/uploads/${organizationName}/Payments/${paymentName}/${userFolder}`;
            try {
                await dropbox.filesCreateFolderV2({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    throw error;
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let proofOfPaymentLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                proofOfPaymentLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    proofOfPaymentLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Insert transaction
            const query = `
                INSERT INTO transactions (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, promissory_note, proof_of_payment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Insert transaction history
            const historyQuery = `
                INSERT INTO transactions_history 
                (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, promissory_note, proof_of_payment, action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            await db.query(query, [
                req.userId,
                payment_id,
                transaction_id,
                transactionStatus,
                paymentMethod,
                totalAmount,
                balanceAmount,
                promissoryNote,
                proofOfPaymentLink
            ]);

            await db.query(historyQuery, [
                req.userId,
                payment_id,
                transaction_id,
                transactionStatus,
                paymentMethod,
                totalAmount,
                balanceAmount,
                promissoryNote,
                proofOfPaymentLink,
                'Transaction successfully placed'
            ]);

            res.status(201).json({ message: 'Transaction added successfully', proofOfPaymentLink });
        } catch (error) {
            console.error('Error adding transaction:', error);
            res.status(500).json({ error: 'Error adding transaction: ' + error.message });
        }
    },
];

  


exports.addTransactionPromissory = [
    promissoryNoteUpload.single('promissory_note'), // Handle promissory note file upload
    async (req, res) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const {
                payment_id,
                transaction_id,
                payment_status,
                payment_method,
                total_amount
            } = req.body;

            // Check if a transaction already exists
            const checkQuery = `
                SELECT * FROM transactions 
                WHERE user_id = ? AND payment_id = ? 
                AND payment_status IN ('Paid', 'Balance', 'Pending', 'Processing')
            `;
            const [existingTransaction] = await db.query(checkQuery, [req.userId, payment_id]);

            if (existingTransaction.length > 0) {
                return res.status(400).json({ error: 'Transaction for this payment already exists' });
            }

            const transactionStatus = payment_status || 'Pending';
            const paymentMethod = payment_method || 'Gcash';

            // Fetch payment details
            const [paymentDetails] = await db.query('SELECT organization_id, name, price FROM payments WHERE id = ?', [payment_id]);
            if (!paymentDetails.length) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            const { organization_id: organizationId, name: paymentName, price: paymentPrice } = paymentDetails[0];

            // Calculate the balance as -price
            const balanceAmount = -paymentPrice;

            // Fetch organization name
            const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organizationResult.length) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            const organizationName = organizationResult[0].name;

            // Fetch user details
            const [userResult] = await db.query(
                'SELECT firstname, lastname, middlename FROM users WHERE id = ?',
                [req.userId]
            );
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            const { firstname, lastname, middlename } = userResult[0];
            const userFolder = `${firstname}_${middlename}_${lastname}`;

            // Generate a unique filename for the promissory note
            const promissoryNoteFile = req.file;
            const uniqueFilename = `${uuidv4()}${path.extname(promissoryNoteFile.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(promissoryNoteFile.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create a folder in Dropbox for the organization, payment, and user
            const folderPath = `/uploads/${organizationName}/Promissory notes/${paymentName}/${userFolder}`;
            try {
                await dropbox.filesCreateFolderV2({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    throw error;
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
            });

            // Generate shared link for the uploaded file
            let promissoryNoteLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                promissoryNoteLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    promissoryNoteLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Insert transaction
            const query = `
                INSERT INTO transactions (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, promissory_note, proof_of_payment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Insert transaction history
            const historyQuery = `
                INSERT INTO transactions_history 
                (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, promissory_note, proof_of_payment, action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            await db.query(query, [
                req.userId,
                payment_id,
                transaction_id,
                transactionStatus,
                paymentMethod,
                total_amount || 0,
                balanceAmount, 
                promissoryNoteLink, 
                null 
            ]);

            await db.query(historyQuery, [
                req.userId,
                payment_id,
                transaction_id,
                transactionStatus,
                paymentMethod,
                total_amount || 0,
                balanceAmount, 
                promissoryNoteLink, 
                null, 
                'Transaction with Promissory Note added successfully'
            ]);

            res.status(201).json({ message: 'Transaction with Promissory Note added successfully', promissoryNoteLink });
        } catch (error) {
            console.error('Error adding transaction with promissory note:', error);
            res.status(500).json({ error: 'Error adding transaction with promissory note: ' + error.message });
        }
    },
];


  
  
  
exports.getTransactionHistory = async (req, res) => {
    try {
        const { transactionId } = req.params;

        // Retrieve the transaction history details along with received_by user details
        const [transactionHistory] = await db.query(
            `SELECT th.*, 
                    u.firstname AS user_firstname, 
                    u.lastname AS user_lastname, 
                    u.middlename AS user_middlename,
                    ou.firstname AS received_firstname,
                    ou.lastname AS received_lastname,
                    ou.middlename AS received_middlename
             FROM transactions_history th
             LEFT JOIN users u ON th.user_id = u.id
             LEFT JOIN organizations_users ou ON th.received_by = ou.id
             WHERE th.transaction_id = ? 
             ORDER BY th.created_at DESC`,
            [transactionId]
        );

        if (transactionHistory.length === 0) {
            return res.status(404).json({ message: 'Transaction history not found.' });
        }

        res.status(200).json(transactionHistory);

    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ message: 'An error occurred while fetching the transaction history. Please try again later.' });
    }
};


exports.updatePayment = async (req, res) => { 
    try {
        const { transactionId, additionalAmount, payment_method } = req.body;
        const orgUserId = req.orgIduser; 

        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        const [paymentDetails] = await db.query(
            `SELECT payments.id AS payment_id, payments.price, payments.name, payments.organization_id, payments.semester_id 
             FROM payments
             JOIN transactions ON payments.id = transactions.payment_id
             WHERE transactions.transaction_id = ?`,
            [transactionId]
        );
        
        if (paymentDetails.length === 0) {
            return res.status(404).json({ message: 'Payment ID not found.' });
        }

        const { price, id: paymentId, name: paymentName, organization_id, semester_id } = paymentDetails[0];

        const [existingTransaction] = await db.query(
            `SELECT total_amount, balance FROM transactions WHERE transaction_id = ?`,
            [transactionId]
        );

        if (existingTransaction.length === 0) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        let totalAmount = existingTransaction[0].total_amount + additionalAmount;
        let balance = totalAmount - price;
        let paymentStatus = 'Paid';
        const paymentMethod = payment_method; // Declare it as a constant

        if (balance < 0) {
            paymentStatus = 'Balance';
        } else if (balance > 0) {
            return res.status(400).json({ message: 'Total amount exceeds the price.' });
        }

        await db.query(
            `UPDATE transactions SET total_amount = ?, balance = ?, payment_status = ?, payment_method = ?, received_by = ?, updated_at = NOW() WHERE transaction_id = ?`,
            [totalAmount, balance, paymentStatus, paymentMethod, orgUserId, transactionId]
        );

        const actionMessage = `Pay balance total of ₱ ${additionalAmount}`;

        await db.query(
            `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, received_by, action, created_at)
            SELECT transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, ?, ?, NOW()
            FROM transactions WHERE transaction_id = ?`,
            [orgUserId, actionMessage, transactionId]
        );

        const [organizationResult] = await db.query(
            `SELECT name, photo FROM organizations WHERE id = ?`,
            [organization_id]
        );
        const organizationName = organizationResult[0].name;
        let organizationPhoto = organizationResult[0].photo;

        const [semesterResult] = await db.query(
            `SELECT name, year FROM semesters WHERE id = ?`,
            [semester_id]
        );
        const semester = semesterResult[0];

        const [userResult] = await db.query(
            `SELECT firstname, middlename, lastname, email, course, section 
             FROM users WHERE id = (SELECT user_id FROM transactions WHERE transaction_id = ?)`,
            [transactionId]
        );
        const user = userResult[0];

        const [orgUserDetails] = await db.query(
            `SELECT firstname, lastname, middlename FROM organizations_users WHERE id = ?`,
            [orgUserId]
        );
        const orgUserFullName = `${orgUserDetails[0].firstname}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg');
        let orgPhotoPath = localLogoPath;

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            const logoFilename = `${paymentId}.jpg`;
            const tempFilePath = path.join(tempDir, logoFilename);

            if (!fs.existsSync(tempFilePath)) {
                try {
                    const response = await axios.get(organizationPhoto, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tempFilePath, response.data);
                    orgPhotoPath = tempFilePath;
                } catch (err) {
                    console.error('Error downloading organization logo:', err);
                    orgPhotoPath = localLogoPath;
                }
            } else {
                orgPhotoPath = tempFilePath;
            }
        }

        let receiptFilePath = '';
        if (paymentStatus === 'Paid') {
            const doc = new PDFDocument({ size: [595, 420], margins: { top: 50, left: 50, right: 50, bottom: 50 } });
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }
            receiptFilePath = path.join(receiptsDir, `receipt_${transactionId}.pdf`);
            doc.pipe(fs.createWriteStream(receiptFilePath));

            doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });
            
            const orgLogoX = 465, orgLogoY = 40, orgLogoSize = 80;
            doc.save();
            doc.circle(orgLogoX + orgLogoSize / 2, orgLogoY + orgLogoSize / 2, orgLogoSize / 2).clip()
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
            doc.circle(300, 250, 150).clip()
                .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' });
            doc.restore();

            doc.text('\n\n');
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semester.name}`, { align: 'right' });
            doc.text(`Course and Section: ${user.course}-${user.section}`, { align: 'left' });
            doc.text('\n\n');
            doc.text(`Amount Received: ${totalAmount}`, { align: 'center' });
            doc.text(`Received Payment From ${user.firstname} ${user.middlename} ${user.lastname}`, { align: 'center' });
            doc.text(`As Payment For ${paymentName}`, { align: 'center' });
            doc.text('\n\n');
            doc.text(`RECEIPT NO. ${transactionId}`, { align: 'left', continued: true });
            doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });
            doc.end();
        }

        await sendTransactionNotification(user.email, user.firstname, user.middlename, user.lastname, organizationName, paymentName, paymentStatus, totalAmount, transactionId, paymentMethod, orgUserFullName, balance, semester.name, semester.year, receiptFilePath);
        res.status(200).json({ success: true, message: 'Transaction updated and receipt sent successfully.' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ success: false, error: 'Error updating transaction.' });
    }
};

exports.updatePaymentPending = async (req, res) => { 
    try {
        const { transactionId, additionalAmount, payment_method } = req.body;
        const orgUserId = req.orgIduser; 

        if (!orgUserId) {
            return res.status(400).json({ message: 'Organization user ID is required.' });
        }

        const [paymentDetails] = await db.query(
            `SELECT payments.id AS payment_id, payments.price, payments.name, payments.organization_id, payments.semester_id 
             FROM payments
             JOIN transactions ON payments.id = transactions.payment_id
             WHERE transactions.transaction_id = ?`,
            [transactionId]
        );
        
        if (paymentDetails.length === 0) {
            return res.status(404).json({ message: 'Payment ID not found.' });
        }

        const { price, id: paymentId, name: paymentName, organization_id, semester_id } = paymentDetails[0];

        const [existingTransaction] = await db.query(
            `SELECT total_amount, balance FROM transactions WHERE transaction_id = ?`,
            [transactionId]
        );

        if (existingTransaction.length === 0) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        let totalAmount = existingTransaction[0].total_amount + additionalAmount;
        let balance = totalAmount - price;
        let paymentStatus = 'Paid';
        const paymentMethod = payment_method; // Declare it as a constant

        if (balance < 0) {
            paymentStatus = 'Balance';
        } else if (balance > 0) {
            return res.status(400).json({ message: 'Total amount exceeds the price.' });
        }

        await db.query(
            `UPDATE transactions SET total_amount = ?, balance = ?, payment_status = ?, payment_method = ?, received_by = ?, updated_at = NOW() WHERE transaction_id = ?`,
            [totalAmount, balance, paymentStatus, paymentMethod, orgUserId, transactionId]
        );

        const actionMessage = `Pay balance total of ₱ ${additionalAmount}`;

        await db.query(
            `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, received_by, action, created_at)
            SELECT transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, proof_of_payment, promissory_note, ?, ?, NOW()
            FROM transactions WHERE transaction_id = ?`,
            [orgUserId, actionMessage, transactionId]
        );

        const [organizationResult] = await db.query(
            `SELECT name, photo FROM organizations WHERE id = ?`,
            [organization_id]
        );
        const organizationName = organizationResult[0].name;
        let organizationPhoto = organizationResult[0].photo;

        const [semesterResult] = await db.query(
            `SELECT name, year FROM semesters WHERE id = ?`,
            [semester_id]
        );
        const semester = semesterResult[0];

        const [userResult] = await db.query(
            `SELECT firstname, middlename, lastname, email, course, section 
             FROM users WHERE id = (SELECT user_id FROM transactions WHERE transaction_id = ?)`,
            [transactionId]
        );
        const user = userResult[0];

        const [orgUserDetails] = await db.query(
            `SELECT firstname, lastname, middlename FROM organizations_users WHERE id = ?`,
            [orgUserId]
        );
        const orgUserFullName = `${orgUserDetails[0].firstname}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg');
        let orgPhotoPath = localLogoPath;

        if (organizationPhoto && organizationPhoto.startsWith('http')) {
            const logoFilename = `${paymentId}.jpg`;
            const tempFilePath = path.join(tempDir, logoFilename);

            if (!fs.existsSync(tempFilePath)) {
                try {
                    const response = await axios.get(organizationPhoto, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tempFilePath, response.data);
                    orgPhotoPath = tempFilePath;
                } catch (err) {
                    console.error('Error downloading organization logo:', err);
                    orgPhotoPath = localLogoPath;
                }
            } else {
                orgPhotoPath = tempFilePath;
            }
        }

        let receiptFilePath = '';
        if (paymentStatus === 'Paid') {
            const doc = new PDFDocument({ size: [595, 420], margins: { top: 50, left: 50, right: 50, bottom: 50 } });
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }
            receiptFilePath = path.join(receiptsDir, `receipt_${transactionId}.pdf`);
            doc.pipe(fs.createWriteStream(receiptFilePath));

            doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });
            
            const orgLogoX = 465, orgLogoY = 40, orgLogoSize = 80;
            doc.save();
            doc.circle(orgLogoX + orgLogoSize / 2, orgLogoY + orgLogoSize / 2, orgLogoSize / 2).clip()
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
            doc.circle(300, 250, 150).clip()
                .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' });
            doc.restore();

            doc.text('\n\n');
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semester.name}`, { align: 'right' });
            doc.text(`Course and Section: ${user.course}-${user.section}`, { align: 'left' });
            doc.text('\n\n');
            doc.text(`Amount Received: ${totalAmount}`, { align: 'center' });
            doc.text(`Received Payment From ${user.firstname} ${user.middlename} ${user.lastname}`, { align: 'center' });
            doc.text(`As Payment For ${paymentName}`, { align: 'center' });
            doc.text('\n\n');
            doc.text(`RECEIPT NO. ${transactionId}`, { align: 'left', continued: true });
            doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });
            doc.end();
        }

        await sendTransactionNotification(user.email, user.firstname, user.middlename, user.lastname, organizationName, paymentName, paymentStatus, totalAmount, transactionId, paymentMethod, orgUserFullName, balance, semester.name, semester.year, receiptFilePath);
        res.status(200).json({ success: true, message: 'Transaction updated and receipt sent successfully.' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ success: false, error: 'Error updating transaction.' });
    }
};


exports.getTransactionsByOrganization = async (req, res) => {
    try {
        const orgId = req.userId; // Assuming userId represents the organization ID from the JWT token

        if (!orgId) {
            return res.status(400).json({ message: 'Organization ID is missing.' });
        }

        // SQL query to retrieve transactions along with organization details
        const [transactions] = await db.query(
            `SELECT 
                t.transaction_id,
                t.payment_method,
                t.total_amount,
                t.balance,
                t.payment_status,
                t.promissory_note,
                t.proof_of_payment,
                t.updated_at,
                u.firstname AS user_firstname, 
                u.lastname AS user_lastname, 
                u.middlename AS user_middlename,
                ou.firstname AS received_firstname,
                ou.lastname AS received_lastname,
                ou.middlename AS received_middlename,
                o.id AS organization_id,
                o.name AS organization_name,
                o.email AS organization_email
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN organizations_users ou ON t.received_by = ou.id
             JOIN payments p ON t.payment_id = p.id
             JOIN organizations o ON p.organization_id = o.id
             WHERE o.id = ? 
             ORDER BY t.updated_at DESC`,
            [orgId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ message: 'No transactions found for this organization.' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions by organization:', error);
        res.status(500).json({ message: 'An error occurred while fetching transactions. Please try again later.' });
    }
};





exports.getTransactionsByPaymentId = async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Fetch transactions with user and received_by user details for the given payment ID
        const [transactions] = await db.query(
            `SELECT t.*, 
                    u.firstname AS user_firstname, 
                    u.lastname AS user_lastname, 
                    u.middlename AS user_middlename,
                    ou.firstname AS received_firstname,
                    ou.lastname AS received_lastname,
                    ou.middlename AS received_middlename,
                    t.proof_of_payment 
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN organizations_users ou ON t.received_by = ou.id
             WHERE t.payment_id = ? 
             ORDER BY t.updated_at DESC`,
            [paymentId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ message: 'No transactions found for this payment.' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions with user details:', error);
        res.status(500).json({ message: 'An error occurred while fetching transactions. Please try again later.' });
    }
};


exports.getTransactionsByPaymentIdfetch = async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Check if the payment is associated with a specific year
        const [paymentDetails] = await db.query(
            `SELECT p.year 
             FROM payments p 
             WHERE p.id = ?`,
            [paymentId]
        );

        if (paymentDetails.length === 0) {
            return res.status(404).json({ message: 'Payment not found.' });
        }

        const paymentYear = paymentDetails[0].year;

        let query;
        let queryParams;

        if (paymentYear) {
            // Fetch unique users and transactions based on the "year" field
            query = `
                SELECT 
                    u.id, 
                    u.firstname, 
                    u.lastname, 
                    u.middlename, 
                    u.email, 
                    u.idnumber, 
                    u.course, 
                    u.section, 
                    MAX(t.id) AS transaction_id, 
                    MAX(t.payment_method) AS payment_method, 
                    MAX(t.payment_status) AS payment_status
                FROM users u
                JOIN semesters_users su ON u.id = su.user_id
                JOIN semesters s ON su.semester_id = s.id
                LEFT JOIN transactions t 
                    ON u.id = t.user_id 
                    AND t.payment_id = ? 
                    AND t.payment_status != 'Decline'
                WHERE su.status = 'Active'
                  AND s.year = ?
                GROUP BY u.id, u.firstname, u.lastname, u.middlename, u.email, u.idnumber, u.course, u.section
                ORDER BY u.course, u.lastname ASC
            `;
            queryParams = [paymentId, paymentYear];
        } else {
            // Fetch users and transactions based on the "semester_id" only
            query = `
                SELECT 
                    u.id, 
                    u.firstname, 
                    u.lastname, 
                    u.middlename, 
                    u.email, 
                    u.idnumber, 
                    u.course, 
                    u.section, 
                    t.id AS transaction_id, 
                    t.payment_method, 
                    t.payment_status
                FROM users u
                JOIN semesters_users su ON u.id = su.user_id
                JOIN payments p ON su.semester_id = p.semester_id
                LEFT JOIN transactions t 
                    ON u.id = t.user_id 
                    AND t.payment_id = ? 
                    AND t.payment_status != 'Decline'
                WHERE su.status = 'Active'
                  AND p.id = ?
                GROUP BY u.id, u.firstname, u.lastname, u.middlename, u.email, u.idnumber, u.course, u.section
                ORDER BY su.semester_id, u.course, u.lastname ASC
            `;
            queryParams = [paymentId, paymentId];
        }

        const [usersWithTransactions] = await db.query(query, queryParams);

        // Return the results
        res.status(200).json(usersWithTransactions);
    } catch (error) {
        console.error('Error fetching users with transactions:', error);
        res.status(500).json({
            message: 'An error occurred while fetching users and transactions. Please try again later.',
        });
    }
};













const { sendTransactionNotification } = require('../config/sendTransactionNotification');  



exports.insertPayment = async (req, res) => {
    try {
        const { userId, totalAmount } = req.body;
        const paymentId = req.params.paymentId;

        const currentYear = new Date().getFullYear().toString();
        const transactionId = `${currentYear}${Math.floor(100000 + Math.random() * 900000)}`;

        const paymentMethod = 'Cash';

        const orgUserId = req.orgIduser; // Retrieve the orgUserId from the request

        // Check if a valid payment already exists for this user and payment
        const [existingPayment] = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = ? AND payment_id = ? 
             AND payment_status IN ('Paid', 'Balance', 'Pending', 'Processing')`,
            [userId, paymentId]
        );

        if (existingPayment.length > 0) {
            return res.status(400).json({ message: 'This user already has a transaction for this payment with a valid status.' });
        }

        // Fetch payment details
        const [paymentDetails] = await db.query(
            `SELECT price, semester_id, year, name FROM payments WHERE id = ?`,
            [paymentId]
        );

        if (paymentDetails.length === 0) {
            return res.status(404).json({ message: 'Payment ID not found.' });
        }

        const price = paymentDetails[0].price;
        const semesterId = paymentDetails[0].semester_id;
        const year = paymentDetails[0].year;
        const paymentName = paymentDetails[0].name;

        let balance = (totalAmount - price);
        let paymentStatus = 'Paid';

        if (balance < 0) {
            paymentStatus = 'Balance';
        } else if (balance > 0) {
            return res.status(400).json({ message: 'Total amount exceeds the price.' });
        }

        // Insert into transactions table
        const [result] = await db.query(
            `INSERT INTO transactions (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, received_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [userId, paymentId, transactionId, paymentStatus, paymentMethod, totalAmount, balance, orgUserId]
        );

        // Fetch org user details (firstname, lastname, middlename)
        const [orgUserDetails] = await db.query(
            `SELECT firstname, lastname, middlename FROM organizations_users WHERE id = ?`,
            [orgUserId]
        );

        if (orgUserDetails.length === 0) {
            return res.status(404).json({ message: 'Organization user not found.' });
        }

        const orgUserFullName = `${orgUserDetails[0].firstname}`;

        const actionMessage = `Receives total of ₱ ${totalAmount}`;

        // Insert into transactions_history table with action message
        await db.query(
            `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, received_by, action, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [transactionId, userId, paymentId, paymentStatus, paymentMethod, totalAmount, balance, orgUserId, actionMessage]
        );

        // Fetch user details (firstname, lastname, email)
        const [userResult] = await db.query(
            `SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = ?`,
            [userId]
        );

        const user = userResult[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Fetch organization name
        const [organizationResult] = await db.query(
            `SELECT name FROM organizations WHERE id = (SELECT organization_id FROM payments WHERE id = ?)`,
            [paymentId]
        );
        const organizationName = organizationResult[0].name;

        // Fetch semester details (name and year)
        const [semesterResult] = await db.query(
            `SELECT name, year FROM semesters WHERE id = ?`,
            [semesterId]
        );
        const semester = semesterResult[0];

        // Generate receipt if payment status is Paid
        let receiptFilePath = '';
        if (paymentStatus === 'Paid') {
            // Generate PDF receipt
            const doc = new PDFDocument();
            const receiptsDir = path.join(__dirname, 'receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir);
            }

            receiptFilePath = path.join(receiptsDir, `receipt_${transactionId}.pdf`);
            doc.pipe(fs.createWriteStream(receiptFilePath));

            
            doc.image(path.join(__dirname, '../public/img/logo.png'), { width: 80, align: 'left' });
            doc.text('\n\n'); 
            doc.fontSize(12).text('Republic of the Philippines', { align: 'center' });
            doc.text('Western Mindanao State University', { align: 'center' });
            doc.text('College Of Computing Studies', { align: 'center' });
            doc.text(organizationName, { align: 'center' });
            doc.text('Zamboanga City', { align: 'center' });
            doc.text('\n\n'); 

            
            doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
            doc.text(`Academic Year: ${semester.name}`, { align: 'right' });
            

            doc.text(`Course and Section: ${user.course}-${user.section}`, { align: 'left' });
            doc.text('\n\n'); 

            
            

            doc.text(`Amount Received: ${totalAmount} Pesos`, { align: 'center' });
            doc.text(`Received Payment From ${user.firstname} ${user.middlename} ${user.lastname}`, { align: 'center' });

            
            doc.text(`As Payment For ${paymentName}`, { align: 'center' });

            doc.text('\n\n'); 

            
            doc.text(`RECEIPT N0. ${transactionId}`, { align: 'left', continued: true });
doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });   

            doc.end();
        }

        // Send email notification with attachment if Paid
        await sendTransactionNotification(
            user.email,
            user.firstname,
            user.middlename,
            user.lastname,
            organizationName,
            paymentName,
            paymentStatus,
            totalAmount,
            transactionId,
            paymentMethod,
            orgUserFullName,
            balance,
            semester.name,
            semester.year,
            receiptFilePath // Attach the generated receipt if Paid
        );

        res.status(200).json({ message: 'Payment successfully added', transactionId });

    } catch (error) {
        console.error('Error inserting payment:', error);
        res.status(500).json({ message: 'An error occurred while inserting the payment. Please try again later.' });
    }
};




exports.insertMultiplePayments = async (req, res) => {
    try {
        const { userId, payments } = req.body;
        if (!userId || userId === '') {
            return res.status(400).json({ message: 'User ID is required.' });
        }
        if (!Array.isArray(payments) || payments.length === 0) {
            return res.status(400).json({ message: 'No payments provided.' });
        }

        const currentYear = new Date().getFullYear().toString();
        const results = [];

        for (let paymentObj of payments) {
            const { paymentId, totalAmount } = paymentObj;
            let paymentName = '';

            // Fetch payment details
            const [paymentDetails] = await db.query(
                `SELECT price, semester_id, name FROM payments WHERE id = ?`,
                [paymentId]
            );
            if (paymentDetails.length === 0) {
                results.push({ paymentId, paymentName: 'Unknown', status: 'failed', message: 'Payment ID not found.' });
                continue;
            }
            paymentName = paymentDetails[0].name;
            const price = paymentDetails[0].price;
            const semesterId = paymentDetails[0].semester_id;

            // Fetch semester details
            const [semesterResult] = await db.query(
                `SELECT name, year FROM semesters WHERE id = ?`,
                [semesterId]
            );
            const semester = semesterResult[0];

            // Fetch organization details
            const [organizationResult] = await db.query(
                `SELECT name, photo FROM organizations WHERE id = (SELECT organization_id FROM payments WHERE id = ?)`,
                [paymentId]
            );
            const organizationName = organizationResult[0].name;
            let organizationPhoto = organizationResult[0].photo;

            // Check if a valid transaction already exists
            const [existingPayment] = await db.query(
                `SELECT * FROM transactions 
                 WHERE user_id = ? AND payment_id = ? 
                 AND payment_status IN ('Paid', 'Balance', 'Pending', 'Processing')`,
                [userId, paymentId]
            );
            if (existingPayment.length > 0) {
                results.push({ paymentId, paymentName, status: 'failed', message: 'Existing valid transaction found.' });
                continue;
            }

            let balance = totalAmount - price;
            let paymentStatus = 'Paid';
            if (balance < 0) {
                paymentStatus = 'Balance';
            } else if (balance > 0) {
                results.push({ paymentId, paymentName, status: 'failed', message: 'Total amount exceeds the price.' });
                continue;
            }

            const transactionId = `${currentYear}${Math.floor(100000 + Math.random() * 900000)}`;
            const paymentMethod = 'Cash';
            const orgUserId = req.orgIduser;

            // Insert into transactions
            await db.query(
                `INSERT INTO transactions (user_id, payment_id, transaction_id, payment_status, payment_method, total_amount, balance, received_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [userId, paymentId, transactionId, paymentStatus, paymentMethod, totalAmount, balance, orgUserId]
            );

            const actionMessage = `Receives total of ₱ ${totalAmount}`;
            await db.query(
                `INSERT INTO transactions_history (transaction_id, user_id, payment_id, payment_status, payment_method, total_amount, balance, received_by, action, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [transactionId, userId, paymentId, paymentStatus, paymentMethod, totalAmount, balance, orgUserId, actionMessage]
            );

            // Fetch user details
            const [userResult] = await db.query(
                `SELECT firstname, middlename, lastname, email, course, section FROM users WHERE id = ?`,
                [userId]
            );
            const user = userResult[0];
            if (!user) {
                results.push({ paymentId, paymentName, status: 'failed', message: 'User not found.' });
                continue;
            }

            const [orgUserDetails] = await db.query(
                `SELECT firstname, lastname, middlename FROM organizations_users WHERE id = ?`,
                [orgUserId]
            );
            if (orgUserDetails.length === 0) {
                return res.status(404).json({ message: 'Organization user not found.' });
            }
            const orgUserFullName = `${orgUserDetails[0].firstname}`;

            const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const localLogoPath = path.join(__dirname, '../public/img/wmsu.jpg'); // Default logo
let orgPhotoPath = localLogoPath;

// Check if organization has a custom logo
if (organizationPhoto && organizationPhoto.startsWith('http')) {
    const logoFilename = `${paymentId}.jpg`; // Generate filename based on paymentId
    const tempFilePath = path.join(tempDir, logoFilename);

    // Check if the file already exists to avoid re-downloading
    if (!fs.existsSync(tempFilePath)) {
        try {
            const response = await axios.get(organizationPhoto, { responseType: 'arraybuffer' });
            fs.writeFileSync(tempFilePath, response.data);
            orgPhotoPath = tempFilePath;  // Use downloaded file as the logo
        } catch (err) {
            console.error('Error downloading organization logo:', err);
            orgPhotoPath = localLogoPath; // Fallback to default
        }
    } else {
        console.log('Using cached logo:', tempFilePath);
        orgPhotoPath = tempFilePath; // Use cached file
    }
}


            // Generate Receipt if Paid
            let receiptFilePath = '';
if (paymentStatus === 'Paid') {
    const doc = new PDFDocument({
        size: [595, 420], // **Set half-page size (Width: 595, Height: 420)**
        margins: { top: 50, left: 50, right: 50, bottom: 50 } // Adjusted margins
    });

    const receiptsDir = path.join(__dirname, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
    }
    receiptFilePath = path.join(receiptsDir, `receipt_${transactionId}.pdf`);
    doc.pipe(fs.createWriteStream(receiptFilePath));

    // **Insert WMSU Logo (Left)**
    doc.image(path.join(__dirname, '../public/img/logo.png'), 50, 40, { width: 80 });

    // **Insert Circular Organization Logo (Right)**
    const orgLogoX = 465; // X position
    const orgLogoY = 40;  // Y position
    const orgLogoSize = 80; // Size of the circular image

    // **Clip the logo into a circular shape**
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
    doc.font('Helvetica').text('Zamboanga City', { align: 'center' }); // Reset to normal
    

    // **Insert Background Image Below "Zamboanga City" (Less Visible)**
    doc.save(); 
doc.opacity(0.1); // **Set Transparency to 10% (Less Visible)**
doc.circle(300, 250, 150) // **Create Circular Clip (Center X: 300, Y: 250, Radius: 150)**
    .clip()
    .image(orgPhotoPath, 150, 100, { width: 300, height: 300, align: 'center' }); // **Centered Background Image**  
doc.restore(); // Restore Original State


    doc.text('\n\n');
    doc.text(`Date of Payment: ${new Date().toLocaleDateString()}`, { align: 'left', continued: true });
    doc.text(`Academic Year: ${semester.name}`, { align: 'right' });
    doc.text(`Course and Section: ${user.course}-${user.section}`, { align: 'left' });
    doc.text('\n\n');
    doc.text(`Amount Received: ${totalAmount} Pesos`, { align: 'center' });
    doc.text(`Received Payment From ${user.firstname} ${user.middlename} ${user.lastname}`, { align: 'center' });
    doc.text(`As Payment For ${paymentName}`, { align: 'center' });
    doc.text('\n\n');
    doc.text(`RECEIPT NO. ${transactionId}`, { align: 'left', continued: true });
    doc.text(`Received By: ${orgUserFullName}`, { align: 'right' });

    doc.end();
}




            // **Send Transaction Notification**
            await sendTransactionNotification(
                user.email,
                user.firstname,
                user.middlename,
                user.lastname,
                organizationName,
                paymentName,
                paymentStatus,
                totalAmount,
                transactionId,
                paymentMethod,
                orgUserFullName,
                balance,
                semester.name,
                semester.year,
                receiptFilePath
            );

            results.push({ paymentId, paymentName, status: 'success', transactionId });
        }

        res.status(200).json({ message: 'Payments processed successfully', results });
    } catch (error) {
        console.error('Error processing payments:', error);
        res.status(500).json({ message: 'An error occurred while processing the payments.' });
    }
};

  



exports.getUserspaymentOrder = async (req, res) => {
    try {
        // Fetch users with status 'Active' and role 'Student'
        const [users] = await db.query('SELECT * FROM users WHERE status = ? AND role = ?', ['Active', 'Student']);
        
        if (users.length > 0) {
            res.status(200).json(users);  // Return the list of active students
        } else {
            res.status(404).json({ message: 'No active students found.' });  // No active students
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'An error occurred while fetching users. Please try again later.' });
    }
};

exports.getUserspayment = async (req, res) => {
    try {
        // Fetch all users with the role 'Student'
        const [users] = await db.query('SELECT * FROM users WHERE role = ?', ['Student']);
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'An error occurred while fetching users. Please try again later.' });
    }
};
exports.getAdviserorg = async (req, res) => {
    try {
        // Fetch all users with the role 'Student'
        const [users] = await db.query('SELECT * FROM users WHERE role = ?', ['Teacher']);
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'An error occurred while fetching users. Please try again later.' });
    }
};

exports.getUserspaymentWeb = async (req, res) => {
    try {
        // Fetch users with role 'Student' whose status is 'Pending', 'Not Enrolled', or 'Declined'
        const [users] = await db.query(`
            SELECT * 
            FROM users 
            WHERE role = "Student"
              AND (status = "Pending" 
                   OR status = "Not Enrolled" 
                   OR status = "Declined")
        `);
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'An error occurred while fetching users. Please try again later.' });
    }
};





exports.getPaymentsBySemesterOrganization = async (req, res) => {
    try {
        const organizationId = req.userId;

        // Fetch semesters
        const [semesters] = await db.query(
            'SELECT * FROM semesters ORDER BY created_at DESC'
        );

        const semesterPayments = [];

        // Iterate through semesters and fetch associated payments
        for (const semester of semesters) {
            const [payments] = await db.query(
                `
                SELECT 
                    p.*,
                    CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name
                FROM 
                    payments p
                LEFT JOIN 
                    organizations_users ou 
                ON 
                    p.created_by = ou.id
                WHERE 
                    p.organization_id = ?
                    AND (
                        (p.year IS NOT NULL AND p.year = ?)
                        OR (p.year IS NULL AND p.semester_id = ?)
                    )
                    AND p.status = 'Accepted'
                `,
                [organizationId, semester.year, semester.id]
            );

            semesterPayments.push({
                semester: semester.name,
                id: semester.id,
                payments // Payments filtered by "year" or "semester_id" with "Accepted" status
            });
        }

        return res.json(semesterPayments);
    } catch (error) {
        console.error('Error fetching payments by semester for the organization:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};




exports.getPaymentsBySemesterOrganizationMaster = async (req, res) => {
    try {
        const organizationId = req.userId;

        // Fetch semesters
        const [semesters] = await db.query(
            'SELECT * FROM semesters ORDER BY created_at DESC'
        );

        const semesterPayments = [];

        // Iterate through semesters and fetch associated payments
        for (const semester of semesters) {
            const [payments] = await db.query(
                `
                SELECT 
                    p.*,
                    CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name
                FROM 
                    payments p
                LEFT JOIN 
                    organizations_users ou 
                ON 
                    p.created_by = ou.id
                WHERE 
                    p.organization_id = ?
                    AND (
                        (p.year IS NOT NULL AND p.year = ?)
                        OR (p.year IS NULL AND p.semester_id = ?)
                    )
                    AND p.status = 'Accepted'
                `,
                [organizationId, semester.year, semester.id]
            );

            semesterPayments.push({
                semester: semester.name,
                payments // Payments filtered by "year" or "semester_id" with "Accepted" status
            });
        }

        return res.json(semesterPayments);
    } catch (error) {
        console.error('Error fetching payments by semester for the organization:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getPaymentsByOrganization = async (req, res) => {
    try {
        const organizationId = req.userId; // Get organization ID from the authenticated user

        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.created_at,
                p.year,
                p.comment_status,
                p.adviser_status,
                p.adviser_by,
                p.accepted_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name, -- Fetch admin's full name
                p.qrcode_picture,
                o.name AS organization_name,
                s.name AS semester_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' \u20B1', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' \u20B1', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' \u20B1', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' \u20B1', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' \u20B1', p.pricefees5), NULL)
                ) AS fees_and_prices,
                EXISTS (SELECT 1 FROM payment_reports pr WHERE pr.payment_id = p.id) AS is_reported
            FROM 
                payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN users u ON p.adviser_by = u.id
            LEFT JOIN admins a ON p.accepted_by = a.id -- Join with admins table to fetch accepted_by details
            WHERE p.organization_id = ?
            ORDER BY p.created_at DESC;
        `;

        const [payments] = await db.query(query, [organizationId]);

        res.status(200).json({ payments });
    } catch (error) {
        console.error('Error fetching payments by organization:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPaymentsByOrganizationreports = async (req, res) => {
    try {
        const organizationId = req.userId; // Get organization ID from the authenticated user

        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.year,
                p.adviser_status,
                p.adviser_by,
                p.accepted_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name, -- Fetch admin's full name
                p.qrcode_picture,
                o.name AS organization_name,
                s.name AS semester_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' \u20B1', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' \u20B1', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' \u20B1', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' \u20B1', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' \u20B1', p.pricefees5), NULL)
                ) AS fees_and_prices,
                EXISTS (SELECT 1 FROM payment_reports pr WHERE pr.payment_id = p.id) AS is_reported
            FROM 
                payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN users u ON p.adviser_by = u.id
            LEFT JOIN admins a ON p.accepted_by = a.id -- Join with admins table to fetch accepted_by details
            WHERE p.organization_id = ? AND p.adviser_status = 'Accepted' AND p.status = 'Accepted'
            ORDER BY p.created_at DESC;
        `;

        const [payments] = await db.query(query, [organizationId]);

        res.status(200).json({ payments });
    } catch (error) {
        console.error('Error fetching payments by organization:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getReportedPaymentsByOrganization = async (req, res) => {
    try {
        const organizationId = req.userId;

        const query = `
            SELECT 
                pr.id,
                pr.payment_id,
                pr.admin_report_by,
                pr.adviser_report_by,
                pr.reason,
                pr.description,
                pr.created_at,
                p.name AS payment_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_reported_by_name
            FROM 
                payment_reports pr
            LEFT JOIN payments p ON pr.payment_id = p.id
            LEFT JOIN admins a ON pr.admin_report_by = a.id
            LEFT JOIN users u ON pr.adviser_report_by = u.id
            WHERE p.organization_id = ?
            ORDER BY pr.created_at DESC;
        `;

        const [reports] = await db.query(query, [organizationId]);

        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching reported payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getReportedPaymentsByOrganizationAll = async (req, res) => {
    try {
        const query = `
            SELECT 
                pr.id,
                pr.payment_id,
                pr.admin_report_by,
                pr.adviser_report_by,
                pr.reason,
                pr.description,
                pr.created_at,
                p.name AS payment_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_reported_by_name
            FROM 
                payment_reports pr
            LEFT JOIN payments p ON pr.payment_id = p.id
            LEFT JOIN admins a ON pr.admin_report_by = a.id
            LEFT JOIN users u ON pr.adviser_report_by = u.id
            ORDER BY pr.created_at DESC
        `;

        const [reports] = await db.query(query);

        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching reported payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getPaymentsByOrganizationAll = async (req, res) => {
    try {
        // Query to fetch all payments for the organization
        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.year,
                p.adviser_status,
                p.adviser_by,
                p.accepted_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name, -- Fetch admin's full name
                p.qrcode_picture,
                o.name AS organization_name,
                s.name AS semester_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' ₱', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' ₱', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' ₱', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' ₱', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' ₱', p.pricefees5), NULL)
                ) AS fees_and_prices,
                EXISTS (SELECT 1 FROM payment_reports pr WHERE pr.payment_id = p.id) AS is_reported
            FROM 
                payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN users u ON p.adviser_by = u.id
            LEFT JOIN admins a ON p.accepted_by = a.id -- Join with admins table to fetch accepted_by details
            ORDER BY p.created_at DESC
        `;

        // Execute the query
        const [payments] = await db.query(query);

        // Return the payments
        res.status(200).json({ payments });
    } catch (error) {
        console.error('Error fetching payments by organization:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getPaymentLogs = async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Fetch payment name
        const paymentQuery = `
            SELECT name 
            FROM payments 
            WHERE id = ?
        `;
        const [paymentResult] = await db.query(paymentQuery, [paymentId]);
        const paymentName = paymentResult.length > 0 ? paymentResult[0].name : 'Unknown Payment';

        // Fetch payment logs
        const logsQuery = `
            SELECT 
                pl.id,
                pl.payment_id,
                pl.action,
                pl.created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS organization_by_name
            FROM 
                payment_logs pl
            LEFT JOIN admins a ON pl.accepted_by = a.id
            LEFT JOIN users u ON pl.adviser_by = u.id
            LEFT JOIN organizations_users ou ON pl.organization_by = ou.id
            WHERE pl.payment_id = ?
            ORDER BY pl.created_at DESC;
        `;
        const [logs] = await db.query(logsQuery, [paymentId]);

        res.status(200).json({ paymentName, logs });
    } catch (error) {
        console.error('Error fetching payment logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getPaymentLogsAll = async (req, res) => {
    try {
        // Fetch all payment logs
        const logsQuery = `
            SELECT 
                pl.id,
                pl.payment_id,
                p.name AS payment_name,
                pl.action,
                pl.created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS organization_by_name
            FROM 
                payment_logs pl
            LEFT JOIN payments p ON pl.payment_id = p.id
            LEFT JOIN admins a ON pl.accepted_by = a.id
            LEFT JOIN users u ON pl.adviser_by = u.id
            LEFT JOIN organizations_users ou ON pl.organization_by = ou.id
            ORDER BY pl.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching all payment logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrganizationPaymentLogs = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization making the request

        // Fetch payment logs specific to the organization
        const logsQuery = `
            SELECT 
                pl.id,
                pl.payment_id,
                p.name AS payment_name,
                pl.action,
                pl.status,
                pl.created_at,
                o.name AS organization_name,  -- Get organization name
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS organization_by_name
            FROM 
                payment_logs pl
            LEFT JOIN payments p ON pl.payment_id = p.id
            LEFT JOIN organizations o ON p.organization_id = o.id  -- Join organizations table
            LEFT JOIN admins a ON pl.accepted_by = a.id
            LEFT JOIN users u ON pl.adviser_by = u.id
            LEFT JOIN organizations_users ou ON pl.organization_by = ou.id
            WHERE o.id = ?  -- Filter by organization ID
            ORDER BY pl.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery, [organizationId]);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching organization payment logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrganizationGcashOrderLogs = async (req, res) => {
    try {
        const organizationId = req.userId; // Organization making the request

        // Fetch GCASH order logs specific to the organization (from gcash_orders)
        const logsQuery = `
            SELECT 
                gol.id,
                gol.order_id,
                gol.action,
                gol.status,
                gol.created_at,
                o.name AS organization_name,  -- Get organization name
                CONCAT(oa.firstname, ' ', oa.middlename, ' ', oa.lastname) AS adviser_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_name
            FROM 
                gcashorder_logs gol
            LEFT JOIN gcashorder go ON gol.order_id = go.id -- Get organization from gcash_orders
            LEFT JOIN organizations o ON go.organization_id = o.id  -- Join organizations table
            LEFT JOIN users oa ON gol.created_by = oa.id
            LEFT JOIN admins a ON gol.created_by_admin = a.id
            WHERE go.organization_id = ?  -- Filter by organization ID
            ORDER BY gol.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery, [organizationId]);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching GCASH order logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



exports.getGcashOrderLogs = async (req, res) => {
    try {
        // Fetch all GCASH order logs
        const logsQuery = `
            SELECT 
                gol.id,
                gol.order_id,
                gol.action,
                gol.status,
                gol.created_at,
                CONCAT(oa.firstname, ' ', oa.middlename, ' ', oa.lastname) AS adviser_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_name
            FROM 
                gcashorder_logs gol
            LEFT JOIN users oa ON gol.created_by = oa.id
            LEFT JOIN admins a ON gol.created_by_admin = a.id
            ORDER BY gol.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching GCASH order logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAllOrganizationLogs = async (req, res) => {
    try {
        // Fetch all organization logs
        const logsQuery = `
            SELECT 
                ol.id,
                o.name AS organization_name,
                ol.action,
                ol.status,
                s.year AS semester_year,
                ol.created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_name
            FROM 
                organizations_logs ol
            LEFT JOIN organizations o ON ol.organization_id = o.id
            LEFT JOIN semesters s ON ol.semester_id = s.id
            LEFT JOIN admins a ON ol.created_by = a.id
            ORDER BY ol.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching organization logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAllOrderTransactionReports = async (req, res) => {
    try {
        // Fetch all order transaction reports
        const logsQuery = `
            SELECT 
                ptr.id,
                ptr.order_transaction_id,
                ptr.reasons,
                ptr.comments,
                ptr.created_at,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS created_by_name
            FROM 
                product_transaction_reports ptr
            LEFT JOIN users u ON ptr.user_id = u.id
            LEFT JOIN organizations_users ou ON ptr.created_by = ou.id
            ORDER BY ptr.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching order transaction reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllTransactionPaymentReports = async (req, res) => {
    try {
        // Fetch all transaction payment reports
        const logsQuery = `
            SELECT 
                tr.id,
                tr.transaction_id,
                tr.reason,
                tr.description,
                tr.created_at,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name,
                CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname) AS reported_by_name
            FROM 
                transactions_reports tr
            LEFT JOIN transactions t ON tr.transaction_id = t.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN organizations_users ou ON tr.reported_by = ou.id
            ORDER BY tr.created_at DESC;
        `;

        const [logs] = await db.query(logsQuery);

        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching transaction payment reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};




exports.getPaymentsBySemesterAdmin = async (req, res) => {
    try {
        // Fetch all semesters with "Activated" or "Expired" status
        const [semesters] = await db.query(
            'SELECT * FROM semesters ORDER BY created_at DESC'
        );

        // Initialize array to hold semester payments data
        const semesterPayments = [];

        // Loop through each semester to fetch associated payments
        for (const semester of semesters) {
            // Modify query to join payments with organizations table to get organization name
            const [payments] = await db.query(`
                SELECT p.*, o.name as organization_name 
                FROM payments p 
                JOIN organizations o ON p.organization_id = o.id 
                WHERE p.semester_id = ?`,
                [semester.id]
            );

            // Push each semester's details with its payments into the array
            semesterPayments.push({
                semester: semester.name,
                payments: payments
            });
        }

        // Send the structured response as JSON
        return res.json(semesterPayments);
    } catch (error) {
        console.error('Error fetching payments by semester:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getPaymentsBySemester = async (req, res) => {
    try {
        // Get the user ID from the request
        const userId = req.userId;

        // Query to get semesters where the user is actively enrolled
        const [semesters] = await db.query(
            `SELECT s.* 
             FROM semesters s
             INNER JOIN semesters_users su ON su.semester_id = s.id
             WHERE su.user_id = ? 
             AND su.status = "Active"
             ORDER BY s.created_at DESC`,
            [userId]
        );
        
        // Initialize an array to hold semester payments
        const semesterPayments = [];

        // Iterate over each semester to get payments
        for (const semester of semesters) {
            // Query to get payments for the current semester where adviser_status and status are both "Accepted"
            const [payments] = await db.query(
                `SELECT p.*, o.name AS organization_name, 
                        COALESCE(o.photo, 'https://your-default-logo-url.com/default-logo.png') AS organization_photo
                 FROM payments p
                 LEFT JOIN organizations o ON p.organization_id = o.id
                 WHERE p.semester_id = ? 
                 AND p.adviser_status = "Accepted" 
                 AND p.status = "Accepted"`, 
                [semester.id]
            );

            // If no payments are found for the semester, skip adding this semester
            if (payments.length === 0) continue;

            // Get a list of payment IDs that the user has already transacted
            const [userTransactions] = await db.query(
                'SELECT payment_id, payment_status FROM transactions WHERE user_id = ?',
                [userId]
            );
            
            // Extract payment IDs from user transactions
            const userTransactionMap = new Map();
            userTransactions.forEach(transaction => {
                userTransactionMap.set(transaction.payment_id, transaction.payment_status);
            });

            // Filter out payments that the user has already made a transaction for, 
            // except for those with "Decline" status
            const filteredPayments = payments.filter(payment => {
                const userTransactionStatus = userTransactionMap.get(payment.id);
                return !userTransactionStatus || userTransactionStatus === "Decline"; // Show only Declined payments
            });

            // If no payments remain after filtering, skip this semester
            if (filteredPayments.length === 0) continue;

            // Add the semester and its filtered payments to the result array
            semesterPayments.push({
                semester: semester.name,
                payments: filteredPayments.map(payment => ({
                    id: payment.id,
                    name: payment.name,
                    price: payment.price,
                    payment_type: payment.payment_type,
                    organization: {
                        name: payment.organization_name,
                        photo: payment.organization_photo
                    }
                }))
            });
        }

        // Return the filtered semesters with payments
        return res.json(semesterPayments);
    } catch (error) {
        console.error('Error fetching payments by semester:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};










const paymentstorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const orgId = req.userId; // Get organization ID from authenticated user
        const dir = path.join(__dirname, '../uploads/payments', orgId.toString());

        // Create the directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Use the original file name
        cb(null, file.originalname);
    }
});

const paymentupload = multer({ storage: paymentstorage });

exports.addPayment = async (req, res) => {
    paymentupload.single('qrcode_picture')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: 'File upload failed' });
        }

        const {
            name,
            description,
            payment_type,
            fees1,
            pricefees1,
            fees2,
            pricefees2,
            fees3,
            pricefees3,
            fees4,
            pricefees4,
            fees5,
            pricefees5,
            payment_scope // Newly added: "By Semester" or "By Academic Year"
        } = req.body;

        const orgId = req.userId; // Organization ID
        const orgUserId = req.orgIduser; // User ID in the organization

        if (!name || !payment_type) {
            return res.status(400).json({ error: 'Name and payment type are required' });
        }

        // Calculate total price
        const totalPrice = [pricefees1, pricefees2, pricefees3, pricefees4, pricefees5]
            .map((price) => parseFloat(price) || 0)
            .reduce((sum, price) => sum + price, 0);

        let qrcodeSharedLink = null;

        try {
            // Check if the organization already has a pending payment
            const [pendingPayments] = await db.query(
                'SELECT id FROM payments WHERE organization_id = ? AND status = "Pending"',
                [orgId]
            );

            if (pendingPayments.length > 0) {
                return res.status(400).json({ error: 'Cannot add payment. This organization already has a pending payment.' });
            }

            // Fetch organization name
            const [orgResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [orgId]);
            if (!orgResult.length) {
                return res.status(400).json({ error: 'Organization not found' });
            }
            const organizationName = orgResult[0].name;

            // Fetch organization user's name and position
            const [orgUserResult] = await db.query(
                `SELECT firstname, lastname, position FROM organizations_users WHERE id = ?`,
                [orgUserId]
            );
            if (!orgUserResult.length) {
                return res.status(400).json({ error: 'Organization user not found' });
            }
            const { firstname, lastname, position } = orgUserResult[0];
            const orgUserFolder = `${firstname}_${lastname}_${position}`;

            // Generate a unique filename for the QR code picture
            const uniqueFilename = `${uuidv4()}${path.extname(req.file.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(req.file.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create a folder in Dropbox for the organization and user
            const folderPath = `/uploads/${organizationName}/QRCODESCREATEPAYMENTS/${orgUserFolder}`;

            // Check if folder exists before creating it
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to the Dropbox folder
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            console.log(`Uploading file to Dropbox at: ${dropboxPath}`);

            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
                mode: { ".tag": "overwrite" } // Ensures file gets replaced if it exists
            });

            // Generate shared link for the uploaded file
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                qrcodeSharedLink = sharedLinkResponse.result?.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    qrcodeSharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Fetch the latest activated semester
            const [semesterResult] = await db.query('SELECT id, year, status FROM semesters ORDER BY created_at DESC LIMIT 1');

            if (semesterResult.length === 0 || semesterResult[0].status !== 'Activated') {
                return res.status(400).json({ error: 'Cannot add payment. Latest semester is not activated.' });
            }

            const latestSemesterId = semesterResult[0].id;
            const latestYear = semesterResult[0].year;

            // Determine year based on payment_scope
            const year = payment_scope === 'By Academic Year' ? latestYear : null;

            // Insert payment details into the database
            const [result] = await db.query(
                `INSERT INTO payments 
                (name, description, payment_type, qrcode_picture, organization_id, semester_id, created_by, fees1, pricefees1, fees2, pricefees2, fees3, pricefees3, fees4, pricefees4, fees5, pricefees5, price, year, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "Pending")`,
                [
                    name,
                    description,
                    payment_type,
                    qrcodeSharedLink,
                    orgId,
                    latestSemesterId,
                    orgUserId,
                    fees1,
                    pricefees1,
                    fees2,
                    pricefees2,
                    fees3,
                    pricefees3,
                    fees4,
                    pricefees4,
                    fees5,
                    pricefees5,
                    totalPrice,
                    year
                ]
            );

            return res.status(201).json({ 
                id: result.insertId, 
                message: 'Payment added successfully', 
                qrcodeLink: qrcodeSharedLink // **Include QR code link in response**
            });
        } catch (error) {
            console.error('Error adding payment:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
};
const proofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/proof_of_payment');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const proofUpload = multer({ storage: proofStorage });

exports.updateProofOfPaymentP = async (req, res) => {
    proofUpload.single('proof_of_payment')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: 'File upload failed' });
        }

        const { payment_id } = req.body;
        const orgId = req.userId; // Organization ID
        const orgUserId = req.orgIduser; // User ID in the organization

        if (!payment_id || !req.file) {
            return res.status(400).json({ error: 'Missing payment ID or file' });
        }

        try {
            // Fetch payment details
            const [paymentResult] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
            const payment = paymentResult[0];
            if (!payment) return res.status(404).json({ error: 'Payment not found' });

            // Fetch organization name
            const [orgResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [orgId]);
            if (!orgResult.length) {
                return res.status(400).json({ error: 'Organization not found' });
            }
            const organizationName = orgResult[0].name;

            // Fetch organization user's name and position
            const [orgUserResult] = await db.query(
                `SELECT firstname, lastname, position FROM organizations_users WHERE id = ?`,
                [orgUserId]
            );
            if (!orgUserResult.length) {
                return res.status(400).json({ error: 'Organization user not found' });
            }
            const { firstname, lastname, position } = orgUserResult[0];
            const orgUserFolder = `${firstname}_${lastname}_${position}`;

            // Read file content
            const filePathOnDisk = path.resolve(req.file.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) throw new Error('Failed to initialize Dropbox.');

            // Define Dropbox folder structure
            const folderPath = `/uploads/${organizationName}/QRCODESCREATEPAYMENTS/${orgUserFolder}`;
            const dropboxPath = `${folderPath}/${req.file.filename}`;

            // Create folder if not exists
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists.`);
                } else {
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            console.log(`Uploading proof of payment to Dropbox: ${dropboxPath}`);
            const uploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
                mode: { ".tag": "overwrite" }
            });

            // Generate a shareable link
            let sharedLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: uploadResponse.result.path_display
                });
                sharedLink = sharedLinkResponse.result.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: uploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    sharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Update payment status and proof of payment link in the database
            await db.query(
                'UPDATE payments SET status = "Qr code Pending", qrcode_picture = ? WHERE id = ?',
                [sharedLink, payment_id]
            );

            // Log the update in payment_logs
            const logAction = `Proof of payment updated and waiting for approval`;
            await db.query(
                `INSERT INTO payment_logs (payment_id, status, action, accepted_by, organization_by)
                VALUES (?, 'Pending Approval', ?, 'None', ? )`,
                [payment_id, logAction, orgUserId]
            );

            console.log(`Proof of payment uploaded successfully. Link: ${sharedLink}`);

            res.status(200).json({ 
                message: 'Proof of payment uploaded successfully. Please wait for admin approval.', 
                proof_of_payment_link: sharedLink 
            });
        } catch (error) {
            console.error('Error updating proof of payment:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};






exports.deletePayment = async (req, res) => {
    const { paymentId } = req.params;

    if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID is required.' });
    }

    try {
        const [result] = await db.query('DELETE FROM payments WHERE id = ?', [paymentId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Payment not found or already deleted.' });
        }

        res.status(200).json({ message: 'Payment deleted successfully.' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};


exports.getAllPayments = async (req, res) => {
    try {
        // SQL query to fetch payment details along with related data, including adviser details and report status
        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.year,
                p.created_at,
                p.adviser_status,
                p.adviser_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                p.qrcode_picture,
                o.name AS organization_name,
                s.name AS semester_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' ₱', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' ₱', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' ₱', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' ₱', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' ₱', p.pricefees5), NULL)
                ) AS fees_and_prices,
                -- Check if the payment is reported for "Declined"
                EXISTS (SELECT 1 FROM payment_reports pr WHERE pr.payment_id = p.id AND p.status = 'Declined') AS is_fully_declined_reported,
                -- Check if the payment is reported for "Qr-Code Declined"
                EXISTS (SELECT 1 FROM payment_reports pr WHERE pr.payment_id = p.id AND p.status = 'Qr-Code Declined') AS is_qr_code_declined_reported
            FROM 
                payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN users u ON p.adviser_by = u.id -- Join with users table for adviser details
            WHERE p.adviser_status = 'Accepted' -- Filter by adviser_status
            ORDER BY p.created_at DESC;
        `;

        const [result] = await db.query(query);

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'No accepted payments found.' });
        }

        res.status(200).json({ success: true, payments: result });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};




exports.getAllOrders = async (req, res) => {
    try {
        const query = `
            SELECT 
                o.id,
                o.qrcodepicture,
                o.adviser_status,
                o.adviser_by,
                o.status,
                o.created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS adviser_name,
                o.created_by,
                o.accepted_by,
                org.name AS organization_name,
                CASE WHEN EXISTS (
                    SELECT 1 FROM gcashorder_reports gr WHERE gr.order_id = o.id
                ) THEN 1 ELSE 0 END AS is_reported
            FROM gcashorder o
            LEFT JOIN organizations_adviser a ON o.adviser_by = a.user_id
            LEFT JOIN organizations org ON o.organization_id = org.id
            WHERE o.adviser_status = 'Accepted'
            GROUP BY o.id, o.qrcodepicture, o.adviser_status, o.adviser_by, o.status, o.created_by, o.accepted_by, org.name, a.firstname, a.middlename, a.lastname
            ORDER BY o.created_at DESC;
        `;

        const [orders] = await db.query(query);

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'No accepted orders found.' });
        }

        res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

exports.getAllOrdersAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from the token

        const query = `
            SELECT 
                o.id,
                o.qrcodepicture,
                o.adviser_status,
                o.adviser_by,
                o.status,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS adviser_name,
                o.created_by,
                o.accepted_by,
                org.name AS organization_name,
                CASE WHEN EXISTS (
                    SELECT 1 FROM gcashorder_reports gr WHERE gr.order_id = o.id
                ) THEN 1 ELSE 0 END AS is_reported
            FROM gcashorder o
            LEFT JOIN users a ON o.adviser_by = a.id
            LEFT JOIN organizations org ON o.organization_id = org.id
            WHERE o.adviser_by = ?
            ORDER BY o.created_at DESC;
        `;

        const [orders] = await db.query(query, [adviserId]);

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found for this adviser.' });
        }

        res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders for adviser:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getReportedPaymentsByAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Get adviser ID from the authenticated user

        const query = `
            SELECT 
                pr.id AS report_id,
                p.name AS payment_name,
                pr.reason,
                pr.description,
                pr.created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_reported_by_name
            FROM 
                payment_reports pr
            LEFT JOIN payments p ON pr.payment_id = p.id
            LEFT JOIN admins a ON pr.admin_report_by = a.id
            LEFT JOIN users u ON pr.adviser_report_by = u.id
            WHERE p.adviser_by = ?
            ORDER BY pr.created_at DESC;
        `;

        const [reports] = await db.query(query, [adviserId]);

        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching reported payments by adviser:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getReportedOrdersByAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Get adviser ID from the authenticated user

        const query = `
            SELECT 
                gor.id AS report_id,
                o.id AS order_id,
                o.status,
                o.created_at AS order_created_at,
                org.name AS organization_name,
                gor.reason,
                gor.description,
                gor.created_at AS report_created_at,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_reported_by_name
            FROM 
                gcashorder_reports gor
            LEFT JOIN gcashorder o ON gor.order_id = o.id
            LEFT JOIN organizations org ON o.organization_id = org.id
            LEFT JOIN admins a ON gor.reported_by_admin = a.id
            LEFT JOIN users u ON gor.reported_by = u.id
            WHERE gor.reported_by = ?
            ORDER BY gor.created_at DESC;
        `;

        const [reports] = await db.query(query, [adviserId]);

        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching reported orders by adviser:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getGcashOrderReports = async (req, res) => {
    try {
        const query = `
            SELECT 
                gor.id,
                gor.order_id,
                gor.reported_by,
                gor.reported_by_admin,
                gor.reason,
                gor.description,
                gor.created_at,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_reported_by_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS admin_reported_by_name
            FROM 
                gcashorder_reports gor
            LEFT JOIN users u ON gor.reported_by = u.id
            LEFT JOIN admins a ON gor.reported_by_admin = a.id
            ORDER BY gor.created_at DESC;
        `;

        const [reports] = await db.query(query);

        res.status(200).json({ reports });
    } catch (error) {
        console.error('Error fetching Gcash order reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const { sendGcashOrderStatusEmail } = require('../config/sendEmailAdmin');

exports.updateAdminOrderStatus = async (req, res) => {
    const orderId = req.params.orderId;
    const { status } = req.body;
    const adminId = req.userId; // Extracted from the token

    try {
        // Validate order existence
        const [orderResult] = await db.query('SELECT * FROM gcashorder WHERE id = ?', [orderId]);
        if (orderResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        const order = orderResult[0];

        // Validate status value
        const validStatuses = ['Accepted', 'Declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value.' });
        }

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT name, email FROM organizations WHERE id = ?', [order.organization_id]);
        const organization = organizationResult[0];

        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found.' });
        }

        // Fetch semester details
        const [semesterResult] = await db.query('SELECT name FROM semesters WHERE id = ?', [order.semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Semester not found.' });
        }

        // Update order status and record the admin who updated it
        await db.query(
            `UPDATE gcashorder SET status = ?, accepted_by = ? WHERE id = ?`,
            [status, adminId, orderId]
        );

        // Insert into gcashorder_logs
        await db.query(
            `INSERT INTO gcashorder_logs (order_id, action, status, created_by, created_by_admin, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
            [orderId, `Admin ${status}`, status, 'None', adminId]
        );

        // Send email notification
        await sendGcashOrderStatusEmail(organization.email, organization.name, semester.name, status);

        res.status(200).json({ success: true, message: `Gcash QrCodes has been ${status.toLowerCase()} successfully.` });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status.' });
    }
};



const { sendGcashOrderReportEmail } = require('../config/sendEmailAdmin');


exports.submitGcashOrderReportadmin = async (req, res) => {
    const adminId = req.userId; // Extracted from the token
    const { orderId, reason, description } = req.body;

    if (!orderId || !reason) {
        return res.status(400).json({ success: false, message: 'Order ID and reason are required.' });
    }

    try {
        // Fetch admin details
        const [adminResult] = await db.query('SELECT firstname, middlename, lastname FROM admins WHERE id = ?', [adminId]);
        const admin = adminResult[0];

        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        const adminFullName = `${admin.firstname} ${admin.middlename || ''} ${admin.lastname}`;

        // Fetch order details to get organization_id
        const [orderResult] = await db.query('SELECT organization_id FROM gcashorder WHERE id = ?', [orderId]);
        const order = orderResult[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT name, email FROM organizations WHERE id = ?', [order.organization_id]);
        const organization = organizationResult[0];

        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found.' });
        }

        // Insert the report into gcashorder_reports
        await db.query(
            `INSERT INTO gcashorder_reports (order_id, reported_by_admin, reason, description)
            VALUES (?, ?, ?, ?)`,
            [orderId, adminId, reason, description || null]
        );

        // Log the action in gcashorder_logs
        await db.query(
            `INSERT INTO gcashorder_logs (order_id, action, status, created_by_admin)
            VALUES (?, 'Reported by Admin', 'Reported', ?)`,
            [orderId, adminId]
        );

        // Send email notification to the organization
        await sendGcashOrderReportEmail(organization.email, organization.name, adminFullName, reason, description);

        res.status(200).json({ success: true, message: 'Report submitted successfully and notification sent to the organization.' });
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


exports.deleteSemester = async (req, res) => {
    const { id } = req.params;

    try {
        // Check if there are any logs associated with the semester
        const [logs] = await db.query('SELECT * FROM semesters_logs WHERE semester_id = ?', [id]);

        if (logs.length > 0) {
            return res.status(400).json({ error: 'Cannot delete semester; it has associated logs.' });
        }

        // Delete the semester
        const [result] = await db.query(
            'DELETE FROM semesters WHERE id = ?',
            [id]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Semester deleted successfully' });
        } else {
            res.status(404).json({ error: 'Semester not found' });
        }
    } catch (error) {
        console.error('Error deleting semester:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const { acceptPaymentOrganizationEmailSend } = require('../config/acceptPaymentOrganizationEmailSend'); // Importing accept payment email sender
const { declinePaymentOrganizationEmailSend } = require('../config/declinePaymentOrganizationEmailSend'); // Importing decline payment email sender
const { acceptPaymentOrganizationEmailSendQR } = require('../config/acceptPaymentOrganizationEmailSend'); // Importing accept payment email sender
exports.acceptQrCodePayment = async (req, res) => {
    try {
        const { payment_id } = req.body;
        const adminId = req.userId; // User ID from the authenticated token

        if (!payment_id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Update payment status to 'Accepted' and update created_at timestamp
        const [result] = await db.query(
            'UPDATE payments SET status = "Accepted", accepted_by = ?, created_at = NOW() WHERE id = ? AND status = "Qr code Pending"',
            [adminId, payment_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Payment not found or already processed.' });
        }

        // Log the action in `payment_logs`
        await db.query(
            'INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [payment_id, 'Accepted', 'Payment QR Code was accepted', adminId, null]
        );

        // Send acceptance email
        await acceptPaymentOrganizationEmailSendQR(payment_id);

        return res.status(200).json({ success: true, message: 'QR Code Payment accepted successfully.' });
    } catch (error) {
        console.error('Error accepting QR Code Payment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ❌ Decline QR Code Payment
exports.declineQrCodePayment = async (req, res) => {
    try {
        const { payment_id } = req.body;
        const adminId = req.userId; // User ID from the authenticated token

        if (!payment_id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Update payment status to 'Declined Qr' and update created_at timestamp
        const [result] = await db.query(
            'UPDATE payments SET status = "Declined Qr", accepted_by = ?, created_at = NOW() WHERE id = ? AND status = "Qr code Pending"',
            [adminId, payment_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Payment not found or already processed.' });
        }

        // Log the action in `payment_logs`
        await db.query(
            'INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [payment_id, 'Declined Qr', 'Payment QR Code was declined', adminId, null]
        );

        // Send decline email
        await declinePaymentOrganizationEmailSend(payment_id);

        return res.status(200).json({ success: true, message: 'QR Code Payment declined successfully.' });
    } catch (error) {
        console.error('Error declining QR Code Payment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.acceptPaymentOrganization = async (req, res) => {
    try {
        const { payment_id } = req.body;
        const adminId = req.userId; // User ID from the authenticated token

        if (!payment_id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Update payment status to 'Accepted' and set the 'accepted_by' field
        const [result] = await db.query(
            'UPDATE payments SET status = "Accepted", accepted_by = ? WHERE id = ? AND status = "Pending"',
            [adminId, payment_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Payment not found or already processed.' });
        }

        // Log the action in the `payment_logs` table
        await db.query(
            'INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by) VALUES (?, ?, ?, ?, ?)',
            [payment_id, 'Accepted', 'Payment accepted', adminId, null]
        );

        // Send the accept payment email
        await acceptPaymentOrganizationEmailSend(payment_id);

        return res.status(200).json({ success: true, message: 'Payment accepted successfully.' });
    } catch (error) {
        console.error('Error accepting payment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.declinePaymentOrganization = async (req, res) => {
    try {
        const { payment_id } = req.body;
        const adminId = req.userId; // User ID from the authenticated token

        if (!payment_id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Update payment status to 'Declined' and set the 'accepted_by' field
        const [result] = await db.query(
            'UPDATE payments SET status = "Declined", accepted_by = ? WHERE id = ? AND status = "Pending"',
            [adminId, payment_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Payment not found or already processed.' });
        }

        // Log the action in the `payment_logs` table
        await db.query(
            'INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by) VALUES (?, ?, ?, ?, ?)',
            [payment_id, 'Declined', 'Payment declined', adminId, null]
        );

        // Send the decline payment email
        await declinePaymentOrganizationEmailSend(payment_id);

        return res.status(200).json({ success: true, message: 'Payment declined successfully.' });
    } catch (error) {
        console.error('Error declining payment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const { sendPaymentReportEmail } = require('../config/SendEmailPaymentReportsAdmin');

exports.adminPaymentReports = async (req, res) => {
    const adminId = req.userId; // Admin ID from token
    const { paymentId, reason, description } = req.body;

    if (!paymentId || !reason) {
        return res.status(400).json({ success: false, message: 'Payment ID and reason are required.' });
    }

    try {
        // Check if the payment report already exists

        // Insert into payment_reports with the description
        await db.query(
            `INSERT INTO payment_reports (payment_id, admin_report_by, reason, description) VALUES (?, ?, ?, ?)`,
            [paymentId, adminId, reason, description || null]
        );

        // Log the report in payment_logs
        const action = `Reported with reason: ${reason}`;

        await db.query(
    `INSERT INTO payment_logs (payment_id, status, action, accepted_by) 
     VALUES (?, 'Reported', ?, ?)`,
    [paymentId, action, adminId] // Ensure adviser_by is NULL instead of 'None'
);


        // Fetch admin details
        const [adminResult] = await db.query('SELECT firstname, lastname, email FROM admins WHERE id = ?', [adminId]);
        const admin = adminResult[0];
        const adminName = `${admin.firstname} ${admin.lastname}`;

        // Fetch payment details for the report
        const [paymentResult] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
        const payment = paymentResult[0];

        // Send email notification
        await sendPaymentReportEmail(
            paymentId,
            payment.status,
            reason,
            description,
            adminName,
            admin.email
        );

        res.status(200).json({ success: true, message: 'Payment reported successfully.' });
    } catch (error) {
        console.error('Error reporting payment:', error);
        res.status(500).json({ success: false, message: 'Failed to report payment.' });
    }
};



exports.updateAdviserFeesPriceFeesadmin = async (req, res) => {
    const adminId = req.userId; // Extracted from the token
    const { paymentId, fees } = req.body;

    if (!paymentId || !fees || !Array.isArray(fees)) {
        return res.status(400).json({ success: false, message: 'Invalid payment ID or fees data.' });
    }

    try {
        // Calculate the total price from fees
        const totalPrice = fees.reduce((total, fee) => total + parseFloat(fee.price || 0), 0);

        // Construct the fields to update dynamically
        let fieldsToUpdate = fees
            .map((fee, index) => `fees${index + 1} = ?, pricefees${index + 1} = ?`)
            .join(', ');
        const values = fees.flatMap(fee => [fee.name, fee.price]);

        // Reset any unused fees/price fields to NULL
        for (let i = fees.length + 1; i <= 5; i++) {
            fieldsToUpdate += `, fees${i} = NULL, pricefees${i} = NULL`;
        }

        // Add total price to the fields
        fieldsToUpdate += `, price = ?`;
        values.push(totalPrice);

        // Add paymentId and adminId to the query parameters
        values.push(paymentId);

        const query = `
            UPDATE payments
            SET ${fieldsToUpdate}
            WHERE id = ?;
        `;


        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'Payment not found or not created by this admin.' });
        }

        // Log the update in payment_logs
        const action = `Admin updated fees and prices`;
        await db.query(
            `
            INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by)
            VALUES (?, 'Updated', ?, ?, 'None')
            `,
            [paymentId, action, adminId]
        );

        res.status(200).json({ success: true, message: 'Fees and total price updated successfully.' });
    } catch (error) {
        console.error('Error updating fees and prices:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


exports.getPaymentFeesadmin = async (req, res) => {
    const paymentId = req.params.paymentId;

    try {
        const [result] = await db.query(
            `
            SELECT 
                id,
                fees1, pricefees1,
                fees2, pricefees2,
                fees3, pricefees3,
                fees4, pricefees4,
                fees5, pricefees5,
                price
            FROM payments
            WHERE id = ?
            `,
            [paymentId]
        );

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found.' });
        }

        // Format the response to include fees and prices
        const fees = [];
        for (let i = 1; i <= 5; i++) {
            if (result[0][`fees${i}`] && result[0][`pricefees${i}`]) {
                fees.push({
                    index: i,
                    name: result[0][`fees${i}`],
                    price: parseFloat(result[0][`pricefees${i}`]),
                });
            }
        }

        res.status(200).json({
            success: true,
            fees,
            totalPrice: parseFloat(result[0].price),
        });
    } catch (error) {
        console.error('Error fetching payment fees:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};



exports.getSemesterLogs = async (req, res) => {
    const { id } = req.params; // Semester ID from request parameters
    try {
        const [logs] = await db.query(
            `SELECT sl.action, 
                   a.username AS performed_by, 
                   a.firstname AS performed_by_firstname, 
                   a.middlename AS performed_by_middlename, 
                   a.lastname AS performed_by_lastname, 
                   sl.created_at 
            FROM semesters_logs sl 
            JOIN admins a ON sl.performed_by = a.id
            WHERE sl.semester_id = ? 
            ORDER BY sl.created_at DESC`, 
            [id]
        );

        res.json(logs); // Return the logs as a JSON response
    } catch (error) {
        console.error('Error fetching semester logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const { sendSemesterStatusEmail } = require('../config/sendEmailAdmin');

exports.toggleStatus = async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const adminId = req.userId; // Assuming the admin ID is obtained from JWT

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    try {
        // Validate the status value
        if (status !== 'Activated' && status !== 'Not Activated') {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Update the status
        const [result] = await db.query(
            'UPDATE semesters SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows > 0) {
            // Log the action in semesters_logs table
            await db.query(
                'INSERT INTO semesters_logs (semester_id, action, performed_by) VALUES (?, ?, ?)',
                [id, `Status updated to ${status}`, adminId]
            );

            // Fetch semester details
            const [semesterResult] = await db.query('SELECT name FROM semesters WHERE id = ?', [id]);
            const semester = semesterResult[0];

            if (!semester) {
                return res.status(404).json({ error: 'Semester not found' });
            }

            // Fetch all organizations' emails
            const [organizations] = await db.query('SELECT name, email FROM organizations');

            // Send email notifications
            for (const organization of organizations) {
                await sendSemesterStatusEmail(organization.email, organization.name, semester.name, status);
            }

            res.status(200).json({ message: `Semester status updated to ${status} successfully, notifications sent.` });
        } else {
            res.status(404).json({ error: 'Semester not found' });
        }
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};





exports.updateEndDate = async (req, res) => {
    const { end_date } = req.body;
    const { id } = req.params;
    const adminId = req.userId; // Assuming the admin ID is obtained from JWT

    if (!end_date) {
        return res.status(400).json({ error: 'End date is required' });
    }

    try {
        // Fetch the current semester to get the start date and end date
        const [semester] = await db.query('SELECT start_date, end_date FROM semesters WHERE id = ?', [id]);

        if (semester.length === 0) {
            return res.status(404).json({ error: 'Semester not found' });
        }

        const startDate = new Date(semester[0].start_date);
        const currentEndDate = new Date(semester[0].end_date);
        const newEndDate = new Date(end_date);

        

        // Validate that the end date is after the start date
        if (newEndDate <= startDate) {
            return res.status(400).json({ error: 'End date must be after the start date' });
        }

        // Check if the new end date is before the current end date
        if (newEndDate < currentEndDate) {
            return res.status(400).json({ error: 'End date cannot be earlier than the current end date' });
        }

        // Check if the new end date is the same as the current end date (ignoring time)
        if (newEndDate.toDateString() === currentEndDate.toDateString()) {
            return res.status(400).json({ error: 'End date cannot be the same as the current end date' });
        }

        // Update the end date
        const [result] = await db.query(
            'UPDATE semesters SET end_date = ? WHERE id = ?',
            [end_date, id]
        );

        if (result.affectedRows > 0) {
            // Format both the new and current end dates using 'en-PH' locale
            const formattedNewEndDate = newEndDate.toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const formattedCurrentEndDate = currentEndDate.toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Log the action in semesters_logs table
            await db.query(
                'INSERT INTO semesters_logs (semester_id, action, performed_by) VALUES (?, ?, ?)',
                [id, `End date updated to "${formattedNewEndDate}" from "${formattedCurrentEndDate}"`, adminId]
            );

            res.status(200).json({ message: `End date updated to "${formattedNewEndDate}" from "${formattedCurrentEndDate}" successfully` });
        } else {
            res.status(404).json({ error: 'Semester not found' });
        }
    } catch (error) {
        console.error('Error updating end date:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};





exports.getLatestSemester = async (req, res) => {
    try {
        const [semesters] = await db.query('SELECT * FROM semesters ORDER BY created_at DESC LIMIT 1');

        if (semesters.length === 0) {
            return res.status(404).json({ error: 'No semester found' });
        }

        const semester = semesters[0];
        const today = new Date();
        const endDate = new Date(semester.end_date);

        if (endDate < today && semester.status !== 'Not Activated') {
            // Update status to Expired
            await db.query('UPDATE semesters SET status = "Not Activated" WHERE id = ?', [semester.id]);
            semester.status = 'Not Activated';
        }

        res.status(200).json(semester);
    } catch (error) {
        console.error('Error fetching latest semester:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getSemesters = async (req, res) => {
    try {
        const [semesters] = await db.query(`
            SELECT s.*, 
                   a.username AS created_by_username, 
                   a.firstname AS created_by_firstname, 
                   a.middlename AS created_by_middlename, 
                   a.lastname AS created_by_lastname 
            FROM semesters s
            LEFT JOIN admins a ON s.created_by = a.id 
            ORDER BY s.created_at DESC
        `);
        
        res.json(semesters);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



exports.addSemester = async (req, res) => {
    const { academic_year, semester } = req.body;
    const created_by = req.userId;

    if (!academic_year || !semester) {
        return res.status(400).send('Academic year and semester are required.');
    }

    // Validate academic_year format: must be "YYYY-YYYY"
    const academicYearPattern = /^\d{4}-\d{4}$/;
    if (!academicYearPattern.test(academic_year)) {
        return res.status(400).send('Invalid academic year format. Expected format: YYYY-YYYY.');
    }

    // Validate that the second year is exactly one more than the first year
    const years = academic_year.split('-').map(Number);
    if (years[1] !== years[0] + 1) {
        return res.status(400).send('Academic year must be in the format "YYYY-YYYY" where the second year is one more than the first.');
    }

    // Validate semester option
    if (semester !== '1st Semester' && semester !== '2nd Semester') {
        return res.status(400).send('Invalid semester option.');
    }

    // Construct semester name (e.g., "1st Semester 2024-2025")
    const name = `${semester} ${academic_year}`;
    const year = academic_year;

    try {
        // Update all existing semesters to be "Deactivated"
        const updateAllSemestersQuery = `UPDATE semesters SET status = 'Deactivated';`;
        await db.query(updateAllSemestersQuery);

        // Check for an existing semester with the same name and academic year
        const [existingSemester] = await db.query(
            `SELECT * FROM semesters WHERE name = ? AND year = ?`,
            [name, year]
        );
        if (existingSemester.length > 0) {
            return res.status(400).send(`The semester ${name} already exists.`);
        }

        // Update user status to "Pending" for all users with status "Active"
        const updateUserStatusQuery = `
            UPDATE users
            SET status = "Pending"
            WHERE status = "Active";
        `;
        await db.query(updateUserStatusQuery);

        // Insert the new semester with the computed start_date and end_date, and with status "Deactivated"
        const [result] = await db.query(
            'INSERT INTO semesters (name, created_by, year, status) VALUES (?, ?, ?, ?);',
            [name, created_by, year, 'Deactivated']
        );

        const semesterId = result.insertId; // Get the inserted semester ID


        // Additional updates if the added semester is the 1st Semester
        if (semester === '1st Semester') {
            const updateOrganizationsQuery = `UPDATE organizations SET status = 'Not Activated';`;
            await db.query(updateOrganizationsQuery);

            const updateOrganizationsAdviserQuery = `UPDATE organizations_adviser SET status = 'Not Activated';`;
            await db.query(updateOrganizationsAdviserQuery);

            const updateOrganizationsUsersQuery = `UPDATE organizations_users SET status = 'Not Activated', position = 'Not member';`;
            await db.query(updateOrganizationsUsersQuery);
        }

        res.status(201).json({ message: 'Semester added successfully', semesterId: semesterId });
    } catch (error) {
        console.error('Error adding semester:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

  







exports.deleteProduct = async (req, res) => {
    const productId = parseInt(req.params.productId, 10);

    try {
        // Use the database pool to get a connection
        const connection = await db.getConnection();

        // First, retrieve the product image path from the database
        const [rows] = await connection.execute('SELECT product_image FROM products WHERE product_id = ?', [productId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const productImagePath = rows[0].product_image;

        // Delete the product record from the database
        const [result] = await connection.execute('DELETE FROM products WHERE product_id = ?', [productId]);

        // Check if the product was deleted
        if (result.affectedRows > 0) {
            // If the product was successfully deleted, delete the image file
            if (productImagePath) {
                const filePath = path.resolve(productImagePath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }

        // Release the connection back to the pool
        connection.release();
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Error deleting product' });
    }
};
exports.getProductDetails = async (req, res) => {
    const { productId } = req.query;
  
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
  
    try {
      const query = `
        SELECT product_id, name, price, status, pre_order_limit, category, description, product_image, quantity, smallquantity, mediumquantity, largequantity, xlargequantity, organization_id
        FROM products
        WHERE product_id = ?
      `;
      const [rows] = await db.execute(query, [productId]);
  
      if (rows.length === 0) {
        console.log(`Product with ID ${productId} not found.`);
        return res.status(404).json({ error: 'Product not found' });
      }
  
      // Directly return the product details from the database
      const product = rows[0];
  
      res.status(200).json(product);
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
exports.getProductById = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.query(
            'SELECT * FROM products WHERE product_id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateQuantity = async (req, res) => { 
    const { productId } = req.params;
    const { quantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || quantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        // Get the current quantity
        const [currentProduct] = await db.query('SELECT quantity FROM products WHERE product_id = ?', [productId]);
        
        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].quantity;
        const difference = quantity - currentQuantity; 

        // Update the quantity field in the products table
        await db.query('UPDATE products SET quantity = ?, created_by = ? WHERE product_id = ?', [quantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added quantity is ${difference} from ${currentQuantity} to ${quantity}.`;
        } else {
            actionMessage = `Total removed quantity is ${-difference} from ${currentQuantity} to ${quantity}.`;
        }

        // Insert into products_logs
        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            quantity: quantity, // Record the quantity change
        });

        return res.status(200).json({ success: true, msg: 'Quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

exports.updateXSmallQuantity = async (req, res) => { 
    const { productId } = req.params;
    const { xsmallquantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || xsmallquantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        // Get the current X-Small quantity
        const [currentProduct] = await db.query('SELECT xsmallquantity FROM products WHERE product_id = ?', [productId]);
        
        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].xsmallquantity;
        const difference = xsmallquantity - currentQuantity; 

        // Update only the xsmallquantity field in the products table
        await db.query('UPDATE products SET xsmallquantity = ?, created_by = ? WHERE product_id = ?', [xsmallquantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added xsmallquantity is ${difference} from ${currentQuantity} to ${xsmallquantity}.`;
        } else {
            actionMessage = `Total removed xsmallquantity is ${-difference} from ${currentQuantity} to ${xsmallquantity}.`;
        }

        // Insert into products_logs
        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            xsmallquantity: xsmallquantity, // Record only the xsmallquantity
        });

        return res.status(200).json({ success: true, msg: 'X-Small quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

exports.updateSmallQuantity = async (req, res) => {
    const { productId } = req.params;
    const { smallquantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || smallquantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        // Get the current Small quantity
        const [currentProduct] = await db.query('SELECT smallquantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].smallquantity;
        const difference = smallquantity - currentQuantity; 

        // Update only the smallquantity field in the products table
        await db.query('UPDATE products SET smallquantity = ?, created_by = ? WHERE product_id = ?', [smallquantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added smallquantity is ${difference} from ${currentQuantity} to ${smallquantity}.`;
        } else {
            actionMessage = `Total removed smallquantity is ${-difference} from ${currentQuantity} to ${smallquantity}.`;
        }

        // Insert into products_logs
        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            smallquantity: smallquantity, // Record only the smallquantity
        });

        return res.status(200).json({ success: true, msg: 'Small quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
// Update Medium Quantity
exports.updateMediumQuantity = async (req, res) => {
    const { productId } = req.params;
    const { mediumquantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || mediumquantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        const [currentProduct] = await db.query('SELECT mediumquantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].mediumquantity;
        const difference = mediumquantity - currentQuantity; 

        await db.query('UPDATE products SET mediumquantity = ?, created_by = ? WHERE product_id = ?', [mediumquantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added mediumquantity is ${difference} from ${currentQuantity} to ${mediumquantity}.`;
        } else {
            actionMessage = `Total removed mediumquantity is ${-difference} from ${currentQuantity} to ${mediumquantity}.`;
        }

        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            mediumquantity: mediumquantity,
        });

        return res.status(200).json({ success: true, msg: 'Medium quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

// Update Large Quantity
exports.updateLargeQuantity = async (req, res) => {
    const { productId } = req.params;
    const { largequantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || largequantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        const [currentProduct] = await db.query('SELECT largequantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].largequantity;
        const difference = largequantity - currentQuantity; 

        await db.query('UPDATE products SET largequantity = ?, created_by = ? WHERE product_id = ?', [largequantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added largequantity is ${difference} from ${currentQuantity} to ${largequantity}.`;
        } else {
            actionMessage = `Total removed largequantity is ${-difference} from ${currentQuantity} to ${largequantity}.`;
        }

        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            largequantity: largequantity,
        });

        return res.status(200).json({ success: true, msg: 'Large quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

exports.updateXLQuantity = async (req, res) => {
    const { productId } = req.params;
    const { xlargequantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || xlargequantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        const [currentProduct] = await db.query('SELECT xlargequantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].xlargequantity;
        const difference = xlargequantity - currentQuantity; 

        await db.query('UPDATE products SET xlargequantity = ?, created_by = ? WHERE product_id = ?', [xlargequantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added xlargequantity is ${difference} from ${currentQuantity} to ${xlargequantity}.`;
        } else {
            actionMessage = `Total removed xlargequantity is ${-difference} from ${currentQuantity} to ${xlargequantity}.`;
        }

        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            xlargequantity: xlargequantity,
        });

        return res.status(200).json({ success: true, msg: 'Extra-Large quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

// Update Double Extra-Large Quantity
exports.updateXXLQuantity = async (req, res) => {
    const { productId } = req.params;
    const { xxlargequantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || xxlargequantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        const [currentProduct] = await db.query('SELECT xxlargequantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].xxlargequantity;
        const difference = xxlargequantity - currentQuantity; 

        await db.query('UPDATE products SET xxlargequantity = ?, created_by = ? WHERE product_id = ?', [xxlargequantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added xxlargequantity is ${difference} from ${currentQuantity} to ${xxlargequantity}.`;
        } else {
            actionMessage = `Total removed xxlargequantity is ${-difference} from ${currentQuantity} to ${xxlargequantity}.`;
        }

        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            xxlargequantity: xxlargequantity,
        });

        return res.status(200).json({ success: true, msg: 'Double Extra-Large quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};

// Update Triple Extra-Large Quantity
exports.updateXXXLQuantity = async (req, res) => {
    const { productId } = req.params;
    const { xxxlargequantity } = req.body;
    const created_by = req.orgIduser;

    if (!productId || xxxlargequantity === undefined) {
        return res.status(400).json({ msg: 'Invalid request data' });
    }

    try {
        const [currentProduct] = await db.query('SELECT xxxlargequantity FROM products WHERE product_id = ?', [productId]);

        if (currentProduct.length === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const currentQuantity = currentProduct[0].xxxlargequantity;
        const difference = xxxlargequantity - currentQuantity; 

        await db.query('UPDATE products SET xxxlargequantity = ?, created_by = ? WHERE product_id = ?', [xxxlargequantity, created_by, productId]);

        let actionMessage;
        if (difference > 0) {
            actionMessage = `Total added xxxlargequantity is ${difference} from ${currentQuantity} to ${xxxlargequantity}.`;
        } else {
            actionMessage = `Total removed xxxlargequantity is ${-difference} from ${currentQuantity} to ${xxxlargequantity}.`;
        }

        await db.query('INSERT INTO products_logs SET ?', {
            product_id: productId,
            organization_id: req.userId,
            created_at: new Date(),
            action: actionMessage,
            updated_at: new Date(),
            created_by: created_by,
            xxxlargequantity: xxxlargequantity,
        });

        return res.status(200).json({ success: true, msg: 'Triple Extra-Large quantity updated successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};



exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, price, description } = req.body;
    const created_by = req.orgIduser;
    const organization_id = req.userId;

    if (!name && !price && !description) {
        return res.status(400).json({ message: 'At least name, price, or description is required' });
    }

    try {
        const [currentProduct] = await db.query(
            'SELECT * FROM products WHERE product_id = ?',
            [id]
        );

        if (currentProduct.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updateFields = [];
        const updateValues = [];
        let logMessage = [];

        if (name && name !== currentProduct[0].name) {
            updateFields.push('name = ?');
            updateValues.push(name);
            logMessage.push(`Updated name from "${currentProduct[0].name}" to "${name}"`);
        }

        if (price && price !== currentProduct[0].price) {
            updateFields.push('price = ?');
            updateValues.push(price);
            logMessage.push(`Updated price from "${currentProduct[0].price}" to "${price}"`);
        }

        if (description && description !== currentProduct[0].description) {
            updateFields.push('description = ?');
            updateValues.push(description);
            logMessage.push(`Updated description`);
        }

        if (updateFields.length > 0) {
            await db.query(
                `UPDATE products SET ${updateFields.join(', ')} WHERE product_id = ?`,
                [...updateValues, id]
            );

            await db.query(
                'INSERT INTO products_logs (product_id, organization_id, created_by, action) VALUES (?, ?, ?, ?)',
                [id, organization_id, created_by, logMessage.join(', ')]
            );

            const [rows] = await db.query(
                'SELECT * FROM products WHERE product_id = ?',
                [id]
            );

            res.status(200).json(rows[0]);
        } else {
            return res.status(400).json({ message: 'No changes detected' });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};







exports.getAllProducts = async (req, res) => { 
    try {
        // Query to get all products from the database where the latest GCash order for the organization is "Accepted"
        const [results] = await db.query(`
            SELECT p.*
            FROM products p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE EXISTS (
                SELECT 1 
                FROM gcashorder g 
                WHERE g.organization_id = o.id 
                ORDER BY g.created_at DESC 
                LIMIT 1
            ) 
            AND (
                SELECT g.status 
                FROM gcashorder g 
                WHERE g.organization_id = o.id 
                ORDER BY g.created_at DESC 
                LIMIT 1
            ) = 'Accepted'
            ORDER BY p.created_at DESC
        `);

        // Filter products: Show if it has a non-empty quantity OR if status is "Pre-Order"
        const filteredResults = results.filter(product => 
            product.status === 'Pre-Order' ||  // Always include Pre-Order products
            product.quantity || 
            product.smallquantity || 
            product.mediumquantity || 
            product.largequantity || 
            product.xlargequantity
        );

        // Return the filtered list of products
        return res.status(200).json(filteredResults);
    } catch (err) {
        console.error('Error fetching products:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};




const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const organizationId = req.userId; // Assuming userId is organizationId
        const dir = `Products/${organizationId}`;

        // Create the directory if it doesn't exist
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

exports.addProduct = [
    upload.single('productImage'), // Middleware to handle the file upload
    async (req, res) => {
        const {
            name,
            description,
            price,
            category,
            xsmallquantity,
            smallquantity,
            mediumquantity,
            largequantity,
            xlargequantity,
            xxlargequantity,
            xxxlargequantity,
        } = req.body;

        const organizationId = req.userId; // Assuming userId is organizationId
        const created_by = req.orgIduser; // Get the creator's ID
        const productImage = req.file; // File from multer

        if (!productImage) {
            return res.status(400).json({ msg: 'Product image is required' });
        }

        const connection = await db.getConnection();

        try {
            // Fetch organization name from the database
            const [organization] = await connection.query('SELECT name FROM organizations WHERE id = ?', [organizationId]);
            if (!organization.length) {
                throw new Error('Organization not found');
            }
            const organizationName = organization[0].name;

            // Generate a unique filename using uuid
            const uniqueFilename = `${uuidv4()}${path.extname(productImage.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(productImage.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Create a folder in Dropbox for the organization
            const organizationFolderPath = `/uploads/${organizationName}/Products`;

            // Check if folder exists before creating it
            try {
                await dropbox.filesGetMetadata({ path: organizationFolderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${organizationFolderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${organizationFolderPath}`);
                    await dropbox.filesCreateFolderV2({ path: organizationFolderPath });
                }
            }

            // Upload file to the organization's folder in Dropbox
            const dropboxPath = `${organizationFolderPath}/${uniqueFilename}`;
            console.log(`Uploading file to Dropbox at: ${dropboxPath}`);

            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent, // Read file content
                mode: { ".tag": "overwrite" } // Ensures file gets replaced if it exists
            });

            // Ensure path is retrieved from upload response
            const filePath = dropboxUploadResponse.result?.path_display || dropboxPath;

            if (!filePath) {
                throw new Error('Failed to retrieve file path from Dropbox upload response.');
            }

            // Generate shared link for the uploaded file
            let dropboxSharedLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: filePath,
                });
                dropboxSharedLink = sharedLinkResponse.result?.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: filePath });
                if (existingLinks.result.links.length > 0) {
                    dropboxSharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Insert product into the database
            await connection.beginTransaction();

            const [result] = await connection.query('INSERT INTO products SET ?', {
                organization_id: organizationId,
                product_image: dropboxSharedLink, // Store the modified Dropbox shared link
                name,
                description,
                price,
                category,
                xsmallquantity: xsmallquantity || 0,
                smallquantity: smallquantity || 0,
                mediumquantity: mediumquantity || 0,
                largequantity: largequantity || 0,
                xlargequantity: xlargequantity || 0,
                xxlargequantity: xxlargequantity || 0,
                xxxlargequantity: xxxlargequantity || 0,
                created_by: created_by,
            });

            const productId = result.insertId;

            // Insert into products_logs
            await connection.query('INSERT INTO products_logs SET ?', {
                product_id: productId,
                organization_id: organizationId,
                xsmallquantity: xsmallquantity || 0,
                smallquantity: smallquantity || 0,
                mediumquantity: mediumquantity || 0,
                largequantity: largequantity || 0,
                xlargequantity: xlargequantity || 0,
                xxlargequantity: xxlargequantity || 0,
                xxxlargequantity: xxxlargequantity || 0,
                created_by: created_by,
                action: 'Product added successfully',
            });

            await connection.commit();
            return res.status(201).json({ msg: 'Product added successfully', productImage: dropboxSharedLink });
        } catch (err) {
            await connection.rollback();
            console.error(err);
            return res.status(500).json({ msg: 'Server error', error: err.message });
        } finally {
            connection.release();
        }
    },
];




exports.getProducts = async (req, res) => {
    const organizationId = req.userId; // Ensure this is the correct way to get the user's organization ID

    try {
        const query = `
            SELECT * 
            FROM products 
            WHERE organization_id = ? 
            ORDER BY updated_at DESC
        `;
        
        const [products] = await db.query(query, [organizationId]);

        if (!products.length) {
            return res.status(404).json({ msg: 'No products found' });
        }

        return res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};


exports.getAllOrganizations = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*, 
                   a.firstname AS created_by_firstname, 
                   a.middlename AS created_by_middlename, 
                   a.lastname AS created_by_lastname 
            FROM organizations o
            LEFT JOIN admins a ON o.created_by = a.id
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrganizationUserss = async (req, res) => {
    const orgId = req.params.orgId;
    try {
        const [rows] = await db.query(`
            SELECT 
                ou.id, 
                u.firstname, 
                u.lastname, 
                u.email, 
                u.idnumber, 
                ou.position,
                ou.apply_status,
                ou.status AS application_status, 
                ou.created_at,
                o.name AS organization_name
            FROM organizations_users ou
            LEFT JOIN users u ON ou.user_id = u.id
            LEFT JOIN organizations o ON ou.organizations_id = o.id
            WHERE ou.organizations_id = ? AND ou.apply_status = 'Accepted'
        `, [orgId]);
        
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching organization users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getOrganizationsUsersLogsa = async (req, res) => {
    const organizationId = req.params.orgId;
    try {
        const [rows] = await db.query(`
            SELECT 
                logs.id, 
                logs.status, 
                logs.action, 
                logs.created_at, 
                users.firstname AS user_firstname,
                users.middlename AS user_middlename,
                users.lastname AS user_lastname,
                admins.firstname AS admin_firstname,
                admins.middlename AS admin_middlename,
                admins.lastname AS admin_lastname,
                org.name AS organization_name
            FROM organizations_users_history logs
            LEFT JOIN organizations_users ou ON logs.organizations_users_id = ou.id
            LEFT JOIN users ON ou.user_id = users.id
            LEFT JOIN admins ON logs.created_by = admins.id
            LEFT JOIN organizations org ON ou.organizations_id = org.id
            WHERE ou.organizations_id = ?
        `, [organizationId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching organizations users history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};




exports.getOrganizationsUsersHistory = async (req, res) => {
    try {
        const query = `
            SELECT 
                ouh.id,
                CONCAT(ou.firstname, ' ', COALESCE(ou.middlename, ''), ' ', ou.lastname) AS user_fullname,
                o.name AS organization_name,
                ouh.status,
                ouh.action,
                CONCAT(a.firstname, ' ', COALESCE(a.middlename, ''), ' ', a.lastname) AS created_by,
                ouh.created_at,
                'Student' AS type
            FROM organizations_users_history ouh
            JOIN organizations_users ou ON ouh.organizations_users_id = ou.id
            JOIN organizations o ON ou.organizations_id = o.id
            JOIN admins a ON ouh.created_by = a.id

            UNION ALL

            SELECT 
                oah.id,
                CONCAT(oa.firstname, ' ', COALESCE(oa.middlename, ''), ' ', oa.lastname) AS user_fullname,
                o.name AS organization_name,
                oah.status,
                oah.action,
                CONCAT(a.firstname, ' ', COALESCE(a.middlename, ''), ' ', a.lastname) AS created_by,
                oah.created_at,
                'Adviser' AS type
            FROM organizations_adviser_history oah
            JOIN organizations_adviser oa ON oah.organizations_adviser_id = oa.id
            JOIN organizations o ON oa.organizations_id = o.id
            JOIN admins a ON oah.created_by = a.id
            
            ORDER BY created_at DESC;
        `;

        const [results] = await db.execute(query);
        res.status(200).json(results);
    } catch (error) {
        console.error("Error fetching organizations users and advisers history:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



exports.getOrganizationAdvisers = async (req, res) => {
    const organizationId = req.params.orgId;

    try {
        const [advisers] = await db.query(`
           SELECT 
    oa.id,
    oa.user_id,
    u.firstname,
    u.lastname,
    u.email,
    oa.position,
    oa.status,
    oa.created_at,
    o.name AS organization_name
FROM organizations_adviser oa
LEFT JOIN users u ON oa.user_id = u.id
LEFT JOIN organizations o ON oa.organizations_id = o.id
WHERE oa.organizations_id = ?

        `, [organizationId]);

        res.status(200).json(advisers);
    } catch (error) {
        console.error('Error fetching organization advisers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const { sendOrganizationAdviserRegistrationEmail } = require('../config/sendEmailAdmin');

exports.registerOrganizationAdviser = async (req, res) => {
    const { userId } = req.body;
    const organizationId = req.params.organization_id; // Organization ID from URL params
    const createdBy = req.userId; // Admin ID from token

    if (!createdBy) {
        return res.status(403).json({ msg: 'Unauthorized: Admin ID is missing' });
    }

    try {
        // Check if there is an activated adviser for the organization
        const [activatedAdviser] = await db.query(
            'SELECT * FROM organizations_adviser WHERE organizations_id = ? AND status = "Activated"',
            [organizationId]
        );

        if (activatedAdviser.length > 0) {
            return res.status(400).json({
                msg: 'There is already an activated adviser for this organization. You cannot add another.',
            });
        }

        // Check if the user is already registered as an adviser in the organization
        const [existingAdviser] = await db.query(
            'SELECT * FROM organizations_adviser WHERE user_id = ? AND organizations_id = ?',
            [userId, organizationId]
        );

        if (existingAdviser.length > 0) {
            return res.status(400).json({
                msg: 'This user is already registered as an adviser for the selected organization.',
            });
        }

        // Fetch user details from the `users` table
        const [userDetails] = await db.query(
            'SELECT firstname, middlename, lastname, email FROM users WHERE id = ?',
            [userId]
        );

        if (userDetails.length === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const { firstname, middlename, lastname, email } = userDetails[0];

        // Fetch organization details
        const [organizationResult] = await db.query(
            'SELECT name FROM organizations WHERE id = ?',
            [organizationId]
        );

        if (organizationResult.length === 0) {
            return res.status(404).json({ msg: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Insert the adviser into organizations_adviser
        await db.query('INSERT INTO organizations_adviser SET ?', {
            user_id: userId,
            organizations_id: organizationId,
            position: 'Adviser',
            firstname,
            middlename,
            lastname,
            created_by: createdBy,
            status: 'Not Activated',
        });

        // Send email notification to the adviser
        await sendOrganizationAdviserRegistrationEmail(email, firstname, middlename, lastname, organizationName);

        return res.status(201).json({ msg: 'Successfully registered as an adviser and notification sent!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error', error: err.message });
    }
};



const { sendOrganizationUserRegistrationEmail } = require('../config/sendEmailAdmin');

exports.registerOrganizationUser = async (req, res) => {
    const { userId, position } = req.body;
    const organizationId = req.params.organization_id; // Organization ID from URL params
    const createdBy = req.userId; // Admin ID from token

    if (!createdBy) {
        return res.status(403).json({ msg: 'Unauthorized: Admin ID is missing' });
    }

    try {
        // Check if the user is already registered in the organization
        const [existingUser] = await db.query(
            'SELECT * FROM organizations_users WHERE user_id = ? AND organizations_id = ?',
            [userId, organizationId]
        );

        if (existingUser.length > 0) {
            // Fetch the organization name for detailed error feedback
            const [organization] = await db.query(
                'SELECT name FROM organizations WHERE id = ?',
                [organizationId]
            );

            const organizationName = organization.length > 0 ? organization[0].name : 'Unknown Organization';
            return res.status(400).json({
                msg: `User is already registered in the "${organizationName}".`,
            });
        }

        // Fetch user details from the `users` table
        const [userDetails] = await db.query(
            'SELECT firstname, middlename, lastname, email FROM users WHERE id = ?',
            [userId]
        );

        if (userDetails.length === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const { firstname, middlename, lastname, email } = userDetails[0];

        // Fetch organization details
        const [organizationResult] = await db.query(
            'SELECT name FROM organizations WHERE id = ?',
            [organizationId]
        );

        if (organizationResult.length === 0) {
            return res.status(404).json({ msg: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Insert the user into organizations_users
        await db.query('INSERT INTO organizations_users SET ?', {
            user_id: userId,
            organizations_id: organizationId,
            position,
            created_at: new Date(),
            created_by: createdBy,
            status: 'Not Activated',
            apply_status: 'Accepted',
            firstname,
            middlename,
            lastname,
        });

        // Send email notification to the user
        await sendOrganizationUserRegistrationEmail(email, firstname, middlename, lastname, organizationName, position);

        return res.status(201).json({ msg: 'Successfully registered organization user and notification sent!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error', error: err.message });
    }
};

const { sendUserPositionUpdateEmail } = require('../config/sendEmailAdmin');

exports.updateUserPosition = async (req, res) => {
    const { position } = req.body;
    const userId = req.params.user_id;
    const createdBy = req.userId; // Admin ID from token

    if (!position) {
        return res.status(400).json({ msg: 'Position is required.' });
    }

    try {
        // Fetch the current organizations_users record
        const [userDetails] = await db.query(`
            SELECT id AS organizations_users_id, user_id, position AS currentPosition, organizations_id
            FROM organizations_users 
            WHERE id = ?
        `, [userId]);

        if (userDetails.length === 0) {
            return res.status(404).json({ msg: 'User not found in organizations_users.' });
        }

        const { organizations_users_id, user_id, currentPosition, organizations_id } = userDetails[0];

        // Fetch user details from the `users` table
        const [userResult] = await db.query(`
            SELECT firstname, middlename, lastname, email 
            FROM users 
            WHERE id = ?
        `, [user_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const { firstname, middlename, lastname, email } = userResult[0];

        // Fetch organization details
        const [organizationResult] = await db.query(`
            SELECT name FROM organizations WHERE id = ?
        `, [organizations_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ msg: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Fetch the latest semester's academic year
        const [latestSemester] = await db.query(`
            SELECT year
            FROM semesters
            ORDER BY id DESC
            LIMIT 1
        `);

        if (!latestSemester || latestSemester.length === 0) {
            return res.status(400).json({ success: false, message: 'No active semester found.' });
        }

        const { year } = latestSemester[0]; // This is the academic year

        // Ensure no duplicate positions (except for "Member")
        if (position.toLowerCase() !== "member") {
            const [existingPosition] = await db.query(`
                SELECT * 
                FROM organizations_users_logs 
                WHERE position = ? AND year = ? AND organizations_id = ?
            `, [position, year, organizations_id]);

            if (existingPosition.length > 0) {
                return res.status(400).json({ msg: `The position "${position}" for the academic year "${year}" is already assigned in this organization.` });
            }
        }

        // Update the user's position
        const [updateResult] = await db.query(
            'UPDATE organizations_users SET position = ?, created_at = NOW() WHERE id = ?',
            [position, userId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ msg: 'No changes made or user not found.' });
        }

        // Add an entry in organizations_users_history
        const action = `"${currentPosition}" position updated to "${position}" for the academic year ${year}`;
        await db.query(`
            INSERT INTO organizations_users_history (organizations_users_id, status, action, created_at, created_by)
            VALUES (?, ?, ?, NOW(), ?)
        `, [organizations_users_id, position, action, createdBy]);

        // Check if a log for the same user and year already exists
        const [existingLog] = await db.query(`
            SELECT * 
            FROM organizations_users_logs 
            WHERE organizations_users_id = ? AND year = ?
        `, [organizations_users_id, year]);

        if (existingLog.length > 0) {
            // Update the existing log
            await db.query(`
                UPDATE organizations_users_logs
                SET position = ?, created_at = NOW(), created_by = ?
                WHERE organizations_users_id = ? AND year = ?
            `, [position, createdBy, organizations_users_id, year]);
        } else {
            // Insert a new log
            await db.query(`
                INSERT INTO organizations_users_logs (organizations_users_id, user_id, organizations_id, position, year, created_at, created_by)
                VALUES (?, ?, ?, ?, ?, NOW(), ?)
            `, [organizations_users_id, user_id, organizations_id, position, year, createdBy]);
        }

        // Send email notification to the user including the academic year
        await sendUserPositionUpdateEmail(email, firstname, middlename, lastname, organizationName, position, year);

        res.status(200).json({ success: true, msg: 'Position updated successfully and notification sent!' });
    } catch (err) {
        console.error('Error updating position and logging:', err);
        return res.status(500).json({ msg: 'Server error.', error: err.message });
    }
};






exports.getOrganizationById = async (req, res) => {
    const { organization_id } = req.params;

    try {
        const [organization] = await db.query('SELECT name FROM organizations WHERE id = ?', [organization_id]);

        if (organization.length === 0) {
            return res.status(404).json({ msg: 'Organization not found.' });
        }

        return res.status(200).json(organization[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error', error: err.message });
    }
};
exports.getAvailableYears = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT year 
            FROM (
                SELECT year FROM organizations_users_logs
                UNION
                SELECT year FROM organizations_adviser_logs
            ) AS all_years
            ORDER BY year DESC;
        `;
        const [years] = await db.query(query);
        res.status(200).json({ years: years.map(row => row.year) });
    } catch (error) {
        console.error('Error fetching available years:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getLatestYear = async (req, res) => {
    try {
        const query = `
            SELECT year 
            FROM semesters 
            ORDER BY id DESC 
            LIMIT 1;
        `;
        const [latest] = await db.query(query);
        res.status(200).json({ latestYear: latest[0]?.year });
    } catch (error) {
        console.error('Error fetching latest year:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getOrganizationsUsersLogs = async (req, res) => {
    const { organization_id } = req.params;
    const { year } = req.query;  // Get the year from query parameter

    try {
        const query = `
            SELECT 
                logs.id, 
                logs.user_id, 
                logs.organizations_id, 
                logs.position, 
                logs.year, 
                users.firstname,
                users.middlename,
                users.lastname
            FROM 
                organizations_users_logs AS logs
            JOIN 
                users ON logs.user_id = users.id
            WHERE 
                logs.organizations_id = ?
                ${year ? 'AND logs.year = ?' : ''}
            ORDER BY 
                FIELD(logs.position, 
                    'President', 
                    'Vice-President', 
                    'Secretary', 
                    'Treasurer', 
                    'Auditor', 
                    'PIO', 
                    'Member'
                );
        `;
        
        const params = year ? [organization_id, year] : [organization_id];
        const [logs] = await db.query(query, params);
        
        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching organizations users logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getOrganizationsAdviserLogs = async (req, res) => {
    const { organization_id } = req.params;
    const { year } = req.query;

    try {
        const query = `
            SELECT 
                logs.id, 
                logs.user_id, 
                logs.organizations_id, 
                logs.position, 
                logs.year, 
                users.firstname,
                users.middlename,
                users.lastname
            FROM 
                organizations_adviser_logs AS logs
            JOIN 
                users ON logs.user_id = users.id
            WHERE 
                logs.organizations_id = ?
                ${year ? 'AND logs.year = ?' : ''}
            ORDER BY 
                logs.created_at DESC;
        `;
        
        const params = year ? [organization_id, year] : [organization_id];
        const [logs] = await db.query(query, params);
        
        res.status(200).json({ logs });
    } catch (error) {
        console.error('Error fetching organizations adviser logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const { sendUserStatusUpdateEmailDelete } = require('../config/sendEmailAdmin');

exports.deleteOrganizationsUsersLog = async (req, res) => {
    const { id } = req.params;
    const createdBy = req.userId; // Admin ID who performs the deletion

    try {
        // First, get the organizations_users_id from the log entry
        const [logEntry] = await db.query('SELECT organizations_users_id FROM organizations_users_logs WHERE id = ?', [id]);

        if (logEntry.length === 0) {
            return res.status(404).json({ message: 'Log not found.' });
        }

        const organizationsUsersId = logEntry[0].organizations_users_id;

        // Fetch user details from the organizations_users table
        const [userDetails] = await db.query(`
            SELECT users.id AS user_id, users.firstname, users.middlename, users.lastname, users.email,
                   organizations_users.organizations_id
            FROM organizations_users
            JOIN users ON organizations_users.user_id = users.id
            WHERE organizations_users.id = ?
        `, [organizationsUsersId]);

        if (userDetails.length === 0) {
            return res.status(404).json({ message: 'User not found in organizations_users.' });
        }

        const { user_id, firstname, middlename, lastname, email, organizations_id } = userDetails[0];

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizations_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ message: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Fetch admin details
        const [adminResult] = await db.query('SELECT firstname, middlename, lastname FROM admins WHERE id = ?', [createdBy]);

        if (adminResult.length === 0) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        // Delete the log
        await db.query('DELETE FROM organizations_users_logs WHERE id = ?', [id]);

        // Update the corresponding organizations_users entry
        await db.query(`
            UPDATE organizations_users 
            SET position = 'Not member', status = 'Not Activated' 
            WHERE id = ?
        `, [organizationsUsersId]);

        // Add history logging
        const action = `Removed from the Organization`;
        const logHistoryQuery = `
            INSERT INTO organizations_users_history (organizations_users_id, status, action, created_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        await db.query(logHistoryQuery, [organizationsUsersId, 'Not Activated', action, createdBy]);

        // Send email notification
        await sendUserStatusUpdateEmailDelete(email, firstname, middlename, lastname, organizationName, 'Not Activated', adminFullName);

        res.status(200).json({ message: 'Organizations Users Log deleted, user status updated, history logged, and email sent successfully.' });
    } catch (error) {
        console.error('Error deleting organizations users log:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Delete Organizations Adviser Log
const { sendAdviserStatusUpdateEmailDelete } = require('../config/sendEmailAdmin');

exports.deleteOrganizationsAdviserLog = async (req, res) => {
    const { id } = req.params;
    const createdBy = req.userId; // Admin ID who performs the deletion

    try {
        // Get the organizations_adviser_id from the log entry
        const [logEntry] = await db.query('SELECT organizations_adviser_id FROM organizations_adviser_logs WHERE id = ?', [id]);

        if (logEntry.length === 0) {
            return res.status(404).json({ message: 'Log not found.' });
        }

        const organizationsAdviserId = logEntry[0].organizations_adviser_id;

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT users.id AS user_id, users.firstname, users.middlename, users.lastname, users.email, 
                   organizations_adviser.organizations_id
            FROM organizations_adviser
            JOIN users ON organizations_adviser.user_id = users.id
            WHERE organizations_adviser.id = ?
        `, [organizationsAdviserId]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ message: 'Adviser not found in organizations_adviser.' });
        }

        const { user_id, firstname, middlename, lastname, email, organizations_id } = adviserResult[0];

        // Fetch organization details
        const [organizationResult] = await db.query('SELECT name FROM organizations WHERE id = ?', [organizations_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ message: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Fetch admin details
        const [adminResult] = await db.query('SELECT firstname, middlename, lastname FROM admins WHERE id = ?', [createdBy]);

        if (adminResult.length === 0) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        // Delete the log
        await db.query('DELETE FROM organizations_adviser_logs WHERE id = ?', [id]);

        // Update the corresponding organizations_adviser entry
        await db.query(`
            UPDATE organizations_adviser 
            SET status = 'Not Activated' 
            WHERE id = ?`, 
            [organizationsAdviserId]
        );

        // Add history logging
        const action = `Removing from the academic year`;
        await db.query(`
            INSERT INTO organizations_adviser_history (organizations_adviser_id, status, action, created_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [organizationsAdviserId, 'Not Activated', action, createdBy]);

        // Send email notification
        await sendAdviserStatusUpdateEmailDelete(email, firstname, middlename, lastname, organizationName, 'Not Activated', adminFullName);

        res.status(200).json({ message: 'Organizations Adviser Log deleted, adviser status updated, history logged, and email sent successfully.' });
    } catch (error) {
        console.error('Error deleting organizations adviser log:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const { sendOrganizationStatusEmail } = require('../config/sendEmailAdmin');

exports.updateOrganizationStatus = async (req, res) => {
    const { organizationId, status } = req.body;
    const adminId = req.userId; // Get the admin ID from the authenticated user

    if (!organizationId || !status) {
        return res.status(400).json({ success: false, message: 'Organization ID and status are required' });
    }

    try {
        // Fetch the latest semester including its year and name
        const semesterQuery = 'SELECT id, name, year FROM semesters ORDER BY created_at DESC LIMIT 1';
        const [semesterResult] = await db.query(semesterQuery);

        if (semesterResult.length === 0) {
            return res.status(404).json({ success: false, message: 'No active semester found' });
        }
        const semesterId = semesterResult[0].id;
        const semesterName = semesterResult[0].name;
        const semesterYear = semesterResult[0].year;

        // Fetch the organization details
        const orgQuery = 'SELECT name, email FROM organizations WHERE id = ?';
        const [orgResult] = await db.query(orgQuery, [organizationId]);

        if (orgResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }
        const organizationName = orgResult[0].name;
        const organizationEmail = orgResult[0].email;

        // Fetch admin details
        const adminQuery = 'SELECT firstname, middlename, lastname FROM admins WHERE id = ?';
        const [adminResult] = await db.query(adminQuery, [adminId]);

        if (adminResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }
        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        // Update the organization's status
        const updateQuery = 'UPDATE organizations SET status = ? WHERE id = ?';
        const [result] = await db.query(updateQuery, [status, organizationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        // Log the update in organizations_logs table
        const logQuery = `
            INSERT INTO organizations_logs (organization_id, action, status, semester_id, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        const action = `Updated organization status to '${status}'`;
        await db.query(logQuery, [organizationId, action, status, semesterId, adminId]);

        // When status is 'Activated', update organizations_year table
        if (status === 'Activated') {
            // Check if an entry already exists for the current semester year
            const checkQuery = 'SELECT * FROM organizations_year WHERE organization_id = ? AND year = ?';
            const [existing] = await db.query(checkQuery, [organizationId, semesterYear]);

            // Only insert a new record if there is no existing record for the current semester year
            if (existing.length === 0) {
                const insertQuery = 'INSERT INTO organizations_year (organization_id, year, status, created_by) VALUES (?, ?, ?, ?)';
                await db.query(insertQuery, [organizationId, semesterYear, 'Activated', adminId]);
            }
        }

        // Send email notification to the organization
        await sendOrganizationStatusEmail(organizationEmail, organizationName, semesterName, status, adminFullName);

        res.status(200).json({ success: true, message: 'Organization status updated successfully and notification sent.' });
    } catch (error) {
        console.error('Error updating organization status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};








const { sendOtpEmail, sendOrganizationConfirmationEmail } = require('../config/sendEmail');
const otpGenerator = require('otp-generator');

exports.registerOrganization = async (req, res) => {
    const { name, email } = req.body;
    const adminId = req.userId;

    if (!adminId) {
        return res.status(403).json({ msg: 'Unauthorized: Admin ID is missing' });
    }

    try {
        const [result] = await db.query('SELECT * FROM organizations WHERE email = ?', [email]);

        if (result.length > 0) {
            return res.status(400).json({ msg: 'Organization already exists' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();


        // Store the organization with OTP, verification attempts, and status as "Pending"
        await db.query('INSERT INTO organizations SET ?', {
            name,
            email,
            created_by: adminId,
            otp,  // Store the OTP for verification
            otp_attempts: 0,  // Initialize OTP attempts to 0
            otp_sent_at: new Date(),  // Timestamp of when the OTP was sent
            email_status: 'Pending'  // Set status to Pending initially
        });

        // Send the OTP to the email address
        await sendOtpEmail(email, otp, name);  // Pass organization name

        return res.status(201).json({ msg: 'Successfully registered the organization! An OTP has been sent to your email.', organization: { name, email } });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error', error: err.message });
    }
};



const transporter = require('../config/!Mainmailer.js');

const sendSuccessEmail = async (orgEmail, orgName) => {
    const mailOptions = {
        from: 'collegofcomputingstudies2024@gmail.com',
        to: orgEmail,
        subject: `Congratulations, ${orgName}! Your email has been successfully verified`,
        html: `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0b3d2e;">Congratulations! ${orgName}</h2>
                        <p style="font-size: 16px; line-height: 1.5;">Your organization has been successfully created and your email verified.</p>
                        <p style="font-size: 16px; line-height: 1.5;">You may now begin adding your officers and advisers to get started.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Best regards,<br>The College of Computing Studies</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <img src="https://drive.google.com/uc?id=1WawamI-BP8S6hG0DfEEBe0gu9pxDySl-" alt="Logo" width="150" />
                        <p style="font-size: 14px; color: #777; margin-top: 10px;">Follow us on <a href="https://www.facebook.com/wmsuccs" style="color: #0b3d2e; text-decoration: none;">Facebook</a></p>
                    </div>
                </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Success email sent successfully to', orgEmail);
    } catch (error) {
        console.error('Error sending success email:', error);
    }
};

// Function to handle OTP verification
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Fetch the organization using the email
        const [orgResult] = await db.query('SELECT * FROM organizations WHERE email = ?', [email]);

        if (orgResult.length === 0) {
            return res.status(404).json({ msg: 'Organization not found' });
        }

        const org = orgResult[0];

        // Check if OTP is valid and not expired
        const otpExpirationTime = 10 * 60 * 1000; // OTP expiration time (10 minutes)

        if (new Date() - new Date(org.otp_sent_at) > otpExpirationTime) {
            // If OTP has expired, delete the organization and return a response
            await db.query('DELETE FROM organizations WHERE email = ?', [email]);

            return res.status(400).json({ 
                msg: 'OTP has expired and organization has been deleted',
                redirectTo: 'admincontrolOrganization.html' 
            });
        }

        if (org.otp === otp) {
            // OTP matches, mark as verified and reset attempts count
            await db.query('UPDATE organizations SET email_status = "Verified", otp_attempts = 0 WHERE email = ?', [email]);

            // Send success email after OTP verification
            await sendSuccessEmail(org.email, org.name);

            return res.status(200).json({ msg: 'OTP verified successfully' });
        } else {
            // Increment OTP attempts count
            await db.query('UPDATE organizations SET otp_attempts = otp_attempts + 1 WHERE email = ?', [email]);

            // Check if the number of failed attempts reaches the limit
            if (org.otp_attempts + 1 >= 5) {
                // Delete the organization if there are 5 failed attempts
                await db.query('DELETE FROM organizations WHERE email = ?', [email]);

                return res.status(400).json({ 
                    msg: 'Too many failed attempts, organization has been deleted', 
                    redirectTo: 'admincontrolOrganization.html' 
                });
            }

            return res.status(400).json({ msg: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};







const { sendOtpEmailusers } = require('../config/sendEmailusers');


exports.register = async (req, res) => {
    const {
        username, email, password, idnumber, course, section, firstname, lastname, middlename,
        contactnumber, gender, role, position
    } = req.body;

    try {
        // Check if the email, username, or ID number already exists in the users table
        const [usersResult] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ? OR idnumber = ?',
            [email, username, idnumber]
        );

        // Check if the email exists in the organizations table
        const [orgsResult] = await db.query(
            'SELECT * FROM organizations WHERE email = ?',
            [email]
        );

        // Check if the email exists in the admins table
        const [adminsResult] = await db.query(
            'SELECT * FROM admins WHERE email = ?',
            [email]
        );

        // Check for existing user by email, username, or ID number
        const existingEmailInUsers = usersResult.find(user => user.email === email);
        const existingUsername = usersResult.find(user => user.username === username);
        const existingIdNumber = usersResult.find(user => user.idnumber === idnumber);
        const existingEmailInOrgs = orgsResult.find(org => org.email === email);
        const existingEmailInAdmins = adminsResult.find(admin => admin.email === email);

        // Return error messages if user already exists
        if (existingEmailInUsers || existingEmailInOrgs || existingEmailInAdmins) {
            return res.status(400).json({ success: false, msg: 'Email already exists' });
        }
        if (existingUsername) {
            return res.status(400).json({ success: false, msg: 'Username already exists' });
        }
        if (existingIdNumber) {
            return res.status(400).json({ success: false, msg: 'ID Number already exists' });
        }

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 8);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Prepare user data for insertion
        const userData = {
            username,
            email,
            password: hashedPassword,
            idnumber,
            firstname,
            lastname,
            middlename,
            contactnumber,
            gender,
            role,
            otp,
            otp_attempts: 0,
            otp_sent_at: new Date(),
            email_status: 'Pending',
        };

        // Include course and section for students
        if (role === 'Student') {
            userData.course = course;
            userData.section = section;
        }

        // Include position for teachers
        if (role === 'Teacher') {
            userData.position = position;
            userData.course = course;
        }

        // Insert new user into the database
        await db.query('INSERT INTO users SET ?', userData);

        // Send OTP email
        await sendOtpEmailusers(email, otp, `${firstname} ${middlename} ${lastname}`, role);

        // Return success message upon successful registration
        return res.status(201).json({
            success: true,
            msg: 'User registered successfully! An OTP has been sent to your email.',
            redirectTo: 'otpuserverification.html'
        });

    } catch (err) {
        console.error('Server error:', err);
        // Return a generic server error message
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};



const { sendAccountVerifiedEmails } = require('../config/sendEmailusers');

exports.verifyOtpUsers = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Fetch the user by email
        const [userResult] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userResult.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const user = userResult[0];

        // Check if OTP is valid and not expired
        const otpExpirationTime = 10 * 60 * 1000; // OTP expiration time (10 minutes)

        if (new Date() - new Date(user.otp_sent_at) > otpExpirationTime) {
            return res.status(400).json({ msg: 'OTP has expired, please request a new one.' });
        }

        if (user.otp === otp) {
            // OTP matches, mark as verified and reset attempts count
            await db.query('UPDATE users SET email_status = "Verified", otp_attempts = 0, otp = NULL WHERE email = ?', [email]);

            // Send notification email about successful account verification
            sendAccountVerifiedEmails(email, `${user.firstname} ${user.middlename || ''} ${user.lastname}`);

            return res.status(200).json({ msg: 'OTP verified successfully' });
        } else {
            // Increment OTP attempts count
            await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = ?', [email]);

            // Check if the number of failed attempts reaches the limit
            if (user.otp_attempts + 1 >= 5) {
                return res.status(400).json({ msg: 'Too many failed attempts, please request a new OTP.' });
            }

            return res.status(400).json({ msg: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.resendOtp = async (req, res) => {
    const { email } = req.body;

    try {
        // Check if the user exists
        const [userResult] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userResult.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = userResult[0];

        // Check if the email is already verified
        if (user.email_status === 'Verified') {
            return res.status(400).json({ success: false, msg: 'Email is already verified' });
        }

        // Generate a new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();


        // Update the OTP in the database
        await db.query('UPDATE users SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [
            otp,
            new Date(),
            email,
        ]);

        // Send the OTP via email
        await sendOtpEmailusers(email, otp, `${user.firstname} ${user.middlename} ${user.lastname}`, user.role);

        return res.status(200).json({
            success: true,
            msg: 'OTP has been resent successfully. Please check your email.',
        });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};
exports.deleteUser = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, msg: 'Email is required' });
    }

    try {
        // Check if the user exists
        const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        // Delete the user from the database
        await db.query('DELETE FROM users WHERE email = ?', [email]);

        return res.status(200).json({ success: true, msg: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};
const { sendAccountVerifiedEmail } = require('../config/sendEmailusersmobile.js');

exports.verifyOtpMobile = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const user = users[0];

        const otpExpirationTime = 10 * 60 * 1000; // 10 minutes

        if (new Date() - new Date(user.otp_sent_at) > otpExpirationTime) {
            return res.status(400).json({ msg: 'OTP has expired, please request a new one.' });
        }

        if (user.otp === otp) {
            // Update user email status and reset OTP
            await db.query(
                'UPDATE users SET email_status = "Verified", otp_attempts = 0, otp = NULL WHERE email = ?',
                [email]
            );

            // Send notification email about successful account verification
            sendAccountVerifiedEmail(email, `${user.firstname} ${user.middlename || ''} ${user.lastname}`);

            return res.status(200).json({ msg: 'OTP verified successfully' });
        } else {
            await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = ?', [email]);

            if (user.otp_attempts + 1 >= 5) {
                return res.status(400).json({ msg: 'Too many failed attempts. Please request a new OTP.' });
            }

            return res.status(400).json({ msg: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};

const { sendOtpEmailusersMobile } = require('../config/sendEmailusersmobile.js');
exports.registers = async (req, res) => {
    const {
        username, email, password, idnumber, course, section, firstname, lastname, middlename,
        contactnumber, gender
    } = req.body;

    try {
        // Check if the email, username, or ID number already exists in the database
        const [result] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ? OR idnumber = ?', 
            [email, username, idnumber]
        );

        // Check for existing user by email, username, or ID number
        const existingEmail = result.find(user => user.email === email);
        const existingUsername = result.find(user => user.username === username);
        const existingIdNumber = result.find(user => user.idnumber === idnumber);

        // Return error messages if user already exists
        if (existingEmail) {
            return res.status(400).json({ success: false, msg: 'Email already exists' });
        }
        if (existingUsername) {
            return res.status(400).json({ success: false, msg: 'Username already exists' });
        }
        if (existingIdNumber) {
            return res.status(400).json({ success: false, msg: 'ID Number already exists' });
        }

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 8);

        // Insert new user into the database
        await db.query('INSERT INTO users SET ?', {
            username,
            email,
            password: hashedPassword,
            idnumber,
            course,
            section,
            firstname,
            lastname,
            middlename,
            contactnumber,
            gender,
            
        });

        // Return success message upon successful registration
        return res.status(201).json({ success: true, msg: 'User registered successfully' });

    } catch (err) {
        console.error('Server error:', err);
        // Return a generic server error message
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};





exports.resendOtpMobile = async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = users[0];

        if (user.email_status === 'Verified') {
            return res.status(400).json({ success: false, msg: 'Email is already verified' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await db.query('UPDATE users SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [otp, new Date(), email]);

        await sendOtpEmailusersMobile(email, otp, `${user.firstname} ${user.middlename} ${user.lastname}`);

        return res.status(200).json({ success: true, msg: 'OTP has been resent successfully' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
};


exports.deleteUserMobile = async (req, res) => {
    const { email } = req.body;

    try {
        const [result] = await db.query('DELETE FROM users WHERE email = ?', [email]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        return res.status(200).json({ msg: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const [result] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (result.length === 0) {
            return res.status(400).json({ msg: 'Email or password is incorrect' });
        }

        const user = result[0];

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Email or password is incorrect' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user.id }, 'jwtSecret', { expiresIn: '8h' });
        return res.json({ token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

const { sendAccountVerifiedEmailAdmin } = require('../config/sendEmailusersAdmin');





exports.verifyAdminOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const [adminResult] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);

        if (adminResult.length === 0) {
            return res.status(404).json({ msg: 'Admin not found' });
        }

        const admin = adminResult[0];
        const otpExpirationTime = 10 * 60 * 1000;

        // Check if OTP has expired
        if (new Date() - new Date(admin.otp_sent_at) > otpExpirationTime) {
            await db.query('DELETE FROM admins WHERE email = ?', [email]);
            return res.status(400).json({ msg: 'OTP expired. Admin registration deleted.' });
        }

        // Check if the OTP is correct
        if (admin.otp === otp) {
            await db.query('UPDATE admins SET email_status = "Verified", otp_attempts = 0 WHERE email = ?', [email]);

            // Send account verified email
            const userFullName = `${admin.firstname} ${admin.middlename} ${admin.lastname}`;
            const role = admin.role; // Get role from the database
            await sendAccountVerifiedEmailAdmin(email, role, userFullName);

            return res.status(200).json({ msg: 'OTP verified successfully!' });
        } else {
            // Increment OTP attempts
            await db.query('UPDATE admins SET otp_attempts = otp_attempts + 1 WHERE email = ?', [email]);

            // Check if attempts exceed the limit
            if (admin.otp_attempts + 1 >= 5) {
                await db.query('DELETE FROM admins WHERE email = ?', [email]);
                return res.status(400).json({ msg: 'Too many failed attempts. Admin registration deleted.' });
            }

            return res.status(400).json({ msg: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};



exports.resendAdminOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const [adminResult] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);

        if (adminResult.length === 0) {
            return res.status(404).json({ msg: 'Admin not found' });
        }

        const admin = adminResult[0];
        if (admin.email_status === 'Verified') {
            return res.status(400).json({ msg: 'Email already verified' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await db.query('UPDATE admins SET otp = ?, otp_attempts = 0, otp_sent_at = ? WHERE email = ?', [
            otp,
            new Date(),
            email,
        ]);

        await sendOtpEmailAdmin(email, otp, `${admin.firstname} ${admin.middlename} ${admin.lastname}`);

        return res.status(200).json({ msg: 'OTP resent successfully!' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.getAllAdmins = async (req, res) => {
    try {
        // Retrieve all admins from the database
        const [admins] = await db.query('SELECT * FROM admins');

        // Check if no admins found
        if (admins.length === 0) {
            return res.status(404).json({ msg: 'No admins found' });
        }

        // Return all admins as a JSON response
        return res.status(200).json(admins);
    } catch (error) {
        console.error('Error retrieving admins:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};
const { sendAdminStatusUpdateEmail } = require('../config/sendEmailusersAdmin.js'); 

exports.toggleAdminStatus = async (req, res) => {
    const { id } = req.params;
    const performed_by = req.userId; // Admin ID performing the action

    try {
        // Fetch admin's current status
        const [admin] = await db.query('SELECT * FROM admins WHERE id = ?', [id]);

        if (admin.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        const newStatus = admin[0].status === 'Activated' ? 'Not Activated' : 'Activated';

        // Update the admin's status
        await db.query('UPDATE admins SET status = ? WHERE id = ?', [newStatus, id]);

        // Log the status change in `admin_logs`
        const action = `status update to "${newStatus}"`;
        await db.query(`
            INSERT INTO admin_logs (admin_id, action, performed_by, created_at)
            VALUES (?, ?, ?, NOW())
        `, [id, action, performed_by]);

        // Send email notification
        const adminEmail = admin[0].email;
        const adminFullName = `${admin[0].firstname} ${admin[0].middlename ? admin[0].middlename + ' ' : ''}${admin[0].lastname}`;

        await sendAdminStatusUpdateEmail(adminEmail, adminFullName, newStatus);

        res.status(200).json({ success: true, message: 'Status updated successfully', newStatus });
    } catch (err) {
        console.error('Error updating admin status:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update admin role
const { sendAdminRoleUpdateEmail } = require('../config/sendEmailusersAdmin.js'); 

exports.updateAdminRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body; // Role can be 'Super Admin' or 'Admin'
    const performed_by = req.userId; // Admin ID performing the action

    // Validate the role input
    if (!role || (role !== 'Super Admin' && role !== 'Admin')) {
        return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    try {
        // Check if the admin exists
        const [adminResult] = await db.query('SELECT * FROM admins WHERE id = ?', [id]);

        if (adminResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        const oldRole = adminResult[0].role; // Store old role for logging

        // Update admin role
        const query = 'UPDATE admins SET role = ? WHERE id = ?';
        await db.query(query, [role, id]);

        // Log the role change in `admin_logs`
        const action = `Role changed from "${oldRole}" to "${role}"`;
        await db.query(`
            INSERT INTO admin_logs (admin_id, action, performed_by, created_at)
            VALUES (?, ?, ?, NOW())
        `, [id, action, performed_by]);

        // Send email notification
        const adminEmail = adminResult[0].email;
        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename ? adminResult[0].middlename + ' ' : ''}${adminResult[0].lastname}`;

        await sendAdminRoleUpdateEmail(adminEmail, adminFullName, oldRole, role);

        res.status(200).json({ success: true, message: 'Role updated successfully.' });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
exports.getAdminLogs = async (req, res) => {
    try {
        // Query to fetch admin logs along with full names of admin and performer
        const [logs] = await db.query(`
            SELECT 
                al.id, 
                al.admin_id, 
                CONCAT(a.firstname, ' ', COALESCE(a.middlename, ''), ' ', a.lastname) AS admin_fullname,
                al.action, 
                al.performed_by, 
                CONCAT(p.firstname, ' ', COALESCE(p.middlename, ''), ' ', p.lastname) AS performed_by_name,
                al.created_at
            FROM admin_logs al
            JOIN admins a ON al.admin_id = a.id
            JOIN admins p ON al.performed_by = p.id
            ORDER BY al.created_at DESC
        `);

        res.status(200).json({ success: true, logs });
    } catch (error) {
        console.error('Error fetching admin logs:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Backend: Ensure the role is returned correctly
exports.checkAdminRole = async (req, res, next) => {
    const adminId = req.userId; // Extracted from the token

    try {
        // Query the database to get the admin's role
        const [adminResult] = await db.query('SELECT role FROM admins WHERE id = ?', [adminId]);

        if (adminResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        const role = adminResult[0].role;
        // Return the role to the client
        return res.json({ role }); // Send role to client

    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

exports.getAdminDetails = async (req, res) => {
    const adminId = req.userId; 

    try {
        // Fetch admin details including status
        const [result] = await db.query(
            'SELECT email, username, firstname, middlename, lastname, role, status FROM admins WHERE id = ?',
            [adminId]
        );

        if (result.length === 0) {
            return res.status(404).json({ msg: 'Admin not found' });
        }

        return res.json(result[0]);
    } catch (err) {
        console.error('Error fetching admin details:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};
exports.getOrganizationsForUser = async (req, res) => { 
    try {
        const { orgIduseraccount } = req; // Get orgIduser (user_id) from the JWT token
        
        // Fetch user details from the users table to get the first name, middle name, last name, and email
        const [userResult] = await db.query(
            `SELECT firstname, middlename, lastname, email 
            FROM users
            WHERE id = ?`,
            [orgIduseraccount]
        );

        if (userResult.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const user = userResult[0];

        // Fetch the organizations that the user belongs to with accepted access
        const [orgUserResult] = await db.query(
            `SELECT organizations.id, organizations.name, organizations.photo, organizations.email AS org_email, 
                    organizations_users.apply_status, organizations_users.status, organizations_users.position
            FROM organizations
            JOIN organizations_users ON organizations.id = organizations_users.organizations_id
            WHERE organizations_users.user_id = ? 
              AND organizations_users.apply_status = 'Accepted' 
              AND organizations_users.status = 'Activated' 
              AND organizations.status = 'Activated'`,

            [orgIduseraccount]
        );

        if (orgUserResult.length > 0) {
            return res.json({ 
                user: {
                    firstName: user.firstname,
                    middleName: user.middlename,
                    lastName: user.lastname,
                    email: user.email
                },
                organizations: orgUserResult 
            });
        } else {
            return res.status(404).json({ msg: 'No accepted organizations with access found for this user' });
        }
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};



// Function to select an organization
exports.selectOrganization = async (req, res) => {
    try {
        const { orgIduseraccount, organizationId } = req.body;  // Get the orgIduser and organizationId from the request

        // Fetch the corresponding organization user data from the 'organizations_users' table
        const [orgUserResult] = await db.query(
            'SELECT * FROM organizations_users WHERE user_id = ? AND organizations_id = ?',
            [orgIduseraccount, organizationId]
        );

        if (orgUserResult.length === 0) {
            return res.status(404).json({ msg: 'Organization user not found' });
        }

        const orgUser = orgUserResult[0];

        // Create the JWT token with orgiduser (user_id) and organization_id (id)
        const token = jwt.sign(
            { orgiduser: orgUser.id, orgiduseraccount: orgUser.user_id, id: orgUser.organizations_id, role: 'organization_user' },
            'jwtSecret',
            { expiresIn: '24h' }
        );

        // Return the token and redirect URL
        return res.json({ token, redirectTo: 'organization-dashboard.html' });

    } catch (error) {
        console.error('Error selecting organization:', error);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.logincollab = async (req, res) => {
    const { email, password } = req.body;

    try {
        // First, check if the user exists in the 'users' table
        const [userResult] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (userResult.length > 0) {
            const user = userResult[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(400).json({ msg: 'Incorrect password' });
            }

            
            if (user.role === 'Teacher') {
                const token = jwt.sign({ adviserid: user.id }, 'jwtSecret', { expiresIn: '24h' });
                return res.json({ token, redirectTo: 'chooseportal.html' });
            }

            // Check if the user has an accepted organization
            const [orgUserResult] = await db.query(
                'SELECT * FROM organizations_users WHERE user_id = ? AND status = "Activated"',
                [user.id]
            );
            if (orgUserResult.length > 0) {
                // If the user has an accepted organization, issue a token
                const orgUser = orgUserResult[0];
                const token = jwt.sign({ orgiduseraccount: orgUser.user_id }, 'jwtSecret', { expiresIn: '24h' });
                return res.json({ token, redirectTo: 'chooseorganizations.html' });
            }

            return res.status(400).json({ msg: 'User is not accepted by any organization' });
        }

        // Check for admin login if the user is not found in the users table
        const [adminResult] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
        if (adminResult.length > 0) {
            const admin = adminResult[0];

            // Check if admin status is "Activated"
            if (admin.status !== 'Activated') {
                return res.status(400).json({ msg: 'Admin account is not activated' });
            }

            const isMatch = await bcrypt.compare(password, admin.password);

            if (!isMatch) {
                return res.status(400).json({ msg: 'Incorrect password' });
            }

            const token = jwt.sign({ id: admin.id, organizations_id: admin.organizations_id, role: 'admin' }, 'jwtSecret', { expiresIn: '24h' });
            return res.json({ token, redirectTo: 'admindashboard.html' });
        }


        return res.status(400).json({ msg: 'Email and password are incorrect' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// Get adviser details and check if they are also an admin
exports.getAdviserDetails = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extract adviser ID from token

        if (!adviserId) {
            return res.status(400).json({ msg: 'Adviser ID is required' });
        }

        // Fetch adviser's details
        const [adviserResult] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [adviserId]
        );

        if (adviserResult.length === 0) {
            return res.status(404).json({ msg: 'Adviser not found' });
        }

        const adviser = adviserResult[0];

        // Check if the adviser is also an admin with status "Activated"
        const [adminResult] = await db.query(
            'SELECT user_id FROM admins WHERE user_id = ? AND status = "Activated"',
            [adviserId]
        );

        const isAdmin = adminResult.length > 0; // Only true if admin is "Activated"

        res.json({
            ...adviser,
            isAdmin // Include isAdmin flag in the response
        });
    } catch (error) {
        console.error('Error fetching adviser details:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};



// Generate a token when an adviser selects the Admin button
exports.selectAdmin = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extract adviser ID from token

        if (!adviserId) {
            return res.status(400).json({ msg: 'Adviser ID is required' });
        }

        // Check if the adviser is also an admin and if status is "Activated"
        const [adminResult] = await db.query(
            'SELECT * FROM admins WHERE user_id = ? AND status = "Activated"',
            [adviserId]
        );

        if (adminResult.length === 0) {
            return res.status(403).json({ msg: 'Access denied: Not an admin or account not activated' });
        }

        const admin = adminResult[0];

        // Generate a new admin token
        const token = jwt.sign(
            { adviserid: adviserId, id: admin.id, organizations_id: admin.organizations_id, role: 'admin' },
            'jwtSecret',
            { expiresIn: '24h' }
        );

        res.json({ token, redirectTo: 'admindashboard.html' });
    } catch (error) {
        console.error('Error selecting admin:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.verifyCurrentPassword = async (req, res) => {
    try {
        const { adviserId, currentPassword } = req.body;

        if (!adviserId || !currentPassword) {
            return res.status(400).json({ msg: 'Adviser ID and password are required' });
        }

        // Fetch the adviser's hashed password
        const [userResult] = await db.query('SELECT email, password FROM users WHERE id = ?', [adviserId]);

        if (userResult.length === 0) {
            return res.status(404).json({ msg: 'Adviser not found' });
        }

        const adviser = userResult[0];

        // Compare passwords
        const isMatch = await bcrypt.compare(currentPassword, adviser.password);

        if (!isMatch) {
            return res.status(401).json({ msg: 'Incorrect password' });
        }

        // Success
        res.status(200).json({ success: true, adviserEmail: adviser.email });
    } catch (error) {
        console.error('Error verifying current password:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};
exports.updatePassword = async (req, res) => {
    try {
        const { adviserId, newPassword } = req.body;

        if (!adviserId || !newPassword) {
            return res.status(400).json({ msg: 'Adviser ID and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ msg: 'Password must be at least 8 characters long' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, adviserId]);

        res.status(200).json({ success: true, msg: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getAdviserPayments = async (req, res) => {
    const adviserId = req.AdviserID; // Extracted from the token

    try {
        // Check adviser's status from the admins table
        const [adviserStatus] = await db.query(`
            SELECT status FROM admins WHERE user_id = ?
        `, [adviserId]);

        // ✅ If adviser is found in `admins` and is "Not Activated", deny access
        if (adviserStatus.length > 0 && adviserStatus[0].status === 'Activated') {
            return res.status(403).json({ success: false, message: 'Access denied. You cannot manage organizations if you are an Admin.' });
        }


        const [adviserLogs] = await db.query(`
            SELECT DISTINCT 
                logs.organizations_id, 
                s.id AS semester_id, 
                s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Mapping adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'No organization logs found for the adviser.' });
        }

        // Build a list of organization IDs and years for filtering
        const organizationsYears = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            year: log.year
        }));

        // Build query to fetch payments for the adviser's organizations and years
        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.year,
                p.created_at,
                p.adviser_status,
                p.adviser_by,
                p.created_by,
                p.priceandfees_status,
                p.qrcode_picture,
                s.name AS semester_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                org.name AS organization_name, -- Fetch organization name
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' ₱', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' ₱', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' ₱', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' ₱', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' ₱', p.pricefees5), NULL)
                ) AS fees_and_prices,
                CASE 
                    WHEN pr.payment_id IS NOT NULL THEN 1
                    ELSE 0
                END AS is_reported
            FROM 
                payments p
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN organizations org ON p.organization_id = org.id -- Join to get organization name
            LEFT JOIN payment_reports pr ON p.id = pr.payment_id -- Check if the payment has been reported
            WHERE (${organizationsYears.map(() => '(p.organization_id = ? AND s.year = ?)').join(' OR ')})
            ORDER BY p.created_at DESC
        `;
        // Flatten parameters for the query
        const queryParams = organizationsYears.flatMap(({ organizations_id, year }) => [organizations_id, year]);

        const [payments] = await db.query(query, queryParams);

        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for this organization and year(s).' });
        }

        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.error('Error fetching adviser payments:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getAdviserPaymentsWithTotal = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ success: false, message: 'Adviser ID is required.' });
        }

        // Fetch adviser's organizations and semesters
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'No organization logs found for the adviser.' });
        }

        // Prepare organization IDs and semester IDs for query
        const organizationsSemesters = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            semester_id: log.semester_id
        }));

        // ✅ Query to fetch payments, total transactions, organization name, and semester year
        const query = `
            SELECT 
                p.id AS payment_id,
                p.name AS payment_name,
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year,  -- ✅ Get the actual year from semesters
                IFNULL(SUM(t.total_amount), 0) AS total_amount
            FROM payments p
            JOIN organizations org ON p.organization_id = org.id
            JOIN semesters s ON p.semester_id = s.id  -- ✅ Join semesters to get the correct year
            LEFT JOIN transactions t ON p.id = t.payment_id
            WHERE p.status = 'Accepted' AND (${organizationsSemesters.map(() => '(p.organization_id = ? AND p.semester_id = ?)').join(' OR ')})
            GROUP BY p.id, p.name, org.name, s.year
            ORDER BY p.created_at DESC;
        `;

        // Prepare parameters for query
        const queryParams = organizationsSemesters.flatMap(({ organizations_id, semester_id }) => [organizations_id, semester_id]);

        // Execute query
        const [payments] = await db.query(query, queryParams);

        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for this organization and semester(s).' });
        }

        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.error('Error fetching payments with total transactions:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
exports.getAllTransactionsAdviser = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Extracted from token
        if (!adviserId) {
            return res.status(400).json({ success: false, message: 'Adviser ID is required.' });
        }

        // ✅ Fetch adviser's assigned organizations and semesters (All years)
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT logs.organizations_id, s.id AS semester_id, s.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            JOIN semesters s ON logs.year = s.year  -- ✅ Map adviser's assigned years to semester IDs
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'No organization logs found for the adviser.' });
        }

        // ✅ Prepare organization IDs and semester IDs for query
        const organizationsSemesters = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            semester_id: log.semester_id
        }));

        // ✅ Fetch all transactions for the adviser's assigned organizations & years
        const query = `
            SELECT 
                t.id,
                t.transaction_id,
                t.user_id,
                t.payment_id,
                t.transaction_id AS unique_transaction_id,
                t.payment_status,
                t.payment_method,
                t.total_amount,
                t.balance,
                t.promissory_note,
                t.proof_of_payment,
                t.created_at,
                t.received_by,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS user_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS received_by_name,
                p.name AS payment_name,
                p.price AS payment_price,
                org.name AS organization_name,
                s.name AS semester_name,
                s.year AS semester_year
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN organizations_users ou ON t.received_by = ou.id
            LEFT JOIN payments p ON t.payment_id = p.id
            LEFT JOIN organizations org ON p.organization_id = org.id
            LEFT JOIN semesters s ON p.semester_id = s.id
            WHERE p.status = 'Accepted' 
              AND (${organizationsSemesters.map(() => '(p.organization_id = ? AND p.semester_id = ?)').join(' OR ')})
            ORDER BY t.created_at DESC;
        `;

        // ✅ Prepare parameters for query
        const queryParams = organizationsSemesters.flatMap(({ organizations_id, semester_id }) => [organizations_id, semester_id]);

        // ✅ Execute query
        const [transactions] = await db.query(query, queryParams);

        if (transactions.length === 0) {
            return res.status(404).json({ success: false, message: 'No transactions found for this adviser.' });
        }

        res.status(200).json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching transactions for adviser:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
const { sendAdviserPaymentStatusEmail } = require('../config/SendEmailPaymentAdviser');

exports.updateAdviserPaymentStatus = async (req, res) => {
    const adviserId = req.AdviserID; // Extracted from the token
    const { paymentId } = req.params; // Payment ID from URL params
    const { adviser_status } = req.body; // Status from the request body

    if (!adviser_status || !['Accepted', 'Declined'].includes(adviser_status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    try {
        // Check if the payment exists
        const [paymentResult] = await db.query(`
            SELECT p.*, 
                s.name AS semester_name, 
                o.name AS organization_name, o.email AS organization_email, 
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' ₱', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' ₱', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' ₱', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' ₱', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' ₱', p.pricefees5), NULL)
                ) AS fees_and_prices
            FROM payments p
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = ?
        `, [paymentId]);

        if (paymentResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const payment = paymentResult[0];

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM users 
            WHERE id = ?
        `, [adviserId]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser not found.' });
        }

        const adviserFullName = `${adviserResult[0].firstname} ${adviserResult[0].middlename || ''} ${adviserResult[0].lastname}`;

        // Update the payment with adviser status and adviser ID
        await db.query(`
            UPDATE payments
            SET adviser_status = ?, adviser_by = ?
            WHERE id = ?
        `, [adviser_status, adviserId, paymentId]);

        // Log the action in the payment_logs table
        const action = `Payment was ${adviser_status.toLowerCase()} by Adviser.`;
        await db.query(`
            INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by)
            VALUES (?, ?, ?, ?, ?)
        `, [paymentId, adviser_status, action, 'None', adviserId]);

        // Send email notification
        await sendAdviserPaymentStatusEmail(
            payment.organization_email,
            payment.organization_name,
            payment.semester_name,
            adviser_status,
            payment.name,
            payment.payment_type,
            payment.price,
            payment.fees_and_prices,
            adviserFullName
        );

        res.status(200).json({ success: true, message: `Payment ${adviser_status.toLowerCase()} successfully and email sent.` });
    } catch (error) {
        console.error('Error updating payment adviser status:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment status' });
    }
};

const { sendAdviserPaymentReportEmail } = require('../config/SendEmailPaymentAdviser');

exports.adviserPaymentReports = async (req, res) => {
    const adviserId = req.AdviserID; // Adviser ID from token
    const { paymentId, reason, description } = req.body;

    if (!paymentId || !reason) {
        return res.status(400).json({ success: false, message: 'Payment ID and reason are required.' });
    }

    try {
        // Check if the payment report already exists
        const [existingReport] = await db.query(
            'SELECT * FROM payment_reports WHERE payment_id = ?',
            [paymentId]
        );

        if (existingReport.length > 0) {
            return res.status(400).json({ success: false, message: 'A report for this payment already exists.' });
        }

        // Fetch payment and organization details
        const [paymentResult] = await db.query(`
            SELECT p.name AS payment_name, p.organization_id, 
                   o.name AS organization_name, o.email AS organization_email
            FROM payments p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = ?
        `, [paymentId]);

        if (paymentResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const { payment_name, organization_id, organization_name, organization_email } = paymentResult[0];

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM users 
            WHERE id = ?
        `, [adviserId]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser not found.' });
        }

        const adviserFullName = `${adviserResult[0].firstname} ${adviserResult[0].middlename || ''} ${adviserResult[0].lastname}`;

        // Convert 'None' to NULL for admin_report_by
        const adminReportByValue = null; // Since it's not an admin report, set NULL

        // Insert into payment_reports with the description
        await db.query(
            `INSERT INTO payment_reports (payment_id, admin_report_by, adviser_report_by, reason, description) 
             VALUES (?, ?, ?, ?, ?)`,
            [paymentId, adminReportByValue, adviserId, reason, description || null]
        );

        // Log the report in payment_logs
        const action = `Reported by Adviser with reason: ${reason}${description ? `, Description: ${description}` : ''}`;
        await db.query(
            `INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by) 
             VALUES (?, 'Reported', ?, 'None', ?)`,
            [paymentId, action, adviserId]
        );

        // Send email notification
        await sendAdviserPaymentReportEmail(
            organization_email,
            organization_name,
            payment_name,
            reason,
            description,
            adviserFullName
        );

        res.status(200).json({ success: true, message: 'Payment reported successfully and email sent.' });
    } catch (error) {
        console.error('Error reporting payment:', error);
        res.status(500).json({ success: false, message: 'Failed to report payment.' });
    }
};



exports.updateAdviserFeesPriceFees = async (req, res) => {
    const adviserId = req.AdviserID; // Extracted from the token
    const { paymentId, fees } = req.body;

    if (!paymentId || !fees || !Array.isArray(fees)) {
        return res.status(400).json({ success: false, message: 'Invalid payment ID or fees data.' });
    }

    try {
        // Calculate the total price from fees
        const totalPrice = fees.reduce((total, fee) => total + parseFloat(fee.price || 0), 0);

        // Initialize fieldsToUpdate as a modifiable variable
        let fieldsToUpdate = fees
            .map((fee, index) => `fees${index + 1} = ?, pricefees${index + 1} = ?`)
            .join(', ');
        const values = fees.flatMap(fee => [fee.name, fee.price]);

        // Ensure to reset fields not included in the current update
        for (let i = fees.length + 1; i <= 5; i++) {
            fieldsToUpdate += `, fees${i} = NULL, pricefees${i} = NULL`;
        }

        // Add the total price to the fieldsToUpdate and query values
        fieldsToUpdate += `, price = ?`;
        values.push(totalPrice);

        // Add paymentId and adviserId to the query parameters
        values.push(paymentId);

        const query = `
            UPDATE payments
            SET ${fieldsToUpdate}
            WHERE id = ?;
        `;

        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'Failed to update fees or payment not found.' });
        }

        // Log the update in payment_logs
        const action = `Adviser Updated fees and prices`;
        await db.query(
            `
            INSERT INTO payment_logs (payment_id, status, action, accepted_by, adviser_by)
            VALUES (?, 'Updated', ?, 'None', ?)
            `,
            [paymentId, action, adviserId]
        );

        res.status(200).json({ success: true, message: 'Fees and total price updated successfully.' });
    } catch (error) {
        console.error('Error updating fees and prices:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};



exports.getAdviserPaymentsAll = async (req, res) => {
    try {
        const adviserId = req.AdviserID; // Adviser ID from token

        const query = `
            SELECT 
                p.id,
                p.name,
                p.price,
                p.description,
                p.payment_type,
                p.status,
                p.year,
                p.adviser_status,
                p.adviser_by,
                p.created_by,
                p.qrcode_picture,
                s.name AS semester_name,
                CONCAT(a.firstname, ' ', a.middlename, ' ', a.lastname) AS accepted_by_name,
                CONCAT(u.firstname, ' ', u.middlename, ' ', u.lastname) AS adviser_name,
                CONCAT(ou.firstname, ' ', ou.lastname) AS created_by_name,
                ou.position AS created_by_position,
                org.name AS organization_name,
                CONCAT_WS(', ',
                    IF(p.fees1 IS NOT NULL AND p.pricefees1 IS NOT NULL, CONCAT(p.fees1, ' ₱', p.pricefees1), NULL),
                    IF(p.fees2 IS NOT NULL AND p.pricefees2 IS NOT NULL, CONCAT(p.fees2, ' ₱', p.pricefees2), NULL),
                    IF(p.fees3 IS NOT NULL AND p.pricefees3 IS NOT NULL, CONCAT(p.fees3, ' ₱', p.pricefees3), NULL),
                    IF(p.fees4 IS NOT NULL AND p.pricefees4 IS NOT NULL, CONCAT(p.fees4, ' ₱', p.pricefees4), NULL),
                    IF(p.fees5 IS NOT NULL AND p.pricefees5 IS NOT NULL, CONCAT(p.fees5, ' ₱', p.pricefees5), NULL)
                ) AS fees_and_prices
            FROM 
                payments p
            LEFT JOIN semesters s ON p.semester_id = s.id
            LEFT JOIN admins a ON p.accepted_by = a.id
            LEFT JOIN users u ON p.adviser_by = u.id
            LEFT JOIN organizations_users ou ON p.created_by = ou.id
            LEFT JOIN organizations org ON p.organization_id = org.id
            WHERE p.adviser_by = ?
            ORDER BY p.created_at DESC;
        `;

        const [payments] = await db.query(query, [adviserId]);

        res.status(200).json({ payments });
    } catch (error) {
        console.error('Error fetching adviser payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};








exports.getPaymentFees = async (req, res) => {
    const paymentId = req.params.paymentId;

    try {
        const [result] = await db.query(
            `
            SELECT 
                id,
                fees1, pricefees1,
                fees2, pricefees2,
                fees3, pricefees3,
                fees4, pricefees4,
                fees5, pricefees5
            FROM payments
            WHERE id = ?
            `,
            [paymentId]
        );

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found.' });
        }

        // Include all fees and their indices, even if some are NULL
        const fees = [];
        for (let i = 1; i <= 5; i++) {
            fees.push({
                index: i,
                name: result[0][`fees${i}`] || '',
                price: result[0][`pricefees${i}`] || '',
            });
        }

        res.status(200).json({ success: true, fees });
    } catch (error) {
        console.error('Error fetching payment fees:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};



exports.getAdviserOrders = async (req, res) => { 
    const adviserId = req.AdviserID; // Extracted from the token

    try {

        const [adviserStatus] = await db.query(`
            SELECT status FROM admins WHERE user_id = ?
        `, [adviserId]);

        // ✅ If adviser is found in `admins` and is "Not Activated", deny access
        if (adviserStatus.length > 0 && adviserStatus[0].status === 'Activated') {
            return res.status(403).json({ success: false, message: 'Access denied. You are now an Admin you cannot manage organizations' });
        }
        // Fetch all unique years and organization IDs from the adviser's logs
        const [adviserLogs] = await db.query(`
            SELECT DISTINCT 
                logs.organizations_id, 
                logs.year
            FROM organizations_adviser_logs logs
            JOIN organizations_adviser oa ON logs.organizations_adviser_id = oa.id
            WHERE oa.user_id = ?
        `, [adviserId]);

        if (adviserLogs.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser logs not found.' });
        }

        // Build a list of organization IDs and years for filtering
        const organizationsYears = adviserLogs.map(log => ({
            organizations_id: log.organizations_id,
            year: log.year
        }));

        // Use a query to fetch orders for all the adviser's organizations and years
        const query = `
            SELECT 
                o.id,
                o.qrcodepicture,
                o.organization_id,
                org.name AS organization_name,  -- Fetch organization name
                o.created_by,
                CONCAT(ou.firstname, ' ', COALESCE(ou.middlename, ''), ' ', ou.lastname) AS created_by_name,  -- Fetch full name of the creator
                o.created_at,
                o.adviser_status,
                o.adviser_by,
                o.status,
                o.semester_id,
                o.accepted_by,
                s.year,
                CASE WHEN EXISTS (
                    SELECT 1 FROM gcashorder_reports gr WHERE gr.order_id = o.id
                ) THEN 1 ELSE 0 END AS is_reported
            FROM gcashorder o
            JOIN semesters s ON o.semester_id = s.id
            JOIN organizations org ON o.organization_id = org.id  -- Join organizations table
            JOIN organizations_users ou ON o.created_by = ou.id  -- Join organizations_users table to get creator's name
            WHERE (${organizationsYears.map(() => '(o.organization_id = ? AND s.year = ?)').join(' OR ')})
            ORDER BY s.year DESC, o.created_at DESC
        `;

        // Flatten the parameters for the query
        const queryParams = organizationsYears.flatMap(({ organizations_id, year }) => [organizations_id, year]);

        const [orders] = await db.query(query, queryParams);

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found for this organization and year(s).' });
        }

        res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const { sendAdviserOrderStatusEmail } = require('../config/SendEmailOrderAdviser');

exports.updateAdviserStatusOrder = async (req, res) => {
    const { adviser_status } = req.body; // Accepted or Declined
    const orderId = req.params.orderId; // Order ID from the request parameters
    const adviserId = req.AdviserID; // Adviser ID from the token

    if (!adviser_status || !['Accepted', 'Declined'].includes(adviser_status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    try {
        // Fetch the order to verify its existence and get related details
        const [orderResult] = await db.query(`
            SELECT o.id AS order_id, o.status AS order_status, 
                   o.organization_id, o.semester_id,
                   org.name AS organization_name, org.email AS organization_email,
                   s.name AS semester_name
            FROM gcashorder o
            LEFT JOIN organizations org ON o.organization_id = org.id
            LEFT JOIN semesters s ON o.semester_id = s.id
            WHERE o.id = ?
        `, [orderId]);

        if (orderResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const { order_id, order_status, organization_name, organization_email, semester_name } = orderResult[0];

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM users 
            WHERE id = ?
        `, [adviserId]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser not found.' });
        }

        const adviserFullName = `${adviserResult[0].firstname} ${adviserResult[0].middlename || ''} ${adviserResult[0].lastname}`;

        // Update the adviser status and adviser_by in the order
        await db.query(`
            UPDATE gcashorder
            SET adviser_status = ?, adviser_by = ?
            WHERE id = ?
        `, [adviser_status, adviserId, orderId]);

        // Insert into gcashorder_logs
        await db.query(`
            INSERT INTO gcashorder_logs (order_id, action, status, created_by, created_by_admin, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [orderId, `Adviser ${adviser_status}`, adviser_status, adviserId, 'None']);

        // Send email notification
        await sendAdviserOrderStatusEmail(
            organization_email,
            organization_name,
            order_id,
            order_status,
            semester_name,
            adviser_status,
            adviserFullName
        );

        res.status(200).json({ success: true, message: `Gcash details has been ${adviser_status.toLowerCase()} and email sent.` });
    } catch (error) {
        console.error('Error updating adviser status:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const { sendAdviserOrderReportEmail } = require('../config/SendEmailOrderAdviser');

exports.submitGcashOrderReport = async (req, res) => {
    const adviserId = req.AdviserID; // Extracted from the token
    const { orderId, reason, description } = req.body;

    if (!orderId || !reason) {
        return res.status(400).json({ success: false, message: 'Order ID and reason are required.' });
    }

    try {
        // Fetch order details and related organization and semester info
        const [orderResult] = await db.query(`
            SELECT o.id AS order_id, 
                   o.organization_id, o.semester_id,
                   org.name AS organization_name, org.email AS organization_email,
                   s.name AS semester_name
            FROM gcashorder o
            LEFT JOIN organizations org ON o.organization_id = org.id
            LEFT JOIN semesters s ON o.semester_id = s.id
            WHERE o.id = ?
        `, [orderId]);

        if (orderResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const { order_id, organization_name, organization_email, semester_name } = orderResult[0];

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM users 
            WHERE id = ?
        `, [adviserId]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser not found.' });
        }

        const adviserFullName = `${adviserResult[0].firstname} ${adviserResult[0].middlename || ''} ${adviserResult[0].lastname}`;

        // Insert the report into gcashorder_reports
        await db.query(`
            INSERT INTO gcashorder_reports (order_id, reported_by, reason, description)
            VALUES (?, ?, ?, ?)
        `, [orderId, adviserId, reason, description || null]);

        // Log the action in gcashorder_logs
        await db.query(`
            INSERT INTO gcashorder_logs (order_id, action, status, created_by)
            VALUES (?, 'Reported by Adviser', 'Reported', ?)
        `, [orderId, adviserId]);

        // Send email notification
        await sendAdviserOrderReportEmail(
            organization_email,
            organization_name,
            order_id,
            semester_name,
            reason,
            description,
            adviserFullName
        );

        res.status(200).json({ success: true, message: 'Report submitted successfully and email sent.' });
    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};











exports.getOrganizationUserDetails = async (req, res) => {
    const orgUserId = req.orgIduser; 

    try {
        const [result] = await db.query(`
            SELECT * FROM organizations_users WHERE id = ?
        `, [orgUserId]);

        if (result.length === 0) {
            return res.status(404).json({ msg: 'Organization User not found' });
        }

        return res.json(result[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};


exports.getOrganizationDetails = async (req, res) => {
    const orgId = req.userId;

    try {
        
        const [result] = await db.query('SELECT * FROM organizations WHERE id = ?', [orgId]);

        if (result.length === 0) {
            return res.status(404).json({ msg: 'Organization not found' });
        }

        return res.json(result[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM users');
        return res.json(results);
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ msg: 'Error fetching users' });
    }
};
exports.getUsersStudent = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM users WHERE role = ?', ['Student']);
        return res.json(results);
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ msg: 'Error fetching users' });
    }
};
exports.getUserById = async (req, res) => {
    const userId = req.params.userId;
    try {
        const query = `
            SELECT 
                id, firstname, middlename, lastname, idnumber, course, section, gender, status, role 
            FROM 
                users
            WHERE 
                id = ?
        `;
        const [user] = await db.query(query, [userId]);
        if (user.length > 0) {
            res.status(200).json(user[0]);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getTransactionsByUserId = async (req, res) => {
    const userId = req.params.userId;
    try {
        const query = `
            SELECT 
                p.id AS payment_id,
                p.name AS payment_name, 
                p.payment_type,
                p.semester_id,
                s.name AS semester_name, -- Get semester name
                t.transaction_id,
                t.payment_status,
                t.payment_method,
                t.total_amount,
                t.balance,
                COALESCE(CONCAT(ou.firstname, ' ', ou.middlename, ' ', ou.lastname), 'None') AS received_by_name,
                t.created_at,
                t.updated_at
            FROM 
                payments p
            LEFT JOIN 
                transactions t ON t.payment_id = p.id AND t.user_id = ?
            LEFT JOIN 
                organizations_users ou ON t.received_by = ou.id
            LEFT JOIN 
                semesters_users su ON su.semester_id = p.semester_id AND su.user_id = ?
            LEFT JOIN 
                semesters s ON s.id = p.semester_id -- Join with semesters table
            WHERE 
                p.status = 'Accepted'
                AND (t.payment_status IS NULL OR t.payment_status != 'Decline')
                AND su.status = 'Active';  -- Only show payments if user is active in the semester
        `;
        
        const [transactions] = await db.query(query, [userId, userId]);
        res.status(200).json({ transactions });
    } catch (error) {
        console.error('Error fetching payments and transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getUserTransactions = async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const transactions = await Transaction.find({ user_id: userId, transaction_id: { $ne: null } });

        res.status(200).json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('Error fetching user transactions:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// In authController.js
exports.getOrderTransactionsByUserId = async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    try {
        const query = `
            SELECT 
                o.*            FROM 
                product_transaction o
            INNER JOIN 
                users u ON o.user_id = u.id
            WHERE 
                u.id = ?
        `;

        // Pass the userId as the parameter to the query
        const [orderTransactions] = await db.query(query, [userId]);

        if (orderTransactions.length === 0) {
            return res.status(404).json({ message: 'No transactions found for this user.' });
        }

        res.status(200).json({ orderTransactions });
    } catch (error) {
        console.error('Error fetching order transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};







exports.getUsersTeacher = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM users WHERE role = ?', ['Teacher']);
        return res.json(results);
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ msg: 'Error fetching users' });
    }
};


exports.getUserData = async (req, res) => {
    const userId = req.userId;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        if (results.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        return res.json(results[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.applyForOrganization = async (req, res) => {
    const { user_id, organization_id, position } = req.body;

    // Check if all required fields are provided
    if (!user_id || !organization_id || !position) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // First, get the user's details (firstname, lastname, middlename)
        const [userDetails] = await db.query('SELECT firstname, lastname, middlename FROM users WHERE id = ?', [user_id]);

        if (userDetails.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { firstname, lastname, middlename } = userDetails[0];

        // Now, insert the user's application into the organizations_users table with firstname, lastname, and middlename
        const query = `
            INSERT INTO organizations_users (user_id, organizations_id, position, apply_status, firstname, lastname, middlename)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [user_id, organization_id, position, 'Pending', firstname, lastname, middlename]);

        // Return success response
        res.status(200).json({ success: true, message: 'Application submitted successfully', data: result });
    } catch (error) {
        console.error('Error applying for organization:', error);
        res.status(500).json({ success: false, message: 'Failed to apply for the organization' });
    }
};

exports.getOrganizationUsers = async (req, res) => {
    try {
        const query = `
            SELECT 
                ou.id, 
                ou.user_id, 
                o.name AS organization_name, 
                u.firstname, 
                u.lastname, 
                u.middlename, 
                ou.position, 
                ou.apply_status 
            FROM organizations_users ou
            LEFT JOIN organizations o ON ou.organizations_id = o.id
            LEFT JOIN users u ON ou.user_id = u.id
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching organization users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch organization users' });
    }
};

const { sendUserStatusUpdateEmail } = require('../config/sendEmailAdmin');

exports.updateUserStatusorg = async (req, res) => {
    const userId = req.params.userId; // ID from the `organizations_users` table
    const { apply_status } = req.body;
    const createdBy = req.userId; // ID of the admin making the change

    try {
        // Fetch `organizations_users` details
        const [userDetails] = await db.query(`
            SELECT id AS organizations_users_id, user_id, organizations_id, position, status
            FROM organizations_users
            WHERE id = ?
        `, [userId]);

        if (userDetails.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found in organizations_users' });
        }

        const { organizations_users_id, user_id, organizations_id, position, status: currentStatus } = userDetails[0];

        // Fetch user details from the `users` table
        const [userResult] = await db.query(`
            SELECT firstname, middlename, lastname, email 
            FROM users 
            WHERE id = ?
        `, [user_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const { firstname, middlename, lastname, email } = userResult[0];

        // Fetch organization details
        const [organizationResult] = await db.query(`
            SELECT name FROM organizations WHERE id = ?
        `, [organizations_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ msg: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Fetch admin details
        const [adminResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM admins 
            WHERE id = ?
        `, [createdBy]);

        if (adminResult.length === 0) {
            return res.status(404).json({ msg: 'Admin not found.' });
        }

        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        // If activating the status, check for position conflicts
        if (apply_status === "Activated") {
            // Fetch the latest semester year
            const [latestSemester] = await db.query(`
                SELECT year
                FROM semesters
                ORDER BY id DESC
                LIMIT 1
            `);

            if (!latestSemester || latestSemester.length === 0) {
                return res.status(400).json({ success: false, message: 'No active semester found.' });
            }

            const { year } = latestSemester[0];

            // Check if the position already exists for the year (except "member")
            if (position.toLowerCase() !== "member" && position.toLowerCase() !== "not member") {
                const [existingPosition] = await db.query(`
                    SELECT * 
                    FROM organizations_users_logs 
                    WHERE position = ? AND year = ? AND organizations_id = ?
                `, [position, year, organizations_id]);

                // If the position is taken and the user is not the owner, block the activation
                if (existingPosition.length > 0 && existingPosition[0].user_id !== user_id) {
                    return res.status(400).json({
                        success: false,
                        message: `The position "${position}" is already assigned for the year ${year}.`,
                    });
                }
            }

            // Check if a log already exists
            const [existingLog] = await db.query(`
                SELECT * 
                FROM organizations_users_logs 
                WHERE organizations_users_id = ? AND year = ?
            `, [organizations_users_id, year]);

            if (existingLog.length === 0) {
                // Adjust position to "Member" if it's currently "Not member"
                const logPosition = position.toLowerCase() === "not member" ? "Member" : position;

                const insertLogQuery = `
                    INSERT INTO organizations_users_logs (organizations_users_id, user_id, organizations_id, position, year, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                `;
                await db.query(insertLogQuery, [organizations_users_id, user_id, organizations_id, logPosition, year, createdBy]);
            }
        }

        const updatedPosition = position.toLowerCase() === "not member" ? "Member" : position;

        const updateQuery = `
            UPDATE organizations_users
            SET status = ?, position = ?, created_at = NOW()
            WHERE id = ?
        `;

        await db.query(updateQuery, [apply_status, updatedPosition, userId]);

        const action = `Status changed to "${apply_status}"`;
        const logHistoryQuery = `
            INSERT INTO organizations_users_history (organizations_users_id, status, action, created_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        await db.query(logHistoryQuery, [userId, apply_status, action, createdBy]);

        // Send email notification
        await sendUserStatusUpdateEmail(email, firstname, middlename, lastname, organizationName, apply_status, adminFullName);

        res.status(200).json({ success: true, message: 'Status and position updated, logged successfully, and notification sent!' });
    } catch (error) {
        console.error('Error updating user status and logging:', error);
        res.status(500).json({ success: false, message: 'Failed to update status and position, and log the action' });
    }
};






const { sendAdviserStatusUpdateEmail } = require('../config/sendEmailAdmin');

exports.updateAdviserStatus = async (req, res) => {
    const adviserId = req.params.adviserId;
    const { apply_status } = req.body;
    const createdBy = req.userId; // Admin ID who performs the update

    try {
        // Fetch current status and organization ID before updating
        const [currentStatusResult] = await db.query(`
            SELECT status, organizations_id, user_id
            FROM organizations_adviser 
            WHERE id = ?
        `, [adviserId]);

        if (currentStatusResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser not found' });
        }

        const { status: currentStatus, organizations_id, user_id } = currentStatusResult[0];

        const [existingAdmin] = await db.query(`
            SELECT * FROM admins WHERE user_id = ? AND status = "Activated"
        `, [user_id]);

        if (existingAdmin.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This adviser is already an activated admin and cannot be activated as an adviser.',
            });
        }

        // Fetch adviser details
        const [adviserResult] = await db.query(`
            SELECT firstname, middlename, lastname, email 
            FROM users 
            WHERE id = ?
        `, [user_id]);

        if (adviserResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Adviser user not found.' });
        }

        const { firstname, middlename, lastname, email } = adviserResult[0];

        // Fetch organization details
        const [organizationResult] = await db.query(`
            SELECT name FROM organizations WHERE id = ?
        `, [organizations_id]);

        if (organizationResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found.' });
        }

        const organizationName = organizationResult[0].name;

        // Fetch admin details
        const [adminResult] = await db.query(`
            SELECT firstname, middlename, lastname 
            FROM admins 
            WHERE id = ?
        `, [createdBy]);

        if (adminResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        const adminFullName = `${adminResult[0].firstname} ${adminResult[0].middlename || ''} ${adminResult[0].lastname}`;

        if (apply_status === "Activated") {
            // Check if there is already an activated adviser for this organization
            const [activatedAdviser] = await db.query(`
                SELECT id 
                FROM organizations_adviser 
                WHERE organizations_id = ? AND status = "Activated"
            `, [organizations_id]);

            if (activatedAdviser.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'There is already an activated adviser for this organization. Status cannot be updated.'
                });
            }

            // Fetch the latest semester
            const [latestSemester] = await db.query(`
                SELECT year
                FROM semesters
                ORDER BY id DESC
                LIMIT 1
            `);

            if (latestSemester.length === 0) {
                return res.status(400).json({ success: false, message: 'No active semester found' });
            }

            const { year } = latestSemester[0];

            // Check if there is already a log for the same organization and year
            const [existingYearLog] = await db.query(`
                SELECT * 
                FROM organizations_adviser_logs 
                WHERE organizations_id = ? AND year = ?
            `, [organizations_id, year]);

            // Check if the current adviser already has a log for this year
            const [adviserLog] = await db.query(`
                SELECT * 
                FROM organizations_adviser_logs 
                WHERE organizations_adviser_id = ? AND year = ?
            `, [adviserId, year]);

            if (existingYearLog.length > 0 && adviserLog.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `An adviser is already assigned for the academic year ${year}. Status cannot be updated.`,
                });
            }

            // Insert a new log if the current adviser does not have one for this year
            if (adviserLog.length === 0) {
                await db.query(`
                    INSERT INTO organizations_adviser_logs (organizations_adviser_id, user_id, organizations_id, position, year, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                `, [adviserId, user_id , organizations_id, 'Adviser', year, createdBy]);
            }
        }

        // Update the adviser's status
        await db.query(`
            UPDATE organizations_adviser
            SET status = ?
            WHERE id = ?
        `, [apply_status, adviserId]);

        // Log the status change in `organizations_adviser_history`
        const action = `Status changed to "${apply_status}"`;
        await db.query(`
            INSERT INTO organizations_adviser_history (organizations_adviser_id, status, action, created_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [adviserId, apply_status, action, createdBy]);

        // Send email notification
        await sendAdviserStatusUpdateEmail(email, firstname, middlename, lastname, organizationName, apply_status, adminFullName);

        res.status(200).json({ success: true, message: 'Status updated, logged successfully, and email sent!' });
    } catch (error) {
        console.error('Error updating adviser status and logging:', error);
        res.status(500).json({ success: false, message: 'Failed to update status and log the action' });
    }
};















// Update apply_status (Accept/Decline)
exports.updateApplyStatus = async (req, res) => {
    const { id, apply_status } = req.body;

    try {
        const query = `
            UPDATE organizations_users
            SET apply_status = ?
            WHERE id = ?
        `;
        await db.query(query, [apply_status, id]);
        res.status(200).json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating apply status:', error);
        res.status(500).json({ success: false, message: 'Failed to update apply status' });
    }
};



if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for certificate uploads
const usersSemestersStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId;
        const dir = `uploads/userssemesters/${userId}`;
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`); // Unique filename
    }
});

// Multer upload middleware
const usersSemestersUpload = multer({ storage: usersSemestersStorage });

// Controller: Upload Certificate
exports.uploadCertificate = [
    async (req, res) => {
        const userId = req.userId; // Assuming user authentication middleware sets `req.userId`
        const uploadcertificate = req.file;
        const { section } = req.body; // Receive section from frontend

        if (!uploadcertificate) {
            return res.status(400).json({ msg: 'No certificate uploaded' });
        }

        if (!section) {
            return res.status(400).json({ msg: 'Section is required' });
        }

        const status = "Pending"; // Status for semesters_users
        const userStatus = "For approval"; // Status for users table

        try {
            // Fetch the latest semester
            const [semesters] = await db.query('SELECT id, name FROM semesters ORDER BY created_at DESC LIMIT 1');

            if (semesters.length === 0) {
                return res.status(404).json({ msg: 'No semester found' });
            }

            const semesterId = semesters[0].id;
            const semesterName = semesters[0].name; // Get semester name

            // Fetch user details
            const [userResult] = await db.query(
                'SELECT firstname, lastname, middlename FROM users WHERE id = ?',
                [userId]
            );

            if (!userResult.length) {
                return res.status(404).json({ msg: 'User not found' });
            }

            const { firstname, lastname, middlename } = userResult[0];
            const userFolder = `${firstname}_${middlename}_${lastname}`;

            // Generate a unique filename for the uploaded certificate
            const uniqueFilename = `${uuidv4()}${path.extname(uploadcertificate.originalname)}`;

            // Read the file content from disk
            const filePathOnDisk = path.resolve(uploadcertificate.path);
            const fileContent = fs.readFileSync(filePathOnDisk);

            // Initialize Dropbox
            const dropbox = await initializeDropbox();
            if (!dropbox) {
                throw new Error('Failed to initialize Dropbox.');
            }

            // Define Dropbox folder
            const folderPath = `/uploads/CORuploads/${userFolder}`;

            // Check if folder exists before creating it
            try {
                await dropbox.filesGetMetadata({ path: folderPath });
            } catch (error) {
                if (error.status === 409) {
                    console.log(`Folder "${folderPath}" already exists. Proceeding...`);
                } else {
                    console.log(`Creating folder: ${folderPath}`);
                    await dropbox.filesCreateFolderV2({ path: folderPath });
                }
            }

            // Upload file to Dropbox
            const dropboxPath = `${folderPath}/${uniqueFilename}`;
            console.log(`Uploading file to Dropbox at: ${dropboxPath}`);

            const dropboxUploadResponse = await dropbox.filesUpload({
                path: dropboxPath,
                contents: fileContent,
                mode: { ".tag": "overwrite" } // Ensures file gets replaced if it exists
            });

            // Generate a shared link
            let dropboxSharedLink;
            try {
                const sharedLinkResponse = await dropbox.sharingCreateSharedLinkWithSettings({
                    path: dropboxUploadResponse.result.path_display,
                });
                dropboxSharedLink = sharedLinkResponse.result?.url.replace('dl=0', 'raw=1');
            } catch (err) {
                console.log('Error creating shared link, trying existing link...');
                const existingLinks = await dropbox.sharingListSharedLinks({ path: dropboxUploadResponse.result.path_display });
                if (existingLinks.result.links.length > 0) {
                    dropboxSharedLink = existingLinks.result.links[0].url.replace('dl=0', 'raw=1');
                } else {
                    throw new Error('Failed to generate shared link');
                }
            }

            // Insert into semesters_users table
            const query = `
                INSERT INTO semesters_users (user_id, semester_id, uploadcertificate, status, section)
                VALUES (?, ?, ?, ?, ?)
            `;
            await db.query(query, [userId, semesterId, dropboxSharedLink, status, section]);

            // Update user status to "For approval"
            const updateUserStatusQuery = `
                UPDATE users
                SET status = ?
                WHERE id = ?
            `;
            await db.query(updateUserStatusQuery, [userStatus, userId]);

            // Insert into user_logs table
            const action = `Uploaded certificate of registration for ${semesterName}`;
            const logQuery = `
                INSERT INTO user_logs (user_id, action)
                VALUES (?, ?)
            `;
            await db.query(logQuery, [userId, action]);

            // Remove file from local storage after upload
            fs.unlinkSync(filePathOnDisk);

            res.status(200).json({ msg: 'Certificate uploaded successfully', certificateLink: dropboxSharedLink });
        } catch (error) {
            console.error('Error uploading certificate:', error);
            res.status(500).json({ msg: 'Failed to upload certificate' });
        }
    }
];



exports.getSemestersUsers = async (req, res) => {
    try {
        // Query to get all semesters_users data along with user's first name, middle name, last name, and semester name, ordered by created_at DESC
        const [results] = await db.query(`
            SELECT 
                su.id, 
                su.user_id, 
                su.uploadcertificate, 
                su.semester_id, 
                su.status, 
                su.section, 
                su.created_at,
                u.firstname, 
                u.middlename, 
                u.lastname, 
                s.name AS semester_name
            FROM semesters_users su
            JOIN users u ON su.user_id = u.id
            JOIN semesters s ON su.semester_id = s.id
            ORDER BY su.created_at DESC
        `);
        
        // If no data is found
        if (results.length === 0) {
            return res.status(404).json({ msg: 'No semesters users found' });
        }

        // Send data back as JSON
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching semesters users:', error);
        res.status(500).json({ msg: 'Internal server error' });
    }
};
const { sendReportEmail } = require('../config/SendEmailUsersReport'); // Import the send email function

exports.reportUser = async (req, res) => {
    const { userId, semesterId, id, reason, comment } = req.body;
    const adminId = req.userId; // Get admin ID from the authenticated request

    // Validate the request parameters
    if (!userId || !semesterId || !id || !reason || !adminId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    try {
        // Insert the report into UsersReport table
        const query = `
            INSERT INTO usersreport (semester_user_id, user_id, semester_id, reason, comment, reported_by_admin)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(query, [id, userId, semesterId, reason, comment, adminId]);

        // Fetch user and send a report email
        await sendReportEmail(id, userId, semesterId, reason, comment, adminId);

        // Send success response
        res.status(201).json({ success: true, message: 'Report successfully submitted' });
    } catch (error) {
        console.error('Error submitting user report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};




// Controller function to check if a report exists
exports.checkReportExists = async (req, res) => {
    const { userId } = req.body; // userId is passed as semester_user_id

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    try {
        // Query to check if a report already exists for the given userId (semester_user_id)
        const query = `
            SELECT * FROM usersreport
            WHERE semester_user_id = ?
        `;
        const [results] = await db.query(query, [userId]);

        if (results.length > 0) {
            // If a report exists, return true
            return res.status(200).json({ success: true, exists: true });
        } else {
            // If no report exists, return false
            return res.status(200).json({ success: true, exists: false });
        }
    } catch (error) {
        console.error('Error checking report existence:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};






  
  
  
  
  // Middleware for certificate upload
  exports.uploadMiddleware = usersSemestersUpload.single('certificate_of_registration');

  exports.checkUserStatus = async (req, res) => {
    const userId = req.userId; // Assuming the user ID is available from the authentication middleware
  
    try {
      
      const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  
      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' }); // Ensure error key is 'error'
      }
  
      // Check for various statuses and return appropriate responses
      const userStatus = user[0].status;
      if (userStatus === 'Pending') {
        return res.status(403).json({ error: 'Your account is pending.' });
      }
  
      if (userStatus === 'For approval') {
        return res.status(403).json({
          error: 'Your account is under approval. Please wait for admin confirmation.'
        });
      }
  
      if (userStatus === 'Graduated') {
        return res.status(403).json({ error: 'Your account is marked as graduated. Access is restricted.' });
      }
  
      if (userStatus === 'Not Enrolled') {
        return res.status(403).json({ error: 'Your account is not enrolled. Please contact admin.' });
      }
  
      if (userStatus === 'Declined') {
        return res.status(403).json({ error: 'Your account has been declined. Access is restricted.' });
      }
  
      
      res.status(200).json({ status: 'Active' });
    } catch (error) {
      console.error('Error fetching user status:', error);
      res.status(500).json({ error: 'Internal server error' }); // Return error in the correct format
    }
  };
  
  const { sendStatusUpdateEmail } = require('../config/SendEmailupdateUserStatus');

  exports.updateUserStatus = async (req, res) => {
    const created_by = req.userId; // Get the user who made the update from the request
    const { user_id, status, action, id, section } = req.body;

    // Validate that all necessary fields are provided
    if (!user_id || !status || !action || !section || !id) {
        return res.status(400).json({ msg: 'Missing user_id, status, action, section, or id' });
    }

    try {
        // Step 1: Update user status in the `users` table
        const userQuery = 'UPDATE users SET status = ? WHERE id = ?';
        await db.query(userQuery, [status, user_id]);

        // Step 2: Fetch necessary data from `semesters_users` and `semesters` for email content
        const [semesterUserResult] = await db.query('SELECT * FROM semesters_users WHERE id = ?', [id]);
        const semesterUser = semesterUserResult[0];

        if (!semesterUser) {
            return res.status(404).json({ msg: 'Semester user not found' });
        }

        const [semesterResult] = await db.query('SELECT * FROM semesters WHERE id = ?', [semesterUser.semester_id]);
        const semester = semesterResult[0];

        if (!semester) {
            return res.status(404).json({ msg: 'Semester not found' });
        }

        const [userResult] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
        const user = userResult[0];

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Step 3: Handle action based on 'action' value
        if (action === 'Declined') {
            // If action is 'Declined', update the `semesters_users` table with the new status and section for the provided `id`
            const semesterQuery = 'UPDATE semesters_users SET status = ?, section = ? WHERE id = ?';
            await db.query(semesterQuery, [status, section, id]);
        } else {
            // If action is not 'Declined', update the user status and section in `semesters_users` table
            const semesterQuery = 'UPDATE semesters_users SET status = ?, section = ? WHERE id = ?';
            await db.query(semesterQuery, [status, section, id]);
        }

        // Step 4: Log the action to the `user_logs` table
        const logQuery = 'INSERT INTO user_logs (user_id, action, created_by) VALUES (?, ?, ?)';
        await db.query(logQuery, [user_id, action, created_by]);

        // Step 5: Send an email to the user based on the action (Declined or Active)
        await sendStatusUpdateEmail(user_id, status, semester.id, section);

        // Step 6: Respond with a success message
        res.status(200).json({ success: true, msg: 'User status and section updated successfully' });

    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ msg: 'Failed to update user status and section' });
    }
};
exports.getUsersReports = async (req, res) => {
    try {
        const query = `
            SELECT 
                ur.user_id, 
                ur.semester_user_id,
                u.firstname, 
                u.lastname, 
                u.middlename, 
                ur.semester_id, 
                s.name AS semester_name, 
                ur.reason, 
                ur.created_at
            FROM usersreport ur
            JOIN users u ON ur.user_id = u.id
            JOIN semesters s ON ur.semester_id = s.id
            ORDER BY ur.created_at DESC
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching users reports:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
};



const { sendStatusUpdateEmailWeb } = require('../config/sendStatusUpdateEmailWeb');

exports.updateUserStatusWeb = async (req, res) => {
    const { user_id, section } = req.body;
    const created_by = req.userId; // Assuming `userId` is set by authentication middleware

    // Validate input
    if (!user_id || !section) {
        return res.status(400).json({ msg: 'Missing user_id or section.' });
    }

    try {
        // Fetch the most recent semester
        const [semesters] = await db.query('SELECT * FROM semesters ORDER BY created_at DESC LIMIT 1');

        if (semesters.length === 0) {
            return res.status(404).json({ error: 'No semester found' });
        }

        const semester_id = semesters[0].id; // Get the latest semester_id

        // Insert into the `semesters_users` table
        const semesterInsertQuery = `
            INSERT INTO semesters_users (user_id, uploadcertificate, status, semester_id, section, created_at)
            VALUES (?, NULL, 'Active', ?, ?, NOW())
        `;
        await db.query(semesterInsertQuery, [user_id, semester_id, section]);

        // Update the user's status and section in the `users` table
        const userQuery = 'UPDATE users SET status = ?, section = ? WHERE id = ?';
        await db.query(userQuery, ['Active', section, user_id]);

        // Log the action to the `user_logs` table with created_by
        const logQuery = 'INSERT INTO user_logs (user_id, action, created_by) VALUES (?, ?, ?)';
        await db.query(logQuery, [user_id, 'You are now Active', created_by]);

        // Send email notification
        await sendStatusUpdateEmailWeb(user_id, semester_id, section);

        // Success response
        res.status(200).json({ success: true, msg: 'User status and section updated successfully.' });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ msg: 'Failed to update user status and section.' });
    }
};




exports.updateUserStatusGrad = async (req, res) => {
    const { user_id, status } = req.body; // Only user_id and status are received
    const created_by = req.userId; // Assuming `userId` is set by authentication middleware

    if (!user_id || !status) {
        return res.status(400).json({ msg: 'Missing user_id or status.' });
    }

    try {
        // Fetch the most recent semester
        const [semesters] = await db.query('SELECT * FROM semesters ORDER BY created_at DESC LIMIT 1');

        if (semesters.length === 0) {
            return res.status(404).json({ error: 'No semester found' });
        }

        const semester_id = semesters[0].id; // Get the latest semester_id

        // Step 1: Get the current section of the user from the `users` table
        const [user] = await db.query('SELECT section FROM users WHERE id = ?', [user_id]);

        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentSection = user[0].section; // Get the section from the user record

        // Step 2: Insert into the `semesters_users` table with the current section
        const semesterInsertQuery = `
            INSERT INTO semesters_users (user_id, uploadcertificate, status, semester_id, section, created_at)
            VALUES (?, NULL, ?, ?, ?, NOW())
        `;
        await db.query(semesterInsertQuery, [user_id, status, semester_id, currentSection]);

        // Step 3: Update the user's status in the `users` table
        const userQuery = 'UPDATE users SET status = ? WHERE id = ?';
        await db.query(userQuery, [status, user_id]);

        // Step 4: Log the action to the `user_logs` table with `created_by`
        const logQuery = 'INSERT INTO user_logs (user_id, action, created_by) VALUES (?, ?, ?)';
        await db.query(logQuery, [user_id, status, created_by]);

        // Step 5: Respond with a success message
        res.status(200).json({ success: true, msg: 'User status updated successfully.' });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ msg: 'Failed to update user status.' });
    }
};



exports.getTotalUsersByRole = async (req, res) => {
    try {
        // Query to count users by role
        const [results] = await db.query(`
            SELECT 
                role, 
                COUNT(*) AS totalUsers
            FROM users
            WHERE role IN ('Student', 'Teacher')
            GROUP BY role
        `);

        const [adminResults] = await db.query(`SELECT COUNT(*) AS totalAdmins FROM admins`);

        let userCounts = { Student: 0, Teacher: 0, Admin: adminResults[0].totalAdmins };

        results.forEach(row => {
            userCounts[row.role] = row.totalUsers;
        });

        return res.json(userCounts);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// Get total users by gender, separated by role
exports.getTotalGendersByRole = async (req, res) => {
    try {
        // Query to count genders for Students and Teachers
        const [results] = await db.query(`
            SELECT 
                role,
                SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS totalMales,
                SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS totalFemales
            FROM users
            WHERE role IN ('Student', 'Teacher')
            GROUP BY role
        `);

        // Query to count genders for Admins
        const [adminResults] = await db.query(`
            SELECT 
                SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS totalMales,
                SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS totalFemales
            FROM admins
        `);

        let genderCounts = {
            Student: { totalMales: 0, totalFemales: 0 },
            Teacher: { totalMales: 0, totalFemales: 0 },
            Admin: { totalMales: adminResults[0].totalMales || 0, totalFemales: adminResults[0].totalFemales || 0 }
        };

        results.forEach(row => {
            genderCounts[row.role] = { totalMales: row.totalMales, totalFemales: row.totalFemales };
        });

        return res.json(genderCounts);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.getTotalOrganizations = async (req, res) => {
    try {
        // Query to count total organizations and status-based count
        const [results] = await db.query(`
            SELECT 
                COUNT(*) AS totalOrganizations,
                SUM(CASE WHEN status = 'Activated' THEN 1 ELSE 0 END) AS totalActiveOrganizations,
                SUM(CASE WHEN status = 'Not Activated' THEN 1 ELSE 0 END) AS totalNotActiveOrganizations
            FROM organizations
        `);

        const { totalOrganizations, totalActiveOrganizations, totalNotActiveOrganizations } = results[0];

        return res.json({ totalOrganizations, totalActiveOrganizations, totalNotActiveOrganizations });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};



// Add this in the authcontroller.js

exports.getTotalOrdersPayments = async (req, res) => {
    try {
        // Query to get total orders and total payments
        const [ordersResults] = await db.query('SELECT SUM(total_amount) AS totalOrders FROM product_transaction'); // Assuming 'orders' table exists
        const [paymentsResults] = await db.query('SELECT SUM(total_amount) AS totalPayments FROM transactions'); // Assuming 'payments' table exists

        const totalOrders = ordersResults[0].totalOrders;
        const totalPayments = paymentsResults[0].totalPayments;

        return res.json({
            totalOrders,
            totalPayments
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// Add this in your authcontroller.js or relevant controller

exports.getActiveUsersPerSemester = async (req, res) => {
    try {
        // Query to count active users per semester
        const [results] = await db.query(`
            SELECT semester_id, COUNT(DISTINCT user_id) AS activeUsers
            FROM semesters_users
            WHERE status = 'Active'  -- Assuming 'Active' denotes an active user
            GROUP BY semester_id
            ORDER BY semester_id;  -- This will make sure semesters are ordered
        `);

        // Send the result back to the frontend
        return res.json(results);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};



exports.getActiveUsersPerSemester = async (req, res) => {
    try {
        // Query to count active users per semester and show all semesters
        const [results] = await db.query(`
            SELECT 
                s.id AS semester_id, 
                s.name AS semester_name, 
                IFNULL(COUNT(DISTINCT su.user_id), 0) AS activeUsers
            FROM semesters s
            LEFT JOIN semesters_users su ON s.id = su.semester_id AND su.status = 'Active' 
            GROUP BY s.id, s.name
            ORDER BY s.id DESC; -- This ensures semesters are ordered
        `);

        // Send the result back to the frontend
        return res.json(results);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.getOrdersVsPaymentsByMonth = async (req, res) => {
    try {
        // Query to fetch total payments grouped by month
        const [paymentsResults] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                SUM(total_amount) AS total_payment
            FROM transactions
            WHERE payment_status = 'paid'
            GROUP BY month
            ORDER BY month DESC
        `);

        // Query to fetch total orders grouped by month
        const [ordersResults] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                SUM(total_pay) AS total_order
            FROM product_transaction
            WHERE status = 'paid'
            GROUP BY month
            ORDER BY month DESC
        `);

        // Merge data from both queries
        const mergedResults = paymentsResults.map(payment => {
            const orderData = ordersResults.find(order => order.month === payment.month);
            return {
                month: payment.month,
                total_payment: payment.total_payment,
                total_order: orderData ? orderData.total_order : 0
            };
        });

        return res.json(mergedResults);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

exports.getTransactionsCountByOrganization = async (req, res) => {
    try {
        
        const orgId = req.userId;

        
        const [results] = await db.query(`
            SELECT 
                p.organization_id, 
                COUNT(t.id) AS total_transactions
            FROM transactions t
            INNER JOIN payments p ON t.payment_id = p.id
            WHERE p.organization_id = ?
            GROUP BY p.organization_id
        `, [orgId]);

        
        return res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching transactions count by organization:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};















  
