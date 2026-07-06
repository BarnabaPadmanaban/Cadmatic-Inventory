const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error && result.error.code !== 'ENOENT') {
  throw result.error;
}

const requiredVars = [
  'DB_SERVER',
  'DB_PORT',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD',
  'CLIENT_URL',
  'JWT_SECRET',
];

const missing = requiredVars.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Ensure a sensible default for NODE_ENV so development fallback logic works
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  DB_SERVER: process.env.DB_SERVER,
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 1433,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_ENCRYPT: process.env.DB_ENCRYPT === 'true',
  DB_TRUST_SERVER_CERTIFICATE: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
};
