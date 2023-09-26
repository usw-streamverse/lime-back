const WebSocket = require('ws');
const rtc = require('./rtc');
const { RTCIceCandidate } = require('wrtc');
const { v1: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const jwt_config = require('../config/jwt.js');
const db = require('../db/db.js');
const db2 = require('../db/db2.js');
const connections = new Map();

WebSocket.Server.prototype.filter = function(condition, callback){
    for(const [key, i] of this.connections){
        if(condition(i))
            if(callback(i) === true) break;
    }
}

WebSocket.Server.prototype.broadcast = function(condition, data){
    for(const [key, i] of this.connections)
        if(condition(i.data)) i.send(data);
}

WebSocket.Server.prototype.join = function(socket){
    socket.wss = this;
    socket.data = {
        uuid: uuid(),
        authorized: false,
        id: null,
        userid: null,
        nickname: null,
        profile: null,
        mode: null,
        room: null,
        streamer: null, // 시청하고 있는 streamer의 socket을 참조함 (streamer의 경우 본인)
        status: {
            title: null,
            viewer: 0,
            created: 0,
        }
    }
    this.connections.set(socket.data.uuid, socket);
}

WebSocket.Server.prototype.leave = function(socket){
    this.connections.delete(socket.data.uuid);
}

WebSocket.prototype.isStreamer = function(){
    return this.data.mode === 'streamer';
}

WebSocket.prototype.isViewer = function(){
    return this.data.mode === 'viewer';
}

WebSocket.prototype.broadcast = function(data){
    for(const [key, i] of this.wss.connections)
        if(i?.data?.room === this.data.room) i.send(data);
}

WebSocket.prototype.particpants = function(callback){
    for(const [key, i] of this.wss.connections)
        if(i?.data?.room === this.data.room) callback(i);
}

module.exports = (server) => {

    const getLiveList = () => {
        return Array.from(connections.values())
        .filter(i => i.isStreamer())
        .map(i => {
            return { created: i.data.status.created, channel: i.data.userid, viewer: i.data.status.viewer, nickname: i.data.nickname, title: i.data.status.title, profile: i.data.profile }
        })
    }

    const wss = new WebSocket.Server({server: server});
    wss.connections = connections;


    wss.on('listening', () => {
        console.log(`live-streaming server is running on port ${wss.options.port}`);
    });

    wss.on('connection', (ws, req) => {
        wss.join(ws);

        ws.on('close', (e) => {
            if(ws.data.streamer){    
                ws.data.streamer.data.status.viewer--;
                ws.broadcast(JSON.stringify({type: 'status', 'viewer': ws.data.streamer.data.status.viewer}));
            }
            wss.leave(ws);
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
                                ws.data.authorized = true;
                                ws.data.userid = decoded.userid;
                                ws.data.id = decoded.id;

                                db.query('SELECT * FROM user WHERE userid = ?', [ws.data.userid], 
                                (error, res) => {
                                    if(res.length){
                                        ws.data.nickname = res[0].nickname;
                                        ws.data.profile = res[0].profile;
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
                        if(!ws.isStreamer()) return;
                        ws.data.status.title = data.title.trim() === '' ? `${ws.data.userid}'s live stream` : data.title;
                        ws.broadcast(JSON.stringify({type: 'title', title: ws.data.status.title}));
                    }
                    break;
                    case 'offer': {
                        const newRtc = new rtc(ws);
                        ws.rtc = newRtc;
                        ws.data.mode = data.mode;
                        switch(data.mode){
                            case 'streamer':
                                ws.data.status.viewer = 0;
                                ws.data.status.created = Date.now();
                                ws.data.status.title = `${ws.data.userid}'s live stream`;
                                if(!ws.data.authorized){
                                    ws.send(JSON.stringify({type: 'error', message: '방송 송출은 로그인이 필요합니다.'}));
                                    throw new Error('unauthorized');
                                }
                                ws.send(JSON.stringify({type: 'title', title: ws.data.status.title}));
                                break;
                            case 'viewer':

                                wss.filter((w) => w.isStreamer(),
                                (w) => {
                                    w.rtc.stream.getTracks().forEach(track => {
                                        ws.rtc.remote.addTrack(track, w.rtc.stream);
                                    });
                                    ws.data.streamer = w;
                                    ws.data.room = w.data.room;
                                    ws.send(JSON.stringify({type: 'title', title: w.data.status.title}));
                                    w.data.status.viewer++;
                                    w.broadcast(JSON.stringify({type: 'status', 'viewer': ws.data.streamer.data.status.viewer}));
                                    return true;
                                });
                                break;
                            default:
                                throw new Error('unknown mode');
                        }
                        newRtc.init(data.desc, (desc, error) => {
                            if(error) return;
                            ws.send(JSON.stringify({type: 'offer', desc: desc}));
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