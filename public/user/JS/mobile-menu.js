// Mobile Menu Handler
document.addEventListener('DOMContentLoaded', function() {
  initMobileMenu();
});

function initMobileMenu() {
  // สร้าง hamburger menu button และ overlay
  createMobileMenuElements();
  
  // ตั้งค่า event listeners
  setupMobileMenuEvents();
  
  // จัดการ responsive behavior
  handleResponsiveChanges();
}

function createMobileMenuElements() {
  // ตรวจสอบว่ามี elements อยู่แล้วหรือไม่
  if (document.querySelector('.mobile-menu-toggle')) return;
  
  // สร้าง hamburger menu button
  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'mobile-menu-toggle';
  mobileToggle.innerHTML = '☰';
  mobileToggle.setAttribute('aria-label', 'เปิดเมนู');
  mobileToggle.setAttribute('aria-expanded', 'false');
  
  // สร้าง overlay
  const mobileOverlay = document.createElement('div');
  mobileOverlay.className = 'mobile-overlay';
  
  // เพิ่มลงใน DOM
  document.body.appendChild(mobileToggle);
  document.body.appendChild(mobileOverlay);
}

function setupMobileMenuEvents() {
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const sidebar = document.querySelector('.sidebar');
  
  if (!mobileToggle || !mobileOverlay || !sidebar) return;
  
  // เปิด/ปิดเมนูเมื่อคลิกปุ่ม hamburger
  mobileToggle.addEventListener('click', function() {
    toggleMobileMenu();
  });
  
  // ปิดเมนูเมื่อคลิก overlay
  mobileOverlay.addEventListener('click', function() {
    closeMobileMenu();
  });
  
  // ปิดเมนูเมื่อคลิกลิงก์ในเมนู
  const menuLinks = sidebar.querySelectorAll('.menu a');
  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      // หน่วงเวลาเล็กน้อยก่อนปิดเมนู เพื่อให้ผู้ใช้เห็นการคลิก
      setTimeout(closeMobileMenu, 150);
    });
  });
  
  // ปิดเมนูเมื่อกด ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });
  
  // จัดการการเลื่อนหน้าจอเมื่อเมนูเปิด
  sidebar.addEventListener('transitionend', function() {
    if (sidebar.classList.contains('active')) {
      // Focus ไปที่ลิงก์แรกในเมนูเพื่อ accessibility
      const firstLink = sidebar.querySelector('.menu a');
      if (firstLink) firstLink.focus();
    }
  });
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  
  if (!sidebar || !mobileOverlay || !mobileToggle) return;
  
  const isOpen = sidebar.classList.contains('active');
  
  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  
  if (!sidebar || !mobileOverlay || !mobileToggle) return;
  
  sidebar.classList.add('active');
  mobileOverlay.classList.add('active');
  mobileToggle.innerHTML = '✕';
  mobileToggle.setAttribute('aria-label', 'ปิดเมนู');
  mobileToggle.setAttribute('aria-expanded', 'true');
  
  // ป้องกันการเลื่อนหน้าเมื่อเมนูเปิด
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  
  if (!sidebar || !mobileOverlay || !mobileToggle) return;
  
  sidebar.classList.remove('active');
  mobileOverlay.classList.remove('active');
  mobileToggle.innerHTML = '☰';
  mobileToggle.setAttribute('aria-label', 'เปิดเมนู');
  mobileToggle.setAttribute('aria-expanded', 'false');
  
  // คืนการเลื่อนหน้าปกติ
  document.body.style.overflow = '';
}

function handleResponsiveChanges() {
  // สร้าง MediaQueryList สำหรับตรวจจับการเปลี่ยนแปลงขนาดหน้าจอ
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  
  function handleMediaChange(e) {
    if (!e.matches) {
      // หน้าจอใหญ่กว่า 768px - ปิดเมนูมือถือ
      closeMobileMenu();
    }
  }
  
  // ตั้งค่า listener สำหรับการเปลี่ยนแปลงขนาดหน้าจอ
  mediaQuery.addListener(handleMediaChange);
  
  // เรียกใช้ครั้งแรกเพื่อตั้งค่าเริ่มต้น
  handleMediaChange(mediaQuery);
}

// Touch gesture support สำหรับการปัดเพื่อเปิด/ปิดเมนู
function initTouchGestures() {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  
  document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });
  
  document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
  }, { passive: true });
  
  document.addEventListener('touchend', function(e) {
    if (!isDragging) return;
    
    const diffX = currentX - startX;
    const sidebar = document.querySelector('.sidebar');
    const isMenuOpen = sidebar && sidebar.classList.contains('active');
    
    // ตรวจจับการปัดจากขอบซ้ายเพื่อเปิดเมนู (หน้าจอมือถือเท่านั้น)
    if (window.innerWidth <= 768) {
      if (!isMenuOpen && startX < 50 && diffX > 100) {
        openMobileMenu();
      }
      // ปัดไปทางซ้ายเพื่อปิดเมนู
      else if (isMenuOpen && diffX < -100) {
        closeMobileMenu();
      }
    }
    
    isDragging = false;
  }, { passive: true });
}

// เรียกใช้ touch gestures
document.addEventListener('DOMContentLoaded', function() {
  initTouchGestures();
});

// ส่งออกฟังก์ชันสำหรับใช้งานภายนอก
window.MobileMenu = {
  toggle: toggleMobileMenu,
  open: openMobileMenu,
  close: closeMobileMenu
};