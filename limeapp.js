const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const usersRouter = require('./routes/users');
app.set('port',process.env.PORT || 3000); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

app.use('/users', usersRouter);

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});