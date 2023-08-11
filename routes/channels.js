const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth.js');

/*
    일단 작업량을 줄이기 위해 채널을 별도 구현하지 않고,
    유저 = 채널로 가정하고 작업함.  
*/

router.get('/:id/video', (req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id WHERE user.userid = ? and status = \'ACTIVE\' ORDER BY created DESC', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        res.status(200).json(result);
    });
});

router.post('/:id/subscribe', auth(), (req, res) => {
    db.query('SELECT * FROM user WHERE id = ?', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length) {
            db.query('SELECT * FROM subscribe WHERE channel = ?', [result[0].id], 
            (error, result) => {
                if(error) throw error;
                if(result.length) {
                    db.query('DELETE FROM subscribe WHERE subscriber = ? and channel = ?', [req.id, req.params.id]);
                    res.status(200).json({
                        'subscribe': false
                    });
                } else {
                    db.query('INSERT INTO subscribe (subscriber, channel) VALUES (?, ?)',[req.id, req.params.id]); 
                    res.status(200).json({
                        'subscribe': true
                    });
                }
            });
        }else{
            res.status(404).json({
                'success': false
            });
        }
    });
});

module.exports = router;