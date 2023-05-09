const express = require('express');
const db = require('../db/db.js');
const fs = require('fs');
const multer = require('multer')
const auth = require('../middlewares/auth');
const router = express.Router();
const MulterAzureStorage = require('multer-azure-blob-storage').MulterAzureStorage;

const connection = process.env.STORAGE_CONNECTION_STRING;
const accessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const containerName = 'lime';

const azureStorage = new MulterAzureStorage({
    connectionString: connection,
    accessKey: accessKey,
    accountName: accountName,
    containerName: containerName,
    urlExpirationTime: 60
});
    
const upload = multer({ storage : azureStorage});

router.post('/', auth, upload.any('video'), (req, res) => {
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