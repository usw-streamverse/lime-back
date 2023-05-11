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
                    console.log('end');
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
                    db.query('INSERT INTO video (url, own_channel, duration, title, explanation, image) VALUES (?,?,?,?,?,?);', [JSON.stringify(urls), req.id, duration, '테스트', '테스트입니다.', thumbnail],
                    (error) => {
                        if(error){
                            res.status(500).json({
                                success: false
                            })  
                        }else{
                            res.status(200).json({
                                m3u8: urls.m3u8,
                                success: true
                            })
                        } 
                    });
                })
                .run();
            })
    });
});

module.exports = router;