const express = require('express');
const router = express.Router();
const db = require('../db/db.js');

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.post('/login', (req, res) => {
    const userid = req.query.id;
    const userpwd = req.query.password;

    db.query('SELECT * FROM user WHERE userid = ? AND userpwd = ?', [userid, userpwd], 
    (error, result, fileds) => {
        if(error) throw error;
        if(result.length > 0) {
            res.status(200).json({
                'success': true,
                'message': '로그인 성공'
            });
        }else{
            res.status(401).json({
                'success': false,
                'message': '로그인 실패'
            });
        }
    });
});

router.post('/register', (req, res) => {
    //id, password, nickname 유효성 검사 추가해야 됨!!!
    const userid = req.query.id;
    const userpwd = req.query.password;
    const nickname = req.query.nickname;

    db.query('SELECT * FROM user WHERE userid = ?', [userid], 
    (error, result, fileds) => {
        if(error) throw error;
        if(result.length === 0) {
            db.query('INSERT INTO user (userid, userpwd, nickname) VALUES (?,?,?);', [userid, userpwd, nickname],
            (error, data) => {
                if (error) throw error;
                res.status(200).json({
                    'success': true,
                    'message': '회원가입 성공'
                });
            });
        }else{
            res.status(409).json({
                'success': false,
                'message': '이미 존재하는 아이디입니다.'
            });
        }
    });
});

module.exports = router;