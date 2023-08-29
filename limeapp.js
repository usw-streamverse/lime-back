const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const bodyParser = require('body-parser');
const auth = require('./middlewares/auth');
const session = require('express-session');

require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// 포트 3000 동영상 서버
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
// 포트 3001 채팅 서버
const chatapp = express(); 
chatapp.set('port', process.env.PORT || 3001); // 포트번호 설정

chatapp.use(session({
  resave: false, // resave : 요청이 올 때 세션에 수정 사항이 생기지 않더라도 세션을 다시 저장할지 설정
  saveUninitialized: false,  // saveUninitialized : 세션에 저장할 내역이 없더라도 처음부터 세션을 생성할지 설정
  secret: process.env.COOKIE_SECRET,
  cookie: {
      httpOnly: true, // httpOnly: 클라이언트에서 쿠키를 확인하지 못하게 함
      secure: false, // secure: false는 https가 아닌 환경에서도 사용 가능 - 배포할 때는 true로 
  },
}));
const webSocket = require('./middlewares/websocket'); // 웹 소켓

const server = chatapp.listen(chatapp.get('port'), () => {
  console.log('lime chating system',chatapp.get('port'), '번 포트에서 대기 중');
});

chatapp.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== 'production' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

webSocket(server);
