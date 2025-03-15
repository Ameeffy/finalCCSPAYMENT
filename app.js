const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
require('./backup');

// Set the timezone to Asia/Manila (Philippines)
process.env.TZ = 'Asia/Manila';

const app = express();

app.use(bodyParser.json());
app.use(cors({
    origin: '*', 
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/Products', express.static(path.join(__dirname, 'Products')));
app.use('/uploads/payments', express.static(path.join(__dirname, 'uploads/payments')));
app.use('/uploads/uploadqruser', express.static(path.join(__dirname, 'uploads/uploadqruser')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);

// Function to get the current date & time in Manila timezone
function getManilaTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Timezone set to: ${process.env.TZ}`);
    console.log(`Current Date & Time in Manila: ${getManilaTime()}`);
});
