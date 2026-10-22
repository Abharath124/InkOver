/**
 * InkOver - Main Interactive Experience & Canvas Engine
 * Recreates the complete screen overlay studio in browser
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCanvasSandbox();
  initUseCasesTabs();
  initPricingToggle();
  initFaqAccordion();
  initDownloadModal();
  initReviewsSystem();
});

/* ==========================================================================
   Navigation Bar Scroll & Mobile Menu
   ========================================================================== */
function initNavbar() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
      });
    });
  }
}

/* ==========================================================================
   Interactive Epic Pen Sandbox & Canvas Engine
   ========================================================================== */
function initCanvasSandbox() {
  const canvas = document.getElementById('annotationCanvas');
  const viewport = document.getElementById('sandboxViewport');
  if (!canvas || !viewport) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Resize canvas to match display size exactly
  function resizeCanvas() {
    const rect = viewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    redrawHistory();
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100);

  // Drawing State
  let currentTool = 'pen'; // 'pen', 'highlighter', 'arrow', 'rect', 'circle', 'text', 'eraser'
  let currentColor = '#FF5722';
  let strokeWidth = 5;
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let history = [];
  let redoStack = [];
  let currentStroke = [];

  // Default color palette
  const colors = [
    '#FF5722', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF',
    '#EF4444', '#14B8A6', '#84CC16', '#6366F1'
  ];

  // DOM Elements
  const toolButtons = document.querySelectorAll('[data-tool]');
  const currentSwatch = document.getElementById('currentSwatch');
  const paletteFlyout = document.getElementById('paletteFlyout');
  const paletteGrid = document.getElementById('paletteGrid');
  const strokeButtons = document.querySelectorAll('[data-stroke]');
  const sceneToggles = document.querySelectorAll('.btn-scene-toggle');

  // Populate Palette Grid
  if (paletteGrid) {
    paletteGrid.innerHTML = '';
    colors.forEach(color => {
      const dot = document.createElement('div');
      dot.className = `palette-dot ${color === currentColor ? 'active' : ''}`;
      dot.style.backgroundColor = color;
      dot.addEventListener('click', () => {
        currentColor = color;
        if (currentSwatch) currentSwatch.style.backgroundColor = color;
        document.querySelectorAll('.palette-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        paletteFlyout?.setAttribute('hidden', 'true');
        showToast(`Color changed to ${color}`);
      });
      paletteGrid.appendChild(dot);
    });
  }

  // Toggle Palette Flyout
  if (currentSwatch && paletteFlyout) {
    currentSwatch.addEventListener('click', (e) => {
      e.stopPropagation();
      if (paletteFlyout.hasAttribute('hidden')) {
        paletteFlyout.removeAttribute('hidden');
      } else {
        paletteFlyout.setAttribute('hidden', 'true');
      }
    });

    document.addEventListener('click', (e) => {
      if (!paletteFlyout.contains(e.target) && e.target !== currentSwatch) {
        paletteFlyout.setAttribute('hidden', 'true');
      }
    });
  }

  // Tool Selection
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'clear') {
        clearCanvas();
        showToast('Canvas Cleared');
        return;
      }
      if (tool === 'undo') {
        undo();
        return;
      }
      if (tool === 'screenshot') {
        captureScreenshot();
        return;
      }

      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = tool;
      showToast(`Selected: ${tool.toUpperCase()}`);
    });
  });

  // Stroke Width Selection
  strokeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      strokeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      strokeWidth = parseInt(btn.dataset.stroke, 10);
    });
  });

  // Scene / Background Switcher
  const scenes = {
    desktop: 'url("assets/images/hero-preview.jpg")',
    whiteboard: 'linear-gradient(#f8fafc, #f1f5f9)',
    blackboard: 'linear-gradient(#0f172a, #020617)',
    slides: 'url("assets/images/whiteboard-preview.jpg")'
  };

  sceneToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      sceneToggles.forEach(t => t.classList.remove('active'));
      toggle.classList.add('active');
      const scene = toggle.dataset.scene;
      viewport.style.background = scenes[scene] || scenes.desktop;
      viewport.style.backgroundSize = 'cover';
      viewport.style.backgroundPosition = 'center';
      showToast(`Background: ${toggle.innerText}`);
    });
  });

  // Get Canvas Coordinates
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // Drawing Event Listeners
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', endDraw);

  canvas.addEventListener('touchstart', (e) => {
    if (e.target === canvas) e.preventDefault();
    startDraw(e);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (e.target === canvas) e.preventDefault();
    draw(e);
  }, { passive: false });
  window.addEventListener('touchend', endDraw);

  function startDraw(e) {
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;

    if (currentTool === 'text') {
      const userText = prompt('Enter text note to place on screen:', 'Key observation here!');
      if (userText) {
        history.push({
          type: 'text',
          text: userText,
          x: pos.x,
          y: pos.y,
          color: currentColor,
          size: strokeWidth * 3 + 12
        });
        redrawHistory();
      }
      isDrawing = false;
      return;
    }

    currentStroke = [{ x: pos.x, y: pos.y }];
  }

  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      currentStroke.push({ x: pos.x, y: pos.y });
      renderCurrentPath(currentStroke, currentTool, currentColor, strokeWidth);
    } else if (['rect', 'circle', 'arrow'].includes(currentTool)) {
      redrawHistory();
      drawShape(ctx, currentTool, startX, startY, pos.x, pos.y, currentColor, strokeWidth);
    }
  }

  function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      if (currentStroke.length > 0) {
        history.push({
          type: currentTool,
          points: [...currentStroke],
          color: currentColor,
          width: strokeWidth
        });
      }
    } else if (['rect', 'circle', 'arrow'].includes(currentTool)) {
      const pos = e.changedTouches ? getPos(e) : { x: e.clientX, y: e.clientY };
      const rect = canvas.getBoundingClientRect();
      const endX = (e.changedTouches ? pos.x : e.clientX - rect.left);
      const endY = (e.changedTouches ? pos.y : e.clientY - rect.top);
      history.push({
        type: currentTool,
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        color: currentColor,
        width: strokeWidth
      });
      redrawHistory();
    }
    redoStack = [];
    currentStroke = [];
  }

  function renderCurrentPath(points, tool, color, width) {
    if (points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 3.5;
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = width * 4;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShape(context, tool, x1, y1, x2, y2, color, width) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (tool === 'rect') {
      context.beginPath();
      context.rect(x1, y1, x2 - x1, y2 - y1);
      context.stroke();
    } else if (tool === 'circle') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = Math.min(x1, x2) + rx;
      const cy = Math.min(y1, y2) + ry;
      context.beginPath();
      context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (tool === 'arrow') {
      const headlen = width * 3.5 + 8;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();

      context.beginPath();
      context.moveTo(x2, y2);
      context.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      context.moveTo(x2, y2);
      context.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      context.stroke();
    }
    context.restore();
  }

  function redrawHistory() {
    const rect = viewport.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    history.forEach(item => {
      if (item.type === 'pen' || item.type === 'highlighter' || item.type === 'eraser') {
        renderCurrentPath(item.points, item.type, item.color, item.width);
      } else if (['rect', 'circle', 'arrow'].includes(item.type)) {
        drawShape(ctx, item.type, item.x1, item.y1, item.x2, item.y2, item.color, item.width);
      } else if (item.type === 'text') {
        ctx.save();
        ctx.font = `600 ${item.size}px 'Outfit', sans-serif`;
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x, item.y);
        ctx.restore();
      }
    });
  }

  function undo() {
    if (history.length > 0) {
      redoStack.push(history.pop());
      redrawHistory();
      showToast('Undone');
    }
  }

  function clearCanvas() {
    if (history.length > 0) {
      redoStack.push([...history]);
      history = [];
      redrawHistory();
    }
  }

  function captureScreenshot() {
    // Generate simulated download of the composite canvas
    const link = document.createElement('a');
    link.download = `InkOver-Annotation-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Screenshot saved to Downloads folder!');
  }

  // Keyboard Shortcuts Support
  window.addEventListener('keydown', (e) => {
    // Avoid interfering with inputs
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === '1') {
      selectToolByName('pen');
    } else if (e.key === '2') {
      selectToolByName('highlighter');
    } else if (e.key === '3') {
      selectToolByName('eraser');
    } else if (e.key === '4') {
      selectToolByName('arrow');
    } else if (e.key === '5') {
      selectToolByName('rect');
    } else if (e.key.toLowerCase() === 'c') {
      clearCanvas();
      showToast('Canvas Cleared (Hotkey C)');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  function selectToolByName(name) {
    const targetBtn = document.querySelector(`[data-tool="${name}"]`);
    if (targetBtn) targetBtn.click();
  }

  // Draggable Toolbar Inside Sandbox
  const toolbar = document.getElementById('epicToolbar');
  const dragHandle = document.getElementById('toolbarDrag');

  if (toolbar && dragHandle) {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = toolbar.getBoundingClientRect();
      const parentRect = viewport.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const parentRect = viewport.getBoundingClientRect();
      let newX = e.clientX - parentRect.left - dragOffsetX;
      let newY = e.clientY - parentRect.top - dragOffsetY;

      // Restrict within viewport bounds
      newX = Math.max(10, Math.min(newX, parentRect.width - toolbar.offsetWidth - 10));
      newY = Math.max(10, Math.min(newY, parentRect.height - toolbar.offsetHeight - 10));

      toolbar.style.left = `${newX}px`;
      toolbar.style.top = `${newY}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // Draw initial sample annotation on load to wow the user
  setTimeout(() => {
    drawSampleMarkings();
  }, 400);

  function drawSampleMarkings() {
    const rect = viewport.getBoundingClientRect();
    if (rect.width < 100) return;

    // Draw a sample arrow and callout
    const sampleArrow = {
      type: 'arrow',
      x1: rect.width * 0.45,
      y1: rect.height * 0.35,
      x2: rect.width * 0.65,
      y2: rect.height * 0.48,
      color: '#FF5722',
      width: 4
    };
    const sampleBox = {
      type: 'rect',
      x1: rect.width * 0.64,
      y1: rect.height * 0.44,
      x2: rect.width * 0.82,
      y2: rect.height * 0.62,
      color: '#10B981',
      width: 3
    };
    const sampleText = {
      type: 'text',
      text: 'BUY ZONE: +24% TARGET',
      x: rect.width * 0.65,
      y: rect.height * 0.42,
      color: '#F59E0B',
      size: 16
    };
    history.push(sampleArrow, sampleBox, sampleText);
    redrawHistory();
  }
}

