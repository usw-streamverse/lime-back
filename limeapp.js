const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const bodyParser = require('body-parser');
const auth = require('./middlewares/auth');
const live_streaming = require('./live_streaming');




require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(`${__dirname}/live_streaming`));

app.set('port',process.env.PORT || 3000); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

app.use('/', require('./routes/main')); //메인페이지
app.use('/users', require('./routes/users')); //유저페이지
app.use('/auth', require('./routes/auth')); //로그인페이지
app.use('/videos', require('./routes/videos')); //비디오 업로드
app.use('/channels', require('./routes/channels')); //채널
app.use('/search', require('./routes/search')); //검색
app.use('/subscribe', require('./routes/subscribe')); // 구독
app.use('/record', require('./routes/record')); // 구독

app.use((req, res, nest) => { //찾을 수 없다면.
   res.status(404).send('Not Found');
})

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});


live_streaming(4000);