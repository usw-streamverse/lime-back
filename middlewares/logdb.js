const fs = require('fs');
const db = require('../db/db.js');
const schedule = require('node-schedule');

let today = new Date();   
let year = today.getFullYear(); // 년도
let month = today.getMonth() + 1;  // 월
if(month/10 < 1){
    month = '0' + month 
}
let date = today.getDate();  // 날짜
let day = year  + '-' + month + '-' + (String(date).padStart(2, "0")); // date는 실행일 기준 -1해야함.


fs.readFile(`../logs/${day}.log`, 'utf-8',function(err, data) {
    let login = 0;
    let register = 0;
    let users = 0
    let upload = 0
    if(data){
        let array = fs.readFileSync(`../logs/${day}.log`).toString().split('\n');
        for(i in array){
            if(array[i].includes('login')){
                login = login + 1 
            }
            else if(array[i].includes('register')){
                register = register + 1
            }
            else if(array[i].includes('/users/profile')){
                users = users + 1
            }
            else if(array[i].includes('upload')){
                upload = upload + 1
            }
        }
        console.log(login + '/' + register + '/' + users + '/' + upload + '/' + ((array.length - 1)/ 2))
        db.query('INSERT INTO infra_data (login,register,used_site,upload_video,requst) VALUES (?,?,?,?,?);', [login,register,users,upload,((array.length - 1)/ 2)], 
        (error, result) => {
            if(error) throw error;
            if(result){
                console.log('success')
            }
        });
    }
});

// var j = schedule.scheduleJob('0 0 * * *', function(){
//     console.log('매일 00시에 00분에 실행함.');
// });



// module.exports = { j }