/* ==========================================================================
   Use Cases Tabs Switcher
   ========================================================================== */
function initUseCasesTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  if (!tabs || tabs.length === 0) return;

  const titleElem = document.getElementById('useCaseTitle');
  const descElem = document.getElementById('useCaseDesc');
  const tagElem = document.getElementById('useCaseTag');
  const listElem = document.getElementById('useCaseList');
  const imgElem = document.getElementById('useCaseImg');

  const useCaseData = {
    education: {
      tag: 'Education & Classroom Tech',
      title: 'Teach with Clarity on Any Screen',
      desc: 'Draw directly over slides, textbooks, geometry proofs, and browser apps. Perfect for interactive whiteboards, smart panels, stylus tablets, and remote classroom calls.',
      features: [
        'Natural pen pressure support for hand-written math formulas',
        'Instant one-click Whiteboard & Blackboard canvas toggle',
        'Fading ink for temporary underlines during fast lectures',
        'Works seamlessly with Zoom, Google Meet, and Microsoft Teams'
      ],
      image: 'assets/images/whiteboard-preview.jpg'
    },
    presenters: {
      tag: 'Keynotes & Corporate Training',
      title: 'Command Your Audience’s Full Attention',
      desc: 'Keep clients and stakeholders locked on what matters most. Highlight bullet points, circle key metrics, and spotlight your cursor in real time without clicking out of presenter view.',
      features: [
        'Global stealth hotkeys — switch tools without opening UI',
        'Cursor halo spotlight to guide audience focus',
        'Highlighter tool preserves text readability underneath',
        'Compatible with PowerPoint, Keynote, and PDF slide decks'
      ],
      image: 'assets/images/hero-preview.jpg'
    },
    trading: {
      tag: 'Financial Analysis & Trading',
      title: 'Mark Charts & Levels with Zero Lag',
      desc: 'Plot trendlines, candlestick patterns, support/resistance zones, and risk boundaries directly on TradingView, Bloomberg terminal, or multi-screen broker feeds.',
      features: [
        'Draw clean geometric rectangles and support arrows',
        'Multi-monitor span support across all trading screens',
        'Quick screenshot tool to export charts straight to Discord or Telegram',
        'Retains marks while live candlestick charts tick underneath'
      ],
      image: 'assets/images/hero-preview.jpg'
    },
    creators: {
      tag: 'Streamers & Video Creators',
      title: 'Real-Time Screen Annotation for OBS & YouTube',
      desc: 'Explain gameplay strategies, code walkthroughs, or 3D animations live. Cut hours off your video editing pipeline by annotating on-screen in real time.',
      features: [
        'Direct capture support in OBS Studio, vMix, and Streamlabs',
        'Ghost Mode hides the entire toolbar from stream output',
        'Ultra-low CPU and RAM footprint (< 15MB overhead)',
        'Custom color picker matches your stream branding'
      ],
      image: 'assets/images/hero-preview.jpg'
    },
    coaches: {
      tag: 'Athletics & Esports Coaches',
      title: 'Visual Chalk-Talk Over Any Match Footage',
      desc: 'Break down defensive formations, running lanes, and tactical plays over video playback in VLC, YouTube, or scouting software without rendering pauses.',
      features: [
        'Precision vector arrows for player movement routes',
        'Freeze-frame illustration and tactical play diagrams',
        'Touchscreen tablet compatibility with Surface & Wacom',
        'Save review frames to team playbook library'
      ],
      image: 'assets/images/whiteboard-preview.jpg'
    },
    enterprise: {
      tag: 'IT Administrators & Enterprises',
      title: 'Mass Deployment & Centralized Licensing',
      desc: 'Deploy InkOver Studio across school districts, universities, and enterprise workstations with silent MSI installation and group policy controls.',
      features: [
        'Standard MSI package with silent unattended install switch',
        'Central license dashboard with seat reassignment',
        'Zero telemetry, offline activation support, and GDPR compliance',
        'Volume pricing tiers and corporate procurement support'
      ],
      image: 'assets/images/hero-preview.jpg'
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.target;
      const data = useCaseData[key];
      if (!data) return;

      if (tagElem) tagElem.innerText = data.tag;
      if (titleElem) titleElem.innerText = data.title;
      if (descElem) descElem.innerText = data.desc;
      if (imgElem) imgElem.src = data.image;

      if (listElem) {
        listElem.innerHTML = '';
        data.features.forEach(feat => {
          const li = document.createElement('li');
          li.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${feat}
          `;
          listElem.appendChild(li);
        });
      }
    });
  });
}

/* ==========================================================================
   Pricing Toggle (Monthly vs Annual)
   ========================================================================== */
function initPricingToggle() {
  const toggle = document.getElementById('billingToggle');
  const proPriceElem = document.getElementById('proPrice');
  const proPeriodElem = document.getElementById('proPeriod');
  const proSubtextElem = document.getElementById('proSubtext');

  if (!toggle) return;

  let isAnnual = true;

  toggle.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggle.classList.toggle('annual', isAnnual);

    if (isAnnual) {
      if (proPriceElem) proPriceElem.innerText = '$2.99';
      if (proPeriodElem) proPeriodElem.innerText = '/ month';
      if (proSubtextElem) proSubtextElem.innerText = 'Billed annually at $35.88 / year';
      showToast('Annual billing selected (Save 35%)');
    } else {
      if (proPriceElem) proPriceElem.innerText = '$4.99';
      if (proPeriodElem) proPeriodElem.innerText = '/ month';
      if (proSubtextElem) proSubtextElem.innerText = 'Billed monthly, cancel anytime';
      showToast('Monthly billing selected');
    }
  });
}

/* ==========================================================================
   FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (question && answer) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');

        // Close other items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('open');
          const otherAns = otherItem.querySelector('.faq-answer');
          if (otherAns) otherAns.style.maxHeight = null;
        });

        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = `${answer.scrollHeight + 30}px`;
        }
      });
    }
  });
}

/* ==========================================================================
   Download Modal & Installer Launcher
   ========================================================================== */
function initDownloadModal() {
  const modal = document.getElementById('downloadModal');
  const triggers = document.querySelectorAll('.btn-download-trigger');
  const closeBtn = document.getElementById('closeModal');

  triggers.forEach(trig => {
    trig.addEventListener('click', (e) => {
      e.preventDefault();
      if (modal) {
        modal.classList.add('active');
      } else {
        // If on another page without the modal (e.g. pricing/features), download setup directly
        simulateDownload('InkOver-Setup.exe');
      }
    });
  });

  if (modal) {
    closeBtn?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    // Action Buttons inside Modal
    document.querySelectorAll('.btn-download-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileName = btn.dataset.file || 'InkOver-Setup.exe';
        simulateDownload(fileName);
        modal.classList.remove('active');
      });
    });
  }
}

function simulateDownload(filename) {
  const isZip = filename.toLowerCase().endsWith('.zip');
  const downloadName = isZip ? 'InkOver-Portable.zip' : 'InkOver-Setup.exe';
  const actualPackage = isZip 
    ? 'assets/downloads/InkOver-Setup.zip' 
    : 'assets/downloads/InkOver-Setup.exe';

  showToast(`Downloading ${downloadName}... Thank you for choosing InkOver!`);

  const a = document.createElement('a');
  a.href = actualPackage;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    showToast(`Downloaded ${downloadName}! Run the setup to start drawing.`);
  }, 1000);
}

/* ==========================================================================
   Micro Toast Notification Feedback
   ========================================================================== */
function showToast(message) {
  let toast = document.getElementById('epicToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'epicToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(255, 87, 34, 0.5);
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 9999;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5722" stroke-width="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    ${message}
  `;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 2800);
}

/* ==========================================================================
   Interactive Community Reviews System
   ========================================================================== */
function initReviewsSystem() {
  const openBtn = document.getElementById('btnOpenReviewModal');
  const modal = document.getElementById('reviewModal');
  const closeBtn = document.getElementById('closeReviewModal');
  const reviewForm = document.getElementById('reviewForm');
  const starsContainer = document.getElementById('interactiveStars');
  const ratingInput = document.getElementById('selectedRating');
  const grid = document.getElementById('testimonialsGrid');

  if (!modal || !grid) return;

  // Restore stored user reviews from localStorage
  const savedReviews = JSON.parse(localStorage.getItem('inkover_user_reviews') || localStorage.getItem('epic_pen_user_reviews') || '[]');
  savedReviews.forEach(r => appendReviewCard(r, false));

  // Modal open/close
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Star Rating Interaction
  if (starsContainer && ratingInput) {
    const starSpans = starsContainer.querySelectorAll('span');
    starSpans.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.star, 10);
        ratingInput.value = rating;
        highlightStars(rating);
      });
      star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.dataset.star, 10);
        highlightStars(rating);
      });
    });

    starsContainer.addEventListener('mouseleave', () => {
      highlightStars(parseInt(ratingInput.value, 10));
    });

    function highlightStars(val) {
      starSpans.forEach(s => {
        const sVal = parseInt(s.dataset.star, 10);
        s.style.color = sVal <= val ? '#F59E0B' : '#4B5563';
        s.style.transform = sVal <= val ? 'scale(1.15)' : 'scale(1)';
        s.style.transition = 'all 0.15s ease';
      });
    }
  }

  // Handle Form Submission
  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const author = document.getElementById('reviewAuthor').value.trim();
      const role = document.getElementById('reviewRole').value.trim();
      const comment = document.getElementById('reviewComment').value.trim();
      const rating = parseInt(ratingInput.value, 10) || 5;

      if (!author || !comment) return;

      const newReview = { author, role, comment, rating };

      // Append immediately to the grid
      appendReviewCard(newReview, true);

      // Save to localStorage
      savedReviews.unshift(newReview);
      localStorage.setItem('inkover_user_reviews', JSON.stringify(savedReviews));

      // Reset and close
      reviewForm.reset();
      ratingInput.value = '5';
      modal.classList.remove('active');

      showToast(`Thank you, ${author}! Your review is now live.`);
    });
  }

  function appendReviewCard(review, isNew = false) {
    const card = document.createElement('div');
    card.className = 'testimonial-card';
    if (isNew) {
      card.style.animation = 'fadeInUp 0.5s ease forwards';
      card.style.borderColor = 'rgba(255, 87, 34, 0.6)';
    }

    const initials = review.author
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'EP';

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span style="color: ${i <= review.rating ? '#F59E0B' : '#4B5563'};">★</span>`;
    }

    card.innerHTML = `
      <div>
        <div class="star-rating">
          ${starsHtml}
        </div>
        <p class="testimonial-text">
          "${escapeHtml(review.comment)}"
        </p>
      </div>
      <div class="author-box">
        <div class="author-avatar" style="background: linear-gradient(135deg, #FF5722, #EA580C);">${escapeHtml(initials)}</div>
        <div class="author-info">
          <h5>${escapeHtml(review.author)}</h5>
          <p>${escapeHtml(review.role || 'Verified User')}</p>
        </div>
      </div>
    `;

    // Insert at the beginning of the grid
    grid.insertBefore(card, grid.firstChild);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
