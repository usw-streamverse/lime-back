const express = require('express');
const db = require('../db/db.js');
const db2 = require('../db/db2.js');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.get('/profile', auth(), (req, res) => {
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
                'nickname': result[0].nickname,
                'profile': result[0].profile
            });
        }
    });
});

router.get('/:id', auth(false), (req, res) => {
    db.query('SELECT * FROM user WHERE userid = ?', [req.params.id], 
    async (error, result) => {
        if(error) throw error;
        if(result.length) {
            try {
                const [readership] = await db2.query('SELECT count(1) as count FROM subscribe WHERE channel = ?', [result[0].id]);
                const [video] = await db2.query('SELECT count(1) as count FROM video WHERE channel_id = ?', [result[0].id]);
                let subscribed = false;
                if(req.id){
                    const [res] = await db2.query('SELECT 1 FROM subscribe WHERE subscriber = ? and channel = ?', [req.id, result[0].id]);
                    if(res.length) subscribed = true;
                }

                res.status(200).json({
                    'success': true,
                    'id': result[0].id,
                    'userid': result[0].userid,
                    'nickname': result[0].nickname,
                    'profile': result[0].profile,
                    'readership': readership[0].count,
                    'videoCount': video[0].count,
                    subscribed
                });
            } catch(e) {
                res.status(404).json({
                    'success': false
                })
            }
        } else {
            res.status(404).json({
                'success': false
            })
        }
    });
});


module.exports = router;