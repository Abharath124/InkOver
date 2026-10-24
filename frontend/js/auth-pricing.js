/**
 * InkOver - Dynamic Pricing Engine & Authentication Controller
 * Manages localStorage session, dynamic pricing updates from admin dashboard,
 * and user flows for overink.com.
 */

const INKOVER_PRICING_KEY = 'inkover_pricing';
const INKOVER_AUTH_KEY = 'inkover_current_user';
const INKOVER_USERS_KEY = 'inkover_users_db';

// Default dynamic pricing configuration ($25/mo, 25*12 - 100 = $200/yr)
const DEFAULT_PRICING = {
  monthlyPrice: 25,
  yearlyDiscount: 100,
  yearlyPrice: 200, // 25 * 12 - 100 = 200
  currency: '$',
  discountBadge: 'Save $100 / Year',
  lastUpdated: new Date().toISOString()
};

// Default fake credentials for easy testing and tracking
const DEFAULT_ACCOUNTS = [
  {
    name: 'Admin Director',
    email: 'admin@overink.com',
    password: 'admin', // or admin123
    role: 'admin',
    plan: 'InkOver Studio Enterprise',
    licenseKey: 'INK-ADMIN-9900-ULTRA-2026'
  },
  {
    name: 'Alex Johnson',
    email: 'user@overink.com',
    password: 'user', // or user123
    role: 'member',
    plan: 'InkOver Studio Pro',
    licenseKey: 'INK-PRO-8492-STUDIO-2026'
  },
  {
    name: 'Demo Member',
    email: 'demo@overink.com',
    password: 'demo',
    role: 'member',
    plan: 'InkOver Studio Pro',
    licenseKey: 'INK-DEMO-3210-STUDIO-2026'
  }
];

/* ==========================================================================
   Dynamic Pricing Manager
   ========================================================================== */
