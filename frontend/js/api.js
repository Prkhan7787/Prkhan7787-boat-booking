const BOAT_STORAGE_KEY = 'boatBooking.boats.v1';
const BOOKING_STORAGE_KEY = 'boatBookings';
const LEGACY_BOOKING_STORAGE_KEY = 'boatBooking.bookings.v1';
const sampleBoats = [
  {id:'sample-andaman-pearl',name:'Andaman Pearl',type:'Ferry',description:'เดินทางอย่างผ่อนคลายในห้องโดยสารกว้างขวาง พร้อมที่นั่งในร่มและวิวทะเล',image:'https://images.unsplash.com/photo-1586273202219-b748ea4db9b4?auto=format&fit=crop&w=1000&q=85',capacity:120,available_seats:120,departure_port:'ภูเก็ต',destination:'หมู่เกาะพีพี',departure_time:'08:30',arrival_time:'10:00',duration:'1 ชม. 30 นาที',price:950,amenities:['เครื่องปรับอากาศ','ของว่าง','เสื้อชูชีพ'],status:'active',featured:true},
  {id:'sample-bluefin-express',name:'Bluefin Express',type:'Speedboat',description:'เดินทางระหว่างเกาะอย่างรวดเร็ว พร้อมดูแลโดยลูกเรือท้องถิ่นที่เป็นกันเอง',image:'https://images.unsplash.com/photo-1505138180678-276b60fcbc4a?auto=format&fit=crop&w=1000&q=85',capacity:24,available_seats:24,departure_port:'ภูเก็ต',destination:'หมู่เกาะพีพี',departure_time:'09:15',arrival_time:'10:05',duration:'50 นาที',price:1450,amenities:['อุปกรณ์ดำน้ำตื้น','น้ำดื่ม','เสื้อชูชีพ'],status:'active',featured:true},
  {id:'sample-lanta-breeze',name:'Lanta Breeze',type:'Ferry',description:'เดินทางเลียบชายฝั่งอย่างสะดวกสบาย พร้อมพื้นที่นั่งพักผ่อน',image:'https://images.unsplash.com/photo-1586273202219-b748ea4db9b4?auto=format&fit=crop&w=1000&q=85',capacity:90,available_seats:90,departure_port:'กระบี่',destination:'เกาะลันตา',departure_time:'10:00',arrival_time:'11:30',duration:'1 ชม. 30 นาที',price:780,amenities:['เครื่องปรับอากาศ','คาเฟ่','เสื้อชูชีพ'],status:'active'},
  {id:'sample-samui-star',name:'Samui Star',type:'Catamaran',description:'ล่องเรืออย่างนุ่มนวลบนเรือคาตามารันทันสมัยที่มั่นคง',image:'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1000&q=85',capacity:48,available_seats:48,departure_port:'เกาะสมุย',destination:'เกาะเต่า',departure_time:'08:00',arrival_time:'10:00',duration:'2 ชั่วโมง',price:1250,amenities:['ดาดฟ้ากลางแจ้ง','Wi-Fi','เสื้อชูชีพ'],status:'active'},
  {id:'sample-tao-longtail',name:'Tao Longtail',type:'Longtail',description:'สัมผัสการเดินทางแบบสบาย ๆ บนเรือท้องถิ่นสำหรับกลุ่มเล็ก',image:'https://images.unsplash.com/photo-1707219155068-5707b1db249f?auto=format&fit=crop&w=1000&q=85',capacity:10,available_seats:10,departure_port:'เกาะสมุย',destination:'เกาะเต่า',departure_time:'11:00',arrival_time:'13:20',duration:'2 ชม. 20 นาที',price:900,amenities:['ไกด์ท้องถิ่น','หลังคากันแดด','เสื้อชูชีพ'],status:'active'}
];
const readStored = key => { try { const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } };
const writeStored = (key,value) => localStorage.setItem(key,JSON.stringify(value));
const storedBoats = () => readStored(BOAT_STORAGE_KEY);
function storedBookings(){
  const current=localStorage.getItem(BOOKING_STORAGE_KEY);
  if(current!==null)return readStored(BOOKING_STORAGE_KEY);
  const legacy=readStored(LEGACY_BOOKING_STORAGE_KEY).map(old=>{
    const boat=allBoats().find(item=>String(item.id)===String(old.boat_id));
    const date=old.travel_date||'';
    const bookingNumber=old.booking_code||old.id||'';
    return {id:bookingNumber,bookingNumber,boatId:old.boat_id,boatName:old.boat_name||boat?.name||'ไม่พบชื่อเรือ',boatImage:boat?.image||'',price:Number(old.total_price||0)/Math.max(1,Number(old.total_passengers||1)),customerName:old.booker_name||old.passengers?.[0]?.first_name||'',phone:old.phone||old.passengers?.[0]?.phone||'',bookingDate:date,bookingTime:old.time||old.departure_time||'',passengerCount:Number(old.total_passengers||1),note:old.notes||'',status:old.status==='cancelled'||old.status==='ยกเลิกแล้ว'?'ยกเลิกแล้ว':'จองแล้ว',createdAt:old.created_at||new Date().toISOString()};
  });
  writeStored(BOOKING_STORAGE_KEY,legacy);
  return legacy;
}
const allBoats = () => [...sampleBoats,...storedBoats()];
function boatAvailability(boat,date){const used=storedBookings().filter(b=>String(b.boatId??b.boat_id)===String(boat.id)&&(b.bookingDate??b.travel_date)===date&&!['ยกเลิกแล้ว','cancelled'].includes(b.status)).reduce((sum,b)=>sum+Number(b.passengerCount??b.total_passengers??0),0);return {...boat,available_seats:Math.max(0,Number(boat.capacity)-used)}}
function localizeApiMessage(message){return message||'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'}
async function api(path,options={}){
  const method=(options.method||'GET').toUpperCase(),url=new URL(path,location.origin),pathname=url.pathname.replace(/^\/api/,'');
  if(pathname==='/boats'&&method==='GET'){
    let boats=allBoats().filter(b=>b.status!=='inactive').map(b=>boatAvailability(b,url.searchParams.get('date')||''));
    const from=url.searchParams.get('from'),to=url.searchParams.get('to'),type=url.searchParams.get('type'),passengers=Number(url.searchParams.get('passengers')||0),maxPrice=Number(url.searchParams.get('maxPrice')||0),search=(url.searchParams.get('search')||'').toLocaleLowerCase('th');
    if(from)boats=boats.filter(b=>b.departure_port===from||b.service_location===from);
    if(to)boats=boats.filter(b=>b.destination===to||b.service_location===to);
    if(type&&type!=='all')boats=boats.filter(b=>b.type===type);
    if(maxPrice)boats=boats.filter(b=>Number(b.price)<=maxPrice);
    if(passengers)boats=boats.filter(b=>b.available_seats>=passengers);
    if(search)boats=boats.filter(b=>`${b.name} ${b.departure_port} ${b.destination} ${b.service_location||''} ${b.description}`.toLocaleLowerCase('th').includes(search));
    return boats;
  }
  const boatMatch=pathname.match(/^\/boats\/([^/]+)$/);
  if(boatMatch&&method==='GET'){const boat=allBoats().find(b=>String(b.id)===decodeURIComponent(boatMatch[1]));if(!boat)throw new Error('ไม่พบข้อมูลเรือ');return boatAvailability(boat,url.searchParams.get('date')||'')}
  if(pathname==='/boats'&&method==='POST'){
    let body;try{body=JSON.parse(options.body||'{}')}catch{throw new Error('ข้อมูลเรือไม่ถูกต้อง')}
    const name=String(body.name||'').trim(),image=String(body.image||'').trim(),type=String(body.type||'').trim(),capacity=Number(body.capacity),price=Number(body.price),description=String(body.description||'').trim(),location=String(body.service_location||body.location||'').trim(),phone=String(body.contact_phone||'').trim();
    if(!name||!type||!description||!location||!/^\+?[0-9\s()-]{7,20}$/.test(phone)||!Number.isInteger(capacity)||capacity<1||!Number.isFinite(price)||price<=0)throw new Error('กรุณากรอกข้อมูลเรือให้ครบและถูกต้อง');
    if(image&&!/^https?:\/\//i.test(image))throw new Error('ลิงก์รูปภาพต้องขึ้นต้นด้วย http:// หรือ https://');
    const boat={id:`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,type,description,image:image||'https://images.unsplash.com/photo-1505138180678-276b60fcbc4a?auto=format&fit=crop&w=1000&q=85',capacity,available_seats:capacity,price,service_location:location,departure_port:location,destination:location,contact_phone:phone,departure_time:'ไม่ระบุ',arrival_time:'',duration:'',amenities:[],status:'active',featured:false,created_at:new Date().toISOString()};
    const boats=storedBoats();boats.unshift(boat);writeStored(BOAT_STORAGE_KEY,boats);return boat;
  }
  if(pathname==='/bookings'&&method==='POST'){
    let body;try{body=JSON.parse(options.body||'{}')}catch{throw new Error('ข้อมูลการจองไม่ถูกต้อง')}
    const boat=allBoats().find(b=>String(b.id)===String(body.boatId)),travelDate=String(body.travelDate||''),count=Number(body.passengerCount||body.passengers?.length||1),bookerName=String(body.bookerName||body.name||'').trim(),phone=String(body.phone||'').trim();
    if(!boat||boat.status==='inactive')throw new Error('ไม่พบเรือที่เลือก');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)||travelDate<new Date().toISOString().slice(0,10))throw new Error('กรุณาเลือกวันที่เดินทางให้ถูกต้อง');
    if(!bookerName||!/^\+?[0-9\s()-]{7,20}$/.test(phone)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time||''))||!Number.isInteger(count)||count<1)throw new Error('กรุณาตรวจสอบชื่อ เบอร์โทรศัพท์ เวลา และจำนวนผู้โดยสาร');
    const available=boatAvailability(boat,travelDate).available_seats;if(count>available)throw new Error(`วันเดินทางนี้เหลือที่นั่ง ${available} ที่`);
    const bookings=storedBookings(),dateCode=travelDate.replaceAll('-',''),sequence=bookings.filter(item=>item.bookingDate===travelDate).length+1,bookingNumber=`BK-${dateCode}-${String(sequence).padStart(3,'0')}`;
    const booking={id:bookingNumber,bookingNumber,boatId:boat.id,boatName:boat.name,boatImage:boat.image,price:Number(boat.price),customerName:bookerName,phone,bookingDate:travelDate,bookingTime:body.time||boat.departure_time,passengerCount:count,note:String(body.notes||'').trim(),status:'จองแล้ว',createdAt:new Date().toISOString()};
    bookings.unshift(booking);writeStored(BOOKING_STORAGE_KEY,bookings);return booking;
  }
  if(pathname==='/bookings'&&method==='GET')return storedBookings().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const bookingMatch=pathname.match(/^\/bookings\/([^/]+)$/);
  if(bookingMatch&&method==='GET'){const booking=storedBookings().find(b=>b.id===decodeURIComponent(bookingMatch[1])||b.bookingNumber===decodeURIComponent(bookingMatch[1]));if(!booking)throw new Error('ไม่พบข้อมูลการจองนี้ในอุปกรณ์เครื่องนี้');return booking}
  if(bookingMatch&&method==='PUT'){const bookings=storedBookings(),booking=bookings.find(b=>b.id===decodeURIComponent(bookingMatch[1])||b.bookingNumber===decodeURIComponent(bookingMatch[1]));if(!booking)throw new Error('ไม่พบข้อมูลการจองนี้');booking.status='ยกเลิกแล้ว';writeStored(BOOKING_STORAGE_KEY,bookings);return booking}
  throw new Error('ไม่พบข้อมูลที่ต้องการ');
}
const money=amount=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(amount||0));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const query=key=>new URLSearchParams(location.search).get(key);
const typeLabel=value=>({Ferry:'เรือเฟอร์รี่',Speedboat:'เรือสปีดโบ๊ต',Longtail:'เรือหางยาว',Catamaran:'เรือคาตามารัน'}[value]||value||'เรือโดยสาร');
const statusLabel=value=>({confirmed:'ยืนยันแล้ว',active:'เปิดให้บริการ',inactive:'ปิดให้บริการ'}[value]||value);
const portLabel=value=>value||'ไม่ระบุ';
const amenityLabel=value=>value;
const durationLabel=value=>value||'ไม่ระบุ';
const speedLabel=value=>value||'ไม่ระบุ';
const descriptionLabel=value=>value||'';
function showError(target,message){const el=typeof target==='string'?document.querySelector(target):target;if(el)el.innerHTML=`<div class="error" role="alert">${esc(message)}</div>`}
