const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');
const iceServers = [{ urls: [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun3.l.google.com:19302",
    "stun:stun4.l.google.com:19302",
]}];

class RTC {
    constructor(socket) {
        this.remote = new RTCPeerConnection(iceServers);
        this.track = null;
        this.socket = socket;

        this.remote.ontrack = (e) => {
            this.stream = e.streams[0];
        }

        this.remote.onicecandidate = (e) => {
            this.socket.send(JSON.stringify({type: 'icecandidate', data: e.candidate}));
        }

        this.init = (desc, callback) => {
            const _desc = new RTCSessionDescription(desc);
            this.remote.setRemoteDescription(_desc,
                () => {
                    this.remote.createAnswer((answer) => {
                        this.remote.setLocalDescription(answer);
                        callback(answer);
                    },
                    () => {
                        callback(null, 'createAnswer Error');
                    });
                },
                () => {
                    callback(null, 'setRemoteDescription Error');
                }
            )
        }
    }
}

module.exports = RTC;