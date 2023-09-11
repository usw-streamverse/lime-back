const WebSocket = require('ws');
const rtc = require('./rtc');
const { RTCIceCandidate } = require('wrtc');
const { v1: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');
const db = require('../db/db.js');
const connections = new Map();

module.exports = (port) => {

    const getLiveList = () => {
        return Array.from(connections.values())
        .filter(i => i.mode === 'broadcast')
        .map(i => {
            return { created: i.created, channel: i.userid, viewer: i.viewer, nickname: i.nickname }
        })
    }

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

                                db.query('SELECT * FROM user WHERE userid = ?', [ws.userid], 
                                (error, res) => {
                                    if(res.length){
                                        ws.nickname = res[0].nickname;
                                        ws.send(JSON.stringify({type: 'authorization', result: true}));
                                    }else{
                                        ws.send(JSON.stringify({type: 'authorization', result: false}));
                                    }
                                });
                            }
                        })
                    }
                    break
                    case 'offer': {
                        const newRtc = new rtc(ws);
                        ws.rtc = newRtc;
                        ws.mode = data.mode;
                        switch(data.mode){
                            case 'broadcast':
                                ws.viewer = 0;
                                ws.created = Date.now();
                                ws.title = 'untitled';
                                if(!ws.authorized){
                                    ws.send(JSON.stringify({type: 'error', message: '방송 송출은 로그인이 필요합니다.'}));
                                    throw new Error('unauthorized');
                                }
                                break;
                            case 'stream':
                                for(const [key, i] of connections){
                                    if(i.mode === 'broadcast'){
                                        i.rtc.stream.getTracks().forEach(track => {
                                            ws.rtc.remote.addTrack(track, i.rtc.stream);
                                        });
                                        break;
                                    }
                                }
                                break;
                            default:
                                throw new Error('unknown mode');
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

    return { getLiveList }
} 