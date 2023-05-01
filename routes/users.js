const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.get('/profile', auth, (req, res) => {
    /*
        로그인한 자기 자신의 정보를 출력
        로그인 유지에 사용됨
    */

    db.query('SELECT * FROM user WHERE id = ?', [req.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length) {
            res.status(200).json({
                'success': true,
                'id': result[0].id,
                'userid': result[0].userid,
                'nickname': result[0].nickname
            });
        }
    });
});

router.get('/:id', (req, res) => {
    res.send(`Hello, ${req.params.id}!`);
    console.log(req.params, req.query);
});



module.exports = router;