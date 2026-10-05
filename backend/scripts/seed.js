require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const boats = [
  ['Andaman Pearl','Ferry','A relaxed, spacious ride with shaded seating and open sea views.','https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=85',120,'28 knots','Phuket','Phi Phi Islands','08:30','10:00','1h 30m',950,120,['Air conditioning','Snacks','Life jackets'],true],
  ['Bluefin Express','Speedboat','A fast island hop with a friendly local crew.','https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1000&q=85',24,'42 knots','Phuket','Phi Phi Islands','09:15','10:05','50 min',1450,24,['Snorkel gear','Drinking water','Life jackets'],true],
  ['Lanta Breeze','Ferry','A comfortable coastal crossing with room to stretch out.','https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85',90,'24 knots','Krabi','Koh Lanta','10:00','11:30','1h 30m',780,90,['Air conditioning','Cafe','Life jackets'],true],
  ['Samui Star','Catamaran','Smooth sailing aboard a modern, stable catamaran.','https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85',48,'30 knots','Koh Samui','Koh Tao','08:00','10:00','2h',1250,48,['Outdoor deck','Wifi','Life jackets'],true],
  ['Tao Longtail','Longtail','A small-group traditional boat for a slower sea day.','https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85',10,'18 knots','Koh Samui','Koh Tao','11:00','13:20','2h 20m',900,10,['Local guide','Shade canopy','Life jackets'],false]
];

(async()=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const adminEmail=(process.env.ADMIN_EMAIL||'admin@boatbooking.demo').toLowerCase();
    const adminPassword=process.env.ADMIN_PASSWORD;
    const ownerEmail=(process.env.OWNER_EMAIL||'owner@boatbooking.demo').toLowerCase();
    const ownerPassword=process.env.OWNER_PASSWORD;
    if(!adminPassword||adminPassword.length<12)throw new Error('Set ADMIN_PASSWORD to at least 12 characters before seeding.');
    if(!ownerPassword||ownerPassword.length<12)throw new Error('Set OWNER_PASSWORD to at least 12 characters before seeding.');
    const adminHash=await bcrypt.hash(adminPassword,12),ownerHash=await bcrypt.hash(ownerPassword,12);
    await client.query("INSERT INTO users(name,email,password,role) VALUES('ผู้ดูแลระบบตัวอย่าง',$1,$2,'admin') ON CONFLICT(email) DO NOTHING",[adminEmail,adminHash]);
    const adminCheck=await client.query('SELECT role FROM users WHERE email=$1',[adminEmail]);
    if(adminCheck.rows[0]?.role!=='admin')throw new Error('ADMIN_EMAIL is already used by a non-admin account. Choose a different seed email.');
    await client.query("INSERT INTO users(name,email,phone,password,role) VALUES('ผู้ให้เช่าเรือตัวอย่าง',$1,'+66 80 000 0000',$2,'boat_owner') ON CONFLICT(email) DO NOTHING",[ownerEmail,ownerHash]);
    const ownerResult=await client.query('SELECT id,role FROM users WHERE email=$1',[ownerEmail]);
    if(ownerResult.rows[0]?.role!=='boat_owner')throw new Error('OWNER_EMAIL is already used by a non-owner account. Choose a different seed email.');
    const ownerId=ownerResult.rows[0].id,inserted=[];
    for(const b of boats){
      const existing=await client.query('SELECT id,owner_id FROM boats WHERE name=$1 ORDER BY id LIMIT 1',[b[0]]);
      if(existing.rows[0]){
        const r=await client.query('UPDATE boats SET owner_id=COALESCE(owner_id,$1) WHERE id=$2 RETURNING *',[ownerId,existing.rows[0].id]);inserted.push(r.rows[0]);
      }else{
        const r=await client.query(`INSERT INTO boats(name,type,description,image,capacity,speed,departure_port,destination,departure_time,arrival_time,duration,price,available_seats,amenities,status,featured,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16) RETURNING *`,[...b.slice(0,13),b[13],b[14],ownerId]);inserted.push(r.rows[0]);
      }
    }
    const bookingCount=await client.query('SELECT COUNT(*)::int AS count FROM bookings');
    if(bookingCount.rows[0].count===0){
      const today=new Date();
      for(let i=0;i<10;i++){
        const boat=inserted[i%inserted.length],dateObject=new Date(today);dateObject.setDate(dateObject.getDate()+i+1);
        const date=dateObject.toISOString().slice(0,10),count=i%3+1,code=`BOAT-${date.replaceAll('-','')}-${String(i+1).padStart(4,'0')}`;
        const status=['confirmed','confirmed','pending','completed'][i%4];
        const booking=await client.query('INSERT INTO bookings(booking_code,boat_id,travel_date,total_passengers,total_price,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[code,boat.id,date,count,Number(boat.price)*count,status]);
        for(let j=0;j<count;j++)await client.query('INSERT INTO passengers(booking_id,first_name,last_name,email,phone,nationality) VALUES($1,$2,$3,$4,$5,$6)',[booking.rows[0].id,['Ava','Noah','Mia','Leo','Ivy'][i%5],`Guest${j+1}`,`guest${i+1}${j+1}@example.test`,`+66 80 000 ${String(i*10+j).padStart(4,'0')}`,'Thailand']);
      }
    }
    await client.query('COMMIT');
    console.log(`Demo seed is ready. Admin: ${adminEmail}; Boat owner: ${ownerEmail}. Existing bookings were preserved.`);
  }catch(error){await client.query('ROLLBACK');console.error('Seed failed:',error.message);process.exitCode=1}
  finally{client.release();await pool.end()}
})();
