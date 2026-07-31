/**
 * The host for checkin.html.
 *
 * Everything the component deliberately does not do lives here: asking for the
 * scale topic, holding the history, and deciding what to say when the browser
 * will not store anything. It talks to checkinStore and never to localStorage
 * directly, so swapping the store for a portal-backed one leaves this file and
 * the component alone.
 *
 * Written in React.createElement rather than JSX on purpose. The page loads
 * this file as it is, so there is nothing to compile and nothing to keep in
 * step with a build.
 */

(function (global) {
  'use strict';

  var React = global.React;
  var ReactDOM = global.ReactDOM;
  var MidweekCheckIn = global.MidweekCheckIn;
  var store = global.checkinStore;

  var mount = document.getElementById('bz-checkin-root');

  if (!React || !ReactDOM || !MidweekCheckIn || !store) {
    /* One of the four scripts did not arrive. Say so plainly, and still give the
       numbers, because that is the part of this page that has to work even when
       the rest of it does not. */
    mount.innerHTML =
      '<div class="bz-fallback">' +
      '<h2>This page did not load properly</h2>' +
      '<p>Closing it and opening it again usually sorts it. If it keeps happening, tell Darragh ' +
      'and do the check-in the next time you are in.</p>' +
      '<p>If you need someone today, please ring rather than write it here. Emergency 999 or 112. ' +
      'Samaritans 116 123, free, 24 hours, the same number North and South. Northern Ireland: ' +
      'Lifeline 0808 808 8000, 24 hours. Republic of Ireland: Pieta 1800 247 247, or text HELP to ' +
      '51444, both 24 hours. Aware 1800 80 48 48, 10am to 10pm, 7 days. Text HELLO to 50808, ' +
      '24 hours. On An Post and 48 the shortcode can fail, so text 086 1800 280 instead.</p>' +
      '</div>';
    return;
  }

  var h = React.createElement;

  /* ── What this page says about where the data lives ───────────
     A client should never find out how this works by losing something. The
     short line sits inside the card on a first visit, at the moment they are
     about to type their own words in. The long one sits at the foot of every
     screen after that. */

  /* Each of these takes the store's own `detail` sentence and finishes it. The
     detail is the specific true thing, a full device or a blocked browser, and
     it has to reach the screen. Saying "private browsing" to somebody whose
     phone is simply full sends them looking for the wrong setting. */

  var STORAGE_SHORT = {
    ok: function () {
      return 'Kept on this phone. Nothing is sent anywhere.';
    },
    readonly: function (detail) {
      return detail + ' Nothing is sent anywhere, but nothing new will save until there is room.';
    },
    unavailable: function (detail) {
      return (
        'Nothing is sent anywhere. ' +
        detail +
        ' What you write here goes when you close the tab.'
      );
    },
  };

  var STORAGE_LINES = {
    ok: function () {
      return (
        'Everything here is kept on this phone and nowhere else. There is no account and no sign ' +
        'in, nothing is sent to Darragh or to anyone else, and clearing your browser data clears ' +
        'this along with it.'
      );
    },
    readonly: function (detail) {
      return (
        detail +
        ' Everything you have written before is still here and safe to read back. A new check-in ' +
        'will not save until you clear some space on the phone.'
      );
    },
    unavailable: function (detail) {
      return (
        detail +
        ' That is usually private browsing, or storage switched off. You can still check in and ' +
        'read it back, but it will be gone once you close the tab.'
      );
    },
    /* Used in place of the standing line when nothing is being kept at all.
       Saying "everything here is kept on this phone" directly under "this
       browser is blocking storage" is a contradiction a client would catch. The
       privacy half of the promise still holds, so keep that and drop the rest. */
    privacyOnly: function () {
      return (
        'There is still no account and no sign in, and nothing is sent to Darragh or to anyone else.'
      );
    },
    recovered: function () {
      return (
        'What was stored here could not be read, so the evidence bank is starting from empty. The ' +
        'old file has been left on the device rather than written over, in case it can be got back.'
      );
    },
  };

  function line(table, status, detail) {
    var fn = table[status] || table.ok;
    return fn(detail || '');
  }

  function StorageNote(props) {
    var status = props.status === 'empty' ? 'ok' : props.status;
    var standing = status === 'unavailable' ? 'privacyOnly' : 'ok';
    var lines =
      status === 'ok'
        ? [line(STORAGE_LINES, 'ok')]
        : [line(STORAGE_LINES, status, props.detail), line(STORAGE_LINES, standing)];
    return h(
      'div',
      { className: 'bz-host-note' },
      lines.map(function (text, i) {
        return h('p', { key: i, className: i === 0 && status !== 'ok' ? 'bz-host-flag' : null }, text);
      }),
      props.error ? h('p', { className: 'bz-host-flag' }, props.error) : null,
      props.onEditTopic
        ? h(
            'button',
            { type: 'button', className: 'bz-host-link', onClick: props.onEditTopic },
            'Change your words'
          )
        : null
    );
  }

  /* ── Topic screen ─────────────────────────────────────────────
     Asked once on this device, in the client's own words, and editable after.
     Skipping is a real option, the component takes a null topic. */

  function TopicScreen(props) {
    var first = props.first;
    return h(
      'div',
      { className: 'bz-mwci' },
      h(MidweekCheckIn.Styles, null),
      h(
        'div',
        { className: 'bz-mwci-shell' },
        h(
          'div',
          { className: 'bz-mwci-card' },
          h('div', { className: 'bz-host-sky' }, h('div', { className: 'bz-mwci-orb' })),
          h(
            'div',
            { className: 'bz-mwci-body' },
            h('p', { className: 'bz-mwci-eyebrow' }, first ? 'Before you start' : 'Your words'),
            h(
              'h2',
              { className: 'bz-mwci-h' },
              first ? 'What did you and Darragh call it?' : 'Your words for it'
            ),
            h(
              'p',
              { className: 'bz-mwci-p' },
              first
                ? 'Whatever you called it in the first session, in your own words. It sits above the ' +
                    'scale each week, so the thing you are rating stays the one thing, not your whole life.'
                : 'Change them whenever they stop fitting. This only changes what shows above the ' +
                    'scale. Your check-ins stay exactly as they are.'
            ),
            first
              ? h('p', { className: 'bz-mwci-sub' }, line(STORAGE_SHORT, props.status, props.detail))
              : null,
            h('textarea', {
              className: 'bz-mwci-textarea bz-host-topic',
              value: props.value,
              maxLength: 160,
              'aria-label': 'Your words for what you are working on',
              placeholder: 'e.g. the knot in my chest before work',
              onChange: function (e) {
                props.onChange(e.target.value);
              },
            }),
            h('button', { type: 'button', className: 'bz-mwci-primary', onClick: props.onSave }, 'Save it'),
            h(
              'button',
              { type: 'button', className: 'bz-mwci-quiet', onClick: props.onSkip },
              first ? 'Skip for now' : 'Back'
            ),
            props.error ? h('p', { className: 'bz-mwci-note' }, props.error) : null
          )
        ),
        h(MidweekCheckIn.Footer, null)
      )
    );
  }

  /* ── App ──────────────────────────────────────────────────── */

  function App() {
    /* Load once. A ref rather than useMemo, because load() probes storage and
       may set a corrupt payload aside, and that should happen exactly once. */
    var initial = React.useRef(null);
    if (initial.current === null) initial.current = store.load();
    var loaded = initial.current;

    var statusState = React.useState(loaded.status);
    var status = statusState[0];
    var setStatus = statusState[1];

    var detailState = React.useState(loaded.detail);
    var detail = detailState[0];
    var setDetail = detailState[1];

    var entriesState = React.useState(loaded.entries);
    var entries = entriesState[0];
    var setEntries = entriesState[1];

    var topicState = React.useState(loaded.topic);
    var topic = topicState[0];
    var setTopic = topicState[1];

    var askingState = React.useState(!loaded.topicAsked);
    var asking = askingState[0];
    var setAsking = askingState[1];

    var draftState = React.useState(loaded.topic || '');
    var draftTopic = draftState[0];
    var setDraftTopic = draftState[1];

    var errorState = React.useState(null);
    var error = errorState[0];
    var setError = errorState[1];

    var firstAsk = !loaded.topicAsked;

    /* The store's mode can change under us: a device that was full may have had
       space cleared, and a write that was going to work may now fail. Recompute
       from the store after every attempt rather than trusting the load. */
    function syncStorage(failureDetail) {
      var m = store.mode();
      setStatus(m === 'store' ? 'ok' : m === 'readonly' ? 'readonly' : 'unavailable');
      if (failureDetail) setDetail(failureDetail);
    }

    function saveTopic() {
      var result = store.saveTopic(draftTopic);
      /* Do not trap the client on this screen when the save cannot work. Their
         words hold for the visit, and the note below says why they will not
         outlast it. */
      setTopic(draftTopic.trim() ? draftTopic.trim() : null);
      setError(result.ok ? null : result.error);
      syncStorage(result.ok ? null : result.error);
      setAsking(false);
    }

    function skipTopic() {
      if (firstAsk) {
        var result = store.saveTopic(null);
        if (!result.ok) {
          setError(result.error);
          syncStorage(result.error);
        }
        setTopic(null);
      } else {
        setDraftTopic(topic || ''); // came back to change it, then thought better of it
      }
      setAsking(false);
    }

    function submit(draft) {
      /* The store plays the parent from the component's contract: it adds id,
         createdAt and weekOf. Rejecting is how the component knows to keep the
         client on the anchor screen with their words still in the box. */
      var result = store.append(draft);
      if (!result.ok) {
        setError(result.error);
        syncStorage(result.error);
        /* clientMessage is what the component will show. Without it the client
           reads "have another go in a moment", which is the wrong advice when
           the real answer is that the device is out of room. */
        var failure = new Error(result.error);
        failure.clientMessage = result.error;
        return Promise.reject(failure);
      }
      setError(null);
      setEntries(function (prev) {
        return prev.concat([result.entry]);
      });
      syncStorage(null);
      return Promise.resolve();
    }

    function editTopic() {
      setDraftTopic(topic || '');
      setError(null);
      setAsking(true);
    }

    return h(
      React.Fragment,
      null,
      asking
        ? h(TopicScreen, {
            first: firstAsk,
            status: status,
            detail: detail,
            value: draftTopic,
            error: error,
            onChange: setDraftTopic,
            onSave: saveTopic,
            onSkip: skipTopic,
          })
        : h(MidweekCheckIn, { scaleTopic: topic, history: entries, onSubmit: submit }),
      h(StorageNote, {
        status: status,
        detail: detail,
        error: asking ? null : error,
        onEditTopic: asking ? null : editTopic,
      })
    );
  }

  ReactDOM.createRoot(mount).render(h(App, null));
})(typeof window !== 'undefined' ? window : this);
