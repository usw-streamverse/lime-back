const express = require('express');
const db = require('../db/db.js');
const router = express.Router();

router.get('/:search', (req, res) => {
    let search = req.params.search; // 검색어를 이곳에 저장.
    search = search.replace(/ /g,'');
    var query = "%" + search + "%";
    db.query('SELECT video.id, user.nickname, user.profile, video.created, video.duration, video.title, video.view_count, video.thumbnail, video.explanation FROM video LEFT JOIN user ON video.channel_id = user.id WHERE replace(title," ","") like ? or replace(explanation," ","") like ?',[query,query], 
    (error, result) => {
        if(error) throw error;
        res.status(200).json(result);
    });
});

module.exports = router;
