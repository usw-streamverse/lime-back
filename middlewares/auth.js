const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');

const auth = (req, res, next) => {
    let token = req.get('Authorization');
    if(token == null)
        res.status(403).json({ message: 'permission denied.' });
    else {
        token = token.split('Bearer ');
        if(token.length > 1) token = token[1];
        else token = token[0];
        jwt.verify(token, jwt_config.secretKey, (error, decoded) => {
            if(error)
                res.status(403).json({ message: 'invalid token.' });
            else{
                req.id = decoded.id;
                req.userid = decoded.userid;
                next();
            }
        })
    }
};

module.exports = auth;