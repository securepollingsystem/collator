CREATE SCHEMA sps;
-- \dn list schemas
-- spsdata=> \dt sps.*
--            List of relations
--  Schema |    Name     | Type  | Owner
-- --------+-------------+-------+--------
--  sps    | opinions    | table | jerkey
--  sps    | screedlines | table | jerkey
--  sps    | screeds     | table | jerkey
-- https://www.postgresql.org/docs/current/datatype-numeric.html

CREATE TABLE sps.screeds (
    pubkey      VARCHAR(64) NOT NULL PRIMARY KEY,
    signer_key  VARCHAR(64) NOT NULL,
    sig_expires TIMESTAMPZ NOT NULL,
    modified    TIMESTAMPZ NOT NULL
);

-- SELECT * FROM sps.opinions;
CREATE TABLE sps.opinions (
    id SERIAL PRIMARY KEY,
    opinion TEXT NOT NULL,
    screed_count INTEGER,
    updated_at   TIMESTAMPZ NOT NULL DEFAULT CURRENT_TIMESTAMPZ
);

CREATE TABLE sps.screedlines (
    id SERIAL PRIMARY KEY,
    screed_key VARCHAR(64) NOT NULL,
    opinion_id INTEGER NOT NULL,
    FOREIGN KEY (screed_key) REFERENCES sps.screeds(pubkey),
    FOREIGN KEY (opinion_id) REFERENCES sps.opinions(id)
);

-- This will ensure only one copy of each opinion exists
ALTER TABLE sps.opinions ADD CONSTRAINT unique_opinion UNIQUE (opinion);
