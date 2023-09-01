const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/',auth() ,(req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id LEFT JOIN subscribe ON video.channel_id = subscribe.channel WHERE subscribe.subscriber = ? and video.status = \'ACTIVE\' ORDER BY created DESC', [req.id], 
    (error, result) => {
        if(error) throw error;
        res.status(200).json(result);
    });
});

module.exports = router;
