const express = require('express');
const db = require('../db/db.js');
const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.get('/:id', (req, res) => { 
    // DB에서 동영상 URL 가져오기
    const id = req.params.id;
    const sql = 'SELECT url FROM video WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('Video Not Found');
            return;
        }
        const videoUrl = results[0].url;

        // 동영상 파일 전송
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', '1024');
        res.setHeader('Accept-Ranges', 'bytes');
        const stream = request(videoUrl).pipe(res); //videoUrl이 스토리지 가르키는 주소라서, 차후 스토리지 접근하는 메소드를 추가해줘야가능.
    });
});
