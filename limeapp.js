const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const bodyParser = require('body-parser');
const live_streaming = require('./live_streaming');
const server = require('http').createServer();
const live_chat = require('./middlewares/websocket');
const { logger, stream } = require('./middlewares/logger')
const morgan = require('morgan')
const db = require('./db/db.js');
var schedule = require("./middlewares/logdb");
db.query('delete from recent_popular_video_buffer');

require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(`${__dirname}/live_streaming`));

//app.set('port',process.env.PORT || 80); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

global.liveStreaming = live_streaming(server);

app.use(morgan(":remote-addr :method :status :url :response-time ms", { stream }));
app.use('/', require('./routes/main')); //메인페이지
app.use('/users', require('./routes/users')); //유저페이지
app.use('/auth', require('./routes/auth')); //로그인페이지
app.use('/videos', require('./routes/videos')); //비디오 업로드
app.use('/channels', require('./routes/channels')); //채널
app.use('/search', require('./routes/search')); //검색
app.use('/subscribe', require('./routes/subscribe')); // 구독
app.use('/record', require('./routes/record')); // 구독
app.use('/live', require('./routes/live')); // 라이브
schedule.schedule_job(); // 로그 24시 자정마다 남기기
app.use('/daily',require('./routes/daily_account'));// 데일리 어카운트


app.use((req, res, nest) => { //찾을 수 없다면.
   res.status(404).send('Not Found');
})

server.on('request', app);
server.listen(process.env.PORT || 80, () => {
   console.log('server is running on port 80');
});

/*app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});*/

//live_chat(3001);
