/**
 * checkinStore
 *
 * The seam between the check-in page and wherever a client's check-ins live.
 * Right now that is localStorage on their own device: nothing leaves the phone,
 * there is no account and no server. When the portal arrives, replace this one
 * file with one that talks to it. Keep the shape below and nothing else in the
 * page changes, and the component still never learns what storage is.
 *
 *   available()          -> boolean
 *   load()               -> { status, topic, topicAsked, entries, detail }
 *   saveTopic(topic)     -> { ok, error }        topic may be null for a skip
 *   append(draft)        -> { ok, entry, error }  adds id, createdAt, weekOf
 *   forget()             -> { ok, error }
 *
 * status is one of:
 *   'ok'          read and written normally
 *   'empty'       nothing stored yet, this is a first visit on this device
 *   'unavailable' the browser will not let us store anything, see detail
 *   'recovered'   what was stored could not be read, see detail
 *
 * append is the piece that plays the parent in the component's contract. It
 * takes { score, bodyArea, microWin, anchor } and adds id, createdAt and weekOf.
 * A clientId would be added here too, on the day there is one. The component is
 * never handed any of it.
 *
 * Everything is synchronous today, but append and saveTopic return result
 * objects rather than throwing, so a version of this file that goes over a
 * network can return promises of the same shape without the page caring.
 */

(function (global) {
  'use strict';

  var KEY = 'bluzen.checkin.v1';
  var SALVAGE_KEY = 'bluzen.checkin.v1.unreadable';
  var VERSION = 1;

  /* Probe rather than feature-detect. Safari in private browsing has a
     localStorage object that throws the moment you write to it, and some
     browsers expose it but keep the quota at zero. */
  function probe() {
    try {
      var k = '__bz' + Date.now();
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  function reason(e) {
    if (!e) return 'Storage is not available in this browser.';
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return 'There is no room left to store anything on this device.';
    }
    if (e.name === 'SecurityError') {
      return 'This browser is blocking storage for this site.';
    }
    return 'This browser is not letting the page store anything.';
  }

  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // getDay: Sunday is 0
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function uuid() {
    try {
      if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    } catch (e) {
      /* some older browsers expose crypto only over https, fall through */
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function blank() {
    return { v: VERSION, topic: null, topicAsked: false, entries: [] };
  }

  /* Anything that comes back off the device is treated as untrusted. It may
     have been written by an older version, hand-edited, or half-written when a
     tab was killed. Coerce it into shape rather than trusting it. */
  function clean(raw) {
    var data = blank();
    if (!raw || typeof raw !== 'object') return data;
    if (typeof raw.topic === 'string' && raw.topic.trim()) data.topic = raw.topic;
    data.topicAsked = raw.topicAsked === true || data.topic !== null;
    if (!Array.isArray(raw.entries)) return data;
    data.entries = raw.entries
      .filter(function (e) {
        return e && typeof e.score === 'number' && e.score >= 1 && e.score <= 10;
      })
      .map(function (e) {
        return {
          id: typeof e.id === 'string' ? e.id : uuid(),
          createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
          weekOf: typeof e.weekOf === 'string' ? e.weekOf : mondayOf(new Date()),
          score: e.score,
          bodyArea: typeof e.bodyArea === 'string' ? e.bodyArea : null,
          microWin: typeof e.microWin === 'string' ? e.microWin : '',
          anchor: typeof e.anchor === 'string' ? e.anchor : '',
        };
      })
      .sort(function (a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt); // component wants newest last
      });
    return data;
  }

  /* Held in memory so the page still works for the length of a visit when the
     browser will not store anything. Nothing is kept when the tab closes, and
     the page says so plainly rather than pretending the save worked. */
  var memory = blank();
  var usingMemory = false;

  function write(data) {
    if (usingMemory) {
      memory = data;
      return { ok: true };
    }
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      /* Out of room mid-session. Do not fall back to memory silently: the
         client is owed the truth that this one did not save. */
      return { ok: false, error: reason(e) };
    }
  }

  function read() {
    if (usingMemory) return { status: memory.entries.length || memory.topicAsked ? 'ok' : 'empty', data: memory };
    var raw;
    try {
      raw = global.localStorage.getItem(KEY);
    } catch (e) {
      return { status: 'unavailable', data: blank(), detail: reason(e) };
    }
    if (raw === null) return { status: 'empty', data: blank() };
    try {
      return { status: 'ok', data: clean(JSON.parse(raw)) };
    } catch (e) {
      /* Unreadable. Put it aside under another key rather than overwriting it:
         it is the client's own words, and a person who knows what they are
         doing may still get it back. */
      try {
        if (global.localStorage.getItem(SALVAGE_KEY) === null) {
          global.localStorage.setItem(SALVAGE_KEY, raw);
        }
      } catch (ignored) {
        /* no room to set it aside, nothing more to be done */
      }
      return {
        status: 'recovered',
        data: blank(),
        detail: 'What was stored here could not be read, so this is starting fresh.',
      };
    }
  }

  var store = {
    available: function () {
      return !usingMemory;
    },

    load: function () {
      var p = probe();
      if (!p.ok) {
        usingMemory = true;
        return {
          status: 'unavailable',
          topic: memory.topic,
          topicAsked: memory.topicAsked,
          entries: memory.entries.slice(),
          detail: reason(p.error),
        };
      }
      var r = read();
      return {
        status: r.status,
        topic: r.data.topic,
        topicAsked: r.data.topicAsked,
        entries: r.data.entries.slice(),
        detail: r.detail || null,
      };
    },

    saveTopic: function (topic) {
      var r = read();
      var data = r.data;
      data.topic = typeof topic === 'string' && topic.trim() ? topic.trim() : null;
      data.topicAsked = true;
      var w = write(data);
      return w.ok ? { ok: true } : { ok: false, error: w.error };
    },

    /* The component hands over exactly { score, bodyArea, microWin, anchor }.
       Everything else on a stored entry is added here. */
    append: function (draft) {
      var now = new Date();
      var entry = {
        id: uuid(),
        createdAt: now.toISOString(),
        weekOf: mondayOf(now),
        score: draft.score,
        bodyArea: draft.bodyArea === undefined ? null : draft.bodyArea,
        microWin: draft.microWin || '',
        anchor: draft.anchor || '',
      };
      var r = read();
      var data = r.data;
      data.entries = data.entries.concat([entry]);
      var w = write(data);
      return w.ok ? { ok: true, entry: entry } : { ok: false, error: w.error };
    },

    forget: function () {
      memory = blank();
      if (usingMemory) return { ok: true };
      try {
        global.localStorage.removeItem(KEY);
        global.localStorage.removeItem(SALVAGE_KEY);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: reason(e) };
      }
    },
  };

  global.checkinStore = store;
})(typeof window !== 'undefined' ? window : this);
