const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'collegofcomputingstudies2024@gmail.com',
        pass: 'sfpe jznk ncuf cmrj'
    },
    tls: {
      rejectUnauthorized: false 
    }
});

module.exports = transporter;
