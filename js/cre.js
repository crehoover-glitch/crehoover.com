/* Cahaba River Estates shared site code.
   One small data layer used by every page. It talks to Supabase when
   js/config.js has keys, otherwise it runs in preview mode using this
   browser's storage and some sample data. */
(function () {
  const cfg = window.CRE_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  const sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const now = () => new Date().toISOString();
  const fmtDate = (iso, opts) => iso ? new Date(iso).toLocaleDateString("en-US", opts || { weekday: "long", month: "long", day: "numeric" }) : "";
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

  /* ---------- preview store ---------- */
  const KEY = "cre-preview-v1";
  const ME = "preview-user";
  function seed() {
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(17, 30, 0, 0); return x.toISOString(); };
    const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    let id = 1; const t = now();
    return {
      profiles: [
        { id: ME, name: "You (preview)", street: "Cahaba River Estates", approved: true, is_admin: true, created_at: t },
        { id: "p2", name: "Sample Neighbor", street: "", approved: true, is_admin: false, created_at: t },
        { id: "p3", name: "New Household (sample)", street: "", approved: false, is_admin: false, created_at: t }
      ],
      events: [
        { id: id++, title: "Halloween on the street", starts_at: "2026-10-31T17:30:00-05:00", location: "Neighborhood streets", details: "Trick-or-treat details to be announced.", cap: null, created_by: ME, created_at: t },
        { id: id++, title: "Backyard grill-out (sample)", starts_at: d(9), location: "A neighbor's backyard", details: "Bring a side or a drink. Burgers and dogs provided.", cap: 12, created_by: "p2", created_at: t }
      ],
      rsvps: [{ id: id++, event_id: 2, user_id: "p2", party: 2, created_at: t }],
      help_posts: [
        { id: id++, kind: "need", title: "Ride to a doctor appointment (sample)", details: "Next Tuesday morning, about two hours round trip.", status: "open", created_by: "p2", created_at: t },
        { id: id++, kind: "offer", title: "Small engine repair (sample)", details: "Mowers, leaf blowers, chainsaws. Happy to take a look.", status: "open", created_by: "p2", created_at: t }
      ],
      help_replies: [],
      recs: [
        { id: id++, category: "Plumbers", name: "Sample Plumbing Co.", phone: "", website: "", note: "Example entry. Replace with real neighbor picks.", created_by: "p2", created_at: t }
      ],
      rec_votes: [{ rec_id: 6, user_id: "p2", value: 1 }],
      care_pages: [
        { id: id++, title: "Meals for a neighbor after surgery (sample)", for_whom: "A neighbor", details: "Dinner drop-off around 5:30. No nuts, please.", created_by: "p2", created_at: t }
      ],
      care_slots: [
        { id: id++, page_id: 7, day: day(2), need: "Dinner", claimed_by: null },
        { id: id++, page_id: 7, day: day(3), need: "Dinner", claimed_by: "p2" },
        { id: id++, page_id: 7, day: day(4), need: "Dinner", claimed_by: null },
        { id: id++, page_id: 7, day: day(4), need: "Ride to follow-up visit", claimed_by: null }
      ],
      news: [
        { id: id++, title: "New neighborhood website", body: "Cahaba River Estates now has a home online. Sign in to RSVP, ask for a hand, or share a good contractor.", created_by: ME, created_at: "2026-10-21T12:00:00-05:00" }
      ],
      wiki_pages: [
        { id: id++, slug: "the-old-lodge", title: "The Old Lodge", body: "The house at 1122 Cahaba River Estates was built in 1928 on about 8 acres along the river. It began as a summer home and hunting retreat, and longtime neighbors remember it as a lodge where people hunted, gathered, and, by most accounts, gambled.\n\nWhat do you know? Add names, dates, and stories here.", updated_by: ME, updated_at: t }
      ],
      wiki_revisions: [],
      _id: 100
    };
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } }
  let mem = load();

  const OWNER = { rsvps: "user_id", help_replies: "user_id", rec_votes: "user_id" };

  const preview = {
    async list(table) { return JSON.parse(JSON.stringify(mem[table] || [])); },
    async add(table, row) {
      const r = Object.assign({ id: ++mem._id, created_at: now() }, row);
      const col = OWNER[table] || (table === "wiki_pages" ? "updated_by" : "created_by");
      if (!(col in r) && !["care_slots", "wiki_revisions"].includes(table)) r[col] = ME;
      (mem[table] = mem[table] || []).push(r); save(mem); return r;
    },
    async edit(table, match, patch) {
      (mem[table] || []).forEach(r => { if (Object.keys(match).every(k => r[k] == match[k])) {
        if (table === "wiki_pages") mem.wiki_revisions.push({ id: ++mem._id, page_id: r.id, title: r.title, body: r.body, edited_by: r.updated_by, created_at: r.updated_at });
        Object.assign(r, patch);
      } });
      save(mem);
    },
    async remove(table, match) { mem[table] = (mem[table] || []).filter(r => !Object.keys(match).every(k => r[k] == match[k])); save(mem); },
    async me() { return mem.profiles.find(p => p.id === ME); },
    async session() { return { user: { id: ME, email: "you@example.com" } }; },
    async signIn() { return { ok: true }; },
    async signOut() { localStorage.removeItem(KEY); mem = seed(); location.reload(); }
  };

  const live = {
    async list(table, order) {
      let q = sb.from(table).select("*");
      if (order) q = q.order(order, { ascending: true });
      const { data, error } = await q; if (error) throw error; return data || [];
    },
    async add(table, row) { const { data, error } = await sb.from(table).insert(row).select().single(); if (error) throw error; return data; },
    async edit(table, match, patch) { let q = sb.from(table).update(patch); for (const k in match) q = q.eq(k, match[k]); const { error } = await q; if (error) throw error; },
    async remove(table, match) { let q = sb.from(table).delete(); for (const k in match) q = q.eq(k, match[k]); const { error } = await q; if (error) throw error; },
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async me() {
      const s = await live.session(); if (!s) return null;
      const { data } = await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
      return data || { id: s.user.id, email: s.user.email, _new: true };
    },
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
      if (error) throw error; return { ok: true };
    },
    async signOut() { await sb.auth.signOut(); location.reload(); }
  };

  const api = LIVE ? live : preview;

  /* ---------- people ---------- */
  let people = null;
  async function names() {
    if (!people) { people = {}; (await api.list("profiles")).forEach(p => people[p.id] = p.name); }
    return people;
  }

  /* ---------- sign-in gate ---------- */
  // Renders into el. Calls onReady(me) once the visitor is an approved neighbor.
  async function gate(el, onReady, what) {
    what = what || "take part";
    if (!el) return;
    const me = await api.me().catch(() => null);
    if (me && me.approved) { el.innerHTML = `<div class="who">Signed in as <b>${esc(me.name)}</b> <button class="link" id="cre-out">Sign out</button></div>`; $("#cre-out", el).onclick = () => api.signOut(); onReady && onReady(me); return me; }
    if (me && me._new) {
      el.innerHTML = `<form class="box" id="cre-prof"><h3>Welcome, neighbor</h3><p>Tell us who you are. A board member will approve you, usually within a day.</p>
        <label>Your name or household name<input name="name" required placeholder="The Smith family"></label>
        <label>Your street (helps us confirm you live here)<input name="street" required placeholder="Cahaba River Estates Dr"></label>
        <button class="btn big" type="submit">Send for approval</button></form>`;
      $("#cre-prof", el).onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target);
        try { await sb.from("profiles").insert({ id: me.id, name: f.get("name"), street: f.get("street") }); gate(el, onReady, what); }
        catch (err) { alert("Something went wrong. Please try again."); } };
      return null;
    }
    if (me && !me.approved) { el.innerHTML = `<div class="box"><h3>Almost there</h3><p>Thanks, ${esc(me.name)}. A board member needs to approve your household. You will be able to ${esc(what)} as soon as that happens.</p></div>`; return null; }
    el.innerHTML = `<form class="box" id="cre-in"><h3>Sign in to ${esc(what)}</h3>
      <p>No password needed. Enter your email and we'll send you a link. Tap it and you're in.</p>
      <label>Your email<input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
      <button class="btn big" type="submit">Email me a sign-in link</button></form>`;
    $("#cre-in", el).onsubmit = async e => { e.preventDefault(); const email = new FormData(e.target).get("email");
      try { await api.signIn(email); el.innerHTML = `<div class="box"><h3>Check your email</h3><p>We sent a sign-in link to <b>${esc(email)}</b>. Tap it on this device to finish.</p></div>`; }
      catch (err) { alert("We couldn't send the email. Please check the address and try again."); } };
    return null;
  }

  /* ---------- preview banner ---------- */
  function banner() {
    if (LIVE) return;
    const b = document.createElement("div"); b.className = "preview-bar";
    b.innerHTML = `<b>Preview mode.</b> Sign-ups here are saved only on this device until the neighborhood database is connected. <button class="link" id="cre-reset">Reset sample data</button>`;
    document.body.append(b);document.body.style.paddingBottom="64px"; $("#cre-reset").onclick = () => api.signOut();
  }

  /* ---------- calendar links ---------- */
  function gcal(ev) {
    const s = new Date(ev.starts_at), e = new Date(s.getTime() + 2 * 3600e3);
    const f = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.title) + "&dates=" + f(s) + "/" + f(e) + "&details=" + encodeURIComponent((ev.details || "") + "\n\nRSVP at crehoover.com") + "&location=" + encodeURIComponent(ev.location || "");
  }
  function ics(ev) {
    const s = new Date(ev.starts_at), e = new Date(s.getTime() + 2 * 3600e3);
    const f = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//crehoover.com//EN", "BEGIN:VEVENT", "UID:cre-" + ev.id + "@crehoover.com", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(s), "DTEND:" + f(e), "SUMMARY:" + ev.title, "LOCATION:" + (ev.location || ""), "DESCRIPTION:" + (ev.details || "").replace(/\n/g, "\\n"), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(txt);
  }

  /* ---------- ranking ---------- */
  // Lower bound of the Wilson score interval: ranks by how sure we are a pick is good.
  function wilson(up, down) {
    const n = up + down; if (!n) return 0;
    const z = 1.96, p = up / n;
    return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n);
  }

  window.CRE = { LIVE, api, gate, names, esc, $, fmtDate, fmtTime, gcal, ics, wilson, banner, sb };
  document.addEventListener("DOMContentLoaded", banner);
})();
