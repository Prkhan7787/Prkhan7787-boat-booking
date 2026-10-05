const API_BASE_URL = window.API_BASE_URL || '';
const apiMessages = new Map([
  ['Please sign in to continue.','กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ'],['Your session has expired. Please sign in again.','เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'],['Admin access is required.','ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแล'],['Boat owner access is required.','ต้องเข้าสู่ระบบด้วยบัญชีผู้ให้เช่าเรือ'],['Customer access is required.','ต้องเข้าสู่ระบบด้วยบัญชีผู้ใช้บริการ'],['Email or password is incorrect.','อีเมลหรือรหัสผ่านไม่ถูกต้อง'],['Enter a valid email and password.','กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง'],['Enter your full name.','กรุณากรอกชื่อและนามสกุล'],['Enter a valid email address.','อีเมลไม่ถูกต้อง'],['Enter a valid phone number.','เบอร์โทรศัพท์ไม่ถูกต้อง'],['Password must be at least 8 characters.','รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],['Choose a valid account type.','กรุณาเลือกประเภทบัญชีให้ถูกต้อง'],['Email is already registered.','อีเมลนี้มีบัญชีแล้ว'],['A record with that value already exists.','ข้อมูลนี้มีอยู่ในระบบแล้ว'],['Complete all required boat fields.','กรุณากรอกข้อมูลเรือที่จำเป็นให้ครบ'],['Enter a service date and contact phone number.','กรุณาระบุวันที่ให้บริการและเบอร์ติดต่อ'],['Choose a valid service date.','กรุณาเลือกวันที่ให้บริการให้ถูกต้อง'],['Enter a valid contact phone number.','เบอร์ติดต่อไม่ถูกต้อง'],['This boat has active bookings and cannot be deleted.','เรือลำนี้มีรายการจองที่ยังดำเนินการอยู่ จึงยังลบไม่ได้'],['Boat disabled because its booking history must be kept.','เรือมีประวัติการจอง จึงปิดให้บริการแทนการลบข้อมูล'],['Boat deleted.','ลบข้อมูลเรือแล้ว'],['Boat not found.','ไม่พบข้อมูลเรือ'],['This boat is not available.','เรือลำนี้ไม่พร้อมให้บริการ'],['Booking not found.','ไม่พบรายการจอง'],['Passenger not found.','ไม่พบข้อมูลผู้โดยสาร'],['Choose a valid boat and a travel date that is today or later.','กรุณาเลือกเรือและวันเดินทางตั้งแต่วันนี้เป็นต้นไป'],['Add between 1 and 10 passengers.','เพิ่มผู้โดยสารได้ตั้งแต่ 1 ถึง 10 คน'],['Please check each passenger’s name, email, phone, and nationality.','กรุณาตรวจสอบชื่อ อีเมล เบอร์โทรศัพท์ และสัญชาติของผู้โดยสารแต่ละคน'],['Provide at least one field to update.','กรุณาระบุข้อมูลที่ต้องการแก้ไขอย่างน้อยหนึ่งรายการ'],['Choose a valid booking status.','กรุณาเลือกสถานะการจองที่ถูกต้อง'],['Booking deleted.','ลบรายการจองแล้ว'],['Something went wrong. Please try again.','เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง']
]);
function localizeApiMessage(message) {
  if (apiMessages.has(message)) return apiMessages.get(message);
  if (/^Only \d+ seats are available for this date\.$/.test(message || '')) return message.replace(/^Only (\d+) seats are available for this date\.$/, 'วันเดินทางนี้เหลือที่นั่ง $1 ที่');
  if (/must be a positive whole number/.test(message || '')) return 'กรุณาระบุจำนวนเป็นเลขจำนวนเต็มที่มากกว่าศูนย์';
  if (/must be greater than zero/.test(message || '')) return 'กรุณาระบุค่ามากกว่าศูนย์';
  if (/cannot exceed capacity/.test(message || '')) return 'จำนวนที่นั่งว่างต้องไม่เกินความจุเรือ';
  if (/Status must be/.test(message || '')) return 'กรุณาเลือกสถานะที่ถูกต้อง';
  return 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง';
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem('boatAdminToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try { response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers }); }
  catch { throw new Error('ไม่สามารถเชื่อมต่อระบบจองได้ กรุณาตรวจสอบการเชื่อมต่อ'); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'); }
  if (!response.ok || !payload.success) throw new Error(localizeApiMessage(payload.message || ''));
  return payload.data;
}
const money = amount => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(amount || 0));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const query = key => new URLSearchParams(location.search).get(key);
const typeLabel = value => ({Ferry:'เรือเฟอร์รี่',Speedboat:'เรือสปีดโบ๊ต',Longtail:'เรือหางยาว',Catamaran:'เรือคาตามารัน'}[value] || value);
const statusLabel = value => ({pending:'รอดำเนินการ',confirmed:'ยืนยันแล้ว',cancelled:'ยกเลิกแล้ว',completed:'เสร็จสิ้น',active:'เปิดให้บริการ',inactive:'ปิดให้บริการ'}[value] || value);
const portLabel = value => ({Phuket:'ภูเก็ต',Krabi:'กระบี่','Koh Samui':'เกาะสมุย','Phi Phi Islands':'หมู่เกาะพีพี','Koh Lanta':'เกาะลันตา','Koh Tao':'เกาะเต่า'}[value] || value);
const portValue = value => ({'ภูเก็ต':'Phuket','กระบี่':'Krabi','เกาะสมุย':'Koh Samui','หมู่เกาะพีพี':'Phi Phi Islands','เกาะลันตา':'Koh Lanta','เกาะเต่า':'Koh Tao'}[value] || value);
const amenityLabel = value => ({'Air conditioning':'เครื่องปรับอากาศ',Snacks:'ของว่าง','Snorkel gear':'อุปกรณ์ดำน้ำตื้น','Drinking water':'น้ำดื่ม',Cafe:'คาเฟ่',Wifi:'Wi-Fi','Outdoor deck':'ดาดฟ้ากลางแจ้ง','Local guide':'ไกด์ท้องถิ่น','Shade canopy':'หลังคากันแดด','Life jackets':'เสื้อชูชีพ'}[value] || value);
const amenityValue = value => ({'เครื่องปรับอากาศ':'Air conditioning','ของว่าง':'Snacks','อุปกรณ์ดำน้ำตื้น':'Snorkel gear','น้ำดื่ม':'Drinking water','คาเฟ่':'Cafe','ดาดฟ้ากลางแจ้ง':'Outdoor deck','ไกด์ท้องถิ่น':'Local guide','หลังคากันแดด':'Shade canopy','เสื้อชูชีพ':'Life jackets'}[value] || value);
const durationLabel = value => ({'1h 30m':'1 ชม. 30 นาที','50 min':'50 นาที','2h 20m':'2 ชม. 20 นาที','2h':'2 ชั่วโมง'}[value] || String(value || '').replace(/(\d+)h(?:\s*(\d+)m)?/,(_,h,m)=>`${h} ชม.${m?` ${m} นาที`:''}`).replace(/(\d+) min/, '$1 นาที'));
const speedLabel = value => String(value || '').replace(' knots',' นอต');
const speedValue = value => String(value || '').replace(' นอต',' knots');
const durationValue = value => ({'1 ชม. 30 นาที':'1h 30m','50 นาที':'50 min','2 ชม. 20 นาที':'2h 20m','2 ชั่วโมง':'2h'}[value] || value);
const descriptionLabel = value => ({'A relaxed, spacious ride with shaded seating and open sea views.':'เดินทางอย่างผ่อนคลายในห้องโดยสารกว้างขวาง พร้อมที่นั่งในร่มและวิวทะเล','A fast island hop with a friendly local crew.':'เดินทางระหว่างเกาะอย่างรวดเร็ว พร้อมดูแลโดยลูกเรือท้องถิ่นที่เป็นกันเอง','A comfortable coastal crossing with room to stretch out.':'เดินทางเลียบชายฝั่งอย่างสะดวกสบาย พร้อมพื้นที่นั่งพักผ่อน','Smooth sailing aboard a modern, stable catamaran.':'ล่องเรืออย่างนุ่มนวลบนเรือคาตามารันทันสมัยที่มั่นคง','A small-group traditional boat for a slower sea day.':'สัมผัสการเดินทางแบบสบาย ๆ บนเรือท้องถิ่นสำหรับกลุ่มเล็ก'}[value] || value);
function showError(target, message) { const el = typeof target === 'string' ? document.querySelector(target) : target; if (el) el.innerHTML = `<div class="error" role="alert">${esc(message)}</div>`; }
