const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const bodyParser = require('body-parser');
const auth = require('./middlewares/auth');

require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.set('port',process.env.PORT || 3000); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

app.use('/', require('./routes/main')); //메인페이지
app.use('/users', require('./routes/users')); //유저페이지
app.use('/auth', require('./routes/auth')); //로그인페이지
app.use('/videos',require('./routes/videos')); //비디오 업로드

app.use((req, res, nest) => { //찾을 수 없다면.
   res.status(404).send('Not Found');
})

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});
