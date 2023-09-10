const WebSocket = require('ws');
const rtc = require('./rtc');
const { RTCIceCandidate } = require('wrtc');
const { v1: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');
const connections = new Map();

module.exports = (port) => {
    const wss = new WebSocket.Server({port: port});
    
    wss.on('listening', () => {
        console.log(`live-streaming server is running on port ${wss.options.port}`);
    });

    wss.on('connection', (ws, req) => {
        ws.state = 0;
        ws.authorized = false;
        ws.id = uuid();

        ws.on('close', (e) => {
            connections.delete(ws.id);
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                switch(data.type){
                    case 'authorization': {
                        jwt.verify(data.token, jwt_config.secretKey, (error, decoded) => {
                            if(error) {
                                ws.send(JSON.stringify({type: 'error', message: '잘못된 토큰입니다.'}));
                                throw new Error('invalid token');
                            } else {
                                ws.authorized = true;
                                ws.userid = decoded.userid;
                            }
                        })
                    }
                    break
                    case 'offer': {
                        if(!ws.authorized) throw new Error('unauthorized');
                        const newRtc = new rtc(ws);
                        newRtc.broadcast = data.mode === 'broadcast';
                        ws.rtc = newRtc;
                        if(data.mode === 'stream'){
                            for(let [key, i] of connections){
                                if(i.rtc.broadcast){
                                    i.rtc.stream.getTracks().forEach(track => {
                                        ws.rtc.remote.addTrack(track, i.rtc.stream);
                                    });
                                    break;
                                }
                            }
                        }
                        newRtc.init(data.desc, (desc, error) => {
                            if(error) return;
                            ws.send(JSON.stringify({'type': 'offer', 'desc': desc}));
                            connections.set(ws.id, ws);
                        });
                    }
                    break;
                    case 'track':
                        if(!ws.authorized) throw new Error('unauthorized');
                        ws.send(JSON.stringify({'type': 'track', 'length': connections.length}));
                        break;
                    case 'icecandidate':
                        if(!ws.authorized) throw new Error('unauthorized');
                        if(data.data)
                            ws.rtc.remote.addIceCandidate(new RTCIceCandidate(data.data));
                        break;
                }
            } catch (e) {
                console.error(e);
                ws.close();
            }
        });
    });
} 