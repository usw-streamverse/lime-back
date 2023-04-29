const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).json({
        'message': 'hello!'
    })
});

router.get('/:id', (req, res) => {
    res.send(`Hello, ${req.params.id}!`);
    console.log(req.params, req.query);
});

module.exports = router;