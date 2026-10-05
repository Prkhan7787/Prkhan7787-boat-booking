require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./config/database');
const { authenticate, requireAdmin, requireOwner, requireCustomer, optionalAuthenticate } = require('./middleware/auth.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured. Copy backend/.env.example to backend/.env.');
const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000').split(',').map(s => s.trim());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('This website is not allowed to access the API.')); } }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (status, message) => Object.assign(new Error(message), { status });
const positiveInt = value => Number.isInteger(Number(value)) && Number(value) > 0;
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const dateValid = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === value;
};
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ success: true, message: 'Boat Booking API is running' });
}));

app.post('/api/auth/register', asyncRoute(async (req,res)=>{
  const { name, email, phone, password, role } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) throw fail(400,'Enter your full name.');
  if (!emailValid(email)) throw fail(400,'Enter a valid email address.');
  if (typeof phone !== 'string' || !/^\+?[0-9\s()-]{7,20}$/.test(phone.trim())) throw fail(400,'Enter a valid phone number.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) throw fail(400,'Password must be at least 8 characters.');
  if (!['customer','boat_owner'].includes(role)) throw fail(400,'Choose a valid account type.');
  const hashed=await bcrypt.hash(password,12);
  const {rows}=await pool.query('INSERT INTO users(name,email,phone,password,role) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role',[name.trim(),email.toLowerCase().trim(),phone.trim(),hashed,role]);
  ok(res,rows[0],201);
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!emailValid(email) || typeof password !== 'string' || !password) throw fail(400, 'Enter a valid email and password.');
  const { rows } = await pool.query('SELECT id, name, email, phone, password, role FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) throw fail(401, 'Email or password is incorrect.');
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  ok(res, { token, user: { id: user.id, name: user.name, email: user.email, phone:user.phone, role: user.role } });
}));

app.get('/api/boats', asyncRoute(async (req, res) => {
  const { from, to, date, passengers, type, maxPrice, search } = req.query;
  const clauses = ["status = 'active'"]; const values = [];
  const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
  if (from) add('LOWER(departure_port) = LOWER(?)', from);
  if (to) add('LOWER(destination) = LOWER(?)', to);
  if (type && type !== 'all') add('type = ?', type);
  if (maxPrice && Number.isFinite(Number(maxPrice))) add('price <= ?', Number(maxPrice));
  if (search) { values.push(`%${String(search).slice(0, 80)}%`); clauses.push(`(name ILIKE $${values.length} OR departure_port ILIKE $${values.length} OR destination ILIKE $${values.length})`); }
  const dateParam = date && dateValid(date) ? (values.push(date), `$${values.length}`) : 'NULL::date';
  if(dateParam!=='NULL::date')clauses.push(`(b.service_date IS NULL OR b.service_date=${dateParam})`);
  if(passengers&&positiveInt(passengers)){
    values.push(Number(passengers));
    clauses.push(dateParam==='NULL::date'?`b.available_seats >= $${values.length}`:`GREATEST(b.capacity-COALESCE((SELECT SUM(x.total_passengers) FROM bookings x WHERE x.boat_id=b.id AND x.travel_date=${dateParam} AND x.status<>'cancelled'),0),0) >= $${values.length}`);
  }
  const { rows } = await pool.query(`SELECT b.*, CASE WHEN ${dateParam} IS NULL THEN b.available_seats ELSE GREATEST(b.capacity-COALESCE((SELECT SUM(x.total_passengers) FROM bookings x WHERE x.boat_id=b.id AND x.travel_date=${dateParam} AND x.status<>'cancelled'),0),0)::int END AS available_seats FROM boats b WHERE ${clauses.join(' AND ')} ORDER BY b.featured DESC, b.price ASC`, values);
  ok(res, rows);
}));

