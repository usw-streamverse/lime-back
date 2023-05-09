const express = require('express');
const router = express.Router();
const db = require('../db/db.js');
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.post('/login', (req, res) => {
    const userid = req.body.id;
    const userpwd = req.body.password;

    if(userid.trim() === ''){
        res.status(400).json({
            'success': false,
            'code': 3 // 아이디가 공백
        });
        return;
    }

    if(userpwd.trim() === ''){
        res.status(400).json({
            'success': false,
            'code': 4 // 비밀번호가 공백
        });
        return;
    }

    db.query('SELECT * FROM user WHERE userid = ? AND userpwd = ?', [userid, userpwd], 
    (error, result) => {
        if(error) throw error;
        if(result.length > 0) {

            const token = jwt.sign({
                'id': result[0].id,
                'userid': result[0].userid
            }, jwt_config.secretKey, jwt_config.option);

            res.status(200).json({
                'success': true,
                'id': result[0].id,
                'userid': result[0].userid,
                'nickname': result[0].nickname,
                'code': 1, // 로그인 성공
                'token': token
            });
        }else{
            res.status(401).json({
                'success': false,
                'code': 2 // 아이디 또는 비밀번호가 틀림
            });
        }
    });
});

router.post('/register', (req, res) => {
    /*
        유효성 검사가 많아지다보니 코드가 더러워지는데,
        임시로 공백 체크만 구현해놓고 유효성 검증 모듈을 사용해서 리팩토링할 예정
    */
    const userid = req.body.id;
    const userpwd = req.body.password;
    const nickname = req.body.nickname;

    if(userid.trim() === ''){
        res.status(400).json({
            'success': false,
            'code': 3 // 아이디가 공백
        });
        return;
    }

    if(userpwd.trim() === ''){
        res.status(400).json({
            'success': false,
            'code': 4 // 비밀번호가 공백
        });
        return;
    }

    if(nickname.trim() === ''){
        res.status(400).json({
            'success': false,
            'code': 5 // 닉네임이 공백
        });
        return;
    }

    db.query('SELECT * FROM user WHERE userid = ?', [userid], 
    (error, result) => {
        if(error) throw error;
        if(result.length === 0) {
            db.query('INSERT INTO user (userid, userpwd, nickname) VALUES (?,?,?);', [userid, userpwd, nickname],
            (error) => {
                if (error) throw error;
                res.status(200).json({
                    'success': true,
                    'code': 1 // 회원가입 성공
                });
            });
        }else{
            res.status(409).json({
                'success': false,
                'code': 2 // 이미 사용중인 아이디
            });
        }
    });
});

module.exports = router;