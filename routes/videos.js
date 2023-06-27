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

router.get('/', (req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.view_count, video.thumbnail FROM video LEFT JOIN user ON video.channel_id = user.id WHERE status = \'ACTIVE\' ORDER BY created DESC', 
    (error, result) => {
        if(error) throw error;
        res.status(200).json(result);
    });
});

router.post('/', auth(), (req, res) => {
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
                                id: result.insertId,
                                thumbnail: thumbnail
                            })
                        } 
                    });
                })
                .run();
            })
    });
});

router.get('/:id', auth(false), (req, res) => {
    db.query('SELECT video.id, user.nickname, video.created, video.duration, video.title, video.view_count, video.thumbnail, video.url, video.explanation, video.like_count, video.view_count FROM video LEFT JOIN user ON video.channel_id = user.id WHERE video.id = ?', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length == 0)
            res.status(404).send();
        else{
            db.query('UPDATE video SET view_count = ? WHERE id = ?', [result[0].view_count += 1, result[0].id]);
             if(req.id){
                //로그인한 경우 좋아요 여부 검사
                db.query('SELECT status FROM likes_video WHERE liker = ? and liked_v = ? and status = ?', [req.id, req.params.id, 'ACTIVE'], 
                (error, result2) => {
                    if(error) throw error;
                    res.status(200).json({
                        ...result[0],
                        like: result2.length > 0
                    });
                });
            }else{
                res.status(200).json({
                    ...result[0],
                    like: false
                });
            }
        }
    });
});

