const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const authRouter = require('./routes/auth');
const auth = require('./middlewares/auth');
require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

/*
로그인을 해야만 접근 가능한 라우터에는
   app.use(auth).use('/exmaple', exampleRouter);
이런 식으로 auth 미들웨어 사용하면 됨
라우터 안에서 id를 전달받으려면 req.id에 로그인 한 id가 들어있음
*/

app.set('port',process.env.PORT || 3000);

app.use('/auth', authRouter);

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});