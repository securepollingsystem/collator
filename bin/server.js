#!/usr/bin/env nodejs


const fs = require('fs');
const http = require('http');


var settings = require('../settings.js');


function startServer() {

  const knex = require('knex')({
    client: 'sqlite3', // or 'better-sqlite3'
    connection: {
      filename: './db/main.sqlite',
    },
  });



  const server = http.createServer((req, res) => {
    res.statusCode = 200;
  
    res.setHeader('Content-Type', 'text/plain');  

    res.end('Hello, World!');
  });

  server.listen(settings.port, settings.hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