router.put('/:id', auth(), (req, res) => {
    db.query('SELECT channel_id, id FROM video WHERE id = ?', [req.params.id], 
    (error, result) => {
        if(error) throw error;
        if(result.length == 0)
            res.status(404).send();
        else{
            if(result[0].channel_id === req.id){
                db.query('UPDATE video SET title = ?, explanation = ?, status = ? WHERE id = ?', [req.body.title, req.body.explanation, 'ACTIVE', result[0].id], 
                (error) => {
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

router.post('/:id/subscribe', auth(), (req, res) => {  //[이벤트리스너] 구독 버튼 콜백함수.
    db.query('SELECT video.id FROM video WHERE id = ?;', [req.params.id],
    (error, result) => {
        let active = false;
        if(error) throw error;
        db.query('SELECT status FROM subscribe WHERE subscriber = ? AND be_subscribed = ?', [req.id, req.params.id], //이미 좋아요가 되어있을 경우(DB상 튜플있음)
        (error, result) => {
            if(error) throw error;
            if(result.length == 0) {//좋아요 처음 누르는 경우. (DB상에 튜플 없음)
                db.query('INSERT INTO  (subscriber, be_subscribed) VALUES (?,?);',[req.id, req.params.id], //처음 구독하는 경우. (DB상에 튜플 없음.)
                (error) => {
                    if(error) throw error;
                });
                active = true;
            }
            else { //좋아요 되어있고, ACTIVE상태.
                active = result[0].status !== 'ACTIVE';
                db.query('UPDATE subscribe SET status = ? WHERE subscriber = ? and be_subscribed = ?', [result[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', req.id, req.params.id], (error) =>{if(error) throw error;}  //INACTIVE(비활성화) = 좋아요 취소.
            )}
            res.status(200).json({
                active: true
            });
        })
    });
});


router.post('/:id/like', auth(), (req, res) => {  //[이벤트리스너] 동영상 좋아요 버튼 콜백함수.
    db.query('SELECT video.id FROM video WHERE id = ?;', [req.params.id],
    (error, result) => {
        if(error) throw error;
        let active = false;
        db.query('SELECT status FROM likes_video WHERE liker = ? AND liked_v = ?', [req.id, req.params.id], //이미 좋아요가 되어있을 경우(DB상 튜플있음)
        (error, result) => {
            if(error) throw error;
            if(result.length == 0) {//좋아요 처음 누르는 경우. (DB상에 튜플 없음)
                db.query('INSERT INTO likes_video (liker, liked_v) VALUES (?,?);',[req.id, req.params.id], //처음 구독하는 경우. (DB상에 튜플 없음.)
                (error) => {
                    if(error) throw error;
                });
                active = true;
            }
            else { //좋아요 되어있고, ACTIVE면 INACTIVE로, INACTIVE면 ACTIVE로.
                active = result[0].status !== 'ACTIVE';
                db.query('UPDATE likes_video SET status = ? WHERE liker = ? and liked_v = ?', [result[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', req.id, req.params.id], (error) =>{if(error) throw error;}  //INACTIVE(비활성화) = 좋아요 취소.
            )}
            res.status(200).json({
                active: active
            });

        })
    });
});

router.get('/:id/comment', auth(false), (req, res) => {
    db.query('SELECT user.nickname, video_comment.* FROM video_comment LEFT JOIN user ON video_comment.writer = user.id WHERE video_id = ? ORDER BY id DESC', [req.params.id],
    (error, result) => {
        if (error) throw error;
        res.status(200).json(result);
    });
});

router.post('/:id/comment', auth(), (req, res) => {
    const comment = req.body.comment;
    const parent_id = req.body.parent_id || 0;

    if(comment.trim() === ''){
        res.status(400).send();
        return;
    }

    if(parent_id == 0){
        db.query('SELECT id FROM video WHERE id = ?', [req.params.id],
        (error, result) => {
            if (error) throw error;
            if(result.length){
                db.query('INSERT INTO video_comment(parent_id, video_id, writer, comment) VALUES (?, ?, ?, ?)', [0, req.params.id, req.id, comment], 
                (error, result) => {
                    if (error) throw error;
                    res.status(200).json({
                        success: true
                    });
                });
            } else {
                res.status(404).send();
            }
        });
    } else {
        db.query('SELECT id FROM video_comment WHERE id = ? and video_id = ?', [parent_id, req.params.id],
        (error, result) => {
            if (error) throw error;
            if(result.length){
                db.query('INSERT INTO video_comment(parent_id, video_id, writer, comment) VALUES (?, ?, ?, ?)', [result[0].id, req.params.id, req.id, comment], 
                (error, result) => {
                    if (error) throw error;
                    res.status(200).json({
                        success: true
                    });
                });
            } else {
                res.status(404).send();
            }
        });
    }
});

router.put('/:id/comment', auth(), (req, res) => {
    const comment = req.body.comment;
    const id = req.body.id;
    const video_id = req.params.id;

    if(comment.trim() === ''){
        res.status(400).send();
        return;
    }

    db.query('SELECT video.writer FROM video_comment WHERE id = ? and video_id = ?', [id, video_id],
    (error, result) => {
        if (error) throw error;
        if(result.length){
            if(result[0].writer === req.id){
                db.query('UPDATE video_comment SET comment = ? WHERE id = ? and video_id = ?', [comment, id, video_id]);
                res.status(200).json({
                    success: true
                });
            } else {
                res.status(403).send();
            }
        } else {
            res.status(404).send();
        }
    });
});

router.delete('/:id/comment/:comment', auth(), (req, res) => {
    const comment_id = req.params.comment;
    const video_id = req.params.id;

    db.query('SELECT writer FROM video_comment WHERE id = ? and video_id = ?', [comment_id, video_id],
    (error, result) => {
        if (error) throw error;
        if(result.length){
            if(result[0].writer === req.id){
                db.query('DELETE FROM video_comment WHERE id = ? and video_id = ?', [comment_id, video_id],
                (error, result) => {
                    db.query('DELETE FROM video_comment WHERE parent_id = ? and video_id = ?', [comment_id, video_id],
                    (error, result) => {
                        res.status(200).json({
                            success: true
                        });
                    });
                });
            } else {
                res.status(403).send();
            }
        } else {
            res.status(404).send();
        }
    });
});

module.exports = router;