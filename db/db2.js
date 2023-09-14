const mysql = require('mysql2/promise');
const fs = require('fs');

const config = {
    connectionLimit: 10,
    host: 'svlime-database.mysql.database.azure.com',
    user: 'lime_admin',
    password: 'Suwon18017',
    database: 'lime_db',
    port: 3306,
    ssl: {ca: fs.readFileSync(`${__dirname}/DigiCertGlobalRootCA.crt.pem`)}
}

const conn = mysql.createPool(config);

module.exports = conn;