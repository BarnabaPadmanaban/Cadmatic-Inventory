const sql = require('mssql');
const env = require('./env');

const dbConfig = {
  server: env.DB_SERVER,
  port: env.DB_PORT,
  database: env.DB_DATABASE,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;

const getPool = async () => {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to Microsoft SQL Server');
  }
  return pool;
};

const closePool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
};

module.exports = { sql, getPool, closePool, dbConfig };
