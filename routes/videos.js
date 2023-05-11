const express = require('express');
const db = require('../db/db.js');
const fs = require('fs');
const multer = require('multer')
const auth = require('../middlewares/auth');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const router = express.Router();
const MulterAzureStorage = require('multer-azure-blob-storage').MulterAzureStorage;

const connection = process.env.STORAGE_CONNECTION_STRING;
const accessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const containerName = 'lime';

if(!fs.existsSync('storage')) fs.mkdirSync('storage');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

const azureStorage = new MulterAzureStorage({
    connectionString: connection,
    accessKey: accessKey,
    accountName: accountName,
    containerName: containerName,
    urlExpirationTime: 60
});
    
const upload = multer({
    storage : azureStorage
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
                '-hls_base_url http://localhost:3000/',
                `-hls_segment_filename ${tempFolder}/%d.ts`
            ])
            .output(`${tempFolder}/result.m3u8`)
            .on('error', () => {
                if(fs.existsSync(`storage/${req.file.filename}`))
                    fs.unlinkSync(`storage/${req.file.filename}`);
                if(fs.existsSync(`storage/${req.file.filename}_`))
                    fs.rmSync(`storage/${req.file.filename}_`, { recursive: true, force: true });
                res.status(415).json({
                    success: false
                })
            })
            .on('end', () => {
                if(fs.existsSync(`storage/${req.file.filename}`))
                    fs.unlinkSync(`storage/${req.file.filename}`);
                res.status(200).json({
                    success: true
                })
            })
            .run();
    });
});

module.exports = router;