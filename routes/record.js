const express = require('express');
const db = require('../db/db.js');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/',auth() ,(req, res) => {
    db.query('SELECT video.id, user.nickname, user.profile, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id LEFT JOIN record ON video.id = record.video_id WHERE record.user_id = ?  ORDER BY record.updated DESC;', [req.id], 
    (error, result) => {
        if(error) throw error;
        res.status(200).send(result);
    });
});

module.exports = router;
