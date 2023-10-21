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

// 특정 채널의 재생 목록 조회
router.get('/:id/playlist', auth(false), (req, res) => {
    db.query('SELECT playlist.id, playlist.name, playlist.created, COUNT(playlist_item.playlist_id) AS count, (SELECT video.thumbnail FROM video LEFT JOIN playlist_item ON playlist_item.video_id = video.id WHERE playlist_item.playlist_id = playlist.id ORDER BY playlist_item.created DESC LIMIT 1) AS thumbnail FROM playlist LEFT JOIN playlist_item ON playlist.id = playlist_item.playlist_id WHERE user_id = ? GROUP BY playlist.id ORDER BY playlist.created DESC', [req.params.id == 0 ? req.id : req.params.id], 
        (error, result) => {
            if(error) throw error;
            res.status(200).json(result);
        }
    );
});

// 특정 재생 목록에 들어가 있는 동영상 목록 출력
router.get('/playlist/:id', (req, res) => {
    db.query('SELECT playlist_item.video_id, playlist_item.created, video.title, video.thumbnail, video.duration FROM playlist_item LEFT JOIN video on video.id = playlist_item.video_id WHERE playlist_id = ? ORDER BY created DESC', [req.params.id], 
        async (error, result) => {
            if(error) throw error;
            res.status(200).json(result);
        }
    );
});

// 재생 목록 삭제
router.delete('/playlist/:id', auth(), (req, res) => {
    db.query('DELETE FROM playlist WHERE id = ? and user_id = ?', [req.params.id, req.id], 
        async (error, result) => {
            if (error) throw error;
            if (result.affectedRows > 0) {
                db.query('DELETE FROM playlist_item WHERE playlist_id = ?', [req.params.id]);
                res.status(200).json({success: true});
            } else {
                res.status(404).json({success: false});
            }
        }
    );
});

// 재생 목록에 있는 동영상 삭제
router.delete('/playlist/:playlist_id/:video_id', auth(), (req, res) => {
    db.query('SELECT user_id FROM playlist WHERE id = ?', [req.params.playlist_id], 
        (error, result) => {
            if (error) throw error;
            if (result.length > 0 && result[0].user_id == req.id) {
                db.query('DELETE FROM playlist_item WHERE playlist_id = ? and video_id = ?', [req.params.playlist_id, req.params.video_id], 
                    (error, result) => {
                        if (error) throw error;
                        res.status(200).json({success: true});
                    }
                );
            } else {
                res.status(401).json({success: false});
            }
        }
    );
    
});

module.exports = router;
