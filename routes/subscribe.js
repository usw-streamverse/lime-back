const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/',auth() ,(req, res) => {
    const active = "ACTIVE"
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id LEFT JOIN subscribe ON video.channel_id = subscribe.channel WHERE subscribe.subscriber = ? and status = \'ACTIVE\' ORDER BY created DESC', [req.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length == 0)
            res.status(201).json({
                'subscribe' : 'NOT Exist'
            });
        else{
            res.status(200).json({
                'result' : result
            });
        }
    });
});

module.exports = router;