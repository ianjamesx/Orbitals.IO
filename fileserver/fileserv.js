
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {

    res.sendFile(__dirname + '/client/index.html');

});

app.get('/contact', function(req, res) {

    res.sendFile(__dirname + '/subdomains/contact.html');

});

app.use('/client', express.static(__dirname + '/client'));

app.use('/subdomains', express.static(__dirname + '/subdomains'));

serv.listen(9000);

console.log('file server online');
