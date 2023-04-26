const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const authRouter = require('./routes/auth');
const auth = require('./middlewares/auth');
require('dotenv').config();

app.use(require('cors')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


app.set('port',process.env.PORT || 3000);

app.use('/auth', authRouter);

app.listen(app.get('port'), () => {
   console.log(`lime-backend is running on port ${app.get('port')}`);
});