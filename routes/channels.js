const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth.js');

/*
    일단 작업량을 줄이기 위해 채널을 별도 구현하지 않고,
    유저 = 채널로 가정하고 작업함.  
*/

router.get('/:id/video', (req, res) => {
    db.query('SELECT video.id, user.nickname, user.profile, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id WHERE user.userid = ? and video.status = \'ACTIVE\' ORDER BY created DESC', [req.params.id], 
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
            db.query('SELECT * FROM subscribe WHERE subscriber = ? and channel = ?', [req.id, result[0].id], 
            (error, result) => {
                if(error) throw error;
                if(result.length) {
                    db.query('DELETE FROM subscribe WHERE subscriber = ? and channel = ?', [req.id, req.params.id], 
                    (error) => {
                        if(error) throw error;
                        res.status(200).json({
                            'active': false
                        });
                    });
                } else {
                    db.query('INSERT INTO subscribe (subscriber, channel) VALUES (?, ?)',[req.id, req.params.id], 
                    (error) => {
                        if(error) throw error;
                        res.status(200).json({
                            'active': true
                        });
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


router.post('/playlist', auth(), (req, res) => {  // 재생목록을 만듬
    const name = req.body.name;  // 재생목록 이름 
    if(name.trim() === ''){
        res.status(400).send();
        return;
    }
    else{
        db.query('SELECT * FROM user WHERE id = ?', [req.id], // 유저 확인 
        (error, result) => {
            if(error) throw error;
            if(result.length) {
                db.query('INSERT INTO playlist (user_id, name) VALUES (?, ?)',[req.id, name], // 재생목록 만듬
                (error, result) => {
                    if(error) throw error;
                    res.status(200).json({
                        'success': true,
                        'playlist_name' : name
                    });
                });
            }         
        });
    }
});

router.get('/playlist', auth(), (req, res) => {  // 재생목록을 확인하는 기능
    db.query('SELECT playlist.id, playlist.name, playlist.created, COUNT(playlist_item.playlist_id) AS count, (SELECT video.thumbnail FROM video LEFT JOIN playlist_item ON playlist_item.video_id = video.id WHERE playlist_item.playlist_id = playlist.id ORDER BY playlist_item.created DESC LIMIT 1) AS thumbnail FROM playlist LEFT JOIN playlist_item ON playlist.id = playlist_item.playlist_id WHERE user_id = ? GROUP BY playlist.id ORDER BY playlist.created DESC ', [req.id], 
        async (error, result) => {
            if(error) throw error;
            res.status(200).json(result);
        }
    );
});

module.exports = router;
