require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
(async()=>{try{const schema=fs.readFileSync(path.join(__dirname,'..','..','database','schema.sql'),'utf8');const migration=fs.readFileSync(path.join(__dirname,'..','migrations','001_owner_accounts.sql'),'utf8');await pool.query(schema);await pool.query(migration);console.log('Database schema and owner migration are ready. Existing data was preserved.')}catch(e){console.error('Database setup failed:',e.message);process.exitCode=1}finally{await pool.end()}})();
