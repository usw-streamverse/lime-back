const WebSocket = require('ws');
const fs = require('fs');

module.exports = (port) => {
    const wss = new WebSocket.Server({port: port});

    wss.on('listening', () => {
        console.log(`live-streaming server is running on port ${wss.options.port}`);
    });

    wss.on('connection', (ws, req) => {
        ws.state = 0;
        ws.on('message', (message) => {
            try {
                switch(ws.state){
                    case 0: 
                    {
                        const data = JSON.parse(message.toString());
                        ws.state = 1;
                        console.log(data);
                    }
                        break;
                    case 1:
                    {
                        const data = JSON.parse(message.toString());
                        ws.state = 2;
                        ws.sequence = parseInt(data.sequence);
                    }
                        break;
                    case 2:
                    {
                        console.log(ws.sequence, message.byteLength);
                        fs.writeFileSync(`${__dirname}/files/${ws.sequence}.webm`, Buffer.from(message.buffer));
                        //Buffer.from(message.buffer).pipe(fs.createWriteStream(`${__dirname}/files/${ws.sequence}.webm`));
                        ws.state = 1;
                    }
                        break;
                }
            } catch (e) {
                console.error(e);
                ws.close();
            }
        });
    });
}