function getPricingConfig() {
  try {
    const stored = localStorage.getItem(INKOVER_PRICING_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure recalculation if needed
      if (!parsed.yearlyPrice) {
        parsed.yearlyPrice = (parsed.monthlyPrice * 12) - parsed.yearlyDiscount;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Error reading pricing config from storage:', err);
  }
  return { ...DEFAULT_PRICING };
}

function savePricingConfig(monthlyPrice, yearlyDiscount, discountBadge) {
  const m = parseFloat(monthlyPrice) || 25;
  const d = parseFloat(yearlyDiscount) || 100;
  const y = (m * 12) - d;

  const config = {
    monthlyPrice: m,
    yearlyDiscount: d,
    yearlyPrice: y > 0 ? y : 0,
    currency: '$',
    discountBadge: discountBadge || `Save $${d} / Year`,
    lastUpdated: new Date().toISOString()
  };

  localStorage.setItem(INKOVER_PRICING_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('inkover_pricing_updated', { detail: config }));
  return config;
}

function resetPricingConfig() {
  localStorage.setItem(INKOVER_PRICING_KEY, JSON.stringify(DEFAULT_PRICING));
  window.dispatchEvent(new CustomEvent('inkover_pricing_updated', { detail: DEFAULT_PRICING }));
  return DEFAULT_PRICING;
}

/* ==========================================================================
   Authentication & Session Controller
   ========================================================================== */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(INKOVER_AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse current user session', e);
  }
  return null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(INKOVER_AUTH_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(INKOVER_AUTH_KEY);
  }
  updateNavbarAuth();
}

function getAllUsers() {
  try {
    const raw = localStorage.getItem(INKOVER_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return [...DEFAULT_ACCOUNTS];
}

function saveAllUsers(users) {
  localStorage.setItem(INKOVER_USERS_KEY, JSON.stringify(users));
}

function authLogin(email, password, roleOverride = null) {
  const users = getAllUsers();
  const normalizedEmail = email.trim().toLowerCase();

  let user = users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    // If logging in with demo email or admin, create it
    const isAdmin = normalizedEmail.includes('admin') || roleOverride === 'admin';
    user = {
      name: isAdmin ? 'Admin Manager' : (email.split('@')[0] || 'Studio User'),
      email: normalizedEmail,
      role: isAdmin ? 'admin' : (roleOverride || 'member'),
      plan: isAdmin ? 'InkOver Studio Enterprise' : 'InkOver Studio Pro',
      licenseKey: 'INK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-STUDIO-2026'
    };
    users.push(user);
    saveAllUsers(users);
  } else if (roleOverride) {
    user.role = roleOverride;
  }

  setCurrentUser(user);
  return user;
}

function authSignup(name, email, password) {
  const users = getAllUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    setCurrentUser(existing);
    return existing;
  }

  const isAdmin = normalizedEmail.includes('admin');
  const newUser = {
    name: name.trim() || 'Studio Creator',
    email: normalizedEmail,
    role: isAdmin ? 'admin' : 'member',
    plan: 'InkOver Studio Pro',
    licenseKey: 'INK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-STUDIO-2026',
    createdAt: new Date().toLocaleDateString()
  };

  users.push(newUser);
  saveAllUsers(users);
  setCurrentUser(newUser);
  return newUser;
}

function authGoogleLogin() {
  const googleUser = {
    name: 'Google User',
    email: 'user.inkover@gmail.com',
    role: 'member',
    plan: 'InkOver Studio Pro',
    avatar: 'https://lh3.googleusercontent.com/a/default-user',
    licenseKey: 'INK-GGL-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-2026'
  };
  setCurrentUser(googleUser);
  return googleUser;
}

function authLogout() {
  setCurrentUser(null);
  showAppToast('You have signed out.');
  const gate = document.getElementById('landingAuthGate');
  if (gate) {
    gate.classList.remove('hidden');
    updateNavbarAuth();
  } else {
    window.location.href = 'index.html';
  }
}

/* ==========================================================================
   Auto-Update Navigation for Logged-In State (Landing Page Focused)
   ========================================================================== */
function updateNavbarAuth() {
  const user = getCurrentUser();
  const navActions = document.querySelector('.nav-actions');
  const gate = document.getElementById('landingAuthGate');

  // Handle Landing Page Gate visibility
  if (gate) {
    if (user) {
      gate.classList.add('hidden');
    } else {
      gate.classList.remove('hidden');
    }
  }

  // Update Hero Section if on index.html
  const heroBadge = document.querySelector('.hero-badge');
  if (heroBadge) {
    if (user) {
      heroBadge.innerHTML = `
        <span class="badge-pulse"></span>
        <span>👋 Welcome, <strong>${user.name}</strong></span>
        <span style="color: var(--brand-primary); font-weight: 700;">• Ready to Launch</span>
      `;
    } else {
      heroBadge.innerHTML = `
        <span class="badge-pulse"></span>
        <span>v3.12 Certified for Windows 11 &amp; 10</span>
        <span style="color: var(--brand-primary); font-weight: 700;">• Free Forever</span>
      `;
    }
  }

  if (!navActions) return;

  if (user) {
    // Show Name with Download Desktop App button (No unnecessary user side pages)
    navActions.innerHTML = `
      <div class="user-greeting-pill">
        <span class="user-name-text">Hi, <span>${user.name.split(' ')[0]}</span></span>
        ${user.role === 'admin' ? `
          <a href="dashboard.html" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.78rem; border-color: rgba(139, 92, 246, 0.4); color: #C4B5FD;">
            👑 Pricing Manager
          </a>
        ` : ''}
        <button type="button" class="btn btn-brand btn-download-trigger" style="padding: 8px 16px; font-size: 0.85rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
          </svg>
          Download Desktop App
        </button>
        <button type="button" class="btn-logout-small" id="navLogoutBtn">Sign Out</button>
      </div>
    `;

    const logoutBtn = document.getElementById('navLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', authLogout);
    }

    // Attach download trigger handler
    const dlBtn = navActions.querySelector('.btn-download-trigger');
    if (dlBtn) {
      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof simulateDownload === 'function') {
          simulateDownload('InkOver-Setup.exe');
        } else {
          showAppToast('Downloading InkOver Desktop App for Windows (.exe)...');
        }
      });
    }

  } else {
    // Logged out: Show Log In & Sign Up buttons which open the blur gate
    navActions.innerHTML = `
      <button type="button" id="navOpenLoginBtn" class="btn btn-outline" style="padding: 8px 16px; font-size: 0.85rem;">Log In</button>
      <button type="button" id="navOpenSignupBtn" class="btn btn-brand" style="padding: 8px 16px; font-size: 0.85rem;">Sign Up</button>
    `;

    const btnLogin = document.getElementById('navOpenLoginBtn');
    const btnSignup = document.getElementById('navOpenSignupBtn');

    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        if (gate) {
          gate.classList.remove('hidden');
          switchGateTab('login');
        } else {
          window.location.href = 'login.html';
        }
      });
    }

    if (btnSignup) {
      btnSignup.addEventListener('click', () => {
        if (gate) {
          gate.classList.remove('hidden');
          switchGateTab('signup');
        } else {
          window.location.href = 'signup.html';
        }
      });
    }
  }
}

