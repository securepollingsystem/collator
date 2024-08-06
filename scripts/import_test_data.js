#!/usr/bin/env node


const knex = require('knex')({
  client: 'sqlite3', // or 'better-sqlite3'
  connection: {
    filename: '../db/main.db',
  },
});

// https://knexjs.org/guide/query-builder.html#insert


knex.schema.createTable('opinions', function (table) {
  table.increments();   // https://knexjs.org/guide/schema-builder.html#increments
  table.string('content');
  table.bigint('count');
  table.timestamps();
});
