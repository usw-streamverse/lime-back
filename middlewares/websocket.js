var WebSocket = require("ws");
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');
const db = require('../db/db.js');

// db를 이용해 유저 정보를 가져오는 것을 구현해야됨 

module.exports = (port) => { // server: app.js에서 넘겨준 서버
    const wss = new WebSocket.Server({port: port});  // express 서버를 웹 소켓 서버와 연결함
                                                   // express(HTTP)와 웹 소켓(WS)은 같은 포트를 공유할 수 있으므로 별도의 작업 필요X
    
    wss.on('connection', (ws, req) => { // 연결 후 웹 소켓 서버(wss)에 이벤트 리스너를 붙힘 - connection 이벤트
                                        // 웹 소켓은 이벤트 기반으로 작동되므로 항상 대기해야 함
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // req.headers['x-forwarded-for'] || req.connection.remoteAddress: 클라이언트의 IP를 알아내는 유명한 방법 중 하나
                                                                                   // express에서는 IP 확인 시 proxy-addr 패키지를 사용하므로 이 패키지(proxy-addr) 사용해도 괜찮음
                                                                                   // localhost 접속 시 크롬에서 IP가 ::1로 뜸, 다른 브라우저는 ::1외에 다른 IP가 뜰 수 있음
        console.log(`live-chat server is running on port ${wss.options.port}`);
        wss.broadcast = (message) => { // broadcast라는 메소드를 추가하는 코드
            wss.clients.forEach((client) => { // 접속된 클라이언트들 모두에게 메세지를 전달함.
                client.send(message);
            });
        };
        let nickname;   // 닉네임을 저장할 값.                                                                       
        let token = req.headers.authorization; // 로그인 정보 토큰을 저장할 값.                                                                               
        if(token == null){
            wss.broadcast('알수 없는 이용자가 입장했습니다.'); 
        } else {
            token = token.split('Bearer ');
            if(token.length > 1) token = token[1];
            else token = token[0];
            jwt.verify(token, jwt_config.secretKey, (error, decoded) => {
                if(error) {
                    wss.broadcast('알수 없는 이용자가 입장했습니다.');
                } else{
                    db.query('SELECT * FROM user WHERE id = ? ', [decoded.id], 
                    (error, result) => {
                        if(error) throw error;           
                        nickname = result[0].nickname;
                        wss.broadcast(result[0].nickname + '님이 입장했습니다.')   
                    });
                }
            })
        }
        console.log('새로운 클라이언트 접속', ip);

        wss.clients.forEach(client => { // 새로운 유저가 들어올때 마다 모든 클라이언트에게 메세지
            client.send(`새로운 유저가 접속했습니다. 현재 유저 ${wss.clients.size} 명`); 
        });

        // 이벤트 리스너(message, error, close) 세 개 연결
        ws.on('message', (message) => { // 클라이언트로부터 메시지 수신 시(메시지 왔을 때 발생), 클라이언트의 onmessage 실행 시 실행됨
            console.log(message.toString());
            wss.broadcast(nickname +'님의 채팅:'+ message.toString());
        });
        
        ws.on('error', (error) => { // 에러 시(웹 소켓 연결 중 문제가 발생한 경우)
            console.error(error);
        });

        ws.on('close', () => { // 연결 종료 시(클라이언트와 연결 끊겼을 때 발생)
            console.log('클라이언트 접속 해제', ip);
            wss.broadcast(`유저 한명이 떠났습니다. 현재 유저 ${wss.clients.size} 명`);
            clearInterval(ws.interval); // setInterval을 clearInterval로 정리 - 안 적어주면 메모리 누수 발생
        });

        ws.interval = setInterval(() => { // 서버 연결상태가 연결중이거나 실패했을때 보낼수 있도록 함.
                                          // 3초마다 연결된 모든 클라이언트로 메시지 전송
                                          // OPEN(열림) - OPEN일때 만 에러 없이 메시지 전송 가능
                                          // + CONNECTION(연결 중), CLOSING(닫는 중), CLOSED(닫힘)
            if(ws.readyState == ws.CONNECTION) { 
                ws.send('서버에 연결된 중입니다.'); 
            }
            if(ws.readyState == ws.CLOSED) { 
                ws.send('서버에 연결이 실패했습니다.'); 
            }
        }, 3000); // 3초를 의미
    });
};

