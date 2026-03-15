/* =====================================================
   MyTrip Feedback Overlay System — feedback.js v2
   Triggers are baked directly into HTML templates.
   This file only manages:
     • The toggle button + banner
     • The popup (openFeedbackPopup / window.fbTrigger)
     • The notes panel
     • Toast notifications
   ===================================================== */

const FeedbackSystem = (() => {
    'use strict';

    let feedbackModeOn = false;
    let unsubSnapshot  = null;
    const COLLECTION   = 'mytrip_feedback';

    // ── Firebase helpers ──────────────────────────────────────────────
    const getDb   = () => window.firebase?.firestore  ? firebase.firestore()  : null;
    const getAuth = () => window.firebase?.auth       ? firebase.auth()       : null;
    const me      = () => { const a = getAuth(); return a?.currentUser ?? null; };

    // ════════════════════════════════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════════════════════════════════
    function init() {
        injectStyles();
        injectToggleButton();
        injectBanner();
        // Expose globally so inline onclick attributes in HTML can call it
        window.fbTrigger = openFeedbackPopup;
        console.log('[Feedback v2] Ready — window.fbTrigger exposed');
    }

    // ── Dynamic CSS injected once into <head> ─────────────────────────
    function injectStyles() {
        if (document.getElementById('fb-system-styles')) return;
        const s = document.createElement('style');
        s.id = 'fb-system-styles';
        s.textContent = `
            /* Feedback trigger "＋" button — baked into every component */
            .fb-trigger-btn {
                position: absolute !important;
                top: 8px !important; right: 8px !important;
                width: 22px !important; height: 22px !important;
                border-radius: 50% !important;
                background: rgba(78,205,196,0.18) !important;
                border: 1px solid rgba(78,205,196,0.5) !important;
                color: #4ECDC4 !important;
                font-size: 14px !important; font-weight: 700 !important;
                line-height: 22px !important; font-family: 'Outfit', sans-serif !important;
                display: none !important;         /* JS toggles to flex when mode ON */
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                z-index: 50 !important; padding: 0 !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
                transition: transform 0.15s, background 0.15s !important;
            }
            .fb-trigger-btn:hover {
                transform: scale(1.18) !important;
                background: rgba(78,205,196,0.32) !important;
            }
            /* Toggle pulse ring */
            @keyframes fbPulse {
                0%,100% { box-shadow: 0 0 0 4px rgba(78,205,196,0.15); }
                50%      { box-shadow: 0 0 0 8px rgba(78,205,196,0.05); }
            }
            /* Textarea shake */
            @keyframes fbShake {
                0%   { transform: translateX(0);  }
                20%  { transform: translateX(-6px);}
                50%  { transform: translateX(6px); }
                75%  { transform: translateX(-6px);}
                100% { transform: translateX(0);  }
            }
            /* Notes panel skeleton cards */
            @keyframes fbSkeleton {
                0%,100% { opacity:.45; } 50% { opacity:.9; }
            }
        `;
        document.head.appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════════
    //  TOGGLE BUTTON
    // ════════════════════════════════════════════════════════════════════
    function injectToggleButton() {
        if (document.getElementById('feedbackToggleBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'feedbackToggleBtn';
        btn.title = 'Toggle Feedback Mode';
        btn.innerHTML = '✏';
        styleToggle(btn, false);
        btn.addEventListener('click', toggleMode);
        document.body.appendChild(btn);
    }

    function styleToggle(btn, on) {
        Object.assign(btn.style, {
            position:       'fixed',
            bottom:         '88px', right: '16px',
            width:          '44px', height: '44px',
            borderRadius:   '50%',
            border:         on ? '1px solid rgba(78,205,196,0.45)' : '1px solid rgba(255,255,255,0.14)',
            background:     on ? 'rgba(78,205,196,0.14)'           : 'rgba(255,255,255,0.07)',
            color:          on ? '#4ECDC4'                          : 'rgba(255,255,255,0.32)',
            fontSize:       '18px',
            cursor:         'pointer',
            zIndex:         '200',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            transition:     'all 0.2s',
            animation:      on ? 'fbPulse 1.5s ease-in-out infinite' : 'none',
            boxShadow:      on ? '0 0 0 4px rgba(78,205,196,0.15)' : 'none',
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  FEEDBACK BANNER (below header)
    // ════════════════════════════════════════════════════════════════════
    function injectBanner() {
        if (document.getElementById('feedbackBanner')) return;
        const b = document.createElement('div');
        b.id = 'feedbackBanner';
        b.textContent = 'Feedback Mode — tap any ＋ to add a note';
        Object.assign(b.style, {
            display:      'none',
            position:     'sticky',
            top:          '0',
            background:   'rgba(78,205,196,0.07)',
            borderBottom: '1px solid rgba(78,205,196,0.15)',
            color:        '#4ECDC4',
            fontFamily:   "'Outfit', sans-serif",
            fontSize:     '12px',
            textAlign:    'center',
            padding:      '6px 16px',
            zIndex:       '99',
        });
        const app = document.getElementById('app');
        if (app) app.insertBefore(b, app.firstChild);
    }

    // ════════════════════════════════════════════════════════════════════
    //  TOGGLE MODE
    // ════════════════════════════════════════════════════════════════════
    function toggleMode() {
        feedbackModeOn = !feedbackModeOn;
        const btn    = document.getElementById('feedbackToggleBtn');
        const banner = document.getElementById('feedbackBanner');
        if (btn)    styleToggle(btn, feedbackModeOn);
        if (banner) banner.style.display = feedbackModeOn ? 'block' : 'none';
        // Show/hide every trigger button baked into HTML templates
        document.querySelectorAll('.fb-trigger-btn').forEach(b => {
            b.style.display = feedbackModeOn ? 'flex' : 'none';
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  FEEDBACK POPUP  (called by window.fbTrigger(zone))
    // ════════════════════════════════════════════════════════════════════
    function openFeedbackPopup(zone) {
        closePopup();
        const user = me();
        if (!user) { showToast('Sign in to add feedback', '#FF6B6B'); return; }

        let priority = 'medium';

        const bd = document.createElement('div');
        bd.id = 'fbBackdrop';
        Object.assign(bd.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.58)', zIndex: '300',
        });
        bd.addEventListener('click', closePopup);

        const pp = document.createElement('div');
        pp.id = 'fbPopup';
        Object.assign(pp.style, {
            position:     'fixed', top: '50%', left: '50%',
            transform:    'translate(-50%,-50%) scale(0.92)',
            opacity:      '0',
            width:        'calc(100% - 48px)', maxWidth: '360px',
            background:   '#0D2137',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding:      '22px',
            zIndex:       '301',
            transition:   'transform 200ms ease-out, opacity 200ms ease-out',
            fontFamily:   "'Outfit', sans-serif",
        });

        pp.innerHTML = `
            <h3 style="margin:0 0 4px;font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;">Add Feedback</h3>
            <p style="margin:0 0 16px;font-size:11px;color:rgba(255,255,255,0.38);">Section: ${esc(zone)}</p>
            <textarea id="fbNoteTA" placeholder="What would you like to change or improve here?"
                style="width:100%;box-sizing:border-box;min-height:100px;
                       background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                       border-radius:12px;padding:12px;
                       font-family:'Outfit',sans-serif;font-size:14px;color:#fff;
                       resize:vertical;outline:none;
                       transition:border-color 200ms,box-shadow 200ms;"></textarea>
            <div style="margin-top:12px;">
                <div style="font-size:12px;color:rgba(255,255,255,0.38);">Priority</div>
                <div id="fbPills" style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                    <button class="fp" data-p="low"    style="border-radius:20px;padding:5px 16px;font:500 12px 'Outfit',sans-serif;cursor:pointer;">Low</button>
                    <button class="fp" data-p="medium" style="border-radius:20px;padding:5px 16px;font:500 12px 'Outfit',sans-serif;cursor:pointer;">Medium</button>
                    <button class="fp" data-p="high"   style="border-radius:20px;padding:5px 16px;font:500 12px 'Outfit',sans-serif;cursor:pointer;">High</button>
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
                <button id="fbCancel"
                    style="background:transparent;border:1px solid rgba(255,255,255,0.15);
                           color:rgba(255,255,255,0.55);border-radius:12px;padding:9px 18px;
                           font:500 14px 'Outfit',sans-serif;cursor:pointer;">Cancel</button>
                <button id="fbSave"
                    style="background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.45);
                           color:#4ECDC4;border-radius:12px;padding:9px 18px;
                           font:500 14px 'Outfit',sans-serif;cursor:pointer;">Save Note</button>
            </div>
        `;

        document.body.appendChild(bd);
        document.body.appendChild(pp);
        requestAnimationFrame(() => {
            pp.style.transform = 'translate(-50%,-50%) scale(1)';
            pp.style.opacity   = '1';
        });

        const ta = pp.querySelector('#fbNoteTA');
        ta.addEventListener('focus', () => { ta.style.borderColor='#4ECDC4'; ta.style.boxShadow='0 0 0 3px rgba(78,205,196,0.1)'; });
        ta.addEventListener('blur',  () => { ta.style.borderColor='rgba(255,255,255,0.12)'; ta.style.boxShadow='none'; });
        ta.focus();

        // Priority pills
        const pillStyle = {
            base:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' },
            low:    { background: 'rgba(78,205,196,0.15)',  border: '1px solid rgba(78,205,196,0.45)',  color: '#4ECDC4' },
            medium: { background: 'rgba(247,201,72,0.15)',  border: '1px solid rgba(247,201,72,0.45)',  color: '#F7C948' },
            high:   { background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.45)', color: '#FF6B6B' },
        };
        const refreshPills = (active) => {
            pp.querySelectorAll('.fp').forEach(p => Object.assign(p.style, p.dataset.p === active ? pillStyle[p.dataset.p] : pillStyle.base));
        };
        pp.querySelectorAll('.fp').forEach(p => {
            p.addEventListener('click', () => { priority = p.dataset.p; refreshPills(priority); });
        });
        refreshPills('medium');

        pp.querySelector('#fbCancel').addEventListener('click', closePopup);
        pp.querySelector('#fbSave').addEventListener('click', async () => {
            const note = ta.value.trim();
            if (!note) {
                ta.style.animation = 'none'; ta.offsetHeight;
                ta.style.animation = 'fbShake 300ms ease';
                setTimeout(() => ta.style.animation = '', 300);
                return;
            }
            const db = getDb();
            if (!db) { showToast('Firebase unavailable', '#FF6B6B'); return; }
            try {
                const u = me();
                await db.collection(COLLECTION).add({
                    id: Date.now().toString(), zone, note, priority,
                    userId:    u.uid,
                    userName:  u.displayName || u.email || 'Anonymous',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    implemented: false, implementedAt: null, version: null,
                });
                closePopup();
                showToast('Feedback saved ✓');
            } catch (e) {
                console.error('[Feedback] Save error:', e);
                showToast('Could not save — check connection', '#FF6B6B');
            }
        });
    }

    function closePopup() {
        document.getElementById('fbBackdrop')?.remove();
        document.getElementById('fbPopup')?.remove();
    }

    // ════════════════════════════════════════════════════════════════════
    //  TOAST
    // ════════════════════════════════════════════════════════════════════
    function showToast(msg, color) {
        const t = document.createElement('div');
        t.textContent = msg;
        const isErr = !!color;
        Object.assign(t.style, {
            position: 'fixed', bottom: '96px', left: '50%',
            transform: 'translateX(-50%)',
            background:   isErr ? 'rgba(255,107,107,0.12)' : 'rgba(78,205,196,0.12)',
            border:       `1px solid ${isErr ? 'rgba(255,107,107,0.38)' : 'rgba(78,205,196,0.38)'}`,
            color:        color || '#4ECDC4',
            borderRadius: '20px', padding: '8px 22px',
            fontFamily:   "'Outfit', sans-serif", fontSize: '13px', fontWeight: '500',
            whiteSpace:   'nowrap', zIndex: '500', opacity: '0', transition: 'opacity 200ms',
        });
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

    // ════════════════════════════════════════════════════════════════════
    //  NOTES PANEL  (bottom sheet)
    // ════════════════════════════════════════════════════════════════════
    function openNotesPanel() {
        closePanelIfOpen();
        const user = me();
        if (!user) { showToast('Sign in to view feedback', '#FF6B6B'); return; }

        if (typeof AccountUI !== 'undefined') AccountUI.closeDropdown?.();

        const bd = document.createElement('div');
        bd.id = 'fbPanelBd';
        Object.assign(bd.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.52)', zIndex:'399' });
        bd.addEventListener('click', closePanelIfOpen);

        const sh = document.createElement('div');
        sh.id = 'fbNotesSheet';
        Object.assign(sh.style, {
            position: 'fixed', bottom:'0', left:'0', right:'0',
            maxHeight: '78vh',
            background: '#0D2137',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px 100px',
            overflowY: 'auto', zIndex: '400',
            transform: 'translateY(100%)',
            transition: 'transform 350ms ease-out',
            fontFamily: "'Outfit', sans-serif",
        });

        sh.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <h3 style="margin:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;">My Feedback Notes</h3>
                <button id="fbSheetClose"
                    style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);
                           border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:16px;
                           cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div id="fbStatBadges" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;"></div>
            <div id="fbFilterRow" style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
                <button class="fb-fpill fb-fpill-active" data-f="all">All</button>
                <button class="fb-fpill" data-f="pending">Pending</button>
                <button class="fb-fpill" data-f="implemented">Implemented</button>
            </div>
            <div id="fbNotesList">${skeleton()}</div>
            <button id="fbExportBtn"
                style="width:100%;height:44px;background:rgba(255,255,255,0.05);
                       border:1px solid rgba(255,255,255,0.1);border-radius:12px;
                       font:500 13px 'Outfit',sans-serif;color:rgba(255,255,255,0.45);
                       cursor:pointer;margin-top:20px;">↓ Export Notes as JSON</button>
        `;

        document.body.appendChild(bd);
        document.body.appendChild(sh);
        requestAnimationFrame(() => sh.style.transform = 'translateY(0)');

        sh.querySelector('#fbSheetClose').addEventListener('click', closePanelIfOpen);

        let activeFilter = 'all', allNotes = [];

        // Filter pill style
        const fpBase   = { borderRadius:'20px', padding:'6px 16px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid transparent', background:'transparent', color:'rgba(255,255,255,0.38)' };
        const fpActive = { ...fpBase, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff' };
        sh.querySelectorAll('.fb-fpill').forEach(p => {
            Object.assign(p.style, p.classList.contains('fb-fpill-active') ? fpActive : fpBase);
            p.addEventListener('click', () => {
                activeFilter = p.dataset.f;
                sh.querySelectorAll('.fb-fpill').forEach(x => Object.assign(x.style, x === p ? fpActive : fpBase));
                renderNotes(allNotes, activeFilter);
            });
        });

        sh.querySelector('#fbExportBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(allNotes, null, 2))
                .then(() => showToast('Copied to clipboard ✓'))
                .catch(() => showToast('Copy failed', '#FF6B6B'));
        });

        const db = getDb();
        if (!db) { document.getElementById('fbNotesList').innerHTML = emptyState(); return; }

        unsubSnapshot = db.collection(COLLECTION)
            .where('userId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snap => {
                allNotes = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
                updateBadges(allNotes, sh);
                renderNotes(allNotes, activeFilter);
            }, err => {
                console.error('[Feedback] onSnapshot:', err);
                document.getElementById('fbNotesList').innerHTML =
                    '<p style="text-align:center;color:rgba(255,107,107,0.7);padding:20px;">Could not load notes</p>';
            });
    }

    function skeleton() {
        return Array(3).fill('')
            .map(() => `<div style="background:rgba(255,255,255,0.04);border-radius:14px;height:90px;margin-bottom:10px;animation:fbSkeleton 1.5s ease-in-out infinite;"></div>`)
            .join('');
    }

    function updateBadges(notes, sh) {
        const bd = sh.querySelector('#fbStatBadges');
        if (!bd) return;
        const p = notes.filter(n => !n.implemented).length;
        const i = notes.filter(n =>  n.implemented).length;
        bd.innerHTML = `
            <span style="background:rgba(247,201,72,0.1);border:1px solid rgba(247,201,72,0.25);color:#F7C948;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:500;">⏳ ${p} Pending</span>
            <span style="background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.25);color:#4ECDC4;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:500;">✓ ${i} Implemented</span>
        `;
    }

    function renderNotes(notes, filter) {
        const el = document.getElementById('fbNotesList');
        if (!el) return;
        let list = [...notes];
        if (filter === 'pending')     list = notes.filter(n => !n.implemented);
        if (filter === 'implemented') list = notes.filter(n =>  n.implemented);
        // Pending first, then implemented; newest first in each group
        list.sort((a, b) => {
            if (a.implemented !== b.implemented) return a.implemented ? 1 : -1;
            const ta = a.timestamp?.toMillis?.() ?? 0;
            const tb = b.timestamp?.toMillis?.() ?? 0;
            return tb - ta;
        });
        if (!list.length) { el.innerHTML = emptyState(filter); return; }
        el.innerHTML = list.map(noteCardHTML).join('');
        el.querySelectorAll('.fb-del-btn').forEach(btn =>
            btn.addEventListener('click', () => promptDelete(btn, btn.dataset.docId)));
    }

    function noteCardHTML(n) {
        const PB = { high:'#FF6B6B', medium:'#F7C948', low:'#4ECDC4' };
        const CBg= { high:'rgba(255,107,107,0.12)', medium:'rgba(247,201,72,0.12)', low:'rgba(78,205,196,0.12)' };
        const CBr= { high:'rgba(255,107,107,0.3)',  medium:'rgba(247,201,72,0.3)',  low:'rgba(78,205,196,0.3)' };
        const p  = n.priority || 'medium';
        const ts = n.timestamp?.toDate?.() ?? new Date();
        const ds = ts.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const ti = ts.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
        const impl = n.version ? `Fixed in ${n.version}` : (n.implementedAt ? `Fixed on ${new Date(n.implementedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}` : '');
        return `
        <div class="fb-note-card" data-doc-id="${n._docId}"
            style="background:rgba(255,255,255,0.05);border-radius:14px;padding:14px 16px;
                   margin-bottom:10px;border-left:4px solid ${PB[p]};overflow:hidden;
                   transition:max-height 300ms ease,opacity 300ms ease,margin 300ms ease,padding 300ms ease;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.38);text-transform:uppercase;letter-spacing:1.5px;flex:1;">${esc(n.zone)}</span>
                <span style="background:${CBg[p]};border:1px solid ${CBr[p]};color:${PB[p]};border-radius:20px;padding:2px 8px;font-size:10px;font-weight:600;flex-shrink:0;margin-left:8px;">${p.charAt(0).toUpperCase()+p.slice(1)}</span>
            </div>
            <p style="margin:0 0 6px;font-size:14px;color:${n.implemented?'rgba(255,255,255,0.3)':'#fff'};line-height:1.5;${n.implemented?'text-decoration:line-through;':''}">${esc(n.note)}</p>
            <div style="font-size:11px;color:rgba(255,255,255,0.28);margin-bottom:10px;">Added ${ds} · ${ti}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    ${n.implemented
                        ? `<span style="background:rgba(78,205,196,0.08);border:1px solid rgba(78,205,196,0.2);color:#4ECDC4;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:500;">✓ Implemented</span>
                           ${impl ? `<div style="font-size:11px;color:rgba(255,255,255,0.28);margin-top:4px;">${esc(impl)}</div>` : ''}`
                        : `<span style="background:rgba(247,201,72,0.08);border:1px solid rgba(247,201,72,0.2);color:#F7C948;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:500;">⏳ Pending review</span>`
                    }
                </div>
                <div class="fb-del-area" data-doc-id="${n._docId}">
                    <button class="fb-del-btn" data-doc-id="${n._docId}"
                        style="background:none;border:none;color:rgba(255,107,107,0.55);font:400 12px 'Outfit',sans-serif;cursor:pointer;">Delete</button>
                </div>
            </div>
        </div>`;
    }

    function promptDelete(btn, docId) {
        const area = document.querySelector(`.fb-del-area[data-doc-id="${docId}"]`);
        if (!area) return;
        area.innerHTML = `
            <span style="font-size:12px;color:rgba(255,255,255,0.45);">Remove? </span>
            <button class="fb-yes" data-doc-id="${docId}" style="background:none;border:none;color:#FF6B6B;font-size:12px;cursor:pointer;font-weight:600;">Yes</button>
            <span style="font-size:12px;color:rgba(255,255,255,0.3);"> | </span>
            <button class="fb-no"  data-doc-id="${docId}" style="background:none;border:none;color:rgba(255,255,255,0.38);font-size:12px;cursor:pointer;">No</button>
        `;
        area.querySelector('.fb-yes').addEventListener('click', () => deleteNote(docId));
        area.querySelector('.fb-no').addEventListener('click',  () => {
            area.innerHTML = `<button class="fb-del-btn" data-doc-id="${docId}"
                style="background:none;border:none;color:rgba(255,107,107,0.55);font:400 12px 'Outfit',sans-serif;cursor:pointer;">Delete</button>`;
            area.querySelector('.fb-del-btn').addEventListener('click', () => promptDelete(area.querySelector('.fb-del-btn'), docId));
        });
    }

    async function deleteNote(docId) {
        const db = getDb(); if (!db) return;
        const card = document.querySelector(`.fb-note-card[data-doc-id="${docId}"]`);
        if (card) {
            const h = card.offsetHeight;
            Object.assign(card.style, { maxHeight: h+'px' });
            requestAnimationFrame(() => {
                card.style.maxHeight = '0'; card.style.opacity = '0';
                card.style.marginBottom = '0'; card.style.paddingTop = '0'; card.style.paddingBottom = '0';
            });
            setTimeout(() => card.remove(), 320);
        }
        try { await db.collection(COLLECTION).doc(docId).delete(); }
        catch (e) { console.error('[Feedback] Delete:', e); showToast('Could not delete', '#FF6B6B'); }
    }

    function emptyState(filter) {
        return `
        <div style="text-align:center;padding:40px 0;">
            <div style="font-size:28px;">📋</div>
            <div style="font-size:15px;font-weight:500;color:rgba(255,255,255,0.45);margin-top:10px;">No notes yet</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.28);max-width:220px;margin:6px auto 0;line-height:1.6;text-align:center;">
                ${filter && filter !== 'all' ? `No ${filter} notes found`
                    : 'Enable Feedback Mode and tap ＋ on any section to add a note'}
            </div>
        </div>`;
    }

    function closePanelIfOpen() {
        const sh = document.getElementById('fbNotesSheet');
        const bd = document.getElementById('fbPanelBd');
        if (sh) { sh.style.transform = 'translateY(100%)'; setTimeout(() => sh.remove(), 360); }
        if (bd) bd.remove();
        if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
    }

    // ── Tiny HTML-safe escape ──────────────────────────────────────────
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ════════════════════════════════════════════════════════════════════
    //  ACCOUNT DROPDOWN INJECTION  ("My Feedback" menu item)
    // ════════════════════════════════════════════════════════════════════
    function hookAccountDropdown() {
        if (typeof AccountUI === 'undefined') { setTimeout(hookAccountDropdown, 400); return; }
        const orig = AccountUI.renderDropdownContent.bind(AccountUI);
        AccountUI.renderDropdownContent = function () {
            orig();
            const content = document.getElementById('accountDropdownContent');
            if (!content || content.querySelector('#fbMyNotesBtn')) return;
            const btn = document.createElement('button');
            btn.id = 'fbMyNotesBtn';
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'width:100%;margin-top:0.5rem;';
            btn.innerHTML = '📋 My Feedback';
            btn.onclick = () => { AccountUI.closeDropdown?.(); openNotesPanel(); };
            const actions = content.querySelector('.account-actions');
            (actions || content).appendChild(btn);
        };
    }

    // ── Public API ────────────────────────────────────────────────────
    return { init, openNotesPanel, toggleMode };
})();

// ════════════════════════════════════════════════════════════════════════
//  BOOT — deferred so bundle.js, account-ui.js etc. are all loaded
// ════════════════════════════════════════════════════════════════════════
(function boot() {
    function start() {
        FeedbackSystem.init();
        // Patch AccountUI for "My Feedback" menu entry
        function patchAccountUI() {
            if (typeof AccountUI === 'undefined') { setTimeout(patchAccountUI, 400); return; }
            const orig = AccountUI.renderDropdownContent.bind(AccountUI);
            AccountUI.renderDropdownContent = function () {
                orig();
                const c = document.getElementById('accountDropdownContent');
                if (!c || c.querySelector('#fbMyNotesBtn')) return;
                const btn = document.createElement('button');
                btn.id = 'fbMyNotesBtn'; btn.className = 'btn btn-secondary';
                btn.style.cssText = 'width:100%;margin-top:0.5rem;';
                btn.innerHTML = '📋 My Feedback';
                btn.onclick = () => { AccountUI.closeDropdown?.(); FeedbackSystem.openNotesPanel(); };
                (c.querySelector('.account-actions') || c).appendChild(btn);
            };
        }
        patchAccountUI();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 250));
    else setTimeout(start, 250);
})();
