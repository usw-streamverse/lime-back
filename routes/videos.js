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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
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
        if(!fs.existsSync(tempFolder))
            fs.mkdirSync(tempFolder, { recursive: true });
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
            .on('end', async () => {
                if(fs.existsSync(`storage/${req.file.filename}`))
                    fs.unlinkSync(`storage/${req.file.filename}`);
                
                let blockBlobClient = containerClient.getBlockBlobClient(`${req.file.filename}.m3u8`);
                let uploadBlobResponse = await blockBlobClient.uploadFile(`${tempFolder}/result.m3u8`);
                
                fs.readdir(tempFolder, (err, fileList) => {
                    fileList.forEach(async (e) => {
                        if(e.split('.')[1] === 'ts'){
                            let blockBlobClient = containerClient.getBlockBlobClient(e);
                            let uploadBlobResponse = await blockBlobClient.uploadFile(`${tempFolder}/${e}`);
                        }
                    })
                })

                console.log(blockBlobClient.url);

                res.status(200).json({
                    success: true
                })
            })
            .run();
    });
});

module.exports = router;