app.get('/api/boats/:id', asyncRoute(async (req, res) => {
  const date = dateValid(req.query.date) ? req.query.date : null;
  const { rows } = await pool.query(`SELECT b.*,CASE WHEN $2::date IS NULL THEN b.available_seats ELSE GREATEST(b.capacity-COALESCE((SELECT SUM(x.total_passengers) FROM bookings x WHERE x.boat_id=b.id AND x.travel_date=$2 AND x.status<>'cancelled'),0),0)::int END AS available_seats FROM boats b WHERE b.id=$1 AND (b.service_date IS NULL OR $2::date IS NULL OR b.service_date=$2)`, [req.params.id,date]);
  if (!rows[0]) throw fail(404, 'Boat not found.');
  ok(res, rows[0]);
}));

const boatFields = ['name','type','description','image','capacity','speed','departure_port','destination','departure_time','arrival_time','duration','price','available_seats','amenities','status'];
function normalizeBoat(body, partial = false) {
  const data = {};
  for (const key of boatFields) if (body[key] !== undefined) data[key] = body[key];
  if (!partial && boatFields.some(k => data[k] === undefined)) throw fail(400, 'Complete all required boat fields.');
  for (const field of ['capacity','available_seats']) if (data[field] !== undefined && !positiveInt(data[field])) throw fail(400, `${field} must be a positive whole number.`);
  if (data.price !== undefined && (!Number.isFinite(Number(data.price)) || Number(data.price) <= 0)) throw fail(400, 'Price must be greater than zero.');
  if (data.capacity !== undefined && data.available_seats !== undefined && Number(data.available_seats) > Number(data.capacity)) throw fail(400, 'Available seats cannot exceed capacity.');
  if (data.status !== undefined && !['active','inactive'].includes(data.status)) throw fail(400, 'Status must be active or inactive.');
  if (data.amenities !== undefined) data.amenities = Array.isArray(data.amenities) ? data.amenities : String(data.amenities).split(',').map(x => x.trim()).filter(Boolean);
  return data;
}

app.post('/api/boats', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const data = normalizeBoat(req.body);
  const cols = Object.keys(data); const vals = cols.map(k => data[k]);
  const { rows } = await pool.query(`INSERT INTO boats (${cols.join(',')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`, vals);
  ok(res, rows[0], 201);
}));
app.put('/api/boats/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const data = normalizeBoat(req.body || {}, true); const cols = Object.keys(data);
  if (!cols.length) throw fail(400, 'Provide at least one field to update.');
  const vals = cols.map(k => data[k]); vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE boats SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) throw fail(404, 'Boat not found.'); ok(res, rows[0]);
}));
app.delete('/api/boats/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM boats WHERE id=$1', [req.params.id]);
  if (!rowCount) throw fail(404, 'Boat not found.'); ok(res, { message: 'Boat deleted.' });
}));
app.get('/api/admin/boats', authenticate, requireAdmin, asyncRoute(async (req,res)=>{
  const { rows } = await pool.query('SELECT * FROM boats ORDER BY created_at DESC'); ok(res, rows);
}));

