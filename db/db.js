const mysql = require('mysql');
const fs = require('fs');

const config = {
    host: 'limesv-database.mysql.database.azure.com',
    user: 'limesv_admin',
    password: 'Universe18017',
    database: 'lime_db',
    port: 3306,
    ssl: {ca: fs.readFileSync(`${__dirname}/DigiCertGlobalRootCA.crt.pem`)}
}

const conn = new mysql.createConnection(config);

conn.connect(
    function (err) { 
    if (err) { 
        console.log("!!! Cannot connect !!! Error:");
        throw err;
    }
    else
    {
        console.log("Connection established.");
    }
});

module.exports = conn;