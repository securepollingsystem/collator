import express from 'express';
import { createPool, sql } from 'slonik';
import fs from 'fs';
import cors from 'cors';
import sodium from 'libsodium-wrappers';

const allowedOrigins = fs.readFileSync('allowedorigins.url', {encoding: 'utf8'}).split('\n').filter(i => i !== '');
// file full of URLs that are allowed to load from this API, such as http://localhost:8990

const postGresURI = fs.readFileSync('postgres.uri', {encoding: 'utf8'});
// postgresql://user:password@localhost:5432/spsdata
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

  app.use(express.json()); // Add JSON body parsing middleware
  app.post('/upload-screed', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    let rawData = req.body;
    let encoding = req.headers['content-encoding'];
    let dataBuffer;
    if (encoding === 'gzip') {
      const { gunzipSync } = await import('zlib');
      try {
        dataBuffer = gunzipSync(rawData);
        logAccess(req, 'Received gzip upload');
      } catch (err) {
        logAccess(req, 'Failed to decompress gzip upload');
        return res.status(400).json({ error: 'Invalid gzip data' });
      }
    } else {
      dataBuffer = rawData;
      logAccess(req, 'Received raw upload');
    }
    if (Buffer.isBuffer(dataBuffer)) {
      console.log('upload-screed (buffer):', dataBuffer.toString());
    } else {
      console.log('upload-screed (non-buffer):', typeof dataBuffer, JSON.stringify(dataBuffer));
      if (typeof dataBuffer === 'object' && dataBuffer !== null) {
        const screedIsSigned = await verifyScreedSignature(dataBuffer);
        console.log('verifyScreedSignature:', screedIsSigned);
        if (screedIsSigned) {
          console.log('storeScreed:',storeScreed(dataBuffer));
        }
      }
    }
    res.json({ status: 'success', bytesReceived: dataBuffer.length });
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  });

  async function storeScreed(signedScreedObject) {
    const sqlString = sql.unsafe`
      INSERT INTO sps.screeds (pubkey, signer_key, sig_expires, modified)
      VALUES (
        ${signedScreedObject.publicKey},
        ${'signer_key'},
        TO_TIMESTAMP(${1758394589}),
        NOW()
      )
      ON CONFLICT (pubkey)
      DO UPDATE SET modified = NOW()
    `; // EXCLUDED.signer_key means the value that was attempted to be inserted into signer_key
    const response = await pool.any(sqlString);
    return response;
  };
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

async function verifyScreedSignature({ screed, signature, publicKey }) {
  await sodium.ready;
  //console.log('verifyScreedSignature:', { screed, signature, publicKey });
  try {
    const msgUint8 = sodium.from_string(screed);
    let sigUint8;
    try {
      sigUint8 = sodium.from_base64(signature, sodium.base64_variants.URLSAFE_NO_PADDING); // default variant
    } catch (e) {
      console.error('Signature base64 decode failed:', e);
      return false;
    }
    const pubKeyUint8 = sodium.from_hex(publicKey);
    return sodium.crypto_sign_verify_detached(sigUint8, msgUint8, pubKeyUint8);
  } catch (e) {
    console.error('Signature verification failed:', e);
    return false;
  }
}

main();
