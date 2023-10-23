var cron = require('node-cron');
const db = require('../db/db.js');
const express = require('express');
const router = express.Router();

let daily_best = [];
cron.schedule('* * * * *', () => {  // 테스트용으로 1분마다 실행. 실전 : 매일 자정 05분에 실행 = '5 0 * * *' 
    console.log('node-cron 실행 테스트, 1분마다 실행', new Date().toString());
    //전날 시청 동영상통계. 시청 수 상위 5개의 동영상만 선정.
    db.query("select A.id, title, total_view, duration, thumbnail, user.nickname, user.profile, video.view_count, video.created from ((select id, sum(frequency) as total_view from recent_popular_video where date_format(update_time,'%Y-%m-%d') = (CURDATE()) group by id order by total_view desc limit 5) A inner join video on a.id = video.id ) inner join user on user.id = video.channel_id;", // recent_popular_video에서 현재의 전날 날짜에 해당하는 데이터만 가공.
    (error, result) => {
      if (error) throw error;
      daily_best = result;
    });
  });

router.get('/', (req, res) => {
    res.status(200).send(daily_best)
});

module.exports = router;
