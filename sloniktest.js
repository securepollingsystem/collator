import express from 'express';
import { createPool, sql } from 'slonik';
import fs from 'fs';
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:8990',
  'http://localhost:5173',
  'http://10.0.0.8:8990', // wow don't leave a trailing / or it wont work!
  'http://demo.securepollingsystem.org',
  'https://demo.securepollingsystem.org',
  'http://demo.securepollingsystem.com',
  'https://demo.securepollingsystem.com'
];

var postGresURI = fs.readFileSync('postgres.uri', {encoding: 'utf8'});
// postgresql://[user[:password]@][host[:port]][/database name][?name=value[&...]]

const main = async () => {
  const pool = await createPool(postGresURI);

  const app = express();
  const port = 8993;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('disallowed by cors'));
      }
    },
    credentials: true
  }));

  app.get('/', (req, res) => {
    res.send('Hello, World!')
    logAccess(req,'');
  });

  app.get('/opinions', async (req, res) => {
    var opinions = 'unpopulated';
    var sqlString = 'unpopulated';
    if ( req.query.subset ) {
      sqlString = sql.unsafe`SELECT * FROM sps.opinions WHERE OPINION ILIKE ${req.query.subset}`;
      opinions = await pool.any(sqlString);
      logAccess(req,'Safe subset query: '+sqlString.values+' returned this many items: '+opinions.length);
    } else {
      opinions = await pool.any(sql.unsafe`SELECT * FROM sps.opinions`);
      logAccess(req,'');
    }
    const stringResponse = JSON.stringify(opinions); // , (key, value) => typeof value === 'bigint' ? value.toString() : value);  // https://github.com/GoogleChromeLabs/jsbi/issues/30
    res.setHeader('Content-Type', 'application/json'); // https://stackoverflow.com/questions/19696240/proper-way-to-return-json-using-node-or-express
    res.json(opinions);
  });

  app.get('/ipv4', (req, res) => {
    console.log(req);
    return res.json({ message: `Hello! Your IP address is: ${logAccess(req,'')}` });
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  });
};

function logAccess(req, addlInfo) {
  //const ip = req.ip; // https://stackoverflow.com/questions/29411551/express-js-req-ip-is-returning-ffff127-0-0-1
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // https://stackoverflow.com/a/39473073
  if (ip.substr(0, 7) == "::ffff:") {
    ip = ip.substr(7)
  }
  console.log(Date().slice(0,24),ip, 'asks for',req.url,'using',req.headers['user-agent'],addlInfo);
  return ip;
}

main();
