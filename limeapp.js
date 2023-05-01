const express = require('express'); //익스프레스 모듈 삽입
const app = express();

const bodyParser = require('body-parser');
const mainRouter = require('./routes/main');  
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const auth = require('./middlewares/auth');

require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.set('port',process.env.PORT || 3000); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

/*
로그인을 해야만 접근 가능한 라우터에는
   app.use(auth).use('/exmaple', exampleRouter);
이런 식으로 auth 미들웨어 사용하면 됨
라우터 안에서 id를 전달받으려면 req.id에 로그인 한 id가 들어있음
*/
app.use('/', mainRouter); //메인페이지
app.use(auth).use('/users', usersRouter); //유저페이지
app.use('/auth', authRouter); //로그인페이지


app.use((req, res, nest) => { //찾을 수 없다면.
   res.status(404).send('Not Found');
})

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});
