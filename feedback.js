/* =====================================================
   MyTrip Feedback Overlay System — feedback.js
   Entirely additive. Does not modify existing features.
   ===================================================== */

const FeedbackSystem = (() => {
    'use strict';

    // ── State ──────────────────────────────────────────────────────────
    let feedbackModeOn = false;
    let unsubscribeSnapshot = null;        // onSnapshot listener handle
    const COLLECTION = 'mytrip_feedback';

    // ── Firestore / Auth helpers ────────────────────────────────────────
    function getDb()   { return window.firebase && firebase.firestore   ? firebase.firestore()   : null; }
    function getAuth() { return window.firebase && firebase.auth        ? firebase.auth()        : null; }
    function currentUser() { const a = getAuth(); return a ? a.currentUser : null; }

    // ── Initialise ──────────────────────────────────────────────────────
    function init() {
        injectToggleButton();
        injectBanner();
        injectTriggerButtons();
        console.log('[Feedback] Initialized');
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TOGGLE BUTTON
    // ═══════════════════════════════════════════════════════════════════
    function injectToggleButton() {
        const btn = document.createElement('button');
        btn.id = 'feedbackToggleBtn';
        btn.setAttribute('aria-label', 'Toggle Feedback Mode');
        btn.innerHTML = '✏';
        btn.title = 'Feedback Mode';
        applyToggleStyle(btn, false);
        btn.addEventListener('click', toggleFeedbackMode);
        document.body.appendChild(btn);
    }

    function applyToggleStyle(btn, on) {
        Object.assign(btn.style, {
            position:      'fixed',
            bottom:        '88px',
            right:         '16px',
            width:         '44px',
            height:        '44px',
            borderRadius:  '50%',
            border:        on ? '1px solid rgba(78,205,196,0.4)' : '1px solid rgba(255,255,255,0.12)',
            background:    on ? 'rgba(78,205,196,0.12)'          : 'rgba(255,255,255,0.06)',
            color:         on ? 'var(--accent-seafoam, #4ECDC4)' : 'rgba(255,255,255,0.3)',
            fontSize:      '18px',
            cursor:        'pointer',
            zIndex:        '200',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            backdropFilter:'blur(8px)',
            transition:    'all 0.2s ease',
            animation:     on ? 'fbPulse 1.5s ease-in-out infinite' : 'none',
            boxShadow:     on ? '0 0 0 4px rgba(78,205,196,0.15)' : 'none',
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  BANNER
    // ═══════════════════════════════════════════════════════════════════
    function injectBanner() {
        const banner = document.createElement('div');
        banner.id = 'feedbackBanner';
        banner.textContent = 'Feedback Mode — tap any ＋ to add a note';
        Object.assign(banner.style, {
            display:        'none',
            position:       'sticky',
            top:            '0',
            left:           '0',
            right:          '0',
            background:     'rgba(78,205,196,0.07)',
            borderBottom:   '1px solid rgba(78,205,196,0.15)',
            color:          'var(--accent-seafoam, #4ECDC4)',
            fontFamily:     "'Outfit', sans-serif",
            fontSize:       '12px',
            textAlign:      'center',
            padding:        '6px 16px',
            zIndex:         '99',
        });

        // Insert just inside #app, before the first child
        const app = document.getElementById('app');
        if (app) app.insertBefore(banner, app.firstChild);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TRIGGER BUTTONS
    // ═══════════════════════════════════════════════════════════════════

    // Static zone definitions: selector → zone label
    const STATIC_ZONES = [
        { sel: '.app-header',                       zone: 'App header' },
        { sel: '#landingScreen',                    zone: 'Landing page hero' },
        { sel: '#ai-scan-card',                     zone: 'AI booking scan section' },
        { sel: '#tripFormScreen',                   zone: 'Trip details form' },
        { sel: '#vehicleSection',                   zone: 'Vehicle details section' },
        { sel: '#rentalInspectionSection',          zone: 'Rental inspection section' },
        { sel: '.trip-progress-bar',                zone: 'Trip progress bar' },
        { sel: '.itinerary-header',                 zone: 'Trip progress bar' },
        { sel: '.budget-overview-card',             zone: 'Budget overview card' },
        { sel: '#prebookingsList',                  zone: 'Pre-bookings section' },
        { sel: '.export-btns',                      zone: 'Export buttons' },
        { sel: '.bottom-tab-bar',                   zone: 'Bottom tab bar' },
    ];

    function injectTriggerButtons() {
        // Inject static triggers
        STATIC_ZONES.forEach(({ sel, zone }) => {
            const el = document.querySelector(sel);
            if (el) attachTrigger(el, zone);
        });

        // Dynamic triggers are injected whenever renderDays / renderPrebookings runs
        // We patch those via MutationObserver on #tripDetailContent and #prebookingsList
        observeDynamic('#tripDetailContent', injectDynamicDayTriggers);
        observeDynamic('#prebookingsList',   injectDynamicPrebookingTriggers);
        observeDynamic('#daysList',          injectDynamicDayTriggers);
    }

    function observeDynamic(sel, cb) {
        const target = document.querySelector(sel);
        if (!target) {
            // Watch for future creation via body observer
            const bodyObs = new MutationObserver(() => {
                const el = document.querySelector(sel);
                if (el) { cb(el); bodyObs.disconnect(); observeDynamic(sel, cb); }
            });
            bodyObs.observe(document.body, { childList: true, subtree: true });
            return;
        }
        cb(target);
        new MutationObserver(() => cb(target))
            .observe(target, { childList: true, subtree: false });
    }

    function injectDynamicDayTriggers(container) {
        // Day cards: [data-day-number], or falling back to .day-card
        container.querySelectorAll('[data-day-number]').forEach(card => {
            const n = card.dataset.dayNumber;
            if (!card.dataset.fbTrigger) {
                attachTrigger(card, `Day card - Day ${n}`);
                // Section triggers inside day card
                const cats = [
                    { sel: '.travel-section, [data-section="travel"]', label: `Day ${n} - TRAVEL section` },
                    { sel: '.stay-section, [data-section="stay"]',     label: `Day ${n} - STAY section` },
                    { sel: '.meal-section, [data-section="meal"]',     label: `Day ${n} - MEAL section` },
                    { sel: '.activity-section, [data-section="activity"]', label: `Day ${n} - ACTIVITY section` },
                    { sel: '.add-item-row, .add-items-row',            label: 'Add item buttons row' },
                ];
                cats.forEach(({ sel, label }) => {
                    card.querySelectorAll(sel).forEach(sec => attachTrigger(sec, label));
                });
                // Item cards
                card.querySelectorAll('.item-card, .expense-item, .day-item-card').forEach(item => {
                    const name = item.querySelector('strong, .item-name')?.textContent?.trim() || 'Item';
                    attachTrigger(item, `Item card - ${name.substring(0, 30)}`);
                });
            }
        });
    }

    function injectDynamicPrebookingTriggers(container) {
        container.querySelectorAll('.prebooking-card').forEach(card => {
            if (!card.dataset.fbTrigger) {
                const name = card.querySelector('strong')?.textContent?.trim() || 'Booking';
                attachTrigger(card, `Pre-booking card - ${name.substring(0, 30)}`);
            }
        });
    }

    function attachTrigger(parent, zone) {
        if (parent.dataset.fbTrigger) return; // already attached
        parent.dataset.fbTrigger = zone;

        // Ensure parent is positioned
        const pos = getComputedStyle(parent).position;
        if (!pos || pos === 'static') parent.style.position = 'relative';

        const btn = document.createElement('button');
        btn.className = 'fb-trigger-btn';
        btn.dataset.zone = zone;
        btn.textContent = '＋';
        btn.title = `Add note: ${zone}`;
        btn.style.display = feedbackModeOn ? 'flex' : 'none';
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openFeedbackPopup(zone);
        });
        parent.appendChild(btn);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TOGGLE FEEDBACK MODE
    // ═══════════════════════════════════════════════════════════════════
    function toggleFeedbackMode() {
        feedbackModeOn = !feedbackModeOn;

        const btn    = document.getElementById('feedbackToggleBtn');
        const banner = document.getElementById('feedbackBanner');

        applyToggleStyle(btn, feedbackModeOn);
        if (banner) banner.style.display = feedbackModeOn ? 'block' : 'none';

        // Show/hide all trigger buttons
        document.querySelectorAll('.fb-trigger-btn').forEach(b => {
            b.style.display = feedbackModeOn ? 'flex' : 'none';
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  FEEDBACK POPUP
    // ═══════════════════════════════════════════════════════════════════
    function openFeedbackPopup(zone) {
        // Remove any existing
        closePopup();

        const user = currentUser();
        if (!user) {
            showToast('Sign in to leave feedback', '#FF6B6B');
            return;
        }

        let selectedPriority = 'medium';

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'fbBackdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '300',
        });
        backdrop.addEventListener('click', closePopup);

        // Popup card
        const popup = document.createElement('div');
        popup.id = 'fbPopup';
        Object.assign(popup.style, {
            position:     'fixed',
            top:          '50%',
            left:         '50%',
            transform:    'translate(-50%, -50%) scale(0.92)',
            opacity:      '0',
            width:        'calc(100% - 48px)',
            maxWidth:     '360px',
            background:   '#0D2137',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding:      '22px',
            zIndex:       '301',
            transition:   'transform 200ms ease-out, opacity 200ms ease-out',
            fontFamily:   "'Outfit', sans-serif",
        });

        popup.innerHTML = `
            <h3 style="margin:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;">Add Feedback</h3>
            <p style="margin:4px 0 16px;font-size:11px;color:rgba(255,255,255,0.4);">Section: ${zone}</p>

            <textarea id="fbNoteInput" placeholder="What would you like to change or improve here?"
                style="width:100%;box-sizing:border-box;min-height:100px;
                       background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                       border-radius:12px;padding:12px;font-family:'Outfit',sans-serif;
                       font-size:14px;color:#fff;resize:vertical;outline:none;
                       transition:border-color 200ms,box-shadow 200ms;"></textarea>

            <div style="margin-top:12px;">
                <div style="font-size:12px;color:rgba(255,255,255,0.4);">Priority</div>
                <div id="fbPriorityRow" style="display:flex;gap:8px;margin-top:6px;">
                    <button class="fb-priority-pill" data-p="low">Low</button>
                    <button class="fb-priority-pill fb-priority-active-medium" data-p="medium">Medium</button>
                    <button class="fb-priority-pill" data-p="high">High</button>
                </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
                <button id="fbCancelBtn"
                    style="background:transparent;border:1px solid rgba(255,255,255,0.15);
                           color:rgba(255,255,255,0.55);border-radius:12px;padding:9px 18px;
                           font-family:'Outfit',sans-serif;font-size:14px;font-weight:500;cursor:pointer;">
                    Cancel
                </button>
                <button id="fbSaveBtn"
                    style="background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.45);
                           color:var(--accent-seafoam,#4ECDC4);border-radius:12px;padding:9px 18px;
                           font-family:'Outfit',sans-serif;font-size:14px;font-weight:500;cursor:pointer;">
                    Save Note
                </button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(() => {
            popup.style.transform = 'translate(-50%, -50%) scale(1)';
            popup.style.opacity   = '1';
        });

        // Textarea focus styles
        const ta = popup.querySelector('#fbNoteInput');
        ta.addEventListener('focus', () => {
            ta.style.borderColor = 'var(--accent-seafoam, #4ECDC4)';
            ta.style.boxShadow   = '0 0 0 3px rgba(78,205,196,0.1)';
        });
        ta.addEventListener('blur', () => {
            ta.style.borderColor = 'rgba(255,255,255,0.12)';
            ta.style.boxShadow   = 'none';
        });
        ta.focus();

        // Priority pills
        const pillStyles = {
            base:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' },
            low:    { background: 'rgba(78,205,196,0.15)',  border: '1px solid rgba(78,205,196,0.45)',  color: 'var(--accent-seafoam,#4ECDC4)' },
            medium: { background: 'rgba(247,201,72,0.15)',  border: '1px solid rgba(247,201,72,0.45)',  color: 'var(--accent-gold,#F7C948)' },
            high:   { background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.45)', color: 'var(--accent-coral,#FF6B6B)' },
        };

        function refreshPills(active) {
            popup.querySelectorAll('.fb-priority-pill').forEach(p => {
                const pv = p.dataset.p;
                Object.assign(p.style, pv === active ? pillStyles[pv] : pillStyles.base);
            });
        }

        popup.querySelectorAll('.fb-priority-pill').forEach(pill => {
            // Base styles
            Object.assign(pill.style, {
                borderRadius: '20px', padding: '5px 16px', cursor: 'pointer',
                font: '12px/1.5 "Outfit", sans-serif', fontWeight: '500',
            });
            Object.assign(pill.style, pillStyles.base);
            pill.addEventListener('click', () => {
                selectedPriority = pill.dataset.p;
                refreshPills(selectedPriority);
            });
        });
        refreshPills('medium');

        // Cancel
        popup.querySelector('#fbCancelBtn').addEventListener('click', closePopup);

        // Save
        popup.querySelector('#fbSaveBtn').addEventListener('click', async () => {
            const note = ta.value.trim();
            if (!note) {
                // Shake textarea
                ta.style.animation = 'none';
                ta.offsetHeight; // reflow
                ta.style.animation = 'fbShake 300ms ease';
                setTimeout(() => ta.style.animation = '', 300);
                return;
            }

            const db = getDb();
            if (!db) { showToast('Firebase not available', '#FF6B6B'); return; }

            try {
                await db.collection(COLLECTION).add({
                    id:            Date.now().toString(),
                    zone,
                    note,
                    priority:      selectedPriority,
                    userId:        user.uid,
                    userName:      user.displayName || user.email || 'Anonymous',
                    timestamp:     firebase.firestore.FieldValue.serverTimestamp(),
                    implemented:   false,
                    implementedAt: null,
                    version:       null,
                });
                closePopup();
                showToast('Feedback saved ✓');
            } catch (err) {
                console.error('[Feedback] Save error:', err);
                showToast('Could not save — check connection', '#FF6B6B');
            }
        });
    }

    function closePopup() {
        const bd = document.getElementById('fbBackdrop');
        const pp = document.getElementById('fbPopup');
        if (bd) bd.remove();
        if (pp) pp.remove();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TOAST
    // ═══════════════════════════════════════════════════════════════════
    function showToast(msg, color) {
        const t = document.createElement('div');
        t.textContent = msg;
        Object.assign(t.style, {
            position:     'fixed',
            bottom:       '96px',
            left:         '50%',
            transform:    'translateX(-50%)',
            background:   'rgba(78,205,196,0.12)',
            border:       `1px solid ${color ? 'rgba(255,107,107,0.35)' : 'rgba(78,205,196,0.35)'}`,
            color:        color || 'var(--accent-seafoam, #4ECDC4)',
            borderRadius: '20px',
            padding:      '8px 22px',
            fontFamily:   "'Outfit', sans-serif",
            fontSize:     '13px',
            fontWeight:   '500',
            whiteSpace:   'nowrap',
            zIndex:       '500',
            opacity:      '0',
            transition:   'opacity 200ms',
        });
        if (color) {
            t.style.background = 'rgba(255,107,107,0.12)';
        }
        document.body.appendChild(t);
        requestAnimationFrame(() => {
            t.style.opacity = '1';
            setTimeout(() => {
                t.style.transition = 'opacity 300ms';
                t.style.opacity = '0';
                setTimeout(() => t.remove(), 300);
            }, 1800);
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  NOTES PANEL  (bottom sheet)
    // ═══════════════════════════════════════════════════════════════════
    function openNotesPanel() {
        closePanelIfOpen();

        const user = currentUser();
        if (!user) { showToast('Sign in to view feedback notes', '#FF6B6B'); return; }

        AccountUI.closeDropdown && AccountUI.closeDropdown();

        // Backdrop
        const bd = document.createElement('div');
        bd.id = 'fbPanelBackdrop';
        Object.assign(bd.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.5)', zIndex: '399',
        });
        bd.addEventListener('click', closePanelIfOpen);

        // Sheet
        const sheet = document.createElement('div');
        sheet.id = 'fbNotesPanel';
        Object.assign(sheet.style, {
            position:     'fixed',
            bottom:       '0', left: '0', right: '0',
            maxHeight:    '78vh',
            background:   '#0D2137',
            borderTop:    '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px 20px 0 0',
            padding:      '20px 20px 100px',
            overflowY:    'auto',
            zIndex:       '400',
            transform:    'translateY(100%)',
            transition:   'transform 350ms ease-out',
            fontFamily:   "'Outfit', sans-serif",
        });

        sheet.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <h3 style="margin:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;">My Feedback Notes</h3>
                <button id="fbPanelClose"
                    style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);
                           border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:16px;
                           cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div id="fbStatRow" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;"></div>
            <div id="fbFilterRow" style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
                <button class="fb-filter-pill fb-filter-active" data-f="all">All</button>
                <button class="fb-filter-pill" data-f="pending">Pending</button>
                <button class="fb-filter-pill" data-f="implemented">Implemented</button>
            </div>
            <div id="fbNotesList">
                ${skeletonLoader()}
            </div>
            <button id="fbExportBtn"
                style="width:100%;height:44px;background:rgba(255,255,255,0.05);
                       border:1px solid rgba(255,255,255,0.1);border-radius:12px;
                       font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;
                       color:rgba(255,255,255,0.45);cursor:pointer;margin-top:20px;">
                ↓ Export Notes as JSON
            </button>
        `;

        document.body.appendChild(bd);
        document.body.appendChild(sheet);

        requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });

        sheet.querySelector('#fbPanelClose').addEventListener('click', closePanelIfOpen);

        // Filter pills
        let activeFilter = 'all';
        let allNotes = [];

        const filterBtnBase = {
            borderRadius: '20px', padding: '6px 16px', fontSize: '12px',
            fontWeight: '500', cursor: 'pointer', border: 'none',
        };
        sheet.querySelectorAll('.fb-filter-pill').forEach(pill => {
            Object.assign(pill.style, filterBtnBase);
            refreshFilterStyle(pill, pill.dataset.f === 'all');
            pill.addEventListener('click', () => {
                activeFilter = pill.dataset.f;
                sheet.querySelectorAll('.fb-filter-pill').forEach(p =>
                    refreshFilterStyle(p, p.dataset.f === activeFilter));
                renderNotes(allNotes, activeFilter);
            });
        });

        // Export
        sheet.querySelector('#fbExportBtn').addEventListener('click', () => {
            const json = JSON.stringify(allNotes, null, 2);
            navigator.clipboard.writeText(json)
                .then(() => showToast('Copied to clipboard ✓'))
                .catch(() => showToast('Copy failed', '#FF6B6B'));
        });

        // Live subscription
        const db = getDb();
        if (!db) {
            document.getElementById('fbNotesList').innerHTML = emptyState();
            return;
        }

        unsubscribeSnapshot = db.collection(COLLECTION)
            .where('userId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                allNotes = snapshot.docs.map(d => ({ _docId: d.id, ...d.data() }));
                updateStatBadges(allNotes, sheet);
                renderNotes(allNotes, activeFilter);
            }, err => {
                console.error('[Feedback] onSnapshot error:', err);
                document.getElementById('fbNotesList').innerHTML =
                    '<p style="color:rgba(255,107,107,0.7);font-size:13px;padding:20px 0;text-align:center;">Could not load notes</p>';
            });
    }

    function refreshFilterStyle(pill, active) {
        Object.assign(pill.style, active
            ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }
            : { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.35)' }
        );
    }

    function skeletonLoader() {
        return Array(3).fill(0).map(() => `
            <div style="background:rgba(255,255,255,0.04);border-radius:14px;height:90px;
                        margin-bottom:10px;animation:fbSkeletonPulse 1.5s ease-in-out infinite;"></div>
        `).join('');
    }

    function updateStatBadges(notes, sheet) {
        const pending     = notes.filter(n => !n.implemented).length;
        const implemented = notes.filter(n =>  n.implemented).length;
        const row = sheet.querySelector('#fbStatRow');
        if (!row) return;
        row.innerHTML = `
            <span style="background:rgba(247,201,72,0.1);border:1px solid rgba(247,201,72,0.25);
                         color:var(--accent-gold,#F7C948);border-radius:20px;padding:4px 12px;
                         font-size:11px;font-weight:500;">⏳ ${pending} Pending</span>
            <span style="background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.25);
                         color:var(--accent-seafoam,#4ECDC4);border-radius:20px;padding:4px 12px;
                         font-size:11px;font-weight:500;">✓ ${implemented} Implemented</span>
        `;
    }

    function renderNotes(notes, filter) {
        const container = document.getElementById('fbNotesList');
        if (!container) return;

        let filtered = [...notes];
        if (filter === 'pending')     filtered = notes.filter(n => !n.implemented);
        if (filter === 'implemented') filtered = notes.filter(n =>  n.implemented);

        // Sort: pending first, then implemented; newest first within each group
        filtered.sort((a, b) => {
            if (a.implemented !== b.implemented) return a.implemented ? 1 : -1;
            const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return tB - tA;
        });

        if (filtered.length === 0) {
            container.innerHTML = emptyState(filter);
            return;
        }

        container.innerHTML = filtered.map(n => noteCard(n)).join('');

        // Wire delete buttons
        container.querySelectorAll('.fb-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => promptDelete(btn, btn.dataset.docId));
        });
    }

    function noteCard(n) {
        const priorityBorder  = { high: '#FF6B6B', medium: '#F7C948', low: '#4ECDC4' };
        const priorityChipBg  = { high: 'rgba(255,107,107,0.12)', medium: 'rgba(247,201,72,0.12)', low: 'rgba(78,205,196,0.12)' };
        const priorityChipBdr = { high: 'rgba(255,107,107,0.3)',  medium: 'rgba(247,201,72,0.3)',  low: 'rgba(78,205,196,0.3)' };
        const priorityChipClr = { high: '#FF6B6B', medium: '#F7C948', low: '#4ECDC4' };

        const pri = n.priority || 'medium';
        const ts = n.timestamp?.toDate ? n.timestamp.toDate() : new Date();
        const dateStr = ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        const implDetail = n.implemented
            ? (n.version ? `Fixed in ${n.version}` : (n.implementedAt ? `Fixed on ${new Date(n.implementedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''))
            : '';

        return `
            <div class="fb-note-card" data-doc-id="${n._docId}"
                style="background:rgba(255,255,255,0.05);border-radius:14px;padding:14px 16px;
                       margin-bottom:10px;border-left:4px solid ${priorityBorder[pri]};
                       transition:max-height 300ms ease,opacity 300ms ease,margin 300ms ease,padding 300ms ease;
                       overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.38);
                                 text-transform:uppercase;letter-spacing:1.5px;flex:1;">${n.zone}</span>
                    <span style="background:${priorityChipBg[pri]};border:1px solid ${priorityChipBdr[pri]};
                                 color:${priorityChipClr[pri]};border-radius:20px;padding:2px 8px;
                                 font-size:10px;font-weight:600;flex-shrink:0;margin-left:8px;">
                        ${pri.charAt(0).toUpperCase() + pri.slice(1)}
                    </span>
                </div>
                <p style="margin:0 0 6px;font-size:14px;color:${n.implemented ? 'rgba(255,255,255,0.32)' : '#fff'};
                           line-height:1.5;${n.implemented ? 'text-decoration:line-through;' : ''}">${escHtml(n.note)}</p>
                <div style="font-size:11px;color:rgba(255,255,255,0.28);margin-bottom:10px;">
                    Added ${dateStr} · ${timeStr}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        ${n.implemented
                            ? `<span style="background:rgba(78,205,196,0.08);border:1px solid rgba(78,205,196,0.2);
                                           color:var(--accent-seafoam,#4ECDC4);border-radius:20px;padding:3px 10px;
                                           font-size:11px;font-weight:500;">✓ Implemented</span>
                               ${implDetail ? `<div style="font-size:11px;color:rgba(255,255,255,0.28);margin-top:4px;">${escHtml(implDetail)}</div>` : ''}`
                            : `<span style="background:rgba(247,201,72,0.08);border:1px solid rgba(247,201,72,0.2);
                                           color:var(--accent-gold,#F7C948);border-radius:20px;padding:3px 10px;
                                           font-size:11px;font-weight:500;">⏳ Pending review</span>`
                        }
                    </div>
                    <div class="fb-delete-area" data-doc-id="${n._docId}">
                        <button class="fb-delete-btn" data-doc-id="${n._docId}"
                            style="background:none;border:none;color:rgba(255,107,107,0.55);
                                   font-family:'Outfit',sans-serif;font-size:12px;cursor:pointer;">Delete</button>
                    </div>
                </div>
            </div>`;
    }

    function promptDelete(btn, docId) {
        const area = document.querySelector(`.fb-delete-area[data-doc-id="${docId}"]`);
        if (!area) return;
        area.innerHTML = `
            <span style="font-size:12px;color:rgba(255,255,255,0.5);">Remove? </span>
            <button class="fb-confirm-yes" data-doc-id="${docId}"
                style="background:none;border:none;color:#FF6B6B;font-size:12px;cursor:pointer;font-weight:600;">Yes</button>
            <span style="font-size:12px;color:rgba(255,255,255,0.3);"> | </span>
            <button class="fb-confirm-no" data-doc-id="${docId}"
                style="background:none;border:none;color:rgba(255,255,255,0.38);font-size:12px;cursor:pointer;">No</button>
        `;
        area.querySelector('.fb-confirm-yes').addEventListener('click', () => deleteNote(docId));
        area.querySelector('.fb-confirm-no').addEventListener('click', () => {
            area.innerHTML = `<button class="fb-delete-btn" data-doc-id="${docId}"
                style="background:none;border:none;color:rgba(255,107,107,0.55);
                       font-family:'Outfit',sans-serif;font-size:12px;cursor:pointer;">Delete</button>`;
            area.querySelector('.fb-delete-btn').addEventListener('click', () => promptDelete(area.querySelector('.fb-delete-btn'), docId));
        });
    }

    async function deleteNote(docId) {
        const db = getDb();
        if (!db) return;
        try {
            // Animate card out
            const card = document.querySelector(`.fb-note-card[data-doc-id="${docId}"]`);
            if (card) {
                const h = card.offsetHeight;
                Object.assign(card.style, { maxHeight: h + 'px', overflow: 'hidden' });
                requestAnimationFrame(() => {
                    card.style.maxHeight = '0';
                    card.style.opacity   = '0';
                    card.style.marginBottom = '0';
                    card.style.paddingTop   = '0';
                    card.style.paddingBottom= '0';
                });
                setTimeout(() => card.remove(), 320);
            }
            await db.collection(COLLECTION).doc(docId).delete();
        } catch (err) {
            console.error('[Feedback] Delete error:', err);
            showToast('Could not delete note', '#FF6B6B');
        }
    }

    function emptyState(filter) {
        return `
            <div style="text-align:center;padding:40px 0;">
                <div style="font-size:28px;">📋</div>
                <div style="font-size:15px;font-weight:500;color:rgba(255,255,255,0.45);margin-top:10px;">No notes yet</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.28);max-width:220px;text-align:center;
                             line-height:1.6;margin:6px auto 0;">
                    ${filter && filter !== 'all'
                        ? `No ${filter} notes found`
                        : 'Enable Feedback Mode and tap ＋ on any section to add a note'}
                </div>
            </div>`;
    }

    function closePanelIfOpen() {
        const bd    = document.getElementById('fbPanelBackdrop');
        const sheet = document.getElementById('fbNotesPanel');
        if (sheet) {
            sheet.style.transform = 'translateY(100%)';
            setTimeout(() => { if (sheet) sheet.remove(); }, 360);
        }
        if (bd) bd.remove();
        if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    }

    // ── helpers ─────────────────────────────────────────────────────────
    function escHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ACCOUNT DROPDOWN HOOK
    // ═══════════════════════════════════════════════════════════════════
    function hookAccountDropdown() {
        // Patch AccountUI.renderDropdownContent to append "My Feedback" item
        if (typeof AccountUI === 'undefined') {
            setTimeout(hookAccountDropdown, 500);
            return;
        }
        const original = AccountUI.renderDropdownContent.bind(AccountUI);
        AccountUI.renderDropdownContent = function() {
            original();
            // Add "My Feedback" button if not already present
            const content = document.getElementById('accountDropdownContent');
            if (!content || content.querySelector('#fbMyNotesBtn')) return;
            const btn = document.createElement('button');
            btn.id = 'fbMyNotesBtn';
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'width:100%;margin-top:0.5rem;';
            btn.innerHTML = '📋 My Feedback';
            btn.onclick = () => { AccountUI.closeDropdown(); openNotesPanel(); };
            // Append inside the actions section
            const actionsDiv = content.querySelector('.account-actions');
            if (actionsDiv) actionsDiv.appendChild(btn);
            else content.appendChild(btn);
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════════════
    return { init, openNotesPanel, toggleFeedbackMode };
})();

// ── Boot ──────────────────────────────────────────────────────────────
(function bootFeedback() {
    function start() {
        FeedbackSystem.init();
        // Patch account dropdown after AccountUI is ready
        if (typeof AccountUI !== 'undefined') {
            const orig = AccountUI.renderDropdownContent.bind(AccountUI);
            AccountUI.renderDropdownContent = function() {
                orig();
                const content = document.getElementById('accountDropdownContent');
                if (!content || content.querySelector('#fbMyNotesBtn')) return;
                const btn = document.createElement('button');
                btn.id = 'fbMyNotesBtn';
                btn.className = 'btn btn-secondary';
                btn.style.cssText = 'width:100%;margin-top:0.5rem;';
                btn.innerHTML = '📋 My Feedback';
                btn.onclick = () => { AccountUI.closeDropdown(); FeedbackSystem.openNotesPanel(); };
                const actionsDiv = content.querySelector('.account-actions');
                if (actionsDiv) actionsDiv.appendChild(btn);
                else content.appendChild(btn);
            };
        } else {
            // Retry until AccountUI is available
            setTimeout(start, 600);
            return;
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        // Defer slightly so all other scripts (bundle.js, account-ui.js) have loaded
        setTimeout(start, 200);
    }
})();
