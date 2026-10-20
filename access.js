/* ============================================================
   MYTHOS ACCESS FRAMEWORK — multi-step sign-in scaffolding
   ------------------------------------------------------------
   The access sequence is a state machine of ordered steps:

     Step 1  GATE        — the three riddles (the-gate.html)
     Step 2  SIGNAL      — Lost Connection, finished (lost-connection.html)
     Step 3  CREDENTIALS — employee ID + passphrase (employee.html)

   TODAY: mode is "legacy". Steps 1–2 are enforced client-side
   and completing them grants access to the employee site, as
   before. Step 3 renders as a dormant form.

   LATER: when the auth backend exists, set MYTHOS_AUTH.mode to
   "backend" and MYTHOS_AUTH.endpoint to its base URL. The steps
   then verify server-side (POST /auth/step/:step, session token
   returned by Step 3), and guardEmployee() checks the session
   instead of local state. Nothing else in the site changes —
   pages already call markStep() / guardEmployee() and read
   state through this file only.

   State is session-scoped on purpose: closing the tab ends the
   "shift", matching the session-only unlock the site launched
   with.
   ============================================================ */

var MYTHOS_AUTH = {
  mode: 'legacy',        // 'legacy' (client-side) | 'backend'
  endpoint: null,        // e.g. 'https://auth.mythosgaming.dpdns.org'
  steps: ['gate', 'signal', 'credentials'],
  stateKey: 'mythos_access_v1'
};

(function () {
  function readState() {
    try {
      return JSON.parse(sessionStorage.getItem(MYTHOS_AUTH.stateKey)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeState(state) {
    try {
      sessionStorage.setItem(MYTHOS_AUTH.stateKey, JSON.stringify(state));
    } catch (e) { /* private mode etc. — access simply won't persist */ }
  }

  // Called by a step's page when the visitor completes that step.
  window.markStep = function (step) {
    var state = readState();
    state[step] = { done: true, at: new Date().toISOString() };
    writeState(state);
    return state;
  };

  // Steps completed so far, in order. The credentials step counts
  // as complete in legacy mode once gate + signal are done (it is
  // dormant until the backend activates it).
  window.accessState = function () {
    var state = readState();
    var done = {
      gate: !!(state.gate && state.gate.done),
      signal: !!(state.signal && state.signal.done),
      credentials: !!(state.credentials && state.credentials.done)
    };
    if (MYTHOS_AUTH.mode === 'legacy' && done.gate && done.signal) {
      done.credentials = true;
    }
    done.complete = MYTHOS_AUTH.steps.every(function (s) { return done[s]; });
    done.next = MYTHOS_AUTH.steps.filter(function (s) { return !done[s]; })[0] || null;
    return done;
  };

  // Guard for the employee site. In legacy mode, visitors who
  // have not completed the sequence are shown the access screen
  // (element #access-gate) instead of the site (element
  // #employee-site). In backend mode this will verify the
  // session token with MYTHOS_AUTH.endpoint before revealing.
  window.guardEmployee = function () {
    var gateEl = document.getElementById('access-gate');
    var siteEl = document.getElementById('employee-site');
    if (!gateEl || !siteEl) return;
    var state = window.accessState();
    if (state.complete) {
      gateEl.style.display = 'none';
      siteEl.style.display = 'block';
    } else {
      gateEl.style.display = 'block';
      siteEl.style.display = 'none';
      // Light up the checklist to match progress.
      MYTHOS_AUTH.steps.forEach(function (step) {
        var li = document.getElementById('step-' + step);
        if (li) li.classList.toggle('done', !!state[step === 'credentials' ? 'credentials' : step]);
      });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('employee-site')) window.guardEmployee();
  });
})();
