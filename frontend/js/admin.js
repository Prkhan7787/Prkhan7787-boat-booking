requireAdmin();

const table = (heads, rows) => rows.length
  ? `<div style="overflow:auto"><table class="admin-table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
  : '<div class="empty">ไม่พบข้อมูล</div>';
const statusTag = status => `<span class="status ${esc(status)}">${esc(statusLabel(status))}</span>`;

async function adminDashboard() {
  const root = document.querySelector('#stats');
  if (!root) return;
  try {
    const stats = await api('/admin/stats');
    const labels = ['จำนวนเรือทั้งหมด', 'จำนวนการจองทั้งหมด', 'ผู้โดยสาร', 'รายได้', 'การจองวันนี้'];
    const values = [stats.total_boats, stats.total_bookings, stats.total_passengers, money(stats.total_revenue), stats.todays_bookings];
    root.innerHTML = labels.map((label, i) => `<div class="stat-card"><p>${label}</p><strong>${values[i]}</strong></div>`).join('');
    const bookings = await api('/bookings');
    document.querySelector('#recent-bookings').innerHTML = table(
      ['รหัสการจอง', 'เรือ', 'วันเดินทาง', 'ผู้โดยสาร', 'ยอดรวม', 'สถานะ'],
      bookings.slice(0, 8).map(b => `<tr><td>${esc(b.booking_code)}</td><td>${esc(b.boat_name)}</td><td>${esc(b.travel_date)}</td><td>${esc(b.total_passengers)}</td><td>${money(b.total_price)}</td><td>${statusTag(b.status)}</td></tr>`)
    );
    if (window.Chart) {
      new Chart(document.querySelector('#daily-chart'), { type: 'bar', data: { labels: stats.daily.map(x => x.label), datasets: [{ label: 'จำนวนการจอง', data: stats.daily.map(x => x.bookings), backgroundColor: '#35c5cb', borderRadius: 7 }] }, options: { responsive: true, maintainAspectRatio: false } });
      new Chart(document.querySelector('#route-chart'), { type: 'doughnut', data: { labels: stats.routes.map(x => x.label.split(' → ').map(portLabel).join(' → ')), datasets: [{ data: stats.routes.map(x => x.value), backgroundColor: ['#35c5cb', '#126b86', '#ffbd69', '#77d4bc', '#aacbe0'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
  } catch (error) {
    if (error.message.includes('เซสชัน') || error.message.includes('เข้าสู่ระบบ')) location.href = '/pages/login.html';
    else showError('#admin-error', error.message);
  }
}

const boatInputs = [
  ['name', 'ชื่อเรือ', 'text'], ['type', 'ประเภทเรือ', 'boatType'], ['description', 'รายละเอียดเรือ', 'text'], ['image', 'ลิงก์รูปภาพ', 'url'],
  ['capacity', 'ความจุ', 'number'], ['speed', 'ความเร็ว', 'text'], ['departure_port', 'ท่าเรือต้นทาง', 'text'], ['destination', 'ปลายทาง', 'text'],
  ['departure_time', 'เวลาออกเดินทาง', 'time'], ['arrival_time', 'เวลาถึง', 'time'], ['duration', 'ระยะเวลาเดินทาง', 'text'], ['price', 'ราคาต่อคน', 'number'],
  ['available_seats', 'ที่นั่งว่าง', 'number'], ['amenities', 'สิ่งอำนวยความสะดวก (คั่นด้วยจุลภาค)', 'text'], ['status', 'สถานะ', 'boatStatus']
];

async function adminBoats() {
  const list = document.querySelector('#boat-list');
  if (!list) return;
  const dialog = document.querySelector('#boat-dialog');
  const form = document.querySelector('#boat-form');
  const fields = document.querySelector('#boat-fields');
  fields.innerHTML = boatInputs.map(([name, label, type]) => {
    const control = type === 'boatType'
      ? `<select name="${name}" required><option value="Ferry">เรือเฟอร์รี่</option><option value="Speedboat">เรือสปีดโบ๊ต</option><option value="Longtail">เรือหางยาว</option><option value="Catamaran">เรือคาตามารัน</option></select>`
      : type === 'boatStatus'
        ? `<select name="${name}" required><option value="active">เปิดให้บริการ</option><option value="inactive">ปิดให้บริการ</option></select>`
        : `<input name="${name}" type="${type}" ${['capacity', 'available_seats', 'price'].includes(name) ? 'min="1"' : ''} required>`;
    return `<label class="field"><span>${label}</span>${control}</label>`;
  }).join('');

  async function load() {
    try {
      const boats = await api('/admin/boats');
      list.innerHTML = table(['เรือ', 'เส้นทาง', 'ประเภท', 'ที่นั่ง', 'ราคา', 'สถานะ', 'การดำเนินการ'], boats.map(b =>
        `<tr><td>${esc(b.name)}</td><td>${esc(portLabel(b.departure_port))} → ${esc(portLabel(b.destination))}</td><td>${esc(typeLabel(b.type))}</td><td>${esc(b.available_seats)}/${esc(b.capacity)}</td><td>${money(b.price)}</td><td>${statusTag(b.status)}</td><td><button class="button secondary small edit-boat" data-id="${b.id}">แก้ไข</button> <button class="button small delete-boat" data-id="${b.id}">ลบ</button></td></tr>`
      ));
      list.querySelectorAll('.edit-boat').forEach(button => button.onclick = () => {
        const boat = boats.find(item => item.id == button.dataset.id);
        form.reset(); form.elements.id.value = boat.id;
        boatInputs.forEach(([key]) => {
          let value = Array.isArray(boat[key]) ? boat[key].map(amenityLabel).join(', ') : boat[key];
          if (key === 'departure_port' || key === 'destination') value = portLabel(value);
          if (key === 'speed') value = speedLabel(value);
          if (key === 'duration') value = durationLabel(value);
          if (key === 'description') value = descriptionLabel(value);
          form.elements[key].value = value;
        });
        document.querySelector('#boat-form-title').textContent = 'แก้ไขข้อมูลเรือ';
        dialog.showModal();
      });
      list.querySelectorAll('.delete-boat').forEach(button => button.onclick = async () => {
        if (!confirm('ต้องการลบเรือลำนี้หรือไม่? เรือที่มีรายการจองแล้วจะไม่สามารถลบได้')) return;
        try { await api(`/boats/${button.dataset.id}`, { method: 'DELETE' }); load(); }
        catch (error) { showError('#admin-error', error.message); }
      });
    } catch (error) { showError('#admin-error', error.message); }
  }

  document.querySelector('#new-boat').onclick = () => { form.reset(); form.elements.id.value = ''; document.querySelector('#boat-form-title').textContent = 'เพิ่มเรือ'; dialog.showModal(); };
  document.querySelector('#close-dialog').onclick = () => dialog.close();
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const id = data.id; delete data.id;
    for (const key of ['capacity', 'available_seats', 'price']) data[key] = Number(data[key]);
    data.departure_port = portValue(data.departure_port); data.destination = portValue(data.destination);
    data.speed = speedValue(data.speed); data.duration = durationValue(data.duration);
    data.amenities = data.amenities.split(',').map(item => amenityValue(item.trim())).filter(Boolean);
    try { await api(id ? `/boats/${id}` : '/boats', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }); dialog.close(); load(); }
    catch (error) { showError('#admin-error', error.message); }
  };
  await load();
}

async function adminBookings() {
  const root = document.querySelector('#booking-list');
  if (!root) return;
  let bookings = [];
  async function load() { try { bookings = await api('/bookings'); render(); } catch (error) { showError('#admin-error', error.message); } }
  function render() {
    const term = document.querySelector('#booking-search').value.toLowerCase();
    const status = document.querySelector('#booking-status').value;
    const filtered = bookings.filter(b => (!status || b.status === status) && `${b.booking_code} ${b.boat_name} ${(b.passengers || []).map(p => `${p.first_name} ${p.last_name}`).join(' ')}`.toLowerCase().includes(term));
    root.innerHTML = table(['รหัสการจอง', 'เรือ / เส้นทาง', 'วันเดินทาง', 'ผู้โดยสาร', 'ยอดรวม', 'สถานะ', 'เปลี่ยนสถานะ'], filtered.map(b =>
      `<tr><td>${esc(b.booking_code)}</td><td>${esc(b.boat_name)}<br><small>${esc(portLabel(b.departure_port))} → ${esc(portLabel(b.destination))}</small></td><td>${esc(b.travel_date)}</td><td>${(b.passengers || []).map(p => `${esc(p.first_name)} ${esc(p.last_name)}`).join(', ')}</td><td>${money(b.total_price)}</td><td>${statusTag(b.status)}</td><td><select class="filter-input status-update" data-id="${b.id}">${[['pending', 'รอดำเนินการ'], ['confirmed', 'ยืนยันแล้ว'], ['cancelled', 'ยกเลิกแล้ว'], ['completed', 'เสร็จสิ้น']].map(([value, label]) => `<option value="${value}" ${b.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`
    ));
    root.querySelectorAll('.status-update').forEach(select => select.onchange = async () => {
      try { await api(`/bookings/${select.dataset.id}`, { method: 'PUT', body: JSON.stringify({ status: select.value }) }); load(); }
      catch (error) { showError('#admin-error', error.message); load(); }
    });
  }
  document.querySelector('#booking-search').oninput = render;
  document.querySelector('#booking-status').onchange = render;
  await load();
}