function normalizeOwnerBoat(body, partial=false) {
  const ownerBody={...body};
  if(!partial&&ownerBody.available_seats===undefined)ownerBody.available_seats=ownerBody.capacity;
  const data=normalizeBoat(ownerBody,partial);
  if(!partial && (!dateValid(body.service_date) || !body.contact_phone?.trim())) throw fail(400,'Enter a service date and contact phone number.');
  if(body.service_date!==undefined){if(!dateValid(body.service_date)||body.service_date<new Date().toISOString().slice(0,10))throw fail(400,'Choose a valid service date.');data.service_date=body.service_date}
  if(body.contact_phone!==undefined){if(!/^\+?[0-9\s()-]{7,20}$/.test(String(body.contact_phone).trim()))throw fail(400,'Enter a valid contact phone number.');data.contact_phone=String(body.contact_phone).trim()}
  return data;
}
app.get('/api/owner/boats',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query('SELECT * FROM boats WHERE owner_id=$1 ORDER BY created_at DESC',[req.user.id]);ok(res,rows);
}));
app.post('/api/owner/boats',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const data=normalizeOwnerBoat(req.body);data.available_seats=Number(data.capacity);data.owner_id=req.user.id;
  const cols=Object.keys(data),vals=cols.map(k=>data[k]);
  const {rows}=await pool.query(`INSERT INTO boats (${cols.join(',')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,vals);ok(res,rows[0],201);
}));
app.get('/api/owner/boats/:id',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query('SELECT * FROM boats WHERE id=$1 AND owner_id=$2',[req.params.id,req.user.id]);if(!rows[0])throw fail(404,'Boat not found.');ok(res,rows[0]);
}));
app.put('/api/owner/boats/:id',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const data=normalizeOwnerBoat(req.body||{},true),cols=Object.keys(data);if(!cols.length)throw fail(400,'Provide at least one field to update.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const owned=await client.query('SELECT id FROM boats WHERE id=$1 AND owner_id=$2 FOR UPDATE',[req.params.id,req.user.id]);
    if(!owned.rows[0])throw fail(404,'Boat not found.');
    if(data.capacity!==undefined){const booked=await client.query("SELECT COALESCE(MAX(total),0)::int AS maximum FROM (SELECT SUM(total_passengers) AS total FROM bookings WHERE boat_id=$1 AND status<>'cancelled' GROUP BY travel_date) trips",[req.params.id]);if(Number(data.capacity)<booked.rows[0].maximum)throw fail(409,'Capacity cannot be lower than already booked passengers.');}
    if(data.service_date!==undefined){const incompatible=await client.query("SELECT 1 FROM bookings WHERE boat_id=$1 AND status<>'cancelled' AND travel_date<>$2 LIMIT 1",[req.params.id,data.service_date]);if(incompatible.rowCount)throw fail(409,'The service date cannot change while bookings exist on other dates.');}
    const vals=cols.map(k=>data[k]);vals.push(req.params.id,req.user.id);
    const {rows}=await client.query(`UPDATE boats SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${vals.length-1} AND owner_id=$${vals.length} RETURNING *`,vals);
    await client.query('COMMIT');ok(res,rows[0]);
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}));
app.delete('/api/owner/boats/:id',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT id FROM boats WHERE id=$1 AND owner_id=$2 FOR UPDATE',[req.params.id,req.user.id]);
    if(!rows[0])throw fail(404,'Boat not found.');
    const {rows:bookings}=await client.query("SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE status IN ('pending','confirmed'))::int AS active FROM bookings WHERE boat_id=$1",[req.params.id]);
    if(bookings[0].active>0)throw fail(409,'This boat has active bookings and cannot be deleted.');
    if(bookings[0].count>0){await client.query("UPDATE boats SET status='inactive' WHERE id=$1",[req.params.id]);await client.query('COMMIT');return ok(res,{message:'Boat disabled because its booking history must be kept.'})}
    await client.query('DELETE FROM boats WHERE id=$1',[req.params.id]);await client.query('COMMIT');ok(res,{message:'Boat deleted.'});
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}));
app.get('/api/owner/bookings',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query(`SELECT b.id,b.booking_code,b.travel_date,b.total_passengers,b.total_price,b.status,boat.name AS boat_name,boat.departure_time,boat.departure_port,boat.destination,
    COALESCE(json_agg(json_build_object('first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email)) FILTER(WHERE p.id IS NOT NULL),'[]') AS passengers
    FROM bookings b JOIN boats boat ON boat.id=b.boat_id LEFT JOIN passengers p ON p.booking_id=b.id
    WHERE boat.owner_id=$1 GROUP BY b.id,boat.name,boat.departure_time,boat.departure_port,boat.destination ORDER BY b.travel_date DESC`,[req.user.id]);ok(res,rows);
}));
app.get('/api/owner/stats',authenticate,requireOwner,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query(`SELECT COUNT(DISTINCT boat.id)::int AS total_boats,COUNT(DISTINCT b.id)::int AS total_bookings,
    COUNT(DISTINCT b.id) FILTER(WHERE b.status='pending')::int AS pending_bookings,
    COALESCE(SUM(b.total_price) FILTER(WHERE b.status IN ('confirmed','completed')),0)::numeric AS total_revenue
    FROM boats boat LEFT JOIN bookings b ON b.boat_id=boat.id WHERE boat.owner_id=$1`,[req.user.id]);ok(res,rows[0]);
}));

app.get('/api/customer/bookings',authenticate,requireCustomer,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query(`SELECT b.*,boat.name AS boat_name,boat.departure_port,boat.destination,boat.departure_time,
    COALESCE(json_agg(json_build_object('first_name',p.first_name,'last_name',p.last_name)) FILTER(WHERE p.id IS NOT NULL),'[]') AS passengers
    FROM bookings b JOIN boats boat ON boat.id=b.boat_id LEFT JOIN passengers p ON p.booking_id=b.id
    WHERE b.user_id=$1 GROUP BY b.id,boat.name,boat.departure_port,boat.destination,boat.departure_time ORDER BY b.created_at DESC`,[req.user.id]);ok(res,rows);
}));
app.get('/api/admin/users',authenticate,requireAdmin,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query('SELECT id,name,email,phone,role,created_at FROM users ORDER BY created_at DESC');ok(res,rows);
}));

app.post('/api/bookings', optionalAuthenticate, asyncRoute(async (req, res) => {
  const { boatId, travelDate, passengers } = req.body || {};
  if (!positiveInt(boatId) || !dateValid(travelDate) || new Date(`${travelDate}T00:00:00`) < new Date(new Date().toDateString())) throw fail(400, 'Choose a valid boat and a travel date that is today or later.');
  if (!Array.isArray(passengers) || passengers.length < 1 || passengers.length > 10) throw fail(400, 'Add between 1 and 10 passengers.');
  for (const p of passengers) if (!p.firstName?.trim() || !p.lastName?.trim() || !emailValid(p.email) || !/^\+?[0-9\s()-]{7,20}$/.test(p.phone || '') || !p.nationality?.trim()) throw fail(400, 'Please check each passenger’s name, email, phone, and nationality.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT * FROM boats WHERE id=$1 AND status='active' AND (service_date IS NULL OR service_date=$2) FOR UPDATE", [boatId,travelDate]);
    const boat = rows[0]; if (!boat) throw fail(404, 'This boat is not available.');
    const reserved = await client.query("SELECT COALESCE(SUM(total_passengers),0)::int AS count FROM bookings WHERE boat_id=$1 AND travel_date=$2 AND status<>'cancelled'", [boatId,travelDate]);
    const available = Math.max(0, Number(boat.capacity) - reserved.rows[0].count);
    if (passengers.length > available) throw fail(409, `Only ${available} seats are available for this date.`);
    const bookingCode = `BOAT-${travelDate.replaceAll('-','')}-${Date.now().toString().slice(-6)}${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;
    const totalPrice = Number(boat.price) * passengers.length;
    const booking = await client.query("INSERT INTO bookings (booking_code,boat_id,user_id,travel_date,total_passengers,total_price,status) VALUES ($1,$2,$3,$4,$5,$6,'confirmed') RETURNING *", [bookingCode,boatId,req.user?.role==='customer'?req.user.id:null,travelDate,passengers.length,totalPrice]);
    for (const p of passengers) await client.query('INSERT INTO passengers (booking_id,first_name,last_name,email,phone,nationality) VALUES ($1,$2,$3,$4,$5,$6)', [booking.rows[0].id,p.firstName.trim(),p.lastName.trim(),p.email.trim().toLowerCase(),p.phone.trim(),p.nationality.trim()]);
    await client.query('COMMIT'); ok(res, { ...booking.rows[0], boat, passengers }, 201);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.get('/api/bookings', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT b.*, v.name AS boat_name, v.departure_port, v.destination,
    COALESCE(json_agg(json_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'nationality',p.nationality)) FILTER (WHERE p.id IS NOT NULL),'[]') AS passengers
    FROM bookings b JOIN boats v ON v.id=b.boat_id LEFT JOIN passengers p ON p.booking_id=b.id
    GROUP BY b.id,v.name,v.departure_port,v.destination ORDER BY b.created_at DESC`);
  ok(res, rows);
}));
app.get('/api/bookings/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT b.*, v.name AS boat_name,v.departure_port,v.destination,v.departure_time,
    COALESCE(json_agg(json_build_object('first_name',p.first_name,'last_name',p.last_name)) FILTER (WHERE p.id IS NOT NULL),'[]') AS passengers
    FROM bookings b JOIN boats v ON v.id=b.boat_id LEFT JOIN passengers p ON p.booking_id=b.id WHERE b.booking_code=$1 GROUP BY b.id,v.name,v.departure_port,v.destination,v.departure_time`, [req.params.id]);
  if (!rows[0]) throw fail(404, 'Booking not found.'); ok(res, rows[0]);
}));
app.put('/api/bookings/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const status = req.body?.status;
  if (!['pending','confirmed','cancelled','completed'].includes(status)) throw fail(400, 'Choose a valid booking status.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [req.params.id]);
    const b = rows[0]; if (!b) throw fail(404, 'Booking not found.');
    if (b.status === 'cancelled' && status !== 'cancelled') {
      const boat = await client.query('SELECT capacity FROM boats WHERE id=$1 FOR UPDATE', [b.boat_id]);
      const reserved = await client.query("SELECT COALESCE(SUM(total_passengers),0)::int AS count FROM bookings WHERE boat_id=$1 AND travel_date=$2 AND status<>'cancelled'", [b.boat_id,b.travel_date]);
      if (Number(boat.rows[0].capacity)-reserved.rows[0].count < b.total_passengers) throw fail(409, 'There are not enough seats to restore this booking.');
    }
    const updated = await client.query('UPDATE bookings SET status=$1 WHERE id=$2 RETURNING *', [status,b.id]);
    await client.query('COMMIT'); ok(res, updated.rows[0]);
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
app.delete('/api/bookings/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const { rows } = await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[req.params.id]); if(!rows[0]) throw fail(404,'Booking not found.');
    await client.query('DELETE FROM bookings WHERE id=$1',[req.params.id]); await client.query('COMMIT'); ok(res,{message:'Booking deleted.'});
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}));

app.get('/api/passengers', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const q = `%${String(req.query.search || '').slice(0,80)}%`;
  const { rows } = await pool.query(`SELECT p.*,b.booking_code,b.travel_date,b.status,v.name AS boat_name,v.departure_port,v.destination FROM passengers p JOIN bookings b ON b.id=p.booking_id JOIN boats v ON v.id=b.boat_id WHERE p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.email ILIKE $1 OR b.booking_code ILIKE $1 ORDER BY p.id DESC`, [q]); ok(res, rows);
}));
app.get('/api/passengers/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT p.*,b.booking_code,b.travel_date,b.status,v.name AS boat_name FROM passengers p JOIN bookings b ON b.id=p.booking_id JOIN boats v ON v.id=b.boat_id WHERE p.id=$1`, [req.params.id]);
  if (!rows[0]) throw fail(404,'Passenger not found.'); ok(res, rows[0]);
}));
app.get('/api/admin/stats', authenticate, requireAdmin, asyncRoute(async (req,res)=>{
  const { rows } = await pool.query(`SELECT (SELECT COUNT(*) FROM boats) AS total_boats,(SELECT COUNT(*) FROM bookings) AS total_bookings,(SELECT COUNT(*) FROM passengers) AS total_passengers,(SELECT COALESCE(SUM(total_price),0) FROM bookings WHERE status IN ('confirmed','completed')) AS total_revenue,(SELECT COUNT(*) FROM bookings WHERE travel_date=CURRENT_DATE) AS todays_bookings`);
  const daily = await pool.query(`SELECT travel_date::text AS label,COUNT(*)::int AS bookings,COALESCE(SUM(total_price),0)::numeric AS revenue FROM bookings WHERE travel_date >= CURRENT_DATE-6 GROUP BY travel_date ORDER BY travel_date`);
  const routes = await pool.query(`SELECT v.departure_port||' → '||v.destination AS label,COUNT(*)::int AS value FROM bookings b JOIN boats v ON v.id=b.boat_id GROUP BY label ORDER BY value DESC LIMIT 5`);
  ok(res,{...rows[0],daily:daily.rows,routes:routes.rows});
}));

app.use('/api', notFound);
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'..','frontend','index.html')));
app.use(errorHandler);

const server = app.listen(process.env.PORT || 5000, () => console.log(`Boat Booking API listening on ${process.env.PORT || 5000}`));
process.on('SIGTERM', () => server.close(() => pool.end()));
module.exports = app;
