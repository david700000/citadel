(function() {
  // ─── CONFIGURATION ───
  // Update this URL with your Render backend URL once deployed
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://citadel-mgt4.onrender.com'; 

  // ─── NAV SCROLL EFFECT ───
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // ─── BURGER MENU ───
  const burger = document.getElementById('burger');
  const mobileNav = document.getElementById('mobileNav');
  if(burger) {
    burger.addEventListener('click', () => {
        mobileNav.classList.toggle('open');
    });
  }

  // ─── FADE-IN ON SCROLL ───
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // ─── CONTACT FORM SUBMISSION ───
  const contactSubmit = document.getElementById('contact-submit');
  if(contactSubmit) {
    contactSubmit.addEventListener('click', async () => {
        const fname = document.getElementById('contact-fname').value;
        const lname = document.getElementById('contact-lname').value;
        const email = document.getElementById('contact-email').value;
        const subject = document.getElementById('contact-subject').value;
        const message = document.getElementById('contact-message').value;

        if(!email || !message) {
            alert('Please fill in your email and message.');
            return;
        }

        contactSubmit.textContent = 'Sending...';
        contactSubmit.disabled = true;

        try {
            const res = await fetch(`${API_URL}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `${fname} ${lname}`, email, subject, message })
            });
            const data = await res.json();
            if(data.success) {
                contactSubmit.textContent = '✓ Sent!';
                contactSubmit.style.background = '#22c55e';
                alert(data.message || 'Message sent successfully!');
                // Reset form
                document.getElementById('contact-fname').value = '';
                document.getElementById('contact-lname').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-message').value = '';
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (err) {
            console.error(err);
            alert('Error sending message. Please try again.');
            contactSubmit.textContent = 'Send Message ›';
            contactSubmit.disabled = false;
        }
    });
  }

  // ─── HERO SLIDESHOW ───
  let currentSlide = 0;
  let totalSlides = 0;
  let autoTimer;

  function initSlider() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    totalSlides = slides.length;
    if(totalSlides === 0) return;

    function goToSlide(n) {
      slides[currentSlide].classList.remove('active');
      slides[currentSlide].classList.add('prev');
      setTimeout(() => slides[currentSlide].classList.remove('prev'), 1400);
      currentSlide = (n + totalSlides) % totalSlides;
      slides[currentSlide].classList.add('active');
      dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(nextSlide, 6000);
    }

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    if(nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAuto(); });
    if(prevBtn) prevBtn.addEventListener('click', () => { goToSlide(currentSlide - 1); startAuto(); });
    dots.forEach(dot => {
      dot.addEventListener('click', () => { goToSlide(+dot.dataset.i); startAuto(); });
    });
    startAuto();
  }

  // ─── DYNAMIC DATA FETCHING ───
  async function loadData() {
    try {
      const response = await fetch(`${API_URL}/api/data`);
      if (!response.ok) throw new Error('Data fetch failed');
      const data = await response.json();

      // 1. Hero
      const slidesWrap = document.getElementById('slidesWrap');
      if (slidesWrap && data.hero && data.hero.length > 0) {
        slidesWrap.innerHTML = data.hero.map((h, i) => `
          <div class="slide ${i === 0 ? 'active' : ''}" id="slide${i}">
            <div class="slide-bg" style="background-image: url('${h.imageUrl}');"></div>
            <div class="slide-overlay"></div>
            <div class="slide-content">
              <div class="slide-eyebrow">${h.eyebrow}</div>
              <h1>${h.headingHtml}</h1>
              <p>${h.description}</p>
              <div class="hero-btns">
                ${h.btn1Text ? `<a href="${h.btn1Link}" class="btn-primary">${h.btn1Text}</a>` : ''}
                ${h.btn2Text ? `<a href="${h.btn2Link}" class="btn-outline">${h.btn2Text}</a>` : ''}
              </div>
            </div>
          </div>
        `).join('');
        const slideDots = document.querySelector('.slide-dots');
        if (slideDots) {
          slideDots.innerHTML = data.hero.map((_, i) => `<button class="dot ${i === 0 ? 'active' : ''}" data-i="${i}"></button>`).join('');
        }
        initSlider();
      }

      // 2. Global Images
      if (data.global) {
        const aboutImg = document.getElementById('dynamic-about-img');
        if (aboutImg && data.global.aboutImage) {
          aboutImg.innerHTML = `<img src="${data.global.aboutImage}" style="width:100%;height:100%;object-fit:contain;" alt="About Us">`;
        }
        const pastorImg = document.getElementById('dynamic-pastor-img');
        if (pastorImg && data.global.pastorImage) {
          pastorImg.innerHTML = `<img src="${data.global.pastorImage}" style="width:100%;height:100%;object-fit:contain;" alt="Pastor">`;
        }
        const headerLogo = document.getElementById('header-logo');
        if (headerLogo && data.global.logoImage) {
          headerLogo.innerHTML = `<img src="${data.global.logoImage}" style="width:100%;height:100%;object-fit:contain;" alt="Logo">`;
        }
        const footerLogo = document.getElementById('footer-logo');
        if (footerLogo && data.global.logoImage) {
          footerLogo.innerHTML = `<img src="${data.global.logoImage}" style="width:100%;height:100%;object-fit:contain;" alt="Logo">`;
        }
      }

      // 3. Events
      const eventsContainer = document.getElementById('dynamic-events');
      if (eventsContainer && data.events) {
        eventsContainer.innerHTML = data.events.map((e, index) => {
          const imgMarkup = e.imageUrl 
            ? `<div class="event-card-img" style="background-image: url('${e.imageUrl}'); background-size: cover; background-position: center;"><div class="event-card-badge">${e.badge}</div></div>`
            : `<div class="event-card-img"><svg viewBox="0 0 24 24"><path d="${e.iconPath || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'}"/></svg><div class="event-card-badge">${e.badge}</div></div>`;
          return `
          <div class="event-card fade-in" style="transition-delay:.${index * 12}s">
            ${imgMarkup}
            <div class="event-card-body">
              <div class="event-date">📅 ${e.date}</div>
              <h3>${e.title}</h3>
              <p>${e.description}</p>
              <a href="#" class="event-link">${e.linkRef || 'View Details'} <svg viewBox="0 0 24 24" style="width:13px;fill:var(--blue)"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg></a>
            </div>
          </div>
        `}).join('');
      }

      // 4. Sermons
      const sermonsContainer = document.getElementById('dynamic-sermons');
      if (sermonsContainer && data.sermons) {
        sermonsContainer.innerHTML = data.sermons.map((s, index) => {
          const thumbMarkup = s.imageUrl
            ? `<div class="sermon-thumb" style="background-image: url('${s.imageUrl}'); background-size: cover; background-position: center;"></div>`
            : `<div class="sermon-thumb"><svg viewBox="0 0 24 24"><path d="${s.iconPath || 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'}"/></svg></div>`;
          return `
          <div class="sermon-card fade-in" style="transition-delay:.${index}s">
            ${thumbMarkup}
            <div class="sermon-info">
              <div class="sermon-meta">${s.meta}</div>
              <h3>${s.title}</h3>
              <p>${s.description}</p>
            </div>
            <button class="sermon-play" aria-label="Play sermon" ${(s.videoUrl || s.audioUrl) ? `onclick="window.open('${s.videoUrl || s.audioUrl}', '_blank')"` : ''}>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        `}).join('');
      }
      
      // 5. Gallery
      const gal1 = document.getElementById('dynamic-gallery-1');
      const gal2 = document.getElementById('dynamic-gallery-2');
      if (gal1 && gal2 && data.gallery && data.gallery.length > 0) {
        const galHTML = data.gallery.map(g => `<div class="gallery-item"><div class="gallery-item-inner"><img src="${g.imageUrl}" style="width:100%;height:100%;object-fit:cover;"></div></div>`).join('');
        const loopHTML = galHTML + galHTML + galHTML;
        gal1.innerHTML = loopHTML;
        gal2.innerHTML = loopHTML;
      }
      
      document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
      
    } catch (err) {
      console.error(err);
    }
  }

  window.addEventListener('DOMContentLoaded', loadData);
})();