async function adminPassengers() {
  const root = document.querySelector('#passenger-list');
  if (!root) return;
  async function load() {
    try {
      const passengers = await api(`/passengers?search=${encodeURIComponent(document.querySelector('#passenger-search').value)}`);
      root.innerHTML = table(['รหัสการจอง', 'ผู้โดยสาร', 'อีเมล', 'เบอร์โทรศัพท์', 'สัญชาติ', 'เรือ / เส้นทาง', 'วันเดินทาง', 'สถานะ'], passengers.map(p =>
        `<tr><td>${esc(p.booking_code)}</td><td>${esc(p.first_name)} ${esc(p.last_name)}</td><td>${esc(p.email)}</td><td>${esc(p.phone)}</td><td>${esc(p.nationality === 'Thailand' ? 'ไทย' : p.nationality)}</td><td>${esc(p.boat_name)}<br><small>${esc(portLabel(p.departure_port))} → ${esc(portLabel(p.destination))}</small></td><td>${esc(p.travel_date)}</td><td>${statusTag(p.status)}</td></tr>`
      ));
    } catch (error) { showError('#admin-error', error.message); }
  }
  let timer;
  document.querySelector('#passenger-search').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  await load();
}

async function adminUsers() {
  const root=document.querySelector('#user-list');
  if(!root)return;
  try{
    const users=await api('/admin/users');
    root.innerHTML=table(['ชื่อ','อีเมล','เบอร์โทรศัพท์','ประเภทบัญชี','วันที่สมัคร'],users.map(user=>`<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${esc(user.phone||'—')}</td><td>${user.role==='admin'?'ผู้ดูแลระบบ':user.role==='boat_owner'?'ผู้ให้เช่าเรือ':'ผู้ใช้บริการ'}</td><td>${esc(user.created_at)}</td></tr>`));
  }catch(error){showError('#admin-error',error.message)}
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.admin-sidebar').forEach(sidebar=>{
    if(!sidebar.querySelector('a[href="/admin/users.html"]')){const link=document.createElement('a');link.href='/admin/users.html';link.textContent='◎  ผู้ใช้งาน';sidebar.insertBefore(link,sidebar.lastElementChild)}
  });
  adminDashboard(); adminBoats(); adminBookings(); adminPassengers(); adminUsers();
});
