const express = require('express'); //익스프레스 모듈 삽입
const app = express();
const path = require('path'); //파일경로를 지정하기 위한 모듈

app.set('port',process.env.PORT || 3000); //process.env에 포트속성이 있다면 사용, 아니라면 3000.

app.get('/', (req,res,) => {  //get 요청 시 front측에서 만든 html파일 응답으로 불러옴.
   res.sendFile(path.join(__dirname,'..','lime','public','index.html'));  //__dirname = 현재 실행중인 폴더경로
});
app.listen(app.get('port'));