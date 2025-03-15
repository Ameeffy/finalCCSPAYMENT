const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, 'jwtSecret', (err, user) => {
        if (err) return res.status(403).json({ msg: 'Failed to authenticate token' }); // Invalid token
        req.userId = user.id;
        req.orgIduser = user.orgiduser;
        req.orgIduseraccount = user.orgiduseraccount;
        req.orgIduserchoose = user.orgiduserchoose;
        req.AdviserID = user.adviserid;
        
        next();
    });
}

module.exports = authenticateToken;
