const express = require('express');
const router = express.Router();

const liveStreaming = global.liveStreaming;

router.get('/', (req, res) => {
    res.send(liveStreaming.getLiveList());
});

module.exports = router;

