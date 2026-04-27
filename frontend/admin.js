(function() {
  // ─── CONFIGURATION ───
  // Update this URL with your Render backend URL once deployed
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://citadel-backend.onrender.com'; 

  let authToken = localStorage.getItem('adminToken');
  let adminRole = localStorage.getItem('adminRole');
  let siteData = { events: [], sermons: [], hero: [], global: [] };

  // DOM Elements
  const loginOverlay = document.getElementById('login-overlay');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const saveAllBtn = document.getElementById('save-all-btn');

  const heroGrid = document.getElementById('admin-hero-grid');
  const eventsGrid = document.getElementById('admin-events-grid');
  const sermonsGrid = document.getElementById('admin-sermons-grid');
  const galleryGrid = document.getElementById('admin-gallery-grid');

  // Mobile Toggle Logic
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      mobileToggle.classList.toggle('active');
    });
  }

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        mobileToggle.classList.remove('active');
      }
    });
  });

  // Initialization
  async function init() {
    if (authToken) {
      if (loginOverlay) loginOverlay.style.display = 'none';
      if (dashboard) dashboard.style.display = 'flex';
      
      // Show mobile header if logged in
      const mobileHeader = document.querySelector('.mobile-header');
      if (mobileHeader) mobileHeader.style.display = window.innerWidth <= 1024 ? 'flex' : 'none';

      const navUsers = document.getElementById('nav-users');
      if (navUsers) navUsers.style.display = adminRole === 'superadmin' ? 'block' : 'none';

      await fetchData();
      if (adminRole === 'superadmin') {
        await fetchUsers();
      }
    } else {
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (dashboard) dashboard.style.display = 'none';
      const mobileHeader = document.querySelector('.mobile-header');
      if (mobileHeader) mobileHeader.style.display = 'none';
    }
  }

  // Auth Actions
  if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        try {
          const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok) {
            authToken = data.token;
            adminRole = data.role;
            localStorage.setItem('adminToken', authToken);
            localStorage.setItem('adminRole', adminRole);
            init();
          } else {
            loginError.textContent = data.error || 'Login failed';
          }
        } catch (err) {
          loginError.textContent = 'Server connection failed';
        }
    });
  }

  if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        authToken = null;
        adminRole = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRole');
        init();
    });
  }

  // Navigation
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(link.dataset.target).classList.add('active');
    });
  });

  // Image Upload Handler
  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      const data = await res.json();
      if(res.ok) return data.url;
      throw new Error(data.error);
    } catch(err) {
      alert("Upload Failed: " + err.message);
      return null;
    }
  }

  window.uploadGlobalImage = async (event, key) => {
    const file = event.target.files[0];
    if(!file) return;
    event.target.previousElementSibling.textContent = "Uploading...";
    const url = await uploadImage(file);
    if(url) {
      siteData.global[key] = url;
      const inputId = key === 'aboutImage' ? 'global-about' : key === 'pastorImage' ? 'global-pastor' : 'global-logo';
      document.getElementById(inputId).value = url;
    }
    event.target.previousElementSibling.textContent = 'Change Photo'; 
  };

  window.handleCardUpload = async (event, arrayName, index, fieldName = 'imageUrl') => {
    const file = event.target.files[0];
    if(!file) return;
    event.target.previousElementSibling.textContent = "Uploading...";
    const url = await uploadImage(file);
    if(url) {
      siteData[arrayName][index][fieldName] = url;
      if(arrayName==='hero') renderHero();
      if(arrayName==='events') renderEvents();
      if(arrayName==='sermons') renderSermons();
      if(arrayName==='gallery') renderGallery();
    }
  };

  async function fetchData() {
    try {
      const res = await fetch(`${API_URL}/api/data`);
      if (res.ok) {
        siteData = await res.json();
        if(!siteData.hero) siteData.hero = [];
        if(!siteData.events) siteData.events = [];
        if(!siteData.sermons) siteData.sermons = [];
        if(!siteData.global) siteData.global = {};
        if(!siteData.gallery) siteData.gallery = [];
        
        document.getElementById('global-about').value = siteData.global.aboutImage || '';
        document.getElementById('global-pastor').value = siteData.global.pastorImage || '';
        document.getElementById('global-logo').value = siteData.global.logoImage || '';
        
        renderHero();
        renderEvents();
        renderSermons();
        renderGallery();
      }
    } catch (err) {
      console.error("Failed to load data", err);
    }
  }

  async function saveData() {
    saveAllBtn.textContent = 'Saving...';
    try {
      const res = await fetch(`${API_URL}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(siteData)
      });
      if (res.ok) {
        saveAllBtn.textContent = '✓ Saved Successfully';
        setTimeout(() => { saveAllBtn.textContent = 'Save All Changes to Website'; }, 3000);
      }
    } catch (err) {
      alert("Error saving data");
      saveAllBtn.textContent = 'Save All Changes';
    }
  }

  if(saveAllBtn) {
    saveAllBtn.addEventListener('click', () => {
        syncInputsToData();
        saveData();
    });
  }

  function syncInputsToData() {
    siteData.hero.forEach((h, i) => {
      const card = document.getElementById(`hero-card-${h.id}`);
      if(card) {
        h.eyebrow = card.querySelector('.h-eyebrow').value;
        h.headingHtml = card.querySelector('.h-heading').value;
        h.description = card.querySelector('.h-desc').value;
        h.btn1Text = card.querySelector('.h-btn1t').value;
        h.btn1Link = card.querySelector('.h-btn1l').value;
        h.btn2Text = card.querySelector('.h-btn2t').value;
        h.btn2Link = card.querySelector('.h-btn2l').value;
      }
    });
    siteData.events.forEach((e, i) => {
      const card = document.getElementById(`event-card-${e.id}`);
      if(card) {
        e.badge = card.querySelector('.ev-badge').value;
        e.date = card.querySelector('.ev-date').value;
        e.title = card.querySelector('.ev-title').value;
        e.description = card.querySelector('.ev-desc').value;
        e.linkRef = card.querySelector('.ev-link').value;
      }
    });
    siteData.sermons.forEach((s, i) => {
      const card = document.getElementById(`sermon-card-${s.id}`);
      if(card) {
        s.meta = card.querySelector('.sm-meta').value;
        s.title = card.querySelector('.sm-title').value;
        s.description = card.querySelector('.sm-desc').value;
        const vUrl = card.querySelector('.sm-video');
        if(vUrl) s.videoUrl = vUrl.value;
      }
    });
  }

  // Rendering logic... (simplified for brevity, keeping existing logic)
  function renderHero() {
    heroGrid.innerHTML = siteData.hero.map((h, i) => `
      <div class="admin-card" id="hero-card-${h.id}">
        <div class="card-header-actions"><button class="btn-danger" onclick="deleteHero('${h.id}')">Delete</button></div>
        <div class="input-group">
          <label>Slide Image</label>
          <input type="file" accept="image/*" onchange="handleCardUpload(event, 'hero', ${i})">
          ${h.imageUrl ? `<img src="${h.imageUrl}" height="60" style="margin-top:5px; border-radius:4px;">` : ''}
        </div>
        <div class="input-group"><label>Eyebrow</label><input type="text" class="h-eyebrow" value="${h.eyebrow || ''}"></div>
        <div class="input-group"><label>Heading</label><input type="text" class="h-heading" value='${h.headingHtml || ''}'></div>
        <div class="input-group"><label>Description</label><textarea class="h-desc">${h.description || ''}</textarea></div>
        <div style="display:flex; gap:10px;">
          <input type="text" class="h-btn1t" placeholder="Btn 1 Text" value="${h.btn1Text || ''}">
          <input type="text" class="h-btn1l" placeholder="Btn 1 Link" value="${h.btn1Link || ''}">
        </div>
      </div>
    `).join('');
  }

  function renderEvents() {
    eventsGrid.innerHTML = siteData.events.map((e, i) => `
      <div class="admin-card" id="event-card-${e.id}">
        <div class="card-header-actions"><button class="btn-danger" onclick="deleteEvent('${e.id}')">Delete</button></div>
        <input type="file" accept="image/*" onchange="handleCardUpload(event, 'events', ${i})">
        <input type="text" class="ev-date" value="${e.date || ''}" placeholder="Date">
        <input type="text" class="ev-title" value="${e.title || ''}" placeholder="Title">
        <textarea class="ev-desc" placeholder="Desc">${e.description || ''}</textarea>
      </div>
    `).join('');
  }

  function renderSermons() {
    sermonsGrid.innerHTML = siteData.sermons.map((s, i) => `
      <div class="admin-card" id="sermon-card-${s.id}">
        <div class="card-header-actions"><button class="btn-danger" onclick="deleteSermon('${s.id}')">Delete</button></div>
        <input type="file" accept="image/*" onchange="handleCardUpload(event, 'sermons', ${i})">
        <input type="file" accept="audio/*" onchange="handleCardUpload(event, 'sermons', ${i}, 'audioUrl')">
        <input type="text" class="sm-title" value="${s.title || ''}" placeholder="Title">
        <input type="text" class="sm-video" value="${s.videoUrl || ''}" placeholder="YouTube Link (Optional)">
      </div>
    `).join('');
  }

  function renderGallery() {
    galleryGrid.innerHTML = siteData.gallery.map((g, i) => `
      <div class="admin-card" id="gallery-card-${g.id}">
        <div class="card-header-actions"><button class="btn-danger" onclick="deleteGalleryImage('${g.id}')">Delete</button></div>
        <input type="file" accept="image/*" onchange="handleCardUpload(event, 'gallery', ${i})">
        ${g.imageUrl ? `<img src="${g.imageUrl}" width="100%">` : ''}
      </div>
    `).join('');
  }

  // Action wrappers for window
  window.addHeroSlide = () => { syncInputsToData(); siteData.hero.unshift({ id: Date.now(), eyebrow: 'New', headingHtml: 'Title', description: '', imageUrl: '' }); renderHero(); };
  window.deleteHero = (id) => { if(confirm('Delete?')) { siteData.hero = siteData.hero.filter(h => h.id != id); renderHero(); } };
  window.addEvent = () => { syncInputsToData(); siteData.events.unshift({ id: Date.now(), date: 'TBD', title: 'New', description: '', imageUrl: '' }); renderEvents(); };
  window.deleteEvent = (id) => { if(confirm('Delete?')) { siteData.events = siteData.events.filter(e => e.id != id); renderEvents(); } };
  window.addSermon = () => { syncInputsToData(); siteData.sermons.unshift({ id: Date.now(), title: 'New', meta: '', description: '', imageUrl: '' }); renderSermons(); };
  window.deleteSermon = (id) => { if(confirm('Delete?')) { siteData.sermons = siteData.sermons.filter(s => s.id != id); renderSermons(); } };
  window.addGalleryImage = () => { syncInputsToData(); siteData.gallery.unshift({ id: Date.now(), imageUrl: '' }); renderGallery(); };
  window.deleteGalleryImage = (id) => { if(confirm('Delete?')) { siteData.gallery = siteData.gallery.filter(g => g.id != id); renderGallery(); } };

  async function fetchUsers() {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (res.ok) { renderUsers(await res.json()); }
    } catch(e) {}
  }
  function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;
    tbody.innerHTML = users.map(u => `<tr><td>${u.email}</td><td>${u.role}</td><td style="text-align:right;"><button class="btn-danger" onclick="deleteUser('${u.id}')">Revoke</button></td></tr>`).join('');
  }
  window.deleteUser = async (id) => {
    if(!confirm('Revoke?')) return;
    await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
    fetchUsers();
  };
  window.createUser = async () => {
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ email, password, role })
    });
    fetchUsers();
  };

  init();
})();
