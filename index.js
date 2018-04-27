const express = require('express');
const app = express();
const http = require('http').Server(app);
const ss = require('socket.io-stream');
const path = require('path');
const io = require('socket.io')(http);
const fs = require('fs');
const redis = require("redis");
const client = redis.createClient();

const tmp = __dirname + '/tmp';

app.use(express.static(__dirname + '/public' ));

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.get('/:username/:id', function(req, res){
    //console.log(req.params.username);
    //console.log(req.params.id);
    res.sendFile(path.join(__dirname + '/public/download.html'));
});

io.on('connect', function(socket) {
    socket.on('init', function (session) {
        let username = JSON.parse(session).username;
        client.set(username, socket.id, function(err) {
            if (err) throw err;
            console.log(session);
        });
    });
    socket.on('request_file_meta', function (data) {
        client.get(data.username, function(err, socketId) {
            if (err) throw err;
            data.clientASocketId = socketId;
            data.clientBSocketId = socket.id;
            console.log('sending request meta');
            io.to(socketId).emit('file_request_meta', data);
        });
    });
    socket.on('file_response_meta', function (data) {
        console.log('got response meta');
        io.to(data.req.clientBSocketId).emit('response_file_meta', data);
    });
    socket.on('request_file', function (data) {
        console.log('got file request');
        io.to(data.req.clientASocketId).emit('file_request', data);
    });
    ss(socket).on('file', function(stream, data) {
        console.log(data);
        let filename = tmp + data.req.clientBSocketId + data.ticket.file.name;
        let size = 0;
        stream.on('data', (chunk) => {
            size += chunk.length;
            io.to(data.req.clientBSocketId).emit('response_file', chunk);
            if(size === data.ticket.file.size){
                io.to(data.req.clientBSocketId).emit('file_end', true);
                fs.unlinkSync(filename);
            }
        });
        stream.pipe(fs.createWriteStream(filename));
    });
});

http.listen(80, function(){
    console.log('listening on *:80');
});