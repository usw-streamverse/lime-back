const express = require('express');
const db = require('../db/db.js');
const fs = require('fs');
const multer = require('multer')
const auth = require('../middlewares/auth');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const router = express.Router();
const { BlobServiceClient } = require('@azure/storage-blob');

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
if (!accountName) throw Error('Azure Storage accountName not found');

const STORAGE_CONNECTION_STRING = process.env.STORAGE_CONNECTION_STRING || "";
const blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient('lime');

if(!fs.existsSync('storage')) fs.mkdirSync('storage');

const toSec = (str) => { 
    var p = str.split(':'),
        s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
    return s;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage')
    },
    filename: (req, file, cb) => {
        cb(null, 'v' + Date.now())
    }
});

const localUpload = multer({
    storage: storage,
    fileFilter: (req, file, callback) => {
        let ext = path.extname(file.originalname);
        let allowed = ['.mp4', '.webm', '.avi', '.ts'];
        if(allowed.indexOf(ext) > -1)
            return callback(null, true);
        else {
            const err = new Error('Only videos are allowed.');
            err.statusCode = 406;
            return callback(err, false);
        }
    },
    limits:{
        fileSize: 1024 ** 3 // 업로드 파일 최대 크기 1GB
    }
});

/*
    채널 기능 만들기 전까지 channel_id 대신 userid로 사용하겠음
*/

router.get('/', (req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.views, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id WHERE status = \'ACTIVE\' ORDER BY created DESC', 
    (error, result) => {
        if(error) throw error;
        res.status(200).json(result);
    });
});

router.get('/:id', (req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.views, video.thumbnail, video.url, video.explanation, video.likes FROM video LEFT JOIN user ON video.channel_id = user.id WHERE video.id = ?', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length == 0)
            res.status(404).send();
        else
            res.status(200).json(
                result[0]
            );
    });
});

router.put('/:id', auth, (req, res) => {
    db.query('SELECT channel_id, id FROM video WHERE id = ?', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length == 0)
            res.status(404).send();
        else{
            if(result[0].channel_id === req.id){
                db.query('UPDATE video SET title = ?, explanation = ?, status = ? WHERE id = ?', [req.body.title, req.body.explanation, 'ACTIVE', result[0].id], 
                (error) => {
                    console.log(error);
                    if(error)
                        res.status(500).send();
                    else{
                        res.status(200).json({
                            id: result[0].id
                        });
                    }
                });
            }else{
                res.status(403).send();
            }
        }
    });
});

router.post('/', auth, (req, res) => {
    localUpload.single('video')(req, res, (err) => {
        if(err || !req.file){
            if(err.statusCode){
                res.status(err.statusCode).json({
                    success: false
                })
                return;
            } else {
                res.status(500).json({
                    success: false
                })
                return;
            }
        }
        const tempFolder = `storage/${req.file.filename}_`;
        let duration = 0, thumbnail = '';

        if(!fs.existsSync(tempFolder))
            fs.mkdirSync(tempFolder, { recursive: true });
        ffmpeg(req.file.path)
            .screenshots({
                timestamps: ['50%'],
                filename: `thumbnail.png`,
                folder: tempFolder,
                size: '320x180'
            })
            .on('end', () => {
                ffmpeg(req.file.path)
                .outputOption([
                    '-codec: copy',
                    '-hls_time 10',
                    '-hls_list_size 0',
                    '-hls_playlist_type vod',
                    '-hls_flags split_by_time',
                    '-hls_base_url https://svlimestorage.blob.core.windows.net/lime/',
                    `-hls_segment_filename ${tempFolder}/${req.file.filename}-%d.ts`
                ])
                .output(`${tempFolder}/result.m3u8`)
                .on('error', () => {
                    if(fs.existsSync(`storage/${req.file.filename}`))
                        fs.unlinkSync(`storage/${req.file.filename}`);
                    if(fs.existsSync(tempFolder))
                        fs.rmSync(tempFolder, { recursive: true, force: true });
                    res.status(415).json({
                        success: false
                    })
                })
                .on('codecData', (data) => {
                    duration = toSec(data.duration);
                })
                .on('end', async () => {
                    if(fs.existsSync(`storage/${req.file.filename}`))
                        fs.unlinkSync(`storage/${req.file.filename}`);
    
                    let urls = {m3u8: '', segments: []};
                    
                    let blockBlobClient = containerClient.getBlockBlobClient(`${req.file.filename}.m3u8`);
                    let uploadBlobResponse = await blockBlobClient.uploadFile(`${tempFolder}/result.m3u8`);
                    urls.m3u8 = blockBlobClient.url;

                    blockBlobClient = containerClient.getBlockBlobClient(`${req.file.filename}-thumbnail.png`);
                    uploadBlobResponse = await blockBlobClient.uploadFile(`${tempFolder}/thumbnail.png`);
                    thumbnail = blockBlobClient.url;
    
                    let fileList = fs.readdirSync(tempFolder);
                    for(const e of fileList){
                        if(e.split('.')[1] === 'ts'){
                            let blockBlobClient = containerClient.getBlockBlobClient(e);
                            let uploadBlobResponse = await blockBlobClient.uploadFile(`${tempFolder}/${e}`);
                            urls.segments.push(blockBlobClient.url);
                        }
                    };

                    /*
                        일단 동영상 파일을 업로드하기만 하면 video 테이블에 status=INACTIVE 상태로 저장이 되고,
                        나중에 사용자가 제목과 내용을 설정하면 status=ACTIVE 상태가 되어 공개가 되는 방식
                        유튜브 업로드도 이거랑 비슷한 방식이고 나중에 삭제할 동영상을 구분할 때 용이해 보여서 이렇게 구성함
                    */

                    db.query('INSERT INTO video (url, channel_id, duration, title, explanation, thumbnail, status) VALUES (?,?,?,?,?,?,?)', [JSON.stringify(urls), req.id, duration, req.file.originalname, '', thumbnail, 'INACTIVE'],
                    (error, result) => {
                        if(error){
                            res.status(500).send();
                        }else{
                            res.status(200).json({
                                m3u8: urls.m3u8,
                                filename: req.file.originalname,
                                duration: duration,
                                id: result.insertId
                            })
                        } 
                    });
                })
                .run();
            })
    });
});

module.exports = router;