function switchGateTab(tabName) {
  const tabSignup = document.getElementById('tabBtnSignup');
  const tabLogin = document.getElementById('tabBtnLogin');
  const formSignup = document.getElementById('gateSignupForm');
  const formLogin = document.getElementById('gateLoginForm');
  const gateTitle = document.getElementById('gateTitle');
  const gateDesc = document.getElementById('gateDesc');

  if (!tabSignup || !tabLogin || !formSignup || !formLogin) return;

  if (tabName === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.style.display = 'block';
    formSignup.style.display = 'none';
    if (gateTitle) gateTitle.innerText = 'Log In to InkOver';
    if (gateDesc) gateDesc.innerText = 'Enter your details or continue with Google to access desktop downloads.';
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    formSignup.style.display = 'block';
    formLogin.style.display = 'none';
    if (gateTitle) gateTitle.innerText = 'Create Free Account';
    if (gateDesc) gateDesc.innerText = 'Quick registration to download the standalone screen studio app.';
  }
}

/* ==========================================================================
   Global Toast Notification
   ========================================================================== */
function showAppToast(message, type = 'success') {
  let toast = document.getElementById('inkoverAppToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'inkoverAppToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(255, 87, 34, 0.5);
      color: #FFFFFF;
      padding: 14px 22px;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 600;
      box-shadow: 0 15px 40px rgba(0,0,0,0.6);
      z-index: 99999;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 12px;
      backdrop-filter: blur(12px);
    `;
    document.body.appendChild(toast);
  }

  const iconColor = type === 'success' ? '#10B981' : (type === 'error' ? '#EF4444' : '#FF5722');
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toast.style.borderColor = iconColor;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 3200);
}

// Initialise storage defaults and navbar upon load
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(INKOVER_PRICING_KEY)) {
    localStorage.setItem(INKOVER_PRICING_KEY, JSON.stringify(DEFAULT_PRICING));
  }
  if (!localStorage.getItem(INKOVER_USERS_KEY)) {
    localStorage.setItem(INKOVER_USERS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
  }

  initLandingAuthGate();
  updateNavbarAuth();
});

function initLandingAuthGate() {
  const gate = document.getElementById('landingAuthGate');
  if (!gate) return;

  const tabSignup = document.getElementById('tabBtnSignup');
  const tabLogin = document.getElementById('tabBtnLogin');
  const formSignup = document.getElementById('gateSignupForm');
  const formLogin = document.getElementById('gateLoginForm');
  const googleBtn = document.getElementById('gateGoogleBtn');
  const skipBtn = document.getElementById('btnSkipGate');
  const forgotLink = document.getElementById('gateForgotLink');

  tabSignup?.addEventListener('click', () => switchGateTab('signup'));
  tabLogin?.addEventListener('click', () => switchGateTab('login'));

  skipBtn?.addEventListener('click', () => {
    gate.classList.add('hidden');
    showAppToast('Browsing in guest mode. Sign up anytime to download.');
  });

  googleBtn?.addEventListener('click', () => {
    const user = authGoogleLogin();
    updateNavbarAuth();
    showAppToast(`Signed in with Google as ${user.name}!`);
  });

  formSignup?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('gateSignupName')?.value.trim();
    const email = document.getElementById('gateSignupEmail')?.value.trim();
    const pass = document.getElementById('gateSignupPassword')?.value;

    if (!name || !email || !pass) return;

    const user = authSignup(name, email, pass);
    updateNavbarAuth();
    showAppToast(`Welcome, ${user.name}! Click 'Download Desktop App' above to get started.`);
  });

  formLogin?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('gateLoginEmail')?.value.trim();
    const pass = document.getElementById('gateLoginPassword')?.value;

    if (!email) return;

    const user = authLogin(email, pass);
    updateNavbarAuth();

    if (user.role === 'admin') {
      showAppToast(`👑 Logged in as Admin! Opening Pricing Control Center...`);
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } else {
      showAppToast(`Welcome back, ${user.name}! Desktop download is ready.`);
    }
  });

  forgotLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('gateLoginEmail')?.value.trim() || 'your account email';
    showAppToast(`Reset instructions sent to ${email}!`);
  });
}

