const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');
const iceServers = {
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:a.relay.metered.ca:80",
            username: "faa70f6f53fda5703594c0c2",
            credential: "UJH/kAmY0wAqKcgI",
        },
        {
            urls: "turn:a.relay.metered.ca:80?transport=tcp",
            username: "faa70f6f53fda5703594c0c2",
            credential: "UJH/kAmY0wAqKcgI",
        },
        {
            urls: "turn:a.relay.metered.ca:443",
            username: "faa70f6f53fda5703594c0c2",
            credential: "UJH/kAmY0wAqKcgI",
        },
        {
            urls: "turn:a.relay.metered.ca:443?transport=tcp",
            username: "faa70f6f53fda5703594c0c2",
            credential: "UJH/kAmY0wAqKcgI",
        },
    ],
};

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