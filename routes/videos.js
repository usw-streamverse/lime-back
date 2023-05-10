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
    destination: function (req, file, cb) {
        cb(null, 'storage')
    },
    filename: function (req, file, cb) {
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
    storage : azureStorage,
    fileFilter: (req, file, callback) => {
        let ext = path.extname(file.originalname);
        let allowed = ['.mp4', '.webm', '.avi', '.ts'];
        if(allowed.indexOf(ext) > -1)
            return callback(null, true);
        else
            return callback(new Error('Only videos are allowed.'), false);
    },
    limits:{
        fileSize: 1024 ** 3
    }
});
const localUpload = multer({
    storage: storage,
    fileFilter: (req, file, callback) => {
        let ext = path.extname(file.originalname);
        let allowed = ['.mp4', '.webm', '.avi', '.ts'];
        if(allowed.indexOf(ext) > -1)
            return callback(null, true);
        else
            return callback(new Error('Only videos are allowed.'), false);
    },
    limits:{
        fileSize: 1024 ** 3
    }
});

//router.post('/', auth, upload.any('video'), (req, res) => {
router.post('/', auth, localUpload.any('video'), (req, res) => {
    const tempFolder = `storage/${req.files[0].filename}_`;
    if(!fs.existsSync(tempFolder))
        fs.mkdirSync(tempFolder, {recursive: true});
    ffmpeg(req.files[0].path)
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
        .on('progress', function(progress) {
            console.log('Processing: ' + progress.percent + '% done')
        })
        .on('end', function(err, stdout, stderr) {
            console.log('Finished processing!' /*, err, stdout, stderr*/)
        })
        .run();
    if(req.files){
        res.status(200).json({
            success: true,
            ...req.files[0]
        });
    } else {
        res.status(404).json(
            {success: false}
        )
    }
});

module.exports = router;