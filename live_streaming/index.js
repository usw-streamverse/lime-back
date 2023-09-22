const WebSocket = require('ws');
const rtc = require('./rtc');
const { RTCIceCandidate } = require('wrtc');
const { v1: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');
const db = require('../db/db.js');
const db2 = require('../db/db2.js');
const connections = new Map();

module.exports = (port) => {

    const getLiveList = () => {
        return Array.from(connections.values())
        .filter(i => i.mode === 'broadcast')
        .map(i => {
            return { created: i.created, channel: i.userid, viewer: i.viewer, nickname: i.nickname, title: i.title, profile: i.profile }
        })
    }

    const wss = new WebSocket.Server({port: port});
    
    wss.on('listening', () => {
        console.log(`live-streaming server is running on port ${wss.options.port}`);
    });

    wss.on('connection', (ws, req) => {
        ws.state = 0;
        ws.authorized = false;
        ws.uuid = uuid();

        ws.on('close', (e) => {
            for(const [key, i] of connections){
                if(i.mode === 'broadcast' && i.userid === ws.view){
                    i.send(JSON.stringify({type: 'status', 'viewer': --i.viewer}));
                    break;
                }
            }

            connections.delete(ws.uuid);
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                switch(data.type){
                    case 'authorization': {
                        jwt.verify(data.token, jwt_config.secretKey, async (error, decoded) => {
                            if(error) {
                                ws.send(JSON.stringify({type: 'error', message: '잘못된 토큰입니다.'}));
                                throw new Error('invalid token');
                            } else {
                                ws.authorized = true;
                                ws.userid = decoded.userid;
                                ws.id = decoded.id;

                                db.query('SELECT * FROM user WHERE userid = ?', [ws.userid], 
                                (error, res) => {
                                    if(res.length){
                                        ws.nickname = res[0].nickname;
                                        ws.profile = res[0].profile;
                                        ws.send(JSON.stringify({type: 'authorization', result: true}));
                                    }else{
                                        ws.send(JSON.stringify({type: 'authorization', result: false}));
                                    }
                                });
                            }
                        })
                    }
                    break;
                    case 'modifyTitle': {
                        if(ws.mode !== 'broadcast') return;                        
                        ws.title = data.title.trim() === '' ? `${ws.userid}'s live stream` : data.title;
                        ws.send(JSON.stringify({type: 'title', title: ws.title}));
                        for(const [key, i] of connections){
                            if(i.mode === 'stream' && i.view === ws.userid){
                                i.send(JSON.stringify({type: 'title', 'title': ws.title}));
                                break;
                            }
                        }
                    }
                    break;
                    case 'offer': {
                        const newRtc = new rtc(ws);
                        ws.rtc = newRtc;
                        ws.mode = data.mode;
                        switch(data.mode){
                            case 'broadcast':
                                ws.viewer = 0;
                                ws.created = Date.now();
                                ws.title = `${ws.userid}'s live stream`;
                                if(!ws.authorized){
                                    ws.send(JSON.stringify({type: 'error', message: '방송 송출은 로그인이 필요합니다.'}));
                                    throw new Error('unauthorized');
                                }
                                ws.send(JSON.stringify({type: 'title', title: ws.title}));
                                break;
                            case 'stream':
                                for(const [key, i] of connections){
                                    if(i.mode === 'broadcast' && i.userid === data.channel){
                                        i.rtc.stream.getTracks().forEach(track => {
                                            ws.rtc.remote.addTrack(track, i.rtc.stream);
                                        });
                                        ws.view = i.userid;

                                        i.send(JSON.stringify({type: 'status', viewer: ++i.viewer}));
                                        ws.send(JSON.stringify({type: 'title', title: i.title}));
                                        break;
                                    }
                                }
                                break;
                            default:
                                throw new Error('unknown mode');
                        }
                        newRtc.init(data.desc, (desc, error) => {
                            if(error) return;
                            ws.send(JSON.stringify({type: 'offer', desc: desc}));
                            connections.set(ws.uuid, ws);
                        });
                    }
                        break;
                    case 'track':
                        ws.send(JSON.stringify({type: 'track', length: connections.length}));
                        break;
                    case 'icecandidate':
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