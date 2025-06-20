const knex = require('knex')
require('dotenv').config()

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
  },
  pool: {
    min: 2,
    max: 10
  }
})

module.exports = db