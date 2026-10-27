/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Multi-User Study Planner Controller
    const $ = (s: string) => document.querySelector(s) as HTMLElement | null;
    const $$ = (s: string) => [...document.querySelectorAll(s)] as HTMLElement[];
    const LS = localStorage;

    interface UserProfile {
      id: string;
      name: string;
      un: string;
      salt: string;
      h: string;
      color?: string;
      avatar?: string;
      created?: number;
      legacy?: boolean;
    }

    const getUsers = (): UserProfile[] => {
      try {
        return JSON.parse(LS.getItem('mz_users') || '[]');
      } catch (e) {
        return [];
      }
    };

    const enc = new TextEncoder();
    const hash = async (p: string, salt: string): Promise<string> => {
      try {
        const k = await crypto.subtle.importKey(
          'raw',
          enc.encode(p),
          'PBKDF2',
          false,
          ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' },
          k,
          256
        );
        return btoa(String.fromCharCode(...new Uint8Array(bits)));
      } catch (e) {
        let h = 5381;
        for (const c of salt + p) {
          h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
        }
        return 'x' + h;
      }
    };

    const enter = (u: UserProfile) => {
      (window as any).__U = u;
      (window as any).__K = 'mz_u_' + u.id;
      // Guarantee strict data isolation for every user
      (window as any).__DB = 'mz_db_' + u.id;
      LS.setItem('mz_session', u.id);
      document.body.classList.remove('auth');
      const authEl = $('#auth');
      if (authEl) authEl.style.display = 'none';
      startApp();
    };

    const logout = () => {
      LS.removeItem('mz_session');
      (window as any).__U = null;
      document.body.classList.add('auth');
      const authEl = $('#auth');
      if (authEl) {
        authEl.style.display = 'flex';
        renderAuthView();
      }
    };

    // Auth State
    let authMode: 'in' | 'up' = 'in';
    let selectedUser: UserProfile | null = null;
    let chosenColor = '#5b4bff';
    const AVATAR_COLORS = ['#5b4bff', '#ff5c8a', '#18b894', '#ff9f1c', '#3ec3ff', '#c04dff'];

    const renderAuthView = () => {
      const users = getUsers();
      const up = authMode === 'up';

      // Toggle Tabs
      $$('#auth .tabs .chip').forEach((b) => {
        b.classList.toggle('on', (b as HTMLElement).dataset.m === authMode);
      });

      // Show/Hide fields
      $$('#auth .fu').forEach((e) => {
        (e as HTMLElement).hidden = !up;
      });

      const userPickerEl = $('#x_user_picker');
      const standardUserLabel = $('#x_user_lbl');
      const selectedUserCard = $('#x_selected_user');
      const xGo = $('#x_go');
      const xErr = $('#x_err');
      const xFg = $('#x_fg');
      const xPass = $('#x_pass') as HTMLInputElement | null;
      const xNote = $('#x_note');

      if (xErr) xErr.textContent = '';
      if (xGo) xGo.textContent = up ? 'إنشاء حساب جديد ودخول' : 'دخول للمذاكرة';
      if (xFg) xFg.hidden = up;
      if (xPass) xPass.autocomplete = up ? 'new-password' : 'current-password';

      if (xNote) {
        xNote.textContent = up
          ? 'بيانات كل طالب مستقلة تماماً ومحفوظة بخصوصية داخل هذا الجهاز. يمكنك إنشاء حسابات متعددة لنفس الجهاز.'
          : 'اختر حسابك المسجل أو أدخل اسم المستخدم وكلمة المرور.';
      }

      if (up) {
        // Sign Up Mode
        if (userPickerEl) userPickerEl.innerHTML = '';
        if (selectedUserCard) selectedUserCard.innerHTML = '';
        if (standardUserLabel) standardUserLabel.hidden = false;
        selectedUser = null;
      } else {
        // Sign In Mode
        if (users.length > 0) {
          if (selectedUser) {
            // A specific user was clicked
            if (userPickerEl) userPickerEl.innerHTML = '';
            if (standardUserLabel) standardUserLabel.hidden = true;
            if (selectedUserCard) {
              selectedUserCard.innerHTML = `
                <div class="u-card active" style="margin-bottom:12px">
                  <div class="u-avatar" style="background:${selectedUser.color || '#5b4bff'}">${selectedUser.name.charAt(0) || 'ط'}</div>
                  <div class="u-info">
                    <b>${selectedUser.name}</b>
                    <span>@${selectedUser.un}</span>
                  </div>
                  <button type="button" class="chip" id="x_switch_acc" style="padding:3px 10px;font-size:12px">تبديل</button>
                </div>
              `;
              const swBtn = $('#x_switch_acc');
              if (swBtn) {
                swBtn.onclick = () => {
                  selectedUser = null;
                  renderAuthView();
                };
              }
            }
            if (xPass) xPass.focus();
          } else {
            // Show list of existing accounts
            if (selectedUserCard) selectedUserCard.innerHTML = '';
            if (standardUserLabel) standardUserLabel.hidden = false;
            if (userPickerEl) {
              userPickerEl.innerHTML = `
                <div class="mute" style="font-weight:700;margin-bottom:8px">👥 الحسابات على هذا الجهاز:</div>
                <div class="user-grid">
                  ${users.map((u) => `
                    <div class="u-card" data-uid="${u.id}">
                      <div class="u-avatar" style="background:${u.color || '#5b4bff'}">${u.name.charAt(0) || 'ط'}</div>
                      <div class="u-info">
                        <b>${u.name}</b>
                        <span>@${u.un}</span>
                      </div>
                      <span class="tag" style="background:var(--soft);color:var(--acc)">دخول</span>
                    </div>
                  `).join('')}
                </div>
              `;

              $$('#x_user_picker .u-card').forEach((card) => {
                card.onclick = () => {
                  const uid = card.dataset.uid;
                  const found = users.find((x) => x.id === uid);
                  if (found) {
                    selectedUser = found;
                    const uInput = $('#x_user') as HTMLInputElement | null;
                    if (uInput) uInput.value = found.un;
                    renderAuthView();
                  }
                };
              });
            }
          }
        } else {
          if (userPickerEl) userPickerEl.innerHTML = '';
          if (selectedUserCard) selectedUserCard.innerHTML = '';
          if (standardUserLabel) standardUserLabel.hidden = false;
        }
      }

      // Render Color Picker in Sign Up
      const cpEl = $('#x_color_picker');
      if (cpEl) {
        cpEl.innerHTML = AVATAR_COLORS.map(
          (c) => `<span class="color-dot ${c === chosenColor ? 'selected' : ''}" style="background:${c}" data-c="${c}"></span>`
        ).join('');
        $$('#x_color_picker .color-dot').forEach((dot) => {
          dot.onclick = () => {
            chosenColor = dot.dataset.c || '#5b4bff';
            renderAuthView();
          };
        });
      }
    };

    // Sign in / Sign up submit
    const submitAuth = async () => {
      const e = (msg: string) => {
        const errEl = $('#x_err');
        if (errEl) errEl.textContent = msg;
      };
      const nameInput = $('#x_name') as HTMLInputElement | null;
      const userInput = $('#x_user') as HTMLInputElement | null;
      const passInput = $('#x_pass') as HTMLInputElement | null;
      const pass2Input = $('#x_pass2') as HTMLInputElement | null;

      const name = nameInput ? nameInput.value.trim() : '';
      const un = (selectedUser ? selectedUser.un : (userInput ? userInput.value.trim() : '')).toLowerCase();
      const pw = passInput ? passInput.value : '';
      const usersList = getUsers();

      if (un.length < 3) return e('اسم المستخدم يجب أن يكون 3 حروف أو أكثر');

      if (authMode === 'up') {
        if (!name) return e('يرجى كتابة اسمك');
        if (pw.length < 6) return e('كلمة المرور يجب أن تكون 6 أحرف أو أكثر');
        if (pass2Input && pw !== pass2Input.value) return e('كلمتا المرور غير متطابقتين');
        if (usersList.some((u) => u.un === un)) return e('اسم المستخدم مستخدم بالفعل، اختر اسماً آخر');

        const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const newUser: UserProfile = {
          id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name,
          un,
          salt,
          h: await hash(pw, salt),
          color: chosenColor,
          avatar: name.charAt(0) || 'ط',
          created: Date.now()
        };

        usersList.push(newUser);
        try {
          LS.setItem('mz_users', JSON.stringify(usersList));
        } catch (x) {
          return e('تعذّر حفظ الحساب، المساحة ممتلئة');
        }
        return enter(newUser);
      }

      // Login
      const u = usersList.find((x) => x.un === un);
      if (!u || (await hash(pw, u.salt)) !== u.h) {
        return e('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      enter(u);
    };

    // Forgot password handler (per-account)
    const handleForgot = () => {
      const userInput = $('#x_user') as HTMLInputElement | null;
      const un = (selectedUser ? selectedUser.un : (userInput ? userInput.value.trim() : '')).toLowerCase();
      const usersList = getUsers();
      const u = usersList.find((x) => x.un === un);
      const errEl = $('#x_err');

      if (!u) {
        if (errEl) errEl.textContent = 'اختر أو اكتب اسم المستخدم أولاً';
        return;
      }
      if (
        !confirm(
          `تنبيه: البيانات محفوظة محلياً على هذا الجهاز.\nسيتم حذف حساب (${u.name}) وبياناته فقط لإعادة تعيينه من جديد، ولن تتأثر حسابات الطلاب الآخرين.\nهل تريد المتابعة؟`
        )
      ) {
        return;
      }

      // Remove only this user
      const filtered = usersList.filter((x) => x.id !== u.id);
      LS.setItem('mz_users', JSON.stringify(filtered));
      LS.removeItem('mz_u_' + u.id);
      try {
        indexedDB.deleteDatabase('mz_db_' + u.id);
      } catch (e) {}

      selectedUser = null;
      authMode = 'up';
      renderAuthView();
      if (errEl) errEl.textContent = `تم حذف حساب (${u.name}). يمكنك إنشاء حساب جديد الآن.`;
    };

    // Initialize Auth UI event bindings
    $$('#auth .tabs .chip').forEach((b) => {
      b.onclick = () => {
        authMode = ((b as HTMLElement).dataset.m as 'in' | 'up') || 'in';
        renderAuthView();
      };
    });

    const goBtn = $('#x_go');
    if (goBtn) goBtn.onclick = submitAuth;

    const fgBtn = $('#x_fg');
    if (fgBtn) fgBtn.onclick = handleForgot;

    $$('#auth input').forEach((i) => {
      i.onkeydown = (e) => {
        if (e.key === 'Enter') submitAuth();
      };
    });

    // Check existing session
    const currentSessionId = LS.getItem('mz_session');
    const existingUsers = getUsers();
    const activeSessionUser = existingUsers.find((u) => u.id === currentSessionId);

    if (activeSessionUser) {
      enter(activeSessionUser);
    } else {
      document.body.classList.add('auth');
      if (!existingUsers.length) {
        authMode = 'up';
      }
      renderAuthView();
    }

    // ==========================================
    // Core Application Logic for Authenticated User
    // ==========================================
    function startApp() {
      const currentUser: UserProfile = (window as any).__U;
      if (!currentUser) return;

      const esc = (s: any) =>
        String(s == null ? '' : s).replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
        );
      const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const dk = (d: any) => new Date(d).toLocaleDateString('en-CA');
      const COL = ['#5b4bff', '#ff5c8a', '#18b894', '#ff9f1c', '#3ec3ff', '#c04dff', '#ef476f'];

      let S: any = {
        subjects: ['دراسات', 'ألماني', 'ساينس', 'عربي', 'إنجليزي', 'ماث'],
        tasks: [],
        cards: [],
        log: [],
        exams: [],
        files: [],
        notes: [],
        cur: '',
        goal: 120,
        hij: 0,
        school: '2026-09-12',
        uni: '2026-09-19',
        pomo: 0,
        run: null,
        theme: '',
        decks: [],
        cdk: '',
        pt: { q: 6, a: 4, sh: 0, lp: 0 },
        les: [],
        cn: {},
        last: {},
        jar: [],
        hb: [],
        tt: [],
        sb: 5,
        lb: 15,
        wg: '',
        fmsg: '',
        bgm: 'focus',
        bg: true,
        moods: [],
        mcur: '',
        apos: 0,
        lv: 1,
        gr: [],
        cst: 'a',
        nst: 'k'
      };

      // Load user-isolated state
      try {
        const stored = localStorage.getItem((window as any).__K);
        if (stored) {
          Object.assign(S, JSON.parse(stored));
        } else if (currentUser.legacy) {
          // Migration from old unpartitioned key if needed
          const legacy = localStorage.getItem('mz_v5') || localStorage.getItem('mz_v4');
          if (legacy) {
            Object.assign(S, JSON.parse(legacy));
            localStorage.setItem((window as any).__K, JSON.stringify(S));
          }
        }
      } catch (e) {}

      ['tasks', 'cards', 'log', 'exams', 'files', 'notes'].forEach((k) => {
        if (!Array.isArray(S[k])) S[k] = [];
      });
      if (Array.isArray(S.voiceNotes) && !S.notes.length) S.notes = S.voiceNotes;

      let svF = false;
      const save = () => {
        try {
          localStorage.setItem((window as any).__K, JSON.stringify(S));
          svF = false;
        } catch (e) {
          if (!svF) {
            svF = true;
            toast('⚠️ التخزين ممتلئ، التعديلات مش بتتحفظ! حمّل نسخة احتياطية فورًا');
          }
        }
      };

      const col = (s: string) =>
        (S.sc && S.sc[s]) || COL[Math.max(0, S.subjects.indexOf(s)) % COL.length];
      const today = () => dk(Date.now());
      const toast = (m: string) => {
        const t = $('#toast');
        if (!t) return;
        t.textContent = m;
        t.classList.add('on');
        clearTimeout((toast as any).h);
        (toast as any).h = setTimeout(() => t.classList.remove('on'), 2500);
      };

      const arm = (b: HTMLElement, fn: () => void) => {
        if (b.dataset.arm) {
          fn();
          return;
        }
        b.dataset.arm = '1';
        const o = b.textContent;
        b.textContent = 'تأكيد؟';
        setTimeout(() => {
          delete b.dataset.arm;
          b.textContent = o;
        }, 2500);
      };

      // User-Isolated IndexedDB
      let db: IDBDatabase | null = null;
      const idb = (m: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest | void): Promise<any> =>
        new Promise((r) => {
          if (!db) return r(null);
          try {
            const t = db.transaction('f', m);
            const q = f(t.objectStore('f'));
            t.oncomplete = () => r({ v: q ? q.result : undefined });
            t.onerror = () => r(null);
          } catch (e) {
            r(null);
          }
        });

      const getD = (k: string) => idb('readonly', (s) => s.get(k)).then((x) => (x ? x.v : null));
      const putD = (k: string, v: any) => idb('readwrite', (s) => s.put(v, k)).then((x) => !!x);
      const delD = (k: string) => idb('readwrite', (s) => s.delete(k)).then((x) => !!x);
      const url = (v: any) => (typeof v === 'string' ? v : URL.createObjectURL(v));

      // Timer Engine
      const LEN: Record<string, () => number> = {
        focus: () => +(($('#fl') as HTMLSelectElement)?.value || 25),
        short: () => +S.sb || 5,
        long: () => +S.lb || 15
      };

      const au = $('#au') as HTMLAudioElement | null;
      let T = { mode: 'focus', total: 1500, left: 1500, end: 0, run: false, sub: '', logged: 0, task: '' };
      let iv: any = null;
      let wl: any = null;

      const lock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wl = await (navigator as any).wakeLock.request('screen');
          }
        } catch (e) {}
      };

      const rel = () => {
        try {
          if (wl) wl.release();
        } catch (e) {}
        wl = null;
      };

      const beep = () => {
        try {
          const c = new AudioContext();
          const o = c.createOscillator();
          const g = c.createGain();
          o.connect(g);
          g.connect(c.destination);
          o.frequency.value = 660;
          g.gain.setValueAtTime(0.2, c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
          o.start();
          o.stop(c.currentTime + 1.2);
        } catch (e) {}
        try {
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } catch (e) {}
      };

      const rT = () => {
        const m = (T.left / 60) | 0;
        const s = T.left % 60;
        const cn = $('#cn');
        if (cn) cn.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        const cs = $('#cs');
        if (cs) cs.textContent = T.mode === 'focus' ? S.cur || 'كل المواد' : 'استراحة';
        const goBtnEl = $('#go');
        if (goBtnEl) goBtnEl.textContent = T.run ? 'إيقاف' : 'ابدأ';
        const g = $('#rg');
        if (g) {
          g.style.strokeDashoffset = String(565.5 * (1 - T.left / T.total));
          g.style.stroke = S.cur ? col(S.cur) : 'var(--acc)';
        }
        $$('[data-a=mode]').forEach((x) => x.classList.toggle('on', x.dataset.i === T.mode));
        const pm = $('#pm');
        if (pm) pm.textContent = 'الجلسة ' + ((S.pomo % 4) + 1) + ' من 4 قبل الراحة الطويلة';
      };

      const setMode = (m: string) => {
        T.mode = m;
        T.total = (LEN[m] ? LEN[m]() : 25) * 60;
        T.left = T.total;
        T.logged = 0;
        T.task = '';
        T.run = false;
        clearInterval(iv);
        rT();
      };

      const fin = () => {
        clearInterval(iv);
        T.run = false;
        S.run = null;
        rel();
        if (au && S.bgm !== 'all') au.pause();
        if (T.mode === 'focus') {
          const en = {
            s: T.sub || 'عام',
            m: (T.total - (T.logged || 0)) / 60,
            k: T.task || '',
            d: today(),
            h: new Date().getHours()
          };
          if (en.m > 0.05) {
            S.log.push(en);
            LL = en;
          } else LL = S.log[S.log.length - 1];
          showRate();
          S.pomo++;
        }
        beep();
        notify('مذاكرتي: انتهى الوقت');
        toast(T.mode === 'focus' ? 'خلصت جلسة تركيز 🌿' : 'الراحة خلصت، يلا نكمل');
        setMode(T.mode === 'focus' ? (S.pomo % 4 === 0 ? 'long' : 'short') : 'focus');
        save();
        render();
      };

      const tick = () => {
        T.left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
        if (T.left <= 0) return fin();
        rT();
      };

      const start = () => {
        if (!T.left) return;
        T.run = true;
        T.sub = S.cur;
        T.end = Date.now() + T.left * 1000;
        S.run = { mode: T.mode, end: T.end, total: T.total, sub: T.sub, logged: T.logged || 0 };
        save();
        clearInterval(iv);
        iv = setInterval(tick, 500);
        lock();
        bgPlay();
        rT();
      };

      const stop = () => {
        if (T.run) T.left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
        flush();
        T.run = false;
        clearInterval(iv);
        S.run = null;
        save();
        rel();
        if (au) au.pause();
        rT();
      };

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && T.run) tick();
      });

      const mins = (d: string) =>
        S.log.filter((l: any) => l.d === d).reduce((a: number, l: any) => a + l.m, 0);
      const streak = () => {
        let n = 0,
          d = new Date();
        if (!mins(dk(d))) d.setDate(d.getDate() - 1);
        while (mins(dk(d)) > 0) {
          n++;
          d.setDate(d.getDate() - 1);
        }
        return n;
      };

      const dueCards = () =>
        S.cards.filter((c: any) => (!S.cur || c.s === S.cur) && (c.due || '') <= today());
      const inSub = (x: any) => !S.cur || x.s === S.cur;
      let flip = false;
      S.decks = S.decks || [];
      S.cdk = S.cdk || '';
      S.pt = Object.assign({ q: 6, a: 4, sh: 0, lp: 0 }, S.pt || {});
      const inDk = (c: any) => !S.cdk || (S.cdk === '_' ? !c.k : c.k === S.cdk);
      const dkn = (id: string) => {
        const d = S.decks.find((x: any) => x.id === id);
        return d ? d.n : 'بدون مجموعة';
      };
      const cdue = () => dueCards().filter(inDk);

      // Render Header with User Badge & Multi-User Switcher
      const rHead = () => {
        const n = new Date();
        const dtEl = $('#dt');
        if (dtEl) {
          dtEl.innerHTML =
            '<b>' +
            n.toLocaleDateString('ar-EG', {
              timeZone: 'Africa/Cairo',
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            }) +
            '</b>';
        }
        let h = '';
        try {
          const d = new Date(n);
          d.setDate(d.getDate() + (+S.hij || 0));
          h = new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(d);
        } catch (e) {}

        const hjEl = $('#hj');
        if (hjEl) {
          hjEl.innerHTML = `
            <span>${h}</span> · 
            <span class="user-pill" data-a="showAccModal" title="اضغط لتبديل الحساب أو إدارته">
              <span class="dot" style="background:${currentUser.color || '#5b4bff'}">${currentUser.name.charAt(0) || 'ط'}</span>
              <span>${currentUser.name}</span>
            </span>
          `;
        }

        const w = (s: string) => {
          const d = Math.floor((n.getTime() - new Date(s).getTime()) / 864e5);
          return d >= 0 ? Math.floor(d / 7) + 1 : 'قريباً';
        };
        const wkEl = $('#wk');
        if (wkEl) {
          wkEl.textContent = 'أسبوع المدارس ' + w(S.school) + ' · الجامعات ' + w(S.uni);
        }
      };

      const rSub = () => {
        const subEl = $('#sub') as HTMLSelectElement | null;
        if (!subEl) return;
        subEl.innerHTML =
          '<option value="">كل المواد</option>' +
          S.subjects.map((s: string) => `<option ${s === S.cur ? 'selected' : ''}>${esc(s)}</option>`).join('');
      };

      const rToday = () => {
        rXP();
        rPlan();
        rHM();
        const t = mins(today());
        const g = +S.goal || 120;
        const gr = $('#gr');
        if (gr) gr.style.strokeDashoffset = String(339.3 * (1 - Math.min(1, t / g)));
        const gt = $('#gt');
        if (gt) gt.textContent = String(Math.round(t));
        const gs = $('#gs');
        if (gs) gs.textContent = 'من ' + g + ' دقيقة';
        const stk = $('#stk');
        if (stk) stk.textContent = String(streak());
        const due = $('#due');
        if (due) due.textContent = String(dueCards().length);

        const ex = [...S.exams]
          .sort((a, b) => (a.d < b.d ? -1 : 1))
          .map((e) => ({
            e,
            n: Math.round((new Date(e.d + 'T00:00').getTime() - new Date(today() + 'T00:00').getTime()) / 864e5)
          }))
          .filter((x) => x.n >= 0);

        const exEl = $('#ex');
        if (exEl) {
          exEl.innerHTML = ex.length
            ? ex
                .map(
                  (x) =>
                    `<div class="row"><span class="tx">${esc(x.e.n)}</span><span class="tag">${x.n ? 'باقي ' + x.n + ' يوم' : 'النهاردة'}</span></div>`
                )
                .join('')
            : '<div class="mute">أضف امتحاناتك من «المزيد».</div>';
        }

        const tk = S.tasks
          .filter((k: any) => !k.done && inSub(k))
          .sort((a: any, b: any) => ((a.d || '9') < (b.d || '9') ? -1 : 1))
          .slice(0, 4);

        const tt2 = $('#tt2');
        if (tt2) {
          tt2.innerHTML = tk.length
            ? tk
                .map(
                  (k: any) =>
                    `<div class="row"><span class="tx">${esc(k.t)}</span>${k.d && k.d < today() ? '<span class="tag bad">متأخرة</span>' : ''}</div>`
                )
                .join('')
            : '<div class="mute">مفيش مهام معلقة 🌿</div>';
        }

        const days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - 6 + i);
          return dk(d);
        });
        const v = days.map(mins);
        const mx = Math.max(...v, 1);
        const bars = $('#bars');
        if (bars) {
          bars.innerHTML = days
            .map((d, i) => `<div><span style="height:${(v[i] / mx) * 60}px"></span>${Math.round(v[i])}</div>`)
            .join('');
        }

        const by: Record<string, number> = {};
        S.log.filter((l: any) => days.includes(l.d)).forEach((l: any) => (by[l.s] = (by[l.s] || 0) + l.m));
        const tot = Object.values(by).reduce((a, b) => a + b, 0) || 1;
        const bysub = $('#bysub');
        if (bysub) {
          bysub.innerHTML = Object.entries(by)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([s, m]) =>
                `<div style="display:flex;justify-content:space-between"><span>${esc(s)}</span><span class="mute">${Math.round(m)} د · ${Math.round((m / tot) * 100)}%</span></div><div class="pb"><i style="width:${(m / tot) * 100}%;background:${col(s)}"></i></div>`
            )
            .join('');
        }
      };

      const rTasks = () => {
        const L = S.tasks
          .filter((x: any) => inSub(x) && !(S.hdn && x.done))
          .sort(
            (a: any, b: any) =>
              a.done - b.done ||
              (b.p | 0) - (a.p | 0) ||
              ((a.d || '9') < (b.d || '9') ? -1 : 1)
          );

        const tl = $('#tl');
        if (tl) {
          tl.innerHTML = L.length
            ? L.map(
                (k: any) =>
                  `<div class="row${k.done ? ' done' : ''}"><input type="checkbox" data-a="tk" data-i="${k.id}" ${k.done ? 'checked' : ''}><span class="tx">${esc(k.t)}</span>${k.p ? '<span class="tag bad">عاجل</span>' : ''}${k.d ? `<span class="tag${!k.done && k.d < today() ? ' bad' : ''}">${esc(k.d)}</span>` : ''}<button class="x" data-a="tgo" data-i="${k.id}" title="بدء تركيز على المهمة">▶</button><button class="x" data-a="te" data-i="${k.id}" title="تعديل">✎</button><button class="x" data-a="td" data-i="${k.id}" title="حذف">×</button></div>`
              ).join('')
            : '<div class="mute">مفيش مهام. ابدأ بمهمة صغيرة.</div>';
        }
      };

      // Advanced Flashcards
      let DKE = false,
        P: any = null,
        SM = false,
        MV: any = null;
      const SEL = new Set<string>();

      const fsz = (t: any) => {
        t = String(t || '');
        return t.length > 140 ? 14 : t.length > 80 ? 16 : t.length > 40 ? 18 : 21;
      };

      const cardHTML = (c: any, on: boolean, id?: string, at?: string) => {
        const st = `fs-${S.cst || 'a'}`;
        const cl = `--c:${col(c.s)}`;
        return `<div class="fl${on ? ' on' : ''}"${id ? ` id="${id}"` : ''}${at || ''}><div class="fl-in"><div class="fc ff ${st}" style="${cl}"><small>سؤال</small><span style="font-size:${fsz(c.q)}px">${esc(c.q)}</span></div><div class="fc ff fb ${st}" style="${cl}"><small>✓ الإجابة</small><span style="font-size:${fsz(c.a)}px">${esc(c.a)}</span></div></div></div>`;
      };

      const readPt = () => {
        const q = $('#ptq') as HTMLInputElement | null;
        const a = $('#pta') as HTMLInputElement | null;
        if (!q || !a) return;
        const cl = (v: any) => Math.min(120, Math.max(2, Math.round(+v) || 6));
        S.pt = {
          q: cl(q.value),
          a: cl(a.value),
          sh: ($('#pts') as HTMLInputElement)?.checked ? 1 : 0,
          lp: ($('#ptl') as HTMLInputElement)?.checked ? 1 : 0
        };
      };

      const rCk = () => {
        ['ckd', 'bkd'].forEach((id) => {
          const e = $('#' + id) as HTMLSelectElement | null;
          if (!e) return;
          const first = !e.options.length;
          const pv = e.value;
          e.innerHTML =
            '<option value="">بدون مجموعة</option>' +
            S.decks.map((d: any) => `<option value="${d.id}">${esc(d.n)}</option>`).join('');
          e.value = first
            ? S.decks.some((d: any) => d.id === S.cdk)
              ? S.cdk
              : ''
            : S.decks.some((d: any) => d.id === pv)
            ? pv
            : '';
        });
      };

      const cScope = () => S.cards.filter(inSub).filter(inDk);
      const cTitle = () => (S.cdk === '_' ? 'بدون مجموعة' : S.cdk ? dkn(S.cdk) : 'كل الكروت');

      const rCards = () => {
        const D = cdue();
        const c = D[0];
        const dk = S.cdk;
        const real = dk && dk !== '_';
        const all = S.cards.filter(inSub);

        const csp = $('#csp');
        if (csp) {
          csp.innerHTML = CSL.map(
            ([k, v]) =>
              `<button class="chip${(S.cst || 'a') === k ? ' on' : ''}" data-a="cst" data-i="${k}">${v}</button>`
          ).join('');
        }

        const dknEl = $('#dkn') as HTMLInputElement | null;
        const pv = dknEl ? dknEl.value : '';
        const noN = all.filter((x: any) => !x.k).length;

        let h =
          '<h3>📁 مجموعات الكروت</h3><div class="dkr"><button class="chip' +
          (!dk ? ' on' : '') +
          '" data-a="dks" data-i="">الكل · ' +
          all.length +
          '</button>' +
          S.decks
            .map(
              (d: any) =>
                `<button class="chip${dk === d.id ? ' on' : ''}" data-a="dks" data-i="${d.id}">${esc(d.n)} · ${all.filter((x: any) => x.k === d.id).length}</button>`
            )
            .join('') +
          ((noN || dk === '_') && S.decks.length
            ? `<button class="chip${dk === '_' ? ' on' : ''}" data-a="dks" data-i="_">بدون مجموعة · ${noN}</button>`
            : '') +
          '</div><div class="add"><input id="dkn" placeholder="اسم مجموعة جديدة، مثلاً: كروت الدرس الأول" style="flex:1"><button class="btn" data-a="dka">+ إنشاء</button></div>';

        const d = real && S.decks.find((x: any) => x.id === dk);
        if (d) {
          h += DKE
            ? `<div class="add"><input id="dkrn" value="${esc(d.n)}" style="flex:1"><button class="btn" data-a="dkrs">حفظ الاسم</button><button class="btn alt" data-a="dkre">إلغاء</button></div>`
            : `<div class="add"><button class="btn alt" data-a="dkre">✎ تغيير الاسم</button><button class="btn alt" data-a="pgo">▶ عرض تلقائي</button><button class="btn bad" data-a="dkd" data-i="${d.id}">🗑 حذف المجموعة</button></div>`;
        }
        h += `<div class="add" style="margin:0"><button class="btn${SM ? '' : ' alt'}" data-a="smt">${SM ? '✖ إنهاء التحديد' : '☑ تحديد كروت ونقلها لمجموعة'}</button></div>`;

        const dkb = $('#dkb');
        if (dkb) {
          dkb.innerHTML = h;
          if (pv && $('#dkn')) ($('#dkn') as HTMLInputElement).value = pv;
        }

        const st = $('#st');
        if (st) {
          st.innerHTML = c
            ? `<div class="mute" style="margin-bottom:8px">📁 ${esc(cTitle())} · باقي ${D.length} للمراجعة</div>` +
              cardHTML(c, flip, 'rvc', ' data-a="flip"') +
              `<div class="rg${flip ? '' : ' xh'}" id="rvg"><button class="btn bad" data-a="gr" data-i="0">صعب</button><button class="btn alt" data-a="gr" data-i="1">متوسط</button><button class="btn" data-a="gr" data-i="2">سهل</button></div><div class="mute${flip ? ' xh' : ''}" id="rvh" style="text-align:center">اضغط على الكارت لقلبه وإظهار الإجابة</div>`
            : '<div class="mute" style="text-align:center">خلصت مراجعة النهاردة 🌿</div>';
        }

        const n = cScope().length;
        const tmb = $('#tmb');
        if (tmb) {
          tmb.innerHTML = `<h3>⏱️ عرض تلقائي بالوقت</h3><div class="mute" style="margin-bottom:10px">الكروت تتقلب لوحدها: يظهر السؤال، وبعد ثواني تظهر الإجابة، وبعدها الكارت اللي بعده.</div><div class="add"><button class="chip" data-a="ppre" data-i="3,2">⚡ سريع</button><button class="chip" data-a="ppre" data-i="6,4">متوسط</button><button class="chip" data-a="ppre" data-i="10,6">هادئ</button></div><div class="tmg"><label>السؤال<input id="ptq" type="number" min="2" max="120" value="${S.pt.q}">ث</label><label>الإجابة<input id="pta" type="number" min="2" max="120" value="${S.pt.a}">ث</label></div><label class="ckl"><input type="checkbox" id="pts"${S.pt.sh ? ' checked' : ''}> ترتيب عشوائي</label><label class="ckl"><input type="checkbox" id="ptl"${S.pt.lp ? ' checked' : ''}> إعادة العرض لما يخلص</label><button class="btn" style="width:100%;margin-top:10px" data-a="pgo">▶ ابدأ العرض (${n} كارت · ${esc(cTitle())})</button>`;
        }

        rCk();

        const grp: [string, string][] = [];
        if (real || dk === '_') {
          grp.push([dk === '_' ? 'بدون مجموعة' : d ? d.n : '', dk === '_' ? '' : dk]);
        } else {
          S.decks.forEach((x: any) => grp.push([x.n, x.id]));
          grp.push(['بدون مجموعة', '']);
        }

        const tagH = (x: any) =>
          `<span class="tag${(x.due || '') <= today() ? ' bad' : ''}">${(x.due || '') <= today() ? 'للمراجعة' : esc(x.s)}</span>`;
        const rowH = (x: any) =>
          SM
            ? `<div class="row sel" data-a="csel" data-i="${x.id}"><input type="checkbox" class="cb" tabindex="-1"${SEL.has(x.id) ? ' checked' : ''}><span class="tx">${esc(x.q)}</span>${tagH(x)}</div>`
            : `<div class="row"><span class="tx">${esc(x.q)}</span>${tagH(x)}<button class="x" data-a="ce" data-i="${x.id}">✎</button><button class="x" data-a="cd" data-i="${x.id}">×</button></div>`;

        let out = '';
        grp.forEach(([nm, id]) => {
          const A = all.filter((x: any) => (id ? x.k === id : !x.k));
          if (!A.length && id === '') return;
          out +=
            `<div class="box"><h3 style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>📁 ${esc(nm)} · ${A.length}</span>${A.length ? (SM ? `<button class="chip" data-a="csg" data-i="${id || '_'}">تحديد الكل</button>` : `<button class="chip" data-a="dkp" data-i="${id || '_'}">▶ عرض</button>`) : ''}</h3>` +
            (A.map(rowH).join('') || '<div class="mute">المجموعة فاضية، أضف كروت من فوق.</div>') +
            '</div>';
        });

        const sn = [...SEL].filter((id) => S.cards.some((c: any) => c.id === id)).length;
        const mv = MV !== null ? MV : S.decks[0] ? S.decks[0].id : '';
        const sbar = SM
          ? `<div class="box sbar"><div class="mute" style="margin-bottom:6px">☑ محدد ${sn} كارت</div><div class="add" style="margin-bottom:6px"><select id="skd" style="flex:1" aria-label="المجموعة الهدف">${S.decks.map((d: any) => `<option value="${d.id}"${mv === d.id ? ' selected' : ''}>${esc(d.n)}</option>`).join('')}<option value=""${mv === '' ? ' selected' : ''}>بدون مجموعة</option></select><button class="btn" data-a="cmv">نقل</button></div><div class="add" style="margin:0"><button class="chip" data-a="csa">تحديد كل المعروض (${cScope().length})</button><button class="chip" data-a="csc">مسح</button><button class="chip" data-a="cdel" style="color:var(--bad)">🗑 حذف المحدد</button></div></div>`
          : '';

        const clEl = $('#cl');
        if (clEl) {
          clEl.innerHTML = (out || '<div class="box mute">أضف أول كارت من فوق.</div>') + sbar;
        }
      };

      // Render More / Settings
      const rMore = () => {
        try {
          rRoom();
        } catch (e) {}

        // User Account Box in Settings
        const accBox = $('#acc_info');
        if (accBox) {
          accBox.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div class="u-avatar" style="background:${currentUser.color || '#5b4bff'};width:48px;height:48px;font-size:22px">
                ${currentUser.name.charAt(0) || 'ط'}
              </div>
              <div style="flex:1">
                <b style="font-size:17px">${currentUser.name}</b>
                <div class="mute">اسم المستخدم: @${currentUser.un}</div>
              </div>
              <button class="btn alt" data-a="showAccModal">تبديل الحساب</button>
            </div>
            <div class="mute" style="margin-bottom:12px">بيانات هذا الحساب معزولة ومحفوظة بخصوصية لك فقط.</div>
          `;
        }

        const sl = $('#sl');
        if (sl) {
          sl.innerHTML = S.subjects
            .map(
              (s: string) =>
                `<div class="row"><input type='color' data-sc='${esc(s)}' value='${col(s)}' style='width:32px;height:32px;padding:0;border:0;background:none'><span class="tx">${esc(s)}</span><button class="x" data-a="sd" data-i="${esc(s)}">حذف</button></div>`
            )
            .join('');
        }

        const exl = $('#exl');
        if (exl) {
          exl.innerHTML =
            S.exams
              .map(
                (e: any) =>
                  `<div class="row"><span class="tx">${esc(e.n)}${e.s ? ' · ' + esc(e.s) : ''}</span><span class="tag">${esc(e.d)}</span><button class="x" data-a="ed" data-i="${e.id}">حذف</button></div>`
              )
              .join('') || '<div class="mute">لا يوجد امتحانات.</div>';
        }

        const goalInput = $('#goal') as HTMLInputElement | null;
        if (goalInput) goalInput.value = S.goal;
        const schInput = $('#sch') as HTMLInputElement | null;
        if (schInput) schInput.value = S.school;
        const uniInput = $('#uni') as HTMLInputElement | null;
        if (uniInput) uniInput.value = S.uni;
        const hijInput = $('#hij') as HTMLInputElement | null;
        if (hijInput) hijInput.value = S.hij;

        const fl2 = $('#fl2');
        if (fl2) {
          fl2.innerHTML =
            S.files
              .filter((x: any) => !x.s)
              .map(
                (f: any) =>
                  `<div class="row"><span class="tx">${esc(f.name)}</span><button class="x" data-a="fo" data-i="${f.id}">فتح</button><button class="x" data-a="fd" data-i="${f.id}">حذف</button></div>`
              )
              .join('') || '<div class="mute">لا توجد ملفات.</div>';
        }
      };

      const rRecs = async () => {
        let h = '';
        for (const n of S.notes.filter(inSub)) {
          const v = await getD('rec_' + n.id);
          h += `<div class="row" style="flex-wrap:wrap"><b class="tx">${esc(n.t)}</b><button class="x" data-a="nd" data-i="${n.id}">حذف</button>${v ? `<audio src="${url(v)}" controls style="width:100%"></audio>` : ''}</div>`;
        }
        const rl = $('#rl');
        if (rl) rl.innerHTML = h || '<div class="mute">لا توجد تسجيلات.</div>';
      };

      // Mistakes Review Module
      let NU = new Map<string, any>(),
        NT = 0,
        NDB = 0,
        MF = '',
        NF = '',
        NQ = '',
        MO = new Set<string>(),
        MS = new Set<string>();

      const isMist = (c: any) =>
        !c.mx && (c.wr != null ? c.wr >= 1 && (c.ok || 0) < 2 : (c.hd || 0) >= 2);
      const fdt = (d: any) => {
        try {
          return new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
        } catch (e) {
          return '';
        }
      };

      const rMist = () => {
        const el = $('#mst');
        if (!el) return;
        const ms = $('#msel') as HTMLSelectElement | null;
        if (ms) {
          const v = ms.value;
          ms.innerHTML = S.subjects.map((x: string) => `<option>${esc(x)}</option>`).join('');
          ms.value =
            v && S.subjects.includes(v) ? v : MF || S.cur || S.subjects[0] || '';
        }

        const all = S.cards.filter(isMist);
        const subs = [...new Set([...S.subjects, ...all.map((c: any) => c.s)])];
        const by = (s: string) =>
          all.filter((c: any) => c.s === s).sort((a: any, b: any) => (b.wr || b.hd || 0) - (a.wr || a.hd || 0));
        const sc = subs.map((s): [string, number] => [s, by(s).length]).filter((x) => x[1] > 0);
        const top = sc.slice().sort((a, b) => b[1] - a[1])[0];
        const fixed = S.cards.filter((c: any) => c.wr && !isMist(c)).length;

        if (MF && !sc.some((x) => x[0] === MF)) MF = '';
        const shown = MF ? sc.filter((x) => x[0] === MF) : sc;

        let h = `<div class="mst-sum"><div><b>${all.length}</b><span>أخطاء حالية</span></div><div><b>${top ? esc(top[0]) : '—'}</b><span>أكتر مادة</span></div><div><b>${fixed}</b><span>اتصلحت</span></div></div>`;
        h += `<div class="dkr"><button class="chip${MF ? '' : ' on'}" data-a="mf" data-i="">الكل (${all.length})</button>${sc.map(([s, n]) => `<button class="chip${MF === s ? ' on' : ''}" data-a="mf" data-i="${esc(s)}">${esc(s)} (${n})</button>`).join('')}</div>`;
        h +=
          shown
            .map(([s, n]) => {
              const op = shown.length === 1 || MO.has(s);
              const it = by(s)
                .map(
                  (c: any) =>
                    `<div class="mi" data-a="mq" data-i="${c.id}"><div class="mq">${esc(c.q)}</div>${MS.has(c.id) ? `<div class="ma">${esc(c.a)}</div>` : '<div class="mute" style="margin-bottom:6px">اضغط لعرض الإجابة</div>'}<div class="mm"><span class="tag">❌ ×${c.wr || c.hd}</span>${c.lw ? `<span class="mute">آخر خطأ: ${fdt(c.lw)}</span>` : ''}<button class="x" data-a="mhide" data-i="${c.id}">إخفاء</button></div></div>`
                )
                .join('');
              return `<div class="box mgrp" style="--c:${col(s)}"><div class="mh" data-a="mt" data-i="${esc(s)}"><b>${esc(s)}</b><span class="tag">${n}</span><i>${op ? '▾' : '◂'}</i></div>${op ? `<div class="mb">${it}<button class="btn" style="width:100%;margin-top:8px" data-a="mrev" data-i="${esc(s)}">🔁 راجع أخطاء ${esc(s)}</button></div>` : ''}</div>`;
            })
            .join('') || '<div class="box mute" style="text-align:center">مفيش أخطاء 🌿 كمّل كده</div>';

        el.innerHTML = h;
      };

      const rNts = async () => {
        const el = $('#ntl');
        if (!el) return;
        const tk = ++NT;
        const sel = $('#nsel') as HTMLSelectElement | null;
        if (sel) {
          const v = sel.value;
          sel.innerHTML = S.subjects.map((s: string) => `<option>${esc(s)}</option>`).join('');
          sel.value = v && S.subjects.includes(v) ? v : S.cur || S.subjects[0] || '';
        }

        const q = NQ.trim().toLowerCase();
        const subs = S.subjects.filter(
          (s: string) => (S.cn[s] || []).length || S.notes.some((n: any) => n.s === s)
        );
        if (NF && !subs.includes(NF)) NF = '';

        const nfc = $('#nfc');
        if (nfc) {
          nfc.innerHTML =
            `<button class="chip${NF ? '' : ' on'}" data-a="nf" data-i="">الكل</button>` +
            subs
              .map(
                (s: string) =>
                  `<button class="chip${NF === s ? ' on' : ''}" data-a="nf" data-i="${esc(s)}">${esc(s)} (${(S.cn[s] || []).length + S.notes.filter((n: any) => n.s === s).length})</button>`
              )
              .join('');
        }

        let h = '';
        for (const s of NF ? [NF] : subs) {
          const ps = (S.cn[s] || [])
            .filter(
              (p: any) => !q || [p.cue, p.body, p.sum].join(' ').toLowerCase().includes(q)
            )
            .sort((a: any, b: any) => (b.star || 0) - (a.star || 0) || (b.t || 0) - (a.t || 0));

          const rs = S.notes.filter(
            (n: any) => n.s === s && (!q || String(n.t).toLowerCase().includes(q))
          );
          if (!ps.length && !rs.length) continue;

          let r = '';
          for (const p of ps) {
            const b = (p.body || '').split('\n').slice(p.cue ? 0 : 1).join(' ').trim();
            r += `<div class="nrow" data-a="nop" data-i="${p.id}"><span>${p.star ? '⭐' : '📄'}</span><div class="tx"><b>${esc(ttl(p))}</b>${b ? `<small>${esc(b.slice(0, 90))}</small>` : ''}</div><span class="mute">${p.t ? fdt(p.t) : ''}</span></div>`;
          }

          for (const n of rs) {
            let u = NU.get(n.id);
            if (u === undefined) {
              const v = await getD('rec_' + n.id);
              u = v ? url(v) : null;
              NU.set(n.id, u);
            }
            r += `<div class="nrow" style="flex-wrap:wrap;cursor:default"><span>🎙️</span><b class="tx">${esc(n.t)}</b><button class="x" data-a="nrd" data-i="${n.id}">حذف</button>${u ? `<audio src="${u}" controls style="width:100%"></audio>` : ''}</div>`;
          }

          h += `<div class="box" style="border-inline-start:6px solid ${col(s)}"><h3>${esc(s)} <span class="tag">${ps.length + rs.length}</span></h3>${r}</div>`;
        }

        if (tk !== NT) return;
        el.innerHTML =
          h ||
          '<div class="box mute" style="text-align:center">' +
            (q ? 'مفيش نتائج' : 'لسه مفيش ملاحظات، اضغط "ملاحظة جديدة"') +
            '</div>';
      };

      const okBk = (o: any) => {
        if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
        for (const k of ['tasks', 'cards', 'log', 'exams', 'files', 'notes', 'subjects']) {
          if (k in o && !Array.isArray(o[k])) return false;
        }
        return !(o.cards || []).some((c: any) => !c || typeof c.q !== 'string' || typeof c.a !== 'string');
      };

      const rstBk = (t: string) => {
        let o: any;
        try {
          o = JSON.parse(t);
        } catch (e) {
          return toast('الملف مش نسخة صالحة');
        }
        if (!okBk(o)) return toast('النسخة تالفة أو شكلها غلط، ما اتغيرش حاجة');
        if (
          !confirm(
            `هتستبدل بيانات حسابك (${currentUser.name}) فقط بالنسخة دي.\nحسابات الطلاب الآخرين لن تتأثر. كمّل؟`
          )
        )
          return;

        try {
          localStorage.setItem((window as any).__K + '_prev', JSON.stringify(S));
          localStorage.setItem((window as any).__K, JSON.stringify(o));
        } catch (e) {
          return toast('المساحة ممتلئة، الاستعادة فشلت');
        }
        location.reload();
      };

      const rBk = () => {
        const el = $('#bkb');
        if (!el) return;
        const d = S.bkAt ? Math.floor((Date.now() - S.bkAt) / 864e5) : null;
        const has = S.cards.length + S.tasks.length + S.log.length > 0;
        const need = has && (d === null || d >= 7) && !(S.bkSn && Date.now() - S.bkSn < 864e5);
        el.style.display = need ? '' : 'none';
        if (need) {
          el.innerHTML = `⚠️ ${d === null ? 'لسه ما خدتش نسخة احتياطية' : 'آخر نسخة احتياطية من ' + d + ' يوم'}<div class="add" style="margin-top:8px"><button class="btn" data-a="dl">⬇️ حمّل نسخة الآن</button><button class="chip" data-a="bks">بعدين</button></div>`;
        }
      };

      const render = () => {
        rHead();
        rSub();
        rToday();
        rTasks();
        rCards();
        rMore();
        rRecs();
        rT();
        rX();
        rS();
        rPray();
        rN();
        rM();
        rP();
        rMood();
        rGr();
        rXP();
        rMist();
        rNts();
        rBk();
      };

      let eT: any = null,
        eC: any = null;
      const notify = (t: string) => {
        try {
          if (Notification.permission === 'granted') new Notification(t);
        } catch (e) {}
      };

      const CITY: Record<string, [number, number]> = {
        الإسكندرية: [31.2, 29.92],
        القاهرة: [30.04, 31.24],
        الجيزة: [30.01, 31.21],
        المنصورة: [31.04, 31.38],
        طنطا: [30.79, 31],
        الإسماعيلية: [30.6, 32.27],
        بورسعيد: [31.26, 32.3],
        السويس: [29.97, 32.55],
        الفيوم: [29.31, 30.84],
        أسيوط: [27.18, 31.18],
        سوهاج: [26.56, 31.7],
        الأقصر: [25.7, 32.64],
        أسوان: [24.09, 32.9]
      };

      const PN = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
      const cNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));

      const calc = () => {
        const n = cNow();
        const [la, lo] = CITY[S.city] || CITY['الإسكندرية'];
        const R = Math.PI / 180;
        const u = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12));
        const tz =
          Math.round(
            (n.getTime() - new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 18e5
          ) / 2;
        const d = u.getTime() / 864e5 - 10957.5;
        const g = (357.529 + 0.98560028 * d) * R;
        const q = (280.459 + 0.98564736 * d) % 360;
        const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R;
        const e = 23.439 * R;
        let ra = ((Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / R / 15 + 24) % 24);
        let eq = q / 15 - ra;
        eq -= 24 * Math.round(eq / 24);
        const dec = Math.asin(Math.sin(e) * Math.sin(L));
        const noon = 12 + tz - lo / 15 - eq;
        const k = Math.cos(la * R) * Math.cos(dec);
        const sl = Math.sin(la * R) * Math.sin(dec);
        const T2 = (a: number) => Math.acos((-Math.sin(a * R) - sl) / k) / R / 15;
        const A = Math.atan(1 / (1 + Math.tan(Math.abs(la * R - dec))));
        const asr = noon + Math.acos((Math.sin(A) - sl) / k) / R / 15;
        return [
          noon - T2(19.5),
          noon - T2(0.833),
          noon,
          asr,
          noon + T2(0.833),
          noon + T2(17.5)
        ].map((h) => Math.round(h * 60 + (+S.padj || 0)));
      };

      const fm = (m: number) =>
        new Date(2000, 0, 1, Math.floor(m / 60) % 24, m % 60).toLocaleTimeString('ar-EG', {
          hour: 'numeric',
          minute: '2-digit'
        });

      let lastP = '';
      const p2 = (n: number) => String(n).padStart(2, '0');

      const rPray = () => {
        const n = cNow();
        const nm = n.getHours() * 60 + n.getMinutes();
        const t = calc();
        const idx = [0, 2, 3, 4, 5];
        let nx = idx.find((i) => t[i] > nm);
        let df: number;
        if (nx === undefined) {
          nx = 0;
          df = t[0] + 1440 - nm;
        } else {
          df = t[nx] - nm;
        }
        const ts = Math.max(0, df * 60 - n.getSeconds());

        const ck = $('#ck');
        if (ck) {
          ck.textContent = new Date().toLocaleTimeString('ar-EG', {
            timeZone: 'Africa/Cairo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
        const cd2 = $('#cd2');
        if (cd2) {
          cd2.textContent = new Date().toLocaleDateString('ar-EG', {
            timeZone: 'Africa/Cairo',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        const nxEl = $('#nx');
        if (nxEl) {
          nxEl.textContent =
            'الصلاة الجاية: ' +
            PN[nx] +
            ' بعد ' +
            p2((ts / 3600) | 0) +
            ':' +
            p2(((ts % 3600) / 60) | 0) +
            ':' +
            p2(ts % 60);
        }
        const pt = $('#pt');
        if (pt) {
          pt.innerHTML = t
            .map(
              (m, i) =>
                `<div class='row'><span class='tx'${i === nx ? " style='font-weight:700;color:var(--acc)'" : ''}>${PN[i]}</span><span>${fm(m)}</span></div>`
            )
            .join('');
        }

        const hit = idx.find((i) => t[i] === nm);
        if (hit !== undefined && lastP !== nm + ':' + hit) {
          lastP = nm + ':' + hit;
          if (T.run && T.mode === 'focus') stop();
          toast('حان وقت ' + PN[hit]);
          notify('حان وقت ' + PN[hit]);
        }
      };

      const rX = () => {
        try {
          rRoom();
        } catch (e) {}
        const cityEl = $('#city') as HTMLSelectElement | null;
        if (cityEl) {
          cityEl.innerHTML = Object.keys(CITY)
            .map((c) => `<option ${c === (S.city || 'الإسكندرية') ? 'selected' : ''}>${c}</option>`)
            .join('');
        }
        const padj = $('#padj') as HTMLInputElement | null;
        if (padj) padj.value = S.padj || 0;

        const L = S.les.filter((x: any) => x.s === S.cur);
        const pr = L.length ? Math.round((L.reduce((a: number, x: any) => a + x.st / 2, 0) / L.length) * 100) : 0;
        const lp = $('#lp');
        if (lp) {
          lp.textContent = S.cur
            ? L.length
              ? 'إنجاز ' + S.cur + ': ' + pr + '%'
              : 'أضف دروس ' + S.cur
            : 'اختر مادة من الأعلى لإدارة دروسها';
        }
        const ll = $('#ll');
        if (ll) {
          ll.innerHTML = L.map(
            (x: any) =>
              `<div class='row'><button class='chip' data-a='ls' data-i='${x.id}'>${['لم يبدأ', 'اتذاكر', 'اتراجع'][x.st]}</button><span class='tx'>${esc(x.t)}</span><button class='x' data-a='lx' data-i='${x.id}'>×</button></div>`
          ).join('');
        }
      };

      let RT = 'n',
        PG: any = null,
        TM = false,
        SH = false;
      const cp = () => S.cn[S.room] || (S.cn[S.room] = []);
      const ttl = (p: any) => (p.cue || p.body || '').split('\n')[0].slice(0, 40) || 'صفحة جديدة';
      const FO = ['كتاب', 'ملزمة', 'امتحانات سابقة', 'أخرى'];

      const rRoom = () => {
        const R = $('#room');
        const H = $('#shelf');
        if (!H || !R) return;

        if (!S.room) {
          R.style.display = 'none';
          H.style.display = '';
          H.innerHTML = `<div class=shelf>${S.subjects
            .map((s: string) => {
              const L = S.les.filter((x: any) => x.s === s);
              const pr = L.length
                ? Math.round((L.reduce((a: number, x: any) => a + x.st / 2, 0) / L.length) * 100)
                : 0;
              return `<button class='bk' style='--c:${col(s)}' data-a='op' data-i='${esc(s)}'><i style='height:${pr}%'></i><b>${esc(s)}</b><div class='mute'>${(S.cn[s] || []).length} صفحة · ${S.files.filter((x: any) => x.s === s).length} ملف · ${pr}%</div></button>`;
            })
            .join('')}</div>`;
          return;
        }

        H.style.display = 'none';
        R.style.display = '';
        const c = col(S.room);
        const P = cp();
        let h = `<div class='add' style='align-items:center'><button class='chip' data-a='bk'>→ الرف</button><b style='font-size:20px;color:${c}'>${esc(S.room)}</b></div><div class='add'>${[['n', 'الملاحظات'], ['f', 'الملفات'], ['l', 'الدروس']].map(([k, v]) => `<button class='chip${RT === k ? ' on' : ''}' data-a='rt' data-i='${k}'>${v}</button>`).join('')}</div>`;

        if (RT === 'n') {
          const p = P.find((x: any) => x.id === PG);
          if (p) {
            h += `<div class='add'><button class='chip' data-a='pb'>→ الصفحات</button>${nsel()}<button class='chip' data-a='ps' data-i='${p.id}'>${p.star ? '⭐' : '☆'} مهم للامتحان</button><button class='chip${TM ? ' on' : ''}' data-a='tm'>اختبر نفسك</button><button class='chip' data-a='pc' data-i='${p.id}'>إلى كارت</button><button class='chip' data-a='pd' data-i='${p.id}'>حذف</button></div>`;
            h += TM
              ? `<div class='box' style='white-space:pre-wrap'><div class='mute'>اضغط على الجزء المخفي لكشفه</div>${esc(p.body).replace(/==(.+?)==/g, `<span class='hid' data-a='rv'>$1</span>`)}</div>`
              : `<div class='cn ns-${S.nst || 'k'}' style='--c:${c}'><textarea class='cue' data-f='cue' placeholder='كلمات مفتاحية وأسئلة'>${esc(p.cue)}</textarea><textarea data-f='body' placeholder='الشرح. ضع الكلمات المهمة بين == =='>${esc(p.body)}</textarea><textarea class='sum' data-f='sum' placeholder='لخّص الصفحة في سطرين'>${esc(p.sum)}</textarea></div>`;
          } else {
            const L = [...P].sort((a: any, b: any) => b.t - a.t);
            const lp = P.find((x: any) => x.id === S.last[S.room]);
            h += `<div class='add'><button class='btn' data-a='pn'>+ صفحة جديدة</button><button class='chip${SH ? ' on' : ''}' data-a='sheet'>ورقة المراجعة ⭐</button>${lp ? `<button class='chip' data-a='po' data-i='${lp.id}'>كمّل: ${esc(ttl(lp))}</button>` : ''}</div>`;
            if (SH) {
              const st = P.filter((x: any) => x.star);
              h += `<div class='box'><h3>ورقة المراجعة الأخيرة</h3>${st.map((x: any) => `<div class='row' style='flex-direction:column;align-items:flex-start'><b>${esc(ttl(x))}</b><span class='mute' style='white-space:pre-wrap'>${esc((x.sum || x.body).slice(0, 300))}</span></div>`).join('') || '<div class=mute>علّم صفحاتك المهمة بنجمة لتظهر هنا.</div>'}</div>`;
            }
            h += `<div class='box'>${L.map((x: any) => `<div class='row' data-a='po' data-i='${x.id}' style='cursor:pointer'><span class='tx'>${x.star ? '⭐ ' : ''}${esc(ttl(x))}</span><span class='tag'>${new Date(x.t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span></div>`).join('') || '<div class=mute>ابدأ بأول صفحة كورنيل.</div>'}</div>`;
          }
        } else if (RT === 'f') {
          const F = S.files.filter((x: any) => x.s === S.room);
          h +=
            `<div class='add'><select id='rfo'>${FO.map((x) => `<option>${x}</option>`).join('')}</select><label class='btn alt' for='rfi'>رفع ملفات</label><input id='rfi' type='file' multiple></div>` +
            FO.map((f) => {
              const g = F.filter((x: any) => (x.f || 'أخرى') === f);
              return g.length
                ? `<div class='box'><h3>${f}</h3>${g.map((x: any) => `<div class='row'><span class='tx'>${esc(x.name)}</span><button class='x' data-a='fo' data-i='${x.id}'>فتح</button><button class='x' data-a='fd' data-i='${x.id}'>حذف</button></div>`).join('')}</div>`
                : '';
            }).join('') +
            (F.length ? '' : '<div class=mute>لا ملفات في هذه المادة بعد.</div>');
        } else {
          const L = S.les.filter((x: any) => x.s === S.room);
          h += `<div class='add'><input id='rln' placeholder='درس جديد'><button class='btn alt' data-a='rl2'>إضافة</button></div><div class='box'>${L.map((x: any) => `<div class='row'><button class='chip' data-a='ls' data-i='${x.id}'>${['لم يبدأ', 'اتذاكر', 'اتراجع'][x.st]}</button><span class='tx'>${esc(x.t)}</span><button class='x' data-a='lx' data-i='${x.id}'>×</button></div>`).join('') || '<div class=mute>أضف دروس المادة.</div>'}</div>`;
        }
        R.innerHTML = h;
      };

      let LL: any = null;
      const bgPlay = () => {
        if (!au || !au.src || !($('#bgOn') as HTMLInputElement)?.checked) return;
        if (T.mode !== 'focus' && S.bgm !== 'all') return;
        au.play().catch(() => toast('اضغط تشغيل في مشغل المزاج'));
      };

      const showRate = () => {
        const rate = $('#rate');
        if (!rate) return;
        rate.innerHTML =
          '<span class=mute>قيّم تركيزك:</span>' +
          [1, 2, 3, 4, 5].map((n) => `<button class='chip' data-a='rate' data-i='${n}'>${n}</button>`).join('');
      };

      const rN = () => {
        const t = today();
        const dys = (n: number) =>
          [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - n - i);
            return dk(d);
          });
        const sm = (a: string[]) => a.reduce((s, d) => s + mins(d), 0);
        const w1 = sm(dys(0));
        const w0 = sm(dys(7));
        let h = `<div>📈 هذا الأسبوع <b>${Math.round(w1)}</b> د ${w0 ? (w1 >= w0 ? '▲' : '▼') + ' ' + Math.abs(Math.round(((w1 - w0) / w0) * 100)) + '% عن الأسبوع الماضي' : ''}</div>`;

        const hr: Record<number, number> = {};
        S.log.forEach((l: any) => {
          if (l.h != null) hr[l.h] = (hr[l.h] || 0) + l.m * (l.r || 3);
        });
        const bh = Object.entries(hr).sort((a, b) => b[1] - a[1])[0];
        if (bh) h += `<div>⏰ أفضل وقت لتركيزك حوالي <b>${fm(+bh[0] * 60)}</b></div>`;

        const fg = S.subjects
          .map((s: string) => {
            const L = S.log
              .filter((l: any) => l.s === s)
              .map((l: any) => l.d)
              .sort()
              .pop();
            return L ? [s, Math.floor((new Date(t).getTime() - new Date(L).getTime()) / 864e5)] : null;
          })
          .filter((x: any) => x && x[1] >= 4);

        if (fg.length) {
          h += `<div>🕰️ مواد منسية: ${fg.map((x: any) => esc(x[0]) + ' (' + x[1] + ' أيام)').join('، ')}</div>`;
        }

        const soon = S.exams.some((e: any) => {
          const n = Math.round(
            (new Date(e.d + 'T00:00').getTime() - new Date(t + 'T00:00').getTime()) / 864e5
          );
          return n >= 0 && n <= 7;
        });
        if (S.fmsg && (soon || !streak())) {
          h += `<div class='tag' style='display:block;margin-top:8px;padding:8px;white-space:pre-wrap'>💌 ${esc(S.fmsg)}</div>`;
        }

        const tot = S.log.reduce((a: number, l: any) => a + l.m, 0);
        const wg = +S.wg;
        h += `<div>🏁 إجمالي ${Math.round(tot / 6) / 10} ساعة · ${S.log.filter((l: any) => l.d === t).length} جلسة اليوم</div>`;
        if (wg) {
          h += `<div class=mute>هدف الأسبوع: ${Math.round((w1 / 60) * 10) / 10} من ${wg} ساعة</div><div class=pb><i style='width:${Math.min(100, (w1 / (wg * 60)) * 100)}%;background:var(--acc)'></i></div>`;
        }

        const ins = $('#ins');
        if (ins) ins.innerHTML = '<h3>رؤى</h3>' + h;

        const jl = $('#jl');
        if (jl) {
          jl.innerHTML =
            S.jar
              .map(
                (x: any) =>
                  `<div class='row'><span class='tx'>${esc(x.t)}</span><span class='tag'>${x.d}</span><button class='x' data-a='jd' data-i='${x.id}'>×</button></div>`
              )
              .join('') || '<div class=mute>فاضي.</div>';
        }

        const lgl = $('#lgl');
        if (lgl) {
          lgl.innerHTML =
            S.log
              .map((l: any, i: number) => [l, i])
              .slice(-8)
              .reverse()
              .map(
                ([l, i]: any) =>
                  `<div class='row'><span class='tx'>${esc(l.s)} · ${Math.round(l.m)} د${l.k ? ' · ' + esc(l.k) : ''}${l.r ? ' · ⭐' + l.r : ''}</span><span class='tag'>${l.d}</span><button class='x' data-a='lg' data-i='${i}'>حذف</button></div>`
              )
              .join('') || '<div class=mute>لا جلسات.</div>';
        }

        const fmsg = $('#fmsg') as HTMLTextAreaElement | null;
        if (fmsg) fmsg.value = S.fmsg || '';
        const bgm = $('#bgm') as HTMLSelectElement | null;
        if (bgm) bgm.value = S.bgm || 'focus';
      };

      const flush = () => {
        if (T.mode !== 'focus') return;
        const l = T.run ? Math.max(0, Math.ceil((T.end - Date.now()) / 1000)) : T.left;
        const e = T.total - l - (T.logged || 0);
        if (e < 20) return;
        S.log.push({
          s: T.sub || S.cur || 'عام',
          m: e / 60,
          k: T.task || '',
          d: today(),
          h: new Date().getHours()
        });
        T.logged = (T.logged || 0) + e;
        if (S.run) S.run.logged = T.logged;
        save();
        rToday();
        rN();
      };

      window.addEventListener('pagehide', () => {
        if (T.run) flush();
      });

      const DN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const hs = (h: any) => {
        let n = 0,
          d = new Date();
        if (!h.d.includes(dk(d))) d.setDate(d.getDate() - 1);
        while (h.d.includes(dk(d))) {
          n++;
          d.setDate(d.getDate() - 1);
        }
        return n;
      };

      const rM = () => {
        const t = today();
        const w = cNow().getDay();
        const T2 = S.tt.filter((x: any) => x.w === w).sort((a: any, b: any) => (a.tm < b.tm ? -1 : 1));
        const td2 = $('#td2');
        if (td2) {
          td2.innerHTML =
            '<h3>عاداتي وحصص اليوم</h3>' +
            (S.hb.length
              ? `<div class='add'>${S.hb.map((h: any) => `<button class='chip${h.d.includes(t) ? ' on' : ''}' data-a='hc' data-i='${h.id}'>${esc(h.t)} 🔥${hs(h)}</button>`).join('')}</div>`
              : '') +
            T2.map(
              (x: any) => `<div class='row'><span class='tag'>${esc(x.tm)}</span><span class='tx'>${esc(x.t)}</span></div>`
            ).join('') +
            (S.hb.length || T2.length ? '' : '<div class=mute>أضف عادات وحصص من «المزيد».</div>');
        }

        const hl = $('#hl');
        if (hl) {
          hl.innerHTML =
            S.hb
              .map(
                (h: any) =>
                  `<div class='row'><span class='tx'>${esc(h.t)}</span><button class='x' data-a='hdel' data-i='${h.id}'>حذف</button></div>`
              )
              .join('') || '<div class=mute>لا عادات.</div>';
        }

        const ttlEl = $('#ttl');
        if (ttlEl) {
          ttlEl.innerHTML =
            [...S.tt]
              .sort((a: any, b: any) => a.w - b.w || (a.tm < b.tm ? -1 : 1))
              .map(
                (x: any) =>
                  `<div class='row'><span class='tag'>${DN[x.w]} ${esc(x.tm)}</span><span class='tx'>${esc(x.t)}</span><button class='x' data-a='ttd' data-i='${x.id}'>حذف</button></div>`
              )
              .join('') || '<div class=mute>لا حصص.</div>';
        }

        const sb = $('#sb') as HTMLInputElement | null;
        if (sb) sb.value = S.sb || 5;
        const lb = $('#lb') as HTMLInputElement | null;
        if (lb) lb.value = S.lb || 15;
        const wg = $('#wg') as HTMLInputElement | null;
        if (wg) wg.value = S.wg || '';
      };

      const ay = () => {
        const n = new Date();
        return n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear() - 1;
      };

      const TRM = () => {
        const y = ay();
        return S.term === 1
          ? {
              a: new Date(y, 9, 1),
              b: new Date(y + 1, 2, 0),
              ms: [
                [y, 9],
                [y, 10],
                [y, 11],
                [y + 1, 0],
                [y + 1, 1]
              ]
            }
          : {
              a: new Date(y + 1, 1, 1),
              b: new Date(y + 1, 6, 0),
              ms: [
                [y + 1, 1],
                [y + 1, 2],
                [y + 1, 3],
                [y + 1, 4],
                [y + 1, 5]
              ]
            };
      };

      const rP = () => {
        const t = today();
        const r = TRM();
        const sel = S.pd || t;
        $$('[data-a=term]').forEach((x) => x.classList.toggle('on', +((x as HTMLElement).dataset.i || 0) === S.term));
        const days = Math.round((r.b.getTime() - r.a.getTime()) / 864e5) + 1;
        const el = Math.min(
          days,
          Math.max(0, Math.floor((new Date(t + 'T00:00').getTime() - r.a.getTime()) / 864e5) + 1)
        );
        const inT = (k: string) => k >= dk(r.a) && k <= dk(r.b);
        const tm = S.log.filter((l: any) => inT(l.d)).reduce((a: number, l: any) => a + l.m, 0);
        const nx = S.exams.filter((e: any) => inT(e.d)).length;
        const nk = S.tasks.filter((x: any) => x.d && inT(x.d) && !x.done).length;

        const tinfo = $('#tinfo');
        if (tinfo) {
          tinfo.innerHTML = `<h3>تقدم الترم · أسبوع ${Math.max(1, Math.ceil(el / 7))} من ${Math.ceil(days / 7)}</h3><div class=pb><i style='width:${(el / days) * 100}%;background:var(--acc)'></i></div><div class=mute>${Math.round(tm / 6) / 10} ساعة مذاكرة · ${nx} امتحان · ${nk} مهمة قادمة</div>`;
        }

        const sd = new Date(sel + 'T00:00');
        const tt = S.tt.filter((x: any) => x.w === sd.getDay()).sort((a: any, b: any) => (a.tm < b.tm ? -1 : 1));
        const dx = S.exams.filter((e: any) => e.d === sel);
        const dt = S.tasks.filter((x: any) => x.d === sel);
        const ds = S.log.filter((l: any) => l.d === sel);

        const dday = $('#dday');
        if (dday) {
          dday.innerHTML =
            `<h3>${sd.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><div>⏱️ ${Math.round(mins(sel))} دقيقة · ${ds.length} جلسة</div>` +
            dx.map((e: any) => `<div class='row'><span class='tag bad'>امتحان</span><span class='tx'>${esc(e.n)}</span></div>`).join('') +
            dt.map((x: any) => `<div class='row${x.done ? ' done' : ''}'><span class='tag'>مهمة</span><span class='tx'>${esc(x.t)}</span></div>`).join('') +
            tt.map((x: any) => `<div class='row'><span class='tag'>${esc(x.tm)}</span><span class='tx'>${esc(x.t)}</span></div>`).join('') +
            `<div class='add' style='margin-top:10px'><input id='pdt' placeholder='أضف لهذا اليوم'><button class='btn alt' data-a='pdx'>امتحان</button><button class='btn alt' data-a='pdk'>مهمة</button></div>`;
        }

        const tcal = $('#tcal');
        if (tcal) {
          tcal.innerHTML =
            r.ms
              .map(([y, mo]) => {
                const off = (new Date(y, mo, 1).getDay() + 1) % 7;
                const dmn = new Date(y, mo + 1, 0).getDate();
                let c = '';
                for (let i = 0; i < off; i++) c += '<i></i>';
                for (let d = 1; d <= dmn; d++) {
                  const k = dk(new Date(y, mo, d));
                  if (!inT(k)) {
                    c += '<i></i>';
                    continue;
                  }
                  const m = mins(k);
                  const hx = S.exams.some((e: any) => e.d === k);
                  const hq = S.tasks.some((e: any) => e.d === k && !e.done);
                  const p = Math.min(70, (m / (+S.goal || 120)) * 100);
                  c += `<div data-a='pday' data-i='${k}' style='cursor:pointer;aspect-ratio:1;border-radius:8px;font-size:12px;text-align:center;line-height:1.25;padding-top:3px;background:color-mix(in srgb,var(--acc) ${Math.round(p)}%,var(--soft));${k === t ? 'outline:2px solid var(--ink);' : ''}${k === sel ? 'box-shadow:0 0 0 3px var(--acc);' : ''}'>${d}<br>${hx ? '🎯' : ''}${hq ? '•' : ''}</div>`;
                }
                return `<div class='box'><h3>${new Date(y, mo, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</h3><div style='display:grid;grid-template-columns:repeat(7,1fr);gap:4px'>${['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map((x) => `<div class=mute style='text-align:center'>${x}</div>`).join('')}${c}</div></div>`;
              })
              .join('') +
            `<div class=mute>الغامق = دقائق أكتر · 🎯 امتحان · • مهمة · اضغط على أي يوم لتفاصيله</div>`;
        }
      };

      const rMood = () => {
        const ml = $('#ml');
        if (ml) {
          ml.innerHTML =
            S.moods
              .map(
                (x: any) =>
                  `<div class='row'><button class='chip${x.id === S.mcur ? ' on' : ''}' data-a='mpl' data-i='${x.id}'>${x.id === S.mcur && au && !au.paused ? '⏸' : '▶'}</button><span class='tx'>${esc(x.n)}</span>${x.u ? `<button class='x' data-a='msv' data-i='${x.id}' title='حفظ على الجهاز'>⬇</button>` : ''}<button class='x' data-a='mup' data-i='${x.id}'>↑</button><button class='x' data-a='mdl' data-i='${x.id}'>حذف</button></div>`
              )
              .join('') || '<div class=mute>أضف سورة أو أكتر.</div>';
        }
        const mrp = $('#mrp') as HTMLSelectElement | null;
        if (mrp) mrp.value = S.mrp || 'all';
      };

      const loadM = async (id: string, play: boolean) => {
        const mo = S.moods.find((x: any) => x.id === id);
        const v = (mo && mo.u) || (await getD('mood_' + id));
        if (!v) return toast('الملف غير موجود');
        S.mcur = id;
        S.apos = 0;
        if (au) {
          au.src = url(v);
          save();
          if (play) au.play().catch(pe);
        }
        rMood();
      };

      const nextM = () => {
        const L = S.moods;
        if (!L.length) return;
        if (S.mrp === 'one') {
          if (au) au.play();
          return;
        }
        const i = L.findIndex((x: any) => x.id === S.mcur);
        loadM(L[S.mrp === 'shuf' ? Math.floor(Math.random() * L.length) : (i + 1) % L.length].id, true);
      };

      const rS = () => {
        const sq = $('#sq') as HTMLInputElement | null;
        if (!sq) return;
        const q = sq.value.trim().toLowerCase();
        const sr = $('#sr');
        if (!sr) return;
        if (!q) {
          sr.innerHTML = '';
          return;
        }
        const r = [
          ...S.tasks.map((x: any) => ['مهمة', x.t]),
          ...S.cards.map((x: any) => ['كارت', x.q + ' — ' + x.a]),
          ...Object.entries(S.nt || {}).map(([s, t]) => ['ملاحظة ' + s, t]),
          ...S.les.map((x: any) => ['درس ' + x.s, x.t]),
          ...S.files.map((x: any) => ['ملف', x.name])
        ]
          .filter((x: any) => String(x[1]).toLowerCase().includes(q))
          .slice(0, 20);

        sr.innerHTML =
          r
            .map(
              (x: any) =>
                `<div class='row'><span class='tag'>${esc(x[0])}</span><span class='tx'>${esc(String(x[1]).slice(0, 90))}</span></div>`
            )
            .join('') || '<div class="mute">لا نتائج</div>';
      };

      let mr: any = null,
        chunks: any[] = [],
        msStream: any = null;

      // Centralized Action Handlers
      const act: Record<string, (i?: any, b?: any) => void> = {
        nav(i) {
          $$('section').forEach((x) => x.classList.toggle('on', x.id === i));
          $$('nav button').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.i === i));
          window.scrollTo(0, 0);
        },
        showAccModal() {
          act.nav('more');
          const accBox = $('#acc_info');
          if (accBox) accBox.scrollIntoView({ behavior: 'smooth' });
        },
        lgo() {
          save();
          logout();
        },
        dl() {
          try {
            S.bkAt = Date.now();
            save();
            const b = new Blob([JSON.stringify(S)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = `mzakrti-${currentUser.un}-${today()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            rBk();
            toast('اتحمّلت نسخة حسابك. احتفظ بيها في مكان آمن');
          } catch (e) {
            toast('التحميل فشل، استخدم "نسخ البيانات"');
          }
        },
        bks() {
          S.bkSn = Date.now();
          save();
          rBk();
        },
        mf(i) {
          MF = i;
          rMist();
        },
        madd() {
          const s = ($('#msel') as HTMLSelectElement)?.value;
          const q = ($('#mq2') as HTMLTextAreaElement)?.value.trim();
          const a = ($('#ma2') as HTMLTextAreaElement)?.value.trim();
          if (!s) return toast('اختار مادة');
          if (!q || !a) return toast('اكتب الخطأ والإجابة الصح');
          S.cards.push({ id: uid(), q, a, s, due: today(), iv: 0, hd: 1, wr: 1, lw: today(), ok: 0 });
          ($('#mq2') as HTMLTextAreaElement).value = ($('#ma2') as HTMLTextAreaElement).value = '';
          save();
          render();
          toast('اتضاف للأخطاء');
        },
        mt(i) {
          MO.has(i) ? MO.delete(i) : MO.add(i);
          rMist();
        },
        mq(i) {
          MS.has(i) ? MS.delete(i) : MS.add(i);
          rMist();
        },
        mhide(i) {
          const c = S.cards.find((x: any) => x.id === i);
          if (c) {
            c.mx = true;
            save();
            rMist();
          }
        },
        mrev(i) {
          S.cards.filter((c: any) => c.s === i && isMist(c)).forEach((c: any) => (c.due = today()));
          S.cur = i;
          S.cdk = '';
          save();
          render();
          act.nav('cards');
          toast('جلسة مراجعة أخطاء ' + i);
        },
        nf(i) {
          NF = i;
          rNts();
        },
        nop(i) {
          const s = Object.keys(S.cn).find((k) => S.cn[k].some((p: any) => p.id === i));
          if (!s) return;
          S.room = s;
          S.cur = s;
          RT = 'n';
          PG = i;
          TM = false;
          SH = false;
          save();
          render();
          act.nav('subs');
        },
        nnew() {
          const s = ($('#nsel') as HTMLSelectElement)?.value;
          if (!s) return toast('اختار مادة');
          const p = { id: uid(), cue: '', body: '', sum: '', star: 0, t: Date.now() };
          (S.cn[s] = S.cn[s] || []).push(p);
          S.room = s;
          S.cur = s;
          RT = 'n';
          PG = p.id;
          TM = false;
          SH = false;
          save();
          render();
          act.nav('subs');
        },
        nrd(i, b) {
          arm(b, async () => {
            await delD('rec_' + i);
            const u = NU.get(i);
            if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
            NU.delete(i);
            S.notes = S.notes.filter((x: any) => x.id !== i);
            save();
            rNts();
          });
        },
        mode(i) {
          if (T.run) return toast('أوقف المؤقت أولاً');
          setMode(i);
        },
        go() {
          T.run ? stop() : start();
        },
        rs() {
          stop();
          setMode(T.mode);
        },
        tk(i) {
          const k = S.tasks.find((x: any) => x.id === i);
          if (k) {
            k.done = !k.done;
            if (k.done && k.r) {
              const n = new Date((k.d || today()) + 'T00:00');
              n.setDate(n.getDate() + (k.r === 'd' ? 1 : 7));
              S.tasks.push({ id: uid(), t: k.t, s: k.s, d: dk(n), p: k.p, r: k.r, done: false });
              k.r = '';
            }
          }
          save();
          rTasks();
          rToday();
        },
        td(i) {
          S.tasks = S.tasks.filter((x: any) => x.id !== i);
          save();
          rTasks();
          rToday();
        },
        addT() {
          const tt = $('#tt') as HTMLInputElement | null;
          const t = tt ? tt.value.trim() : '';
          if (!t) return;
          const td = ($('#td') as HTMLInputElement | null)?.value || '';
          const tp = +(($('#tp') as HTMLSelectElement | null)?.value || 0);
          const tr = ($('#tr') as HTMLSelectElement | null)?.value || '';

          if (eT) {
            Object.assign(eT, { t, d: td, p: tp });
            eT = null;
          } else {
            S.tasks.push({ id: uid(), t, s: S.cur, d: td, p: tp, r: tr, done: false });
          }
          if (tt) tt.value = '';
          const tdInput = $('#td') as HTMLInputElement | null;
          if (tdInput) tdInput.value = '';
          save();
          rTasks();
          rToday();
        },
        flip() {
          flip = !flip;
          rCards();
        },
        gr(i) {
          const c = cdue()[0];
          if (!c) return;
          const iv0 = c.iv || 0;
          if (i == 0) {
            c.hd = (c.hd || 0) + 1;
            c.wr = (c.wr || 0) + 1;
            c.lw = today();
            c.ok = 0;
            c.mx = false;
          } else {
            if (i == 2) c.hd = 0;
            if (c.wr) c.ok = (c.ok || 0) + 1;
          }
          c.iv =
            i == 0
              ? 1
              : i == 1
              ? Math.max(2, Math.round(iv0 * 1.8))
              : Math.max(4, Math.round(Math.max(iv0, 1) * 3));
          c.due = dk(Date.now() + c.iv * 864e5);
          flip = false;
          save();
          rCards();
          rToday();
        },
        addC() {
          const cq = $('#cq') as HTMLInputElement | null;
          const ca = $('#ca') as HTMLInputElement | null;
          const ckd = $('#ckd') as HTMLSelectElement | null;
          const q = cq ? cq.value.trim() : '';
          const a = ca ? ca.value.trim() : '';
          const k = ckd ? ckd.value : '';
          if (!q || !a) return toast('اكتب السؤال والإجابة');

          if (eC) {
            eC.q = q;
            eC.a = a;
            eC.k = k;
            eC = null;
            const cfh = $('#cfh');
            if (cfh) cfh.textContent = 'كارت جديد';
          } else {
            S.cards.push({ id: uid(), q, a, s: S.cur || 'عام', k, due: today(), iv: 0 });
          }
          if (cq) cq.value = '';
          if (ca) ca.value = '';
          save();
          rCards();
          rToday();
          toast('اتحفظ الكارت');
        },
        cd(i) {
          S.cards = S.cards.filter((x: any) => x.id !== i);
          save();
          rCards();
          rToday();
        },
        addS() {
          const ns = $('#ns') as HTMLInputElement | null;
          const v = ns ? ns.value.trim() : '';
          if (v && !S.subjects.includes(v)) {
            S.subjects.push(v);
            S.cur = v;
            if (ns) ns.value = '';
            save();
            render();
          }
        },
        sd(i, b) {
          arm(b, () => {
            S.subjects = S.subjects.filter((x: string) => x !== i);
            if (S.cur === i) S.cur = '';
            save();
            render();
          });
        },
        addE() {
          const en = $('#en') as HTMLInputElement | null;
          const ed = $('#ed') as HTMLInputElement | null;
          const es = $('#es') as HTMLSelectElement | null;
          const n = en ? en.value.trim() : '';
          const d = ed ? ed.value : '';
          if (!n || !d) return toast('اكتب الاسم والتاريخ');
          S.exams.push({ id: uid(), n, d, s: es ? es.value : '' });
          if (en) en.value = '';
          save();
          rMore();
          rToday();
        },
        ed(i) {
          S.exams = S.exams.filter((x: any) => x.id !== i);
          save();
          rMore();
          rToday();
        },
        async fo(i) {
          const f = S.files.find((x: any) => x.id === i);
          const b = await getD(i);
          if (!b) return toast('الملف غير موجود في التخزين');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = f.name;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        fd(i, b) {
          arm(b, async () => {
            await delD(i);
            S.files = S.files.filter((x: any) => x.id !== i);
            save();
            rMore();
          });
        },
        async rec() {
          if (mr && mr.state === 'recording') {
            mr.stop();
            return;
          }
          try {
            msStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mr = new (window as any).MediaRecorder(msStream);
            chunks = [];
            mr.ondataavailable = (e: any) => chunks.push(e.data);
            mr.onstop = async () => {
              msStream.getTracks().forEach((t: any) => t.stop());
              const id = uid();
              await putD('rec_' + id, new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
              const rn = $('#rn') as HTMLInputElement | null;
              S.notes.push({ id, t: (rn ? rn.value.trim() : '') || 'تسجيل صوتي', s: S.cur || 'عام' });
              if (rn) rn.value = '';
              const rb = $('#rb');
              if (rb) rb.textContent = '🔴 تسجيل';
              save();
              rRecs();
              toast('تم حفظ التسجيل');
            };
            mr.start();
            const rb = $('#rb');
            if (rb) rb.textContent = '⏹️ إيقاف وحفظ';
          } catch (e) {
            toast('الميكروفون غير متاح أو لم يتم السماح به');
          }
        },
        nd(i, b) {
          arm(b, async () => {
            await delD('rec_' + i);
            S.notes = S.notes.filter((x: any) => x.id !== i);
            save();
            rRecs();
          });
        },
        exp() {
          const j = JSON.stringify(S);
          const bk = $('#bk') as HTMLTextAreaElement | null;
          if (bk) {
            bk.value = j;
            bk.select();
          }
          try {
            navigator.clipboard.writeText(j).then(() => toast('تم نسخ بيانات حسابك'));
          } catch (e) {
            toast('حدد النص وانسخه');
          }
        },
        imp() {
          const bk = $('#bk') as HTMLTextAreaElement | null;
          if (bk) rstBk(bk.value);
        },
        reset(i, b) {
          arm(b, () => {
            try {
              localStorage.removeItem((window as any).__K);
            } catch (e) {}
            try {
              indexedDB.deleteDatabase((window as any).__DB);
            } catch (e) {}
            location.reload();
          });
        },
        te(i) {
          const k = S.tasks.find((x: any) => x.id === i);
          if (!k) return;
          eT = k;
          const tt = $('#tt') as HTMLInputElement | null;
          if (tt) tt.value = k.t;
          const td = $('#td') as HTMLInputElement | null;
          if (td) td.value = k.d || '';
          const tp = $('#tp') as HTMLSelectElement | null;
          if (tp) tp.value = k.p || 0;
          toast('عدّل ثم اضغط إضافة');
        },
        ce(i) {
          const c = S.cards.find((x: any) => x.id === i);
          if (!c) return;
          eC = c;
          const cq = $('#cq') as HTMLInputElement | null;
          if (cq) cq.value = c.q;
          const ca = $('#ca') as HTMLInputElement | null;
          if (ca) ca.value = c.a;
          rCk();
          const ckd = $('#ckd') as HTMLSelectElement | null;
          if (ckd) ckd.value = S.decks.some((d: any) => d.id === c.k) ? c.k : '';
          const cfh = $('#cfh');
          if (cfh) cfh.textContent = 'تعديل كارت';
          toast('عدّل ثم اضغط حفظ');
        },
        addL() {
          const lm = $('#lm') as HTMLInputElement | null;
          const m = lm ? +lm.value : 0;
          if (!m) return toast('اكتب عدد الدقائق');
          S.log.push({ s: S.cur || 'عام', m, d: today() });
          if (lm) lm.value = '';
          save();
          rToday();
          toast('تم التسجيل');
        },
        addLs() {
          if (!S.cur) return toast('اختر مادة أولاً');
          const ln = $('#ln') as HTMLInputElement | null;
          const t = ln ? ln.value.trim() : '';
          if (!t) return;
          S.les.push({ id: uid(), s: S.cur, t, st: 0 });
          if (ln) ln.value = '';
          save();
          rX();
        },
        ls(i) {
          const x = S.les.find((y: any) => y.id === i);
          if (x) x.st = (x.st + 1) % 3;
          save();
          rX();
        },
        lx(i) {
          S.les = S.les.filter((y: any) => y.id !== i);
          save();
          rX();
        },
        op(i) {
          S.room = i;
          S.cur = i;
          RT = 'n';
          PG = null;
          TM = false;
          SH = false;
          save();
          render();
        },
        bk() {
          S.room = '';
          S.cur = '';
          save();
          render();
        },
        rt(i) {
          RT = i;
          PG = null;
          rRoom();
        },
        pn() {
          const p = { id: uid(), cue: '', body: '', sum: '', star: 0, t: Date.now() };
          cp().push(p);
          PG = p.id;
          TM = false;
          save();
          rRoom();
        },
        po(i) {
          PG = i;
          TM = false;
          S.last[S.room] = i;
          save();
          rRoom();
        },
        pb() {
          PG = null;
          rRoom();
        },
        ps(i) {
          const p = cp().find((x: any) => x.id === i);
          if (p) p.star = p.star ? 0 : 1;
          save();
          rRoom();
        },
        tm() {
          TM = !TM;
          rRoom();
        },
        pc(i) {
          const p = cp().find((x: any) => x.id === i);
          if (!p) return;
          const q = (p.cue || p.body).split('\n')[0].trim();
          const a = (p.sum || p.body).trim().slice(0, 300);
          if (!q || !a) return toast('اكتب سؤالاً وإجابة أولاً');
          S.cards.push({ id: uid(), q, a, s: S.room, due: today(), iv: 0 });
          save();
          rCards();
          rToday();
          toast('اتضاف كارت');
        },
        pd(i, b) {
          arm(b, () => {
            S.cn[S.room] = cp().filter((x: any) => x.id !== i);
            PG = null;
            save();
            rRoom();
          });
        },
        sheet() {
          SH = !SH;
          rRoom();
        },
        rv(i, b) {
          b.classList.toggle('on');
        },
        rl2() {
          const rln = $('#rln') as HTMLInputElement | null;
          const t = rln ? rln.value.trim() : '';
          if (!t) return;
          S.les.push({ id: uid(), s: S.room, t, st: 0 });
          save();
          rRoom();
        },
        bgt() {
          if (!au) return;
          au.src
            ? au.paused
              ? au.play().catch(() => toast('تعذر التشغيل'))
              : au.pause()
            : toast('اختر ملف المزاج من المزيد');
        },
        zen() {
          document.body.classList.toggle('zen');
        },
        jar() {
          const jr = $('#jr') as HTMLInputElement | null;
          const v = jr ? jr.value.trim() : '';
          if (!v) return;
          S.jar.push({ id: uid(), t: v, d: today() });
          if (jr) jr.value = '';
          save();
          rN();
          toast('اتحفظت، كمّل تركيزك');
        },
        jd(i) {
          S.jar = S.jar.filter((x: any) => x.id !== i);
          save();
          rN();
        },
        rate(i) {
          if (LL) LL.r = +i;
          LL = null;
          const rate = $('#rate');
          if (rate) rate.innerHTML = '';
          save();
          rN();
          toast('شكراً');
        },
        lg(i, b) {
          arm(b, () => {
            S.log.splice(+i, 1);
            save();
            render();
          });
        },
        hd() {
          S.hdn = !S.hdn;
          save();
          rTasks();
        },
        cl(i, b) {
          arm(b, () => {
            S.tasks = S.tasks.filter((x: any) => !x.done);
            save();
            rTasks();
            rToday();
          });
        },
        tgo(i) {
          const k = S.tasks.find((x: any) => x.id === i);
          if (!k) return;
          if (T.run) return toast('أوقف المؤقت أولاً');
          if (k.s && S.subjects.includes(k.s)) {
            S.cur = k.s;
            save();
            render();
          }
          setMode('focus');
          T.task = k.t;
          act.nav('timer');
          start();
          toast('ركّز على: ' + k.t);
        },
        hadd() {
          const hn = $('#hn') as HTMLInputElement | null;
          const t = hn ? hn.value.trim() : '';
          if (!t) return;
          S.hb.push({ id: uid(), t, d: [] });
          if (hn) hn.value = '';
          save();
          rM();
        },
        hc(i) {
          const h = S.hb.find((x: any) => x.id === i);
          if (!h) return;
          const t = today();
          h.d = h.d.includes(t) ? h.d.filter((x: any) => x !== t) : [...h.d, t];
          save();
          rM();
        },
        hdel(i, b) {
          arm(b, () => {
            S.hb = S.hb.filter((x: any) => x.id !== i);
            save();
            rM();
          });
        },
        tta() {
          const tti = $('#tti') as HTMLInputElement | null;
          const t = tti ? tti.value.trim() : '';
          if (!t) return toast('اكتب اسم الحصة');
          const tdw = $('#tdw') as HTMLSelectElement | null;
          const ttm = $('#ttm') as HTMLInputElement | null;
          S.tt.push({ id: uid(), w: +(tdw ? tdw.value : 0), tm: (ttm ? ttm.value : '') || '00:00', t });
          if (tti) tti.value = '';
          save();
          rM();
        },
        ttd(i, b) {
          arm(b, () => {
            S.tt = S.tt.filter((x: any) => x.id !== i);
            save();
            rM();
          });
        },
        rep() {
          const d = [...Array(7)].map((_, i) => {
            const x = new Date();
            x.setDate(x.getDate() - i);
            return dk(x);
          });
          const L = S.log.filter((l: any) => d.includes(l.d));
          const by: Record<string, number> = {};
          L.forEach((l: any) => (by[l.s] = (by[l.s] || 0) + l.m));
          const tx =
            `تقرير مذاكرتي الأسبوعي (${currentUser.name})\n` +
            'الإجمالي: ' +
            Math.round(L.reduce((a: number, l: any) => a + l.m, 0)) +
            ' دقيقة\n' +
            Object.entries(by)
              .map(([s, m]) => s + ': ' + Math.round(m) + ' د')
              .join('\n') +
            '\nأيام متتالية: ' +
            streak();
          const bk = $('#bk') as HTMLTextAreaElement | null;
          if (bk) bk.value = tx;
          try {
            navigator.clipboard.writeText(tx).then(() => toast('تم نسخ التقرير'));
          } catch (e) {
            toast('انسخ النص من خانة النسخ الاحتياطية');
          }
        },
        term(i) {
          S.term = +i;
          S.pd = '';
          save();
          rP();
        },
        pday(i) {
          S.pd = i;
          rP();
          window.scrollTo(0, 0);
        },
        pdx() {
          const pdt = $('#pdt') as HTMLInputElement | null;
          const n = pdt ? pdt.value.trim() : '';
          if (!n) return toast('اكتب الاسم');
          S.exams.push({ id: uid(), n, d: S.pd || today() });
          save();
          rP();
          rMore();
          rToday();
          toast('اتضاف امتحان');
        },
        pdk() {
          const pdt = $('#pdt') as HTMLInputElement | null;
          const t = pdt ? pdt.value.trim() : '';
          if (!t) return toast('اكتب المهمة');
          S.tasks.push({ id: uid(), t, s: S.cur, d: S.pd || today(), p: 0, r: '', done: false });
          save();
          rP();
          rTasks();
          rToday();
          toast('اتضافت مهمة');
        },
        mpl(i) {
          if (i === S.mcur && au && au.src) {
            au.paused ? au.play().catch(pe) : au.pause();
          } else loadM(i, true);
        },
        mnx() {
          nextM();
        },
        mup(i) {
          const k = S.moods.findIndex((x: any) => x.id === i);
          if (k > 0) {
            [S.moods[k - 1], S.moods[k]] = [S.moods[k], S.moods[k - 1]];
            save();
            rMood();
          }
        },
        mdl(i, b) {
          arm(b, async () => {
            await delD('mood_' + i);
            S.moods = S.moods.filter((x: any) => x.id !== i);
            if (S.mcur === i && au) {
              au.pause();
              au.removeAttribute('src');
              au.load();
              S.mcur = S.moods[0] ? S.moods[0].id : '';
              if (S.mcur) await loadM(S.mcur, false);
            }
            save();
            rMood();
          });
        },
        async ntf() {
          try {
            const p = await Notification.requestPermission();
            toast(p === 'granted' ? 'تم تفعيل التنبيهات' : 'التنبيهات غير مسموحة');
          } catch (e) {
            toast('المتصفح لا يدعم التنبيهات');
          }
        },
        // Account management in Settings
        async cpw() {
          const users = getUsers();
          const u = users.find((x) => x.id === currentUser.id);
          const pw1 = $('#pw1') as HTMLInputElement | null;
          const pw2 = $('#pw2') as HTMLInputElement | null;
          const a = pw1 ? pw1.value : '';
          const n = pw2 ? pw2.value : '';

          if (!u || (await hash(a, u.salt)) !== u.h) {
            return toast('كلمة المرور الحالية غير صحيحة');
          }
          if (n.length < 6) {
            return toast('الجديدة لازم تكون 6 أحرف أو أكثر');
          }

          u.salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
          u.h = await hash(n, u.salt);
          LS.setItem('mz_users', JSON.stringify(users));
          if (pw1) pw1.value = '';
          if (pw2) pw2.value = '';
          toast('تم تغيير كلمة المرور بنجاح');
        },
        dacc(i, b) {
          arm(b, () => {
            try {
              const users = getUsers().filter((x) => x.id !== currentUser.id);
              LS.setItem('mz_users', JSON.stringify(users));
              LS.removeItem((window as any).__K);
              LS.removeItem('mz_session');
              indexedDB.deleteDatabase((window as any).__DB);
            } catch (e) {}
            logout();
          });
        },
        dks(i) {
          SEL.clear();
          S.cdk = i || '';
          flip = false;
          DKE = false;
          save();
          rCards();
          const ckd = $('#ckd') as HTMLSelectElement | null;
          if (S.decks.some((d: any) => d.id === S.cdk) && ckd) ckd.value = S.cdk;
        },
        dka() {
          const dknEl = $('#dkn') as HTMLInputElement | null;
          const n = dknEl ? dknEl.value.trim() : '';
          if (!n) return toast('اكتب اسم المجموعة');
          if (S.decks.some((d: any) => d.n === n)) return toast('فيه مجموعة بنفس الاسم');
          const d = { id: uid(), n };
          S.decks.push(d);
          S.cdk = d.id;
          if (dknEl) dknEl.value = '';
          flip = false;
          save();
          rCards();
          const ckd = $('#ckd') as HTMLSelectElement | null;
          if (ckd) ckd.value = d.id;
          toast('اتعملت المجموعة: ' + n);
        },
        dkre() {
          DKE = !DKE;
          rCards();
        },
        dkrs() {
          const dkrn = $('#dkrn') as HTMLInputElement | null;
          const n = dkrn ? dkrn.value.trim() : '';
          const d = S.decks.find((x: any) => x.id === S.cdk);
          if (!d) return;
          if (!n) return toast('اكتب الاسم');
          d.n = n;
          DKE = false;
          save();
          rCards();
          toast('اتغير الاسم');
        },
        dkd(i, b) {
          arm(b, () => {
            S.cards.forEach((c: any) => {
              if (c.k === i) c.k = '';
            });
            S.decks = S.decks.filter((d: any) => d.id !== i);
            S.cdk = '';
            DKE = false;
            save();
            rCards();
            rToday();
            toast('اتحذفت المجموعة، كروتها رجعت بدون مجموعة');
          });
        },
        ppre(i) {
          const [q, a] = i.split(',');
          readPt();
          S.pt.q = +q;
          S.pt.a = +a;
          save();
          rCards();
        },
        dkp(i) {
          S.cdk = i;
          save();
          rCards();
          act.pgo();
        },
        pgo() {
          readPt();
          save();
          let l = cScope();
          if (!l.length) return toast('مفيش كروت هنا للعرض');
          if (S.pt.sh) l = sh(l);
          if (P) clearInterval(P.iv);
          P = {
            L: l,
            i: 0,
            ph: 0,
            l: S.pt.q,
            tb: S.pt.q,
            pa: 0,
            fin: 0,
            t: cTitle(),
            iv: setInterval(pTick, 100)
          };
          document.body.style.overflow = 'hidden';
          pz().classList.add('on');
          pRender();
        },
        pgx() {
          if (P) clearInterval(P.iv);
          P = null;
          const e = $('#pz');
          if (e) {
            e.classList.remove('on', 'pa');
            e.innerHTML = '';
          }
          document.body.style.overflow = '';
        },
        pgt() {
          if (!P) return;
          P.pa = !P.pa;
          pz().classList.toggle('pa', !!P.pa);
          const b = $('#pzt');
          if (b) b.textContent = P.pa ? '▶ استمرار' : '⏸ إيقاف';
        },
        pgn() {
          pNext(1);
        },
        pgp() {
          pNext(-1);
        },
        pgf() {
          if (!P || P.fin) return;
          if (P.ph === 0) {
            P.ph = 1;
            P.l = P.tb = S.pt.a;
          } else {
            P.ph = 0;
            P.l = P.tb = S.pt.q;
          }
          pSet();
        },
        pgr() {
          if (!P) return;
          if (S.pt.sh) P.L = sh(P.L);
          P.i = 0;
          P.fin = 0;
          P.ph = 0;
          P.l = P.tb = S.pt.q;
          pRender();
        },
        smt() {
          SM = !SM;
          SEL.clear();
          rCards();
        },
        csel(i) {
          SEL.has(i) ? SEL.delete(i) : SEL.add(i);
          rCards();
        },
        csg(i) {
          const A = S.cards.filter(inSub).filter((x: any) => (i === '_' ? !x.k : x.k === i));
          const all = A.length && A.every((x: any) => SEL.has(x.id));
          A.forEach((x: any) => (all ? SEL.delete(x.id) : SEL.add(x.id)));
          rCards();
        },
        csa() {
          const A = cScope();
          const all = A.length && A.every((x: any) => SEL.has(x.id));
          A.forEach((x: any) => (all ? SEL.delete(x.id) : SEL.add(x.id)));
          rCards();
        },
        csc() {
          SEL.clear();
          rCards();
        },
        cmv() {
          const ids = [...SEL].filter((id) => S.cards.some((c: any) => c.id === id));
          if (!ids.length) return toast('حدّد كروت أولاً');
          const skd = $('#skd') as HTMLSelectElement | null;
          const k = skd ? skd.value : '';
          MV = k;
          S.cards.forEach((c: any) => {
            if (SEL.has(c.id)) c.k = k;
          });
          SEL.clear();
          save();
          rCards();
          toast('اتنقل ' + ids.length + ' كارت إلى: ' + dkn(k));
        },
        cdel(i, b) {
          const ids = [...SEL].filter((id) => S.cards.some((c: any) => c.id === id));
          if (!ids.length) return toast('حدّد كروت أولاً');
          arm(b, () => {
            S.cards = S.cards.filter((c: any) => !SEL.has(c.id));
            SEL.clear();
            save();
            rCards();
            rToday();
            toast('اتحذف ' + ids.length + ' كارت');
          });
        },
        bki() {
          const bulk = $('#bulk') as HTMLTextAreaElement | null;
          const bkn = $('#bkn') as HTMLInputElement | null;
          const bkd = $('#bkd') as HTMLSelectElement | null;
          const rows = bulk ? bulk.value.split('\n').map((x) => x.trim()).filter(Boolean) : [];
          const nn = bkn ? bkn.value.trim() : '';
          let k = bkd ? bkd.value : '';
          const ps: [string, string][] = [];
          let bad = 0;

          rows.forEach((r) => {
            const m = r.match(/^(.*?)(?:\t|\|)(.*)$/);
            const q = m && m[1].trim();
            const a = m && m[2].trim();
            if (q && a) ps.push([q, a]);
            else bad++;
          });

          if (!ps.length) return toast('مفيش كروت صالحة. اكتب كل كارت في سطر: السؤال | الإجابة');

          if (nn) {
            let d = S.decks.find((x: any) => x.n === nn);
            if (!d) {
              d = { id: uid(), n: nn };
              S.decks.push(d);
            }
            k = d.id;
          }

          const ex = new Set(S.cards.filter((c: any) => (c.k || '') === k).map((c: any) => c.q + '\n' + c.a));
          let add = 0,
            dup = 0;
          ps.forEach(([q, a]) => {
            const key = q + '\n' + a;
            if (ex.has(key)) {
              dup++;
              return;
            }
            ex.add(key);
            S.cards.push({ id: uid() + (add++).toString(36), q, a, s: S.cur || 'عام', k, due: today(), iv: 0 });
          });

          if (bulk) bulk.value = '';
          if (bkn) bkn.value = '';
          S.cdk = k || '';
          SEL.clear();
          save();
          rCards();
          rToday();
          toast(
            'اتضاف ' +
              add +
              ' كارت' +
              (dup ? ' · ' + dup + ' مكرر اتجاهل' : '') +
              (bad ? ' · ' + bad + ' سطر بدون فاصل' : '')
          );
        },
        pls(i) {
          const x = S.les.find((y: any) => y.id === i);
          if (!x) return;
          x.st = Math.min(2, x.st + 1);
          save();
          rPlan();
          rX();
          if (x.st === 2) toast('✅ خلّصت: ' + x.t);
        },
        qs() {
          if (new Set(S.cards.map((x: any) => x.a)).size < 4) {
            return toast('محتاج 4 كروت بإجابات مختلفة على الأقل');
          }
          let L = S.cards.filter(inSub).filter(inDk);
          if (L.length < 4) L = S.cards;
          Q = { L: sh(L).slice(0, 10), i: 0, sc: 0 };
          qo();
          rQ();
        },
        qa(i) {
          if (!Q || Q.d) return;
          Q.d = 1;
          Q.p = +i;
          const c = Q.L[Q.i];
          if (Q.o[+i] === c.a) Q.sc++;
          else {
            c.hd = (c.hd || 0) + 1;
            c.due = today();
            c.iv = 0;
            save();
          }
          rQ();
        },
        qn() {
          Q.i++;
          if (Q.i < Q.L.length) qo();
          rQ();
          rToday();
        },
        qx() {
          Q = null;
          rQ();
        },
        addG() {
          const gdN = $('#gdN') as HTMLInputElement | null;
          const gdV = $('#gdV') as HTMLInputElement | null;
          const gdM = $('#gdM') as HTMLInputElement | null;
          const gdS = $('#gdS') as HTMLSelectElement | null;
          const n = gdN ? gdN.value.trim() : '';
          const v = gdV ? +gdV.value : NaN;
          const m = gdM ? +gdM.value || 100 : 100;
          if (!n || isNaN(v) || (gdV && gdV.value === '')) return toast('اكتب اسم الاختبار ودرجتك');
          S.gr = S.gr || [];
          S.gr.push({ id: uid(), s: gdS ? gdS.value : '', n, v, m, d: today() });
          if (gdN) gdN.value = '';
          if (gdV) gdV.value = '';
          save();
          rGr();
          rXP();
          toast('اتسجلت الدرجة');
        },
        gx(i) {
          S.gr = S.gr.filter((g: any) => g.id !== i);
          save();
          rGr();
          rXP();
        },
        async msv(i) {
          const mo = S.moods.find((x: any) => x.id === i);
          if (!mo || !mo.u) return;
          toast('جاري الحفظ…');
          try {
            const r = await fetch(mo.u);
            if (!r.ok) throw 0;
            const bl = await r.blob();
            if (!(await putD('mood_' + i, bl))) throw 1;
            delete mo.u;
            save();
            rMood();
            toast('اتحفظت على الجهاز وتشتغل بدون نت');
          } catch (e) {
            toast('الموقع ما سمحش بالحفظ من هنا، حمّل الملف وارفعه يدوياً');
            window.open(mo.u, '_blank');
          }
        },
        cst(i) {
          S.cst = i;
          save();
          rCards();
        },
        msr() {
          let n = 0;
          SU2.forEach(([r, k, t]: any) => {
            const u = RC[r][0] + String(k).padStart(3, '0') + '.mp3';
            if (S.moods.some((x: any) => x.u === u)) return;
            const id = uid();
            S.moods.push({ id, n: 'سورة ' + t + ' - ' + RC[r][1], u });
            if (!S.mcur) S.mcur = id;
            n++;
          });
          save();
          rMood();
          const ms = $('#ms');
          if (ms) ms.textContent = n ? '✓ تمت إضافة ' + n + ' سورة' : 'السور مضافة من قبل';
          if (n && au && !au.src) loadM(S.mcur, false);
        }
      };

      const pz = () => {
        let e = $('#pz');
        if (!e) {
          e = document.createElement('div');
          e.id = 'pz';
          e.className = 'pz';
          document.body.appendChild(e);
        }
        return e;
      };

      const pSet = () => {
        if (!P || P.fin) return;
        const f = $('#pzc');
        if (f) f.classList.toggle('on', P.ph === 1);
        const b = $('#pzb');
        if (b) b.style.width = '100%';
        pTxt();
      };

      const pTxt = () => {
        const p = $('#pzp');
        if (p && P) p.textContent = (P.ph ? 'الإجابة' : 'السؤال') + ' · ' + Math.max(1, Math.ceil(P.l)) + ' ث';
      };

      const pTick = () => {
        if (!P || P.pa || P.fin) return;
        P.l -= 0.1;
        if (P.l <= 0.05) {
          if (P.ph === 0) {
            P.ph = 1;
            P.l = P.tb = S.pt.a;
            pSet();
          } else pNext(1);
          return;
        }
        const b = $('#pzb');
        if (b) b.style.width = (P.l / P.tb) * 100 + '%';
        pTxt();
      };

      const pNext = (d: number) => {
        if (!P) return;
        P.i += d;
        if (P.i >= P.L.length) {
          if (S.pt.lp) {
            if (S.pt.sh) P.L = sh(P.L);
            P.i = 0;
          } else {
            P.fin = 1;
            pRender();
            return;
          }
        }
        if (P.i < 0) P.i = 0;
        P.ph = 0;
        P.l = P.tb = S.pt.q;
        pRender();
      };

      const pRender = () => {
        if (!P) return;
        const e = pz();
        if (P.fin) {
          e.innerHTML = `<div class="pzh"><div><b>${esc(P.t)}</b></div><button class="ic" data-a="pgx" aria-label="إغلاق">✕</button></div><div class="box" style="text-align:center"><div class="big">🎉</div><div class="big" style="font-size:22px">خلص العرض</div><div class="mute">عرضنا ${P.L.length} كارت</div><div class="add" style="justify-content:center;margin-top:14px"><button class="btn" data-a="pgr">إعادة العرض</button><button class="btn alt" data-a="pgx">إغلاق</button></div></div>`;
          return;
        }
        const c = P.L[P.i];
        e.innerHTML =
          `<div class="pzh"><div><b>📁 ${esc(P.t)}</b><div class="mute">${P.i + 1} / ${P.L.length}</div></div><button class="ic" data-a="pgx" aria-label="إغلاق">✕</button></div><div class="pzbar"><i id="pzb"></i></div>` +
          cardHTML(c, P.ph === 1, 'pzc', ' data-a="pgf"') +
          `<div class="pzph" id="pzp"></div><div class="pzc2"><button class="btn alt" data-a="pgp">السابق</button><button class="btn" data-a="pgt" id="pzt">${P.pa ? '▶ استمرار' : '⏸ إيقاف'}</button><button class="btn alt" data-a="pgn">التالي</button></div><div class="mute" style="text-align:center;font-size:12px">اضغط على الكارت لقلبه يدوياً</div>`;
        pTxt();
      };

      const rXP = () => {
        const b = $('#xpb');
        if (!b) return;
        const xp = Math.round(
          S.log.reduce((a: number, l: any) => a + l.m, 0) +
            10 * S.tasks.filter((t: any) => t.done).length +
            3 * S.cards.length +
            10 * (S.gr || []).length
        );
        const L = Math.floor(Math.sqrt(xp / 40)) + 1;
        const a = 40 * (L - 1) ** 2;
        const n = 40 * L * L;
        if (S.lv && L > S.lv) toast('🎉 وصلت المستوى ' + L);
        if (S.lv !== L) {
          S.lv = L;
          save();
        }
        b.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b class="big">المستوى ${L}</b><span class="tag">${xp} XP</span></div><div class="pb"><i style="width:${((xp - a) / (n - a)) * 100}%;background:var(--pk)"></i></div><div class="mute">باقي ${n - xp} نقطة للمستوى ${L + 1} · الدقيقة نقطة، المهمة 10، الكارت 3، الدرجة 10</div><div class="badges">${BGD.map(([i, t, f]: any) => `<span class="bd${f() ? ' on' : ''}">${i}<small>${t}</small></span>`).join('')}</div>`;
      };

      const rGr = () => {
        S.gr = S.gr || [];
        rTrend();
        rStq();
        const es = $('#es') as HTMLSelectElement | null;
        if (es) {
          const ev = es.value;
          es.innerHTML =
            '<option value="">كل المواد</option>' + S.subjects.map((x: string) => `<option>${esc(x)}</option>`).join('');
          es.value = ev;
        }

        const sel = $('#gdS') as HTMLSelectElement | null;
        if (sel) {
          const k = sel.value;
          sel.innerHTML = S.subjects.map((s: string) => `<option>${esc(s)}</option>`).join('');
          if (k) sel.value = k;
        }

        const by: Record<string, any[]> = {};
        S.gr.forEach((g: any) => (by[g.s] = by[g.s] || []).push(g));

        const gdA = $('#gdA');
        if (gdA) {
          gdA.innerHTML =
            Object.entries(by)
              .map(([s, L]) => {
                const p = L.reduce((a: number, g: any) => a + (g.v / g.m) * 100, 0) / L.length;
                return `<div style="display:flex;justify-content:space-between"><span>${esc(s)}</span><b>${Math.round(p)}%</b></div><div class="pb"><i style="width:${p}%;background:${col(s)}"></i></div>`;
              })
              .join('') || '<div class="mute">سجّل أول درجة لتشوف متوسطك لكل مادة.</div>';
        }

        const gdL = $('#gdL');
        if (gdL) {
          gdL.innerHTML =
            [...S.gr]
              .reverse()
              .map(
                (g: any) =>
                  `<div class="row"><span class="tx">${esc(g.n)} <span class="mute">${esc(g.s)}</span></span><span class="tag">${g.v}/${g.m}</span><button class="x" data-a="gx" data-i="${g.id}">×</button></div>`
              )
              .join('') || '<div class="mute">لا توجد درجات مسجلة بعد.</div>';
        }
      };

      const rPlan = () => {
        const b = $('#plb');
        if (!b) return;
        const td = today();
        const exs = S.exams
          .map((e: any) => ({
            e,
            n: Math.round((new Date(e.d + 'T00:00').getTime() - new Date(td + 'T00:00').getTime()) / 864e5)
          }))
          .filter((x: any) => x.n >= 1)
          .sort((a: any, c: any) => a.n - c.n);

        const it: any[] = [];
        const seen = new Set<string>();

        exs.forEach((x: any) =>
          (x.e.s ? [x.e.s] : S.subjects).forEach((sb: string) => {
            if (seen.has(sb) || (S.cur && sb !== S.cur)) return;
            const P = S.les.filter((l: any) => l.s === sb && l.st < 2).sort((a: any, c: any) => c.st - a.st);
            if (!P.length) return;
            seen.add(sb);
            it.push({ sb, x, P, per: Math.ceil(P.length / Math.max(1, x.n - 1)) });
          })
        );

        if (!it.length) {
          b.innerHTML =
            '<h3>خطة اليوم</h3><div class="mute">' +
            (exs.length
              ? 'خلّصت دروس موادك 🎉 راجع كروتك واختبر نفسك.'
              : 'أضف موعد امتحان من «المزيد» (واربطه بمادة) ودروسك من «المواد»، وأنا أوزّعها عليك يوم بيوم.') +
            '</div>';
          return;
        }

        b.innerHTML =
          '<h3>خطة اليوم</h3>' +
          it
            .map(
              (o) =>
                `<div style="margin:6px 0 2px"><b style="color:${col(o.sb)}">${esc(o.sb)}</b> <span class="mute">· ${esc(o.x.e.n)} بعد ${o.x.n} يوم · باقي ${o.P.length} درس · هدفك ${o.per} النهاردة</span></div>` +
                o.P.slice(0, o.per)
                  .map(
                    (l: any) =>
                      `<div class="row"><button class="chip" data-a="pls" data-i="${l.id}">${['لم يبدأ', 'اتذاكر'][l.st]}</button><span class="tx">${esc(l.t)}</span></div>`
                  )
                  .join('')
            )
            .join('');
      };

      const rHM = () => {
        const b = $('#hm');
        if (!b) return;
        const g = +S.goal || 120;
        let h = '',
          n = 0;
        for (let k = 34; k >= 0; k--) {
          const d = new Date();
          d.setDate(d.getDate() - k);
          const key = dk(d);
          const m = mins(key);
          if (m > 0) n++;
          h += `<i class="${m <= 0 ? '' : m < g / 3 ? 'l1' : m < g ? 'l2' : 'l3'}${k ? '' : ' t'}" title="${key}: ${Math.round(m)} د"></i>`;
        }
        b.innerHTML = `<h3>مذاكرتك آخر 5 أسابيع</h3><div class="mute">ذاكرت ${n} يوم من 35 · كل ما اللون أغمق، دقايق أكتر</div><div class="hm">${h}</div>`;
      };

      const rTrend = () => {
        const L = [...(S.gr || [])].sort((a: any, c: any) => (a.d < c.d ? -1 : 1));
        const c = $('#gdC');
        if (!c) return;
        if (L.length < 2) {
          c.innerHTML = '';
          return;
        }
        const pts = L.map((g: any, i: number) => [10 + i * (280 / (L.length - 1)), 70 - (g.v / g.m) * 60]);
        c.innerHTML = `<svg viewBox="0 0 300 80" style="width:100%;height:90px"><polyline fill="none" stroke="var(--acc)" stroke-width="3" points="${pts.map((q) => q.join(',')).join(' ')}"/>${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="${col(L[i].s)}" stroke="var(--edge)" stroke-width="2"/>`).join('')}</svg><div class="mute">تطور درجاتك بالنسبة المئوية</div>`;
      };

      const rStq = () => {
        try {
          if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then((e: any) => {
              const u = e.usage / 1048576;
              const q = e.quota / 1048576;
              const stq = $('#stq');
              if (stq) {
                stq.textContent =
                  'مستخدم ' +
                  u.toFixed(1) +
                  ' ميجا من ' +
                  Math.round(q) +
                  ' ميجا' +
                  (u / q > 0.8 ? ' ⚠ المساحة قاربت تخلص، احذف ملفات قديمة' : '');
              }
              if (u / q > 0.8) toast('⚠ مساحة التخزين قاربت تخلص');
            });
          }
        } catch (e) {
          const stq = $('#stq');
          if (stq) stq.textContent = 'غير متاح في هذا المتصفح';
        }
      };

      let Q: any = null;
      const sh = (a: any[]) => [...a].sort(() => Math.random() - 0.5);
      const qo = () => {
        const c = Q.L[Q.i];
        Q.o = sh([
          ...sh([...new Set(S.cards.map((x: any) => x.a).filter((a: any) => a !== c.a))]).slice(0, 3),
          c.a
        ]);
        Q.d = 0;
        Q.p = -1;
      };

      const rQ = () => {
        const b = $('#qz');
        if (!b) return;
        if (!Q) {
          b.style.display = 'none';
          return;
        }
        b.style.display = '';
        if (Q.i >= Q.L.length) {
          b.innerHTML = `<h3>النتيجة</h3><div class="big">${Q.sc} / ${Q.L.length}</div><div class="mute">${Q.sc === Q.L.length ? 'ممتاز 🔥' : 'الكروت اللي غلطت فيها رجعت لمراجعة النهاردة'}</div><div class="add" style="margin-top:10px"><button class="btn" data-a="qs">اختبار جديد</button><button class="btn alt" data-a="qx">إغلاق</button></div>`;
          return;
        }
        const c = Q.L[Q.i];
        b.innerHTML =
          `<div class="mute">سؤال ${Q.i + 1} من ${Q.L.length}</div><div class="big" style="font-size:20px;margin:8px 0">${esc(c.q)}</div>` +
          Q.o
            .map(
              (o: string, k: number) =>
                `<button class="btn alt" style="display:block;width:100%;margin-bottom:8px;text-align:start;${Q.d ? (o === c.a ? 'background:#18c9a0;color:#fff' : k === Q.p ? 'background:var(--bad);color:#fff' : '') : ''}" data-a="qa" data-i="${k}">${esc(o.slice(0, 120))}</button>`
            )
            .join('') +
          (Q.d ? `<button class="btn" data-a="qn">${Q.i + 1 === Q.L.length ? 'النتيجة' : 'التالي'}</button>` : '');
      };

      const pe = (e: any) =>
        toast(
          e && e.name === 'NotAllowedError'
            ? 'اضغط زر التشغيل في المشغل'
            : e && e.name === 'AbortError'
            ? ''
            : 'تعذّر التشغيل (' + ((e && e.name) || '؟') + ')، تأكد من الإنترنت'
        );

      const CSL = [
        ['a', 'كلاسيك'],
        ['b', 'دفتر مسطر'],
        ['c', 'ملوّن'],
        ['d', 'كارت فهرسة'],
        ['e', 'بارز']
      ];
      const NSL = [
        ['k', 'كورنيل'],
        ['l', 'دفتر مسطر'],
        ['g', 'مربعات'],
        ['s', 'ورقة لاصقة'],
        ['b', 'سبورة']
      ];
      const nsel = () =>
        `<select id='nsel'>${NSL.map(([k, v]) => `<option value='${k}'${(S.nst || 'k') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;

      const RC: Record<string, [string, string]> = {
        A: ['https://server8.mp3quran.net/afs/', 'مشاري العفاسي'],
        G: ['https://server7.mp3quran.net/s_gmd/', 'سعد الغامدي'],
        B: ['https://server7.mp3quran.net/basit/Almusshaf-Al-Mojawwad/', 'عبد الباسط عبد الصمد'],
        M: ['https://server12.mp3quran.net/maher/', 'ماهر المعيقلي'],
        H: ['https://server13.mp3quran.net/husr/', 'محمود الحصري'],
        N: ['https://server10.mp3quran.net/minsh/', 'محمد صديق المنشاوي']
      };

      const SU2 = [
        ['A', 18, 'الكهف'],
        ['A', 67, 'الملك'],
        ['A', 94, 'الشرح'],
        ['G', 55, 'الرحمن'],
        ['G', 56, 'الواقعة'],
        ['G', 12, 'يوسف'],
        ['B', 19, 'مريم'],
        ['B', 36, 'يس'],
        ['B', 93, 'الضحى'],
        ['M', 1, 'الفاتحة'],
        ['M', 78, 'النبأ'],
        ['M', 87, 'الأعلى'],
        ['H', 59, 'الحشر'],
        ['H', 88, 'الغاشية'],
        ['H', 112, 'الإخلاص'],
        ['H', 113, 'الفلق'],
        ['N', 114, 'الناس'],
        ['N', 32, 'السجدة'],
        ['N', 50, 'ق'],
        ['N', 75, 'القيامة']
      ];

      const BGD = [
        ['🔥', '3 أيام', () => streak() >= 3],
        ['⚡', 'أسبوع متتالي', () => streak() >= 7],
        ['🏆', '30 يوم', () => streak() >= 30],
        ['⏱️', '10 ساعات', () => S.log.reduce((a: number, l: any) => a + l.m, 0) >= 600],
        ['📚', '50 كارت', () => S.cards.length >= 50],
        ['✅', '20 مهمة', () => S.tasks.filter((t: any) => t.done).length >= 20],
        ['🎯', 'درجة 90%+', () => (S.gr || []).some((g: any) => g.v / g.m >= 0.9)]
      ];

      // Global Event Delegation
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const b = target.closest('[data-a]') as HTMLElement | null;
        if (b && act[b.dataset.a || '']) {
          act[b.dataset.a || ''](b.dataset.i, b);
        }
      });

      document.addEventListener('input', (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        if (target.id === 'sq') rS();
        if (target.id === 'nq') {
          NQ = (target as HTMLInputElement).value;
          clearTimeout(NDB);
          NDB = window.setTimeout(rNts, 180);
        }
        if (target.dataset && target.dataset.f) {
          const f = target.dataset.f;
          const p = cp().find((x: any) => x.id === PG);
          if (p) {
            p[f] = (target as HTMLInputElement | HTMLTextAreaElement).value;
            p.t = Date.now();
            S.last[S.room] = PG;
            save();
          }
        }
        if (target.id === 'fmsg') {
          S.fmsg = (target as HTMLTextAreaElement).value;
          save();
        }
      });

      document.addEventListener('change', async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        const id = target.id;

        if (id === 'sub') {
          S.cur = (target as HTMLSelectElement).value;
          save();
          flip = false;
          render();
        } else if (id === 'fl') {
          if (T.mode === 'focus' && !T.run) setMode('focus');
        } else if (id === 'goal') {
          S.goal = +(target as HTMLInputElement).value || 120;
          save();
          rToday();
        } else if (id === 'sch' || id === 'uni') {
          S[id === 'sch' ? 'school' : 'uni'] = (target as HTMLInputElement).value;
          save();
          rHead();
        } else if (id === 'hij') {
          S.hij = +(target as HTMLInputElement).value || 0;
          save();
          rHead();
        } else if (id === 'city') {
          S.city = (target as HTMLSelectElement).value;
          save();
          rPray();
        } else if (id === 'padj') {
          S.padj = +(target as HTMLInputElement).value || 0;
          save();
          rPray();
        } else if (id === 'nsel') {
          S.nst = (target as HTMLSelectElement).value;
          save();
          rRoom();
        } else if (id === 'bgOn') {
          S.bg = (target as HTMLInputElement).checked;
          save();
        } else if (id === 'bgm') {
          S.bgm = (target as HTMLSelectElement).value;
          save();
        } else if (id === 'mrp') {
          S.mrp = (target as HTMLSelectElement).value;
          save();
        } else if (id === 'skd') {
          MV = (target as HTMLSelectElement).value;
        } else if (['sb', 'lb', 'wg'].includes(id)) {
          S[id] = +(target as HTMLInputElement).value;
          save();
          rN();
        } else if (target.dataset && target.dataset.sc) {
          S.sc = S.sc || {};
          S.sc[target.dataset.sc] = (target as HTMLInputElement).value;
          save();
          render();
        } else if (id === 'bkf') {
          const files = (target as HTMLInputElement).files;
          if (files && files[0]) {
            files[0].text().then(rstBk);
          }
          (target as HTMLInputElement).value = '';
        } else if (id === 'rfi') {
          const files = [...((target as HTMLInputElement).files || [])];
          const fo = ($('#rfo') as HTMLSelectElement)?.value || 'أخرى';
          let n = 0;
          for (const f of files) {
            const i = 'file_' + uid();
            if (await putD(i, f)) {
              S.files.push({ id: i, name: f.name, size: f.size, s: S.room, f: fo });
              n++;
            }
          }
          save();
          rRoom();
          toast('تم حفظ ' + n + ' ملف');
        } else if (id === 'fi') {
          const files = [...((target as HTMLInputElement).files || [])];
          let n = 0;
          for (const f of files) {
            const i = 'file_' + uid();
            if (await putD(i, f)) {
              S.files.push({ id: i, name: f.name, size: f.size, s: '' });
              n++;
            }
          }
          save();
          rMore();
          toast(
            n === files.length
              ? 'تم حفظ ' + n + ' ملف'
              : 'تم حفظ ' + n + ' من ' + files.length + ' (المساحة قد تكون ممتلئة)'
          );
          (target as HTMLInputElement).value = '';
        } else if (id === 'mi') {
          const files = [...((target as HTMLInputElement).files || [])];
          if (files.length) {
            let n = 0;
            for (const f of files) {
              const id = uid();
              if (await putD('mood_' + id, f)) {
                S.moods.push({ id, n: f.name.replace(/\.[^.]+$/, '') });
                n++;
                if (!S.mcur) S.mcur = id;
              }
            }
            save();
            rMood();
            const ms = $('#ms');
            if (ms) ms.textContent = n ? '✓ تمت إضافة ' + n + ' ملف' : '⚠ لم يُحفظ (المساحة ممتلئة)';
            if (n && au && !au.src) await loadM(S.mcur, false);
          }
          (target as HTMLInputElement).value = '';
        }
      });

      // Dark / Light Theme Toggle
      const thBtn = $('#th');
      if (thBtn) {
        thBtn.onclick = () => {
          const d = matchMedia('(prefers-color-scheme:dark)').matches;
          const cur = S.theme || (d ? 'dark' : 'light');
          S.theme = cur === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = S.theme;
          save();
        };
      }
      if (S.theme) document.documentElement.dataset.theme = S.theme;

      // Audio Event Listeners
      if (au) {
        au.addEventListener('ended', nextM);
        au.addEventListener('play', rMood);
        au.addEventListener('pause', rMood);
        au.addEventListener('error', () => {
          if (/^https?:/.test(au.currentSrc || '')) {
            toast('تعذّر تحميل السورة. تأكد من الإنترنت أو جرّب سورة أخرى');
          }
        });
      }

      // Keyboard Shortcuts
      document.addEventListener('keydown', (e) => {
        if (!P) return;
        if (e.key === 'Escape') act.pgx();
        else if (e.key === ' ') {
          e.preventDefault();
          act.pgt();
        } else if (e.key === 'ArrowLeft') pNext(1);
        else if (e.key === 'ArrowRight') pNext(-1);
      });

      // Accordions in Settings
      $$('#more > .box').forEach((b, i) => {
        const h = b.querySelector('h3') as HTMLElement | null;
        if (!h) return;
        b.classList.add('acc');
        if (i === 1) b.classList.add('open');
        h.tabIndex = 0;
        h.setAttribute('role', 'button');
        h.onclick = () => b.classList.toggle('open');
        h.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            b.classList.toggle('open');
          }
        };
      });

      // Boot Engine
      const boot = async () => {
        await new Promise<void>((ok) => {
          try {
            const r = indexedDB.open((window as any).__DB, 1);
            r.onupgradeneeded = () => r.result.createObjectStore('f');
            r.onsuccess = () => {
              db = r.result;
              ok();
            };
            r.onerror = () => ok();
          } catch (e) {
            ok();
          }
        });

        try {
          if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist();
          }
        } catch (e) {}

        setMode('focus');

        if (S.run) {
          const r = S.run;
          T.mode = r.mode;
          T.total = r.total;
          T.sub = r.sub;
          T.logged = r.logged || 0;
          T.end = r.end;
          T.left = Math.max(0, Math.ceil((r.end - Date.now()) / 1000));
          if (T.left > 0) {
            T.run = true;
            iv = setInterval(tick, 500);
            lock();
          } else fin();
        }

        render();

        rMood();
        const m0 = S.moods.find((x: any) => x.id === S.mcur) || S.moods[0];
        const m = m0 ? m0.u || (await getD('mood_' + m0.id)) : null;
        if (m && au) {
          S.mcur = m0.id;
          au.src = url(m);
          const ms = $('#ms');
          if (ms) ms.textContent = '✓ الملف جاهز';
        }
      };

      boot();
      setInterval(rPray, 1000);
      setInterval(rHead, 60000);
    }
  }, []);

  return (
    <>
      {/* ===== Multi-User Authentication Overlay ===== */}
      <div id="auth">
        <div className="ac">
          <h1>مذاكرتي</h1>
          <p className="mute">لكل طالب مساحته الخاصة: مهامه وكروته وملاحظاته.</p>

          <div className="tabs">
            <button className="chip on" data-m="in">تسجيل الدخول</button>
            <button className="chip" data-m="up">حساب طالب جديد</button>
          </div>

          {/* User selector for multiple saved accounts on this device */}
          <div id="x_selected_user"></div>
          <div id="x_user_picker"></div>

          <label className="fu" hidden>
            اسم الطالب (مثال: أحمد، مريم)
            <input id="x_name" maxLength={30} autoComplete="name" placeholder="اكتب اسمك الأول" />
          </label>

          <label id="x_user_lbl">
            اسم المستخدم
            <input
              id="x_user"
              maxLength={24}
              autoComplete="username"
              autoCapitalize="off"
              dir="ltr"
              placeholder="مثال: ahmed123"
            />
          </label>

          <label>
            كلمة المرور
            <input
              id="x_pass"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              placeholder="••••••••"
            />
          </label>

          <label className="fu" hidden>
            تأكيد كلمة المرور
            <input
              id="x_pass2"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              placeholder="••••••••"
            />
          </label>

          <div className="fu" hidden style={{ marginBottom: 14 }}>
            <span className="mute" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
              اختر لون شارتك المميزة:
            </span>
            <div id="x_color_picker" className="color-picker"></div>
          </div>

          <div id="x_err" role="alert"></div>

          <button className="btn" id="x_go">
            دخول للمذاكرة
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button className="chip" id="x_fg" type="button" style={{ fontSize: 13 }}>
              نسيت كلمة المرور؟
            </button>
          </div>

          <p className="mute" id="x_note" style={{ margin: '14px 0 0', fontSize: 12 }}></p>
        </div>
      </div>

      {/* ===== Main Application Layout ===== */}
      <div className="wrap">
        <header>
          <div>
            <div id="dt"></div>
            <div className="mute" id="hj"></div>
          </div>
          <select id="sub" aria-label="اختر المادة"></select>
          <button className="ic" id="th" aria-label="الوضع الليلي والنهاري" title="تبديل الوضع">
            ◐
          </button>
          <button
            className="ic"
            data-a="lgo"
            aria-label="تسجيل الخروج أو تبديل الحساب"
            title="تسجيل الخروج / تبديل الحساب"
          >
            ⎋
          </button>
        </header>

        <div id="bkb" className="box" style={{ display: 'none' }}></div>

        {/* Section: Today (اليوم) */}
        <section id="today" className="on">
          <div className="box" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div className="ring" style={{ width: 116, height: 116, margin: 0 }}>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--line)" strokeWidth="8" />
                <circle
                  id="gr"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="var(--acc)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="339.3"
                  strokeDashoffset="339.3"
                />
              </svg>
              <div className="big" id="gt">
                0
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>هدف اليوم</div>
              <div className="mute" id="gs">
                من 120 دقيقة
              </div>
              <div className="mute" id="wk"></div>
            </div>
          </div>

          <div className="box" id="plb"></div>
          <div className="box" id="hm"></div>
          <div className="box" id="xpb"></div>

          <div className="g2">
            <div className="box">
              <div className="big">
                🔥 <span id="stk">0</span>
              </div>
              <div className="mute">يوم متتالي</div>
            </div>
            <div className="box">
              <div className="big" id="due">
                0
              </div>
              <div className="mute">كروت للمراجعة</div>
            </div>
          </div>

          <div className="box" style={{ marginTop: 14 }}>
            <h3>الامتحانات القادمة</h3>
            <div id="ex"></div>
          </div>

          <div className="box">
            <h3>مهام قريبة</h3>
            <div id="tt2"></div>
          </div>

          <div className="box" id="td2"></div>
          <div className="box" id="ins"></div>
          <div id="cal" style={{ display: 'none' }}></div>

          <div className="box">
            <h3>آخر 7 أيام (دقيقة)</h3>
            <div className="bars" id="bars"></div>
            <div id="bysub" style={{ marginTop: 14 }}></div>
          </div>
        </section>

        {/* Section: Subjects Shelf (المواد) */}
        <section id="subs">
          <div id="shelf"></div>
          <div id="room" style={{ display: 'none' }}></div>
        </section>

        {/* Section: Timer (المؤقت) */}
        <section id="timer">
          <div className="box">
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="chip on" data-a="mode" data-i="focus">
                تركيز
              </button>
              <button className="chip" data-a="mode" data-i="short">
                راحة قصيرة
              </button>
              <button className="chip" data-a="mode" data-i="long">
                راحة طويلة
              </button>
            </div>

            <div className="ring">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="var(--line)" strokeWidth="8" />
                <circle
                  id="rg"
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="var(--acc)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="565.5"
                  strokeDashoffset="0"
                />
              </svg>
              <div>
                <div className="big" id="cn" style={{ direction: 'ltr', fontSize: 46 }}>
                  25:00
                </div>
                <div className="mute" id="cs"></div>
              </div>
            </div>

            <div className="add" style={{ justifyContent: 'center' }}>
              <button className="btn" id="go" data-a="go">
                ابدأ
              </button>
              <button className="btn alt" data-a="rs">
                إعادة
              </button>
              <select id="fl" aria-label="مدة الجلسة">
                <option value="15">15 دقيقة</option>
                <option value="20">20 دقيقة</option>
                <option value="25">25 دقيقة</option>
                <option value="35">35 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="50">50 دقيقة</option>
                <option value="60">60 دقيقة</option>
                <option value="90">90 دقيقة</option>
              </select>
            </div>

            <div style={{ textAlign: 'center' }}>
              <label className="mute">
                <input type="checkbox" id="bgOn" defaultChecked /> شغّل صوت الخلفية مع التركيز
              </label>

              <div className="add" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button className="chip" data-a="bgt">
                  🎵 تشغيل/إيقاف المزاج
                </button>
                <select id="bgm" aria-label="وضع تشغيل المزاج">
                  <option value="focus">مع التركيز فقط</option>
                  <option value="all">مع الراحة أيضاً</option>
                </select>
                <button className="chip" data-a="zen">
                  ملء الشاشة
                </button>
              </div>

              <div className="add" style={{ marginTop: 8 }}>
                <input id="jr" placeholder="فكرة شتّتتك؟ اكتبها وكمّل" />
                <button className="btn alt" data-a="jar">
                  احفظ
                </button>
              </div>

              <div id="rate" className="add" style={{ justifyContent: 'center', marginTop: 8 }}></div>
              <button
                className="btn alt"
                id="zx"
                data-a="zen"
                style={{
                  display: 'none',
                  position: 'fixed',
                  inset: 'auto 0 0',
                  margin: '0 auto 16px',
                  width: 'max-content',
                  paddingBottom: 'calc(9px + env(safe-area-inset-bottom,0px))'
                }}
              >
                خروج من ملء الشاشة
              </button>
              <div className="mute" id="pm" style={{ marginTop: 8 }}></div>
            </div>
          </div>
        </section>

        {/* Section: Prayer Times (مواقيت الصلاة) */}
        <section id="pray">
          <div className="box" style={{ textAlign: 'center' }}>
            <div className="mute">🇪🇬 توقيت جمهورية مصر العربية</div>
            <div className="big" id="ck" style={{ direction: 'ltr', fontSize: 40 }}>
              --
            </div>
            <div id="cd2" style={{ fontWeight: 700 }}></div>
            <div className="mute" id="nx"></div>
          </div>

          <div className="box" id="pt"></div>

          <div className="box">
            <h3>ضبط المواقيت</h3>
            <div className="add">
              <span>المدينة</span>
              <select id="city" aria-label="اختر المدينة"></select>
            </div>
            <div className="add">
              <span>تعديل بالدقائق</span>
              <input id="padj" type="number" style={{ flex: '0 0 80px' }} defaultValue="0" />
              <button className="btn alt" data-a="ntf">
                تفعيل التنبيهات
              </button>
            </div>
            <div className="mute" style={{ marginTop: 8 }}>
              الحساب بطريقة الهيئة المصرية العامة للمساحة، والتنبيهات تعمل والصفحة مفتوحة. المؤقت يتوقف تلقائياً وقت الأذان.
            </div>
          </div>
        </section>

        {/* Section: Academic Schedule (الجدول والترم) */}
        <section id="plan">
          <div className="add">
            <button className="chip on" data-a="term" data-i="1">
              الترم الأول · أكتوبر → فبراير
            </button>
            <button className="chip" data-a="term" data-i="2">
              الترم الثاني · فبراير → يونيو
            </button>
          </div>
          <div className="box" id="tinfo"></div>
          <div className="box" id="dday"></div>
          <div id="tcal"></div>
          <div className="box">
            <h3>الجدول الأسبوعي الثابت</h3>
            <div className="add">
              <select id="tdw" aria-label="اختر اليوم"></select>
              <input id="ttm" type="time" defaultValue="08:00" />
              <input id="tti" placeholder="حصة أو درس أو محاضرة" />
              <button className="btn alt" data-a="tta">
                إضافة
              </button>
            </div>
            <div id="ttl"></div>
          </div>
        </section>

        {/* Section: Tasks (المهام) */}
        <section id="tasks">
          <div className="add">
            <input id="tt" placeholder="مهمة جديدة" />
            <input id="td" type="date" />
            <select id="tp" aria-label="الأولوية">
              <option value="0">عادي</option>
              <option value="1">عاجل</option>
            </select>
            <select id="tr" aria-label="التكرار">
              <option value="">بدون تكرار</option>
              <option value="d">يومي</option>
              <option value="w">أسبوعي</option>
            </select>
            <button className="btn" data-a="addT">
              إضافة
            </button>
          </div>
          <div className="add">
            <button className="chip" data-a="hd">
              إخفاء/إظهار المنتهية
            </button>
            <button className="chip" data-a="cl">
              مسح المنتهية
            </button>
          </div>
          <div className="box" id="tl"></div>
        </section>

        {/* Section: Flashcards (الكروت) */}
        <section id="cards">
          <div className="box" id="qz" style={{ display: 'none' }}></div>
          <div className="add">
            <button className="btn" data-a="qs">
              ⚡ اختبار سريع من كروتك
            </button>
          </div>
          <div className="add" id="csp"></div>
          <div className="box" id="dkb"></div>
          <div className="box" id="st"></div>
          <div className="box" id="tmb"></div>

          <div className="box">
            <h3 id="cfh">كارت جديد</h3>
            <div className="add">
              <input id="cq" placeholder="السؤال" />
              <input id="ca" placeholder="الإجابة" />
              <select id="ckd" style={{ flex: 1, minWidth: 140 }} aria-label="المجموعة"></select>
              <button className="btn" data-a="addC">
                حفظ
              </button>
            </div>
          </div>

          <details className="box imp">
            <summary>📥 إضافة كروت كتير مرة واحدة</summary>
            <div>
              <div className="mute" style={{ marginBottom: 8 }}>
                الصق كروتك، كل كارت في سطر: السؤال | الإجابة (أو افصل بينهم بمسافة Tab لو نسخت من إكسل). كلها هتتضاف لمجموعة واحدة.
              </div>
              <textarea
                id="bulk"
                className="bk"
                placeholder="عاصمة مصر؟ | القاهرة&#10;ناتج 7×8 | 56"
              ></textarea>
              <div className="add" style={{ marginTop: 8 }}>
                <select id="bkd" style={{ flex: 1, minWidth: 140 }} aria-label="المجموعة"></select>
                <input id="bkn" placeholder="أو اسم مجموعة جديدة" style={{ flex: 1, minWidth: 140 }} />
              </div>
              <button className="btn" style={{ width: '100%', marginTop: 8 }} data-a="bki">
                استيراد الكروت
              </button>
            </div>
          </details>

          <div id="cl"></div>
        </section>

        {/* Section: Mistakes Tracker (أخطائي) */}
        <section id="mist">
          <div className="pgh">
            <h2>🎯 أخطائي</h2>
            <div className="mute">كل كارت غلطت فيه، مرتب حسب المادة</div>
          </div>
          <details className="box" id="madd">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>➕ إضافة خطأ يدوي</summary>
            <div style={{ marginTop: 10 }}>
              <div className="add">
                <select id="msel" aria-label="اختر المادة"></select>
              </div>
              <textarea
                id="mq2"
                rows={2}
                style={{ width: '100%', marginBottom: 8 }}
                placeholder="إيه الخطأ أو السؤال اللي غلطت فيه؟"
              ></textarea>
              <textarea
                id="ma2"
                rows={2}
                style={{ width: '100%', marginBottom: 8 }}
                placeholder="الإجابة الصح"
              ></textarea>
              <button className="btn" style={{ width: '100%' }} data-a="madd">
                إضافة للأخطاء
              </button>
            </div>
          </details>
          <div id="mst"></div>
        </section>

        {/* Section: Cornell Notes Overview (ملاحظاتي) */}
        <section id="nts">
          <div className="pgh">
            <h2>📝 ملاحظاتي</h2>
            <div className="mute">كل ملاحظاتك في مكان واحد</div>
          </div>
          <div className="box">
            <div className="add">
              <select id="nsel" aria-label="اختر المادة"></select>
              <button className="btn" data-a="nnew">
                ➕ ملاحظة جديدة
              </button>
            </div>
            <input id="nq" placeholder="ابحث في الملاحظات" style={{ width: '100%' }} />
          </div>
          <div id="nfc" className="dkr"></div>
          <div id="ntl"></div>
        </section>

        {/* Section: More / Settings (المزيد) */}
        <section id="more">
          {/* Active Account Card */}
          <div className="box">
            <h3>👤 حساب الطالب الحالي</h3>
            <div id="acc_info"></div>
            <div className="add" style={{ marginTop: 10 }}>
              <input id="pw1" type="password" placeholder="كلمة المرور الحالية" dir="ltr" />
              <input id="pw2" type="password" placeholder="كلمة المرور الجديدة (6+ أحرف)" dir="ltr" />
              <button className="btn alt" data-a="cpw">
                تغيير كلمة المرور
              </button>
            </div>
            <div className="add" style={{ marginTop: 12 }}>
              <button className="btn bad" data-a="dacc">
                حذف حسابي وكل بياناتي فقط
              </button>
            </div>
          </div>

          <div className="box">
            <h3>أقسام سريعة</h3>
            <div className="add">
              <button className="btn alt" data-a="nav" data-i="pray">
                🕌 مواقيت الصلاة
              </button>
              <button className="btn alt" data-a="nav" data-i="plan">
                🗓️ الجدول والترم
              </button>
            </div>
          </div>

          <div className="box">
            <h3>درجاتي واختباراتي</h3>
            <div className="add">
              <select id="gdS" aria-label="المادة"></select>
              <input id="gdN" placeholder="اسم الاختبار" />
              <input id="gdV" type="number" min="0" placeholder="درجتك" style={{ flex: '0 0 80px' }} />
              <input id="gdM" type="number" min="1" defaultValue="100" placeholder="الدرجة الكلية" style={{ flex: '0 0 70px' }} />
              <button className="btn" data-a="addG">
                إضافة
              </button>
            </div>
            <div id="gdC"></div>
            <div id="gdA"></div>
            <div id="gdL"></div>
          </div>

          <div className="box">
            <h3>المواد الدراسية</h3>
            <div className="add">
              <input id="ns" placeholder="مادة جديدة" maxLength={30} />
              <button className="btn alt" data-a="addS">
                إضافة
              </button>
            </div>
            <div id="sl"></div>
          </div>

          <div className="box">
            <h3>الامتحانات</h3>
            <div className="add">
              <input id="en" placeholder="اسم الامتحان" />
              <input id="ed" type="date" />
              <select id="es" aria-label="المادة"></select>
              <button className="btn alt" data-a="addE">
                إضافة
              </button>
            </div>
            <div id="exl"></div>
          </div>

          <div className="box">
            <h3>ملفات عامة</h3>
            <label className="btn alt" htmlFor="fi">
              رفع ملفات
            </label>
            <input id="fi" type="file" multiple />
            <div id="fl2" style={{ marginTop: 8 }}></div>
          </div>

          <div className="box">
            <h3>مسجل الشروح الصوتية</h3>
            <div className="add">
              <input id="rn" placeholder="عنوان التسجيل" />
              <button className="btn" id="rb" data-a="rec">
                🔴 تسجيل
              </button>
            </div>
            <div id="rl"></div>
          </div>

          <div className="box">
            <h3>صوت الخلفية (القرآن والمزاج)</h3>
            <label className="btn alt" htmlFor="mi">
              إضافة ملفات صوتية
            </label>
            <input id="mi" type="file" accept="audio/*" multiple />
            <div className="add" style={{ marginTop: 8 }}>
              <button className="chip" data-a="msr">
                ➕ إضافة 20 سورة بأصوات كبار القراء
              </button>
            </div>
            <div className="mute" id="ms"></div>
            <div id="ml" style={{ marginTop: 8 }}></div>
            <audio id="au" controls style={{ width: '100%', marginTop: 8 }}></audio>
            <div className="add" style={{ marginTop: 8 }}>
              <select id="mrp" aria-label="وضع التكرار">
                <option value="all">تكرار القائمة</option>
                <option value="one">تكرار السورة</option>
                <option value="shuf">عشوائي</option>
              </select>
              <button className="chip" data-a="mnx">
                التالي ⏭
              </button>
            </div>
          </div>

          <div className="box">
            <h3>بحث شامل</h3>
            <input
              id="sq"
              placeholder="ابحث في المهام والكروت والملاحظات والدروس..."
              style={{ width: '100%' }}
            />
            <div id="sr"></div>
          </div>

          <div className="box">
            <h3>تقدم المنهج والدروس</h3>
            <div id="lp" className="mute"></div>
            <div className="add" style={{ marginTop: 6 }}>
              <input id="ln" placeholder="درس أو وحدة جديدة" />
              <button className="btn alt" data-a="addLs">
                إضافة
              </button>
            </div>
            <div id="ll"></div>
          </div>

          <div className="box">
            <h3>تسجيل جلسة مذاكرة يدوية</h3>
            <div className="add">
              <input id="lm" type="number" min="1" placeholder="عدد الدقائق" />
              <button className="btn alt" data-a="addL">
                تسجيل
              </button>
            </div>
          </div>

          <div className="box">
            <h3>الإعدادات الأكاديمية</h3>
            <div className="add">
              <span>الهدف اليومي (دقيقة)</span>
              <input id="goal" type="number" min="10" style={{ flex: '0 0 90px' }} defaultValue="120" />
            </div>
            <div className="add">
              <span>بداية الدراسة: مدارس</span>
              <input id="sch" type="date" defaultValue="2026-09-12" />
              <span>جامعات</span>
              <input id="uni" type="date" defaultValue="2026-09-19" />
            </div>
            <div className="add">
              <span>تعديل الهجري (أيام)</span>
              <input id="hij" type="number" style={{ flex: '0 0 80px' }} defaultValue="0" />
            </div>
          </div>

          <div className="box">
            <h3>العادات اليومية</h3>
            <div className="add">
              <input id="hn" placeholder="عادة جديدة (مثلاً: قراءة 30 دقيقة)" />
              <button className="btn alt" data-a="hadd">
                إضافة
              </button>
            </div>
            <div id="hl"></div>
          </div>

          <div className="box">
            <h3>تفضيلات المؤقت والتقارير</h3>
            <div className="add">
              <span>راحة قصيرة (د)</span>
              <input id="sb" type="number" style={{ flex: '0 0 70px' }} defaultValue="5" />
              <span>طويلة (د)</span>
              <input id="lb" type="number" style={{ flex: '0 0 70px' }} defaultValue="15" />
              <span>هدف أسبوعي (ساعات)</span>
              <input id="wg" type="number" style={{ flex: '0 0 70px' }} />
            </div>
            <button className="btn alt" data-a="rep" style={{ marginTop: 8 }}>
              نسخ التقرير الأسبوعي
            </button>
          </div>

          <div className="box">
            <h3>صندوق الأفكار المشتتة</h3>
            <div id="jl"></div>
          </div>

          <div className="box">
            <h3>سجل الجلسات</h3>
            <div id="lgl"></div>
          </div>

          <div className="box">
            <h3>رسالة تحفيزية لنفسك</h3>
            <textarea
              id="fmsg"
              rows={3}
              style={{ width: '100%' }}
              placeholder="تظهر لك قبل الامتحان بأسبوع أو لما يتقطع الـ Streak"
            ></textarea>
          </div>

          <div className="box">
            <h3>مساحة التخزين المستهلكة</h3>
            <div className="mute" id="stq">
              ...
            </div>
          </div>

          <div className="box">
            <h3>النسخة الاحتياطية لحسابك</h3>
            <div className="mute">
              النسخة خاصة بحسابك الحالي فقط، ولا تؤثر على حسابات الطلاب الآخرين على هذا الجهاز.
            </div>
            <textarea
              id="bk"
              rows={3}
              style={{ width: '100%', margin: '8px 0' }}
              placeholder="الصق هنا كود نسخة للاستعادة"
            ></textarea>
            <div className="add">
              <button className="btn alt" data-a="dl">
                ⬇️ تحميل ملف نسخة
              </button>
              <label className="btn alt" htmlFor="bkf">
                📂 استعادة من ملف
              </label>
              <input id="bkf" type="file" accept=".json,application/json" hidden />
              <button className="btn alt" data-a="exp">
                نسخ البيانات
              </button>
              <button className="btn alt" data-a="imp">
                استعادة
              </button>
              <button className="btn bad" data-a="reset" style={{ marginInlineStart: 'auto' }}>
                مسح بيانات حسابي فقط
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ===== Bottom Navigation Bar ===== */}
      <nav id="nav">
        <button data-a="nav" data-i="today" className="on">
          <b>🏡</b>اليوم
        </button>
        <button data-a="nav" data-i="subs">
          <b>📚</b>المواد
        </button>
        <button data-a="nav" data-i="timer">
          <b>⏳</b>المؤقت
        </button>
        <button data-a="nav" data-i="mist">
          <b>🎯</b>أخطائي
        </button>
        <button data-a="nav" data-i="tasks">
          <b>✅</b>المهام
        </button>
        <button data-a="nav" data-i="nts">
          <b>📝</b>ملاحظاتي
        </button>
        <button data-a="nav" data-i="cards">
          <b>🗂️</b>الكروت
        </button>
        <button data-a="nav" data-i="more">
          <b>⚙️</b>المزيد
        </button>
      </nav>

      {/* Toast Notification */}
      <div id="toast"></div>
    </>
  );
}
