const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');

const auth = (req, res, next) => {
    let token = req.get('Authorization').split('Bearer ');
    if(token.length === 1)
        res.status(403).json({ message: 'permission denied.' });
    else {
        token = token[1];
        jwt.verify(token, jwt_config.secretKey, (error, decoded) => {
            if(error)
                res.status(403).json({ message: 'invalid token.' });
            else{
                req.id = decoded.id;
                next();
            }
        })
    }
};

module.exports = auth;