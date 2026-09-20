/* Vowly - wedding RSVP + seating planner (vanilla JS, localStorage only) */
(function () {
  'use strict';

  var STORE = 'vowly.v1';
  var TABLES = ['Table 1', 'Table 2', 'Table 3', 'Table 4'];
  var SEATS_PER_TABLE = 6;

  var el = {
    form: document.getElementById('rsvp-form'),
    msg: document.getElementById('form-msg'),
    list: document.getElementById('guest-list'),
    empty: document.getElementById('guest-empty'),
    count: document.getElementById('guest-count'),
    pool: document.getElementById('pool'),
    poolItems: document.getElementById('pool-items'),
    floor: document.getElementById('floor'),
    toast: document.getElementById('toast'),
    seed: document.getElementById('seed-btn'),
    stats: {
      replies: document.getElementById('stat-replies'),
      attending: document.getElementById('stat-attending'),
      pending: document.getElementById('stat-pending'),
      seated: document.getElementById('stat-seated')
    }
  };

  var state = load() || demoState();
  var filter = 'all';
  var toastTimer = null;

  function demoState() {
    var people = [
      ['Aisha & Bilal', 'aisha@example.com', 2, 'attending', 'Vegetarian for one'],
      ['Noor Fatima', 'noor@example.com', 1, 'attending', ''],
      ['Hamza Sheikh', 'hamza@example.com', 2, 'attending', 'No nuts'],
      ['Zainab Ali', 'zainab@example.com', 3, 'attending', ''],
      ['Usman Tariq', 'usman@example.com', 2, 'pending', ''],
      ['Sara Khan', 'sara@example.com', 1, 'attending', 'Vegan'],
      ['Daniyal Raza', 'daniyal@example.com', 2, 'declined', ''],
      ['Mariam Iqbal', 'mariam@example.com', 1, 'pending', '']
    ];
    var guests = people.map(function (p, i) {
      return { id: 'g' + (Date.now() + i), name: p[0], email: p[1], party: p[2], status: p[3], diet: p[4], note: '' };
    });
    var seats = {};
    var attending = guests.filter(function (g) { return g.status === 'attending'; });
    seats['0-0'] = attending[0].id;
    seats['0-1'] = attending[1].id;
    seats['1-0'] = attending[2].id;
    seats['1-1'] = attending[3].id;
    return { guests: guests, seats: seats };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.guests) || typeof data.seats !== 'object') return null;
      return data;
    } catch (e) { return null; }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2400);
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function seatedIds() {
    return Object.keys(state.seats).map(function (k) { return state.seats[k]; });
  }

  function totals() {
    var attendingSeats = 0, pendingSeats = 0;
    state.guests.forEach(function (g) {
      if (g.status === 'attending') attendingSeats += Number(g.party) || 1;
      if (g.status === 'pending') pendingSeats += Number(g.party) || 1;
    });
    var seated = seatedIds().filter(Boolean).length;
    return { replies: state.guests.length, attendingSeats: attendingSeats, pendingSeats: pendingSeats, seated: seated };
  }

  function renderStats() {
    var t = totals();
    el.stats.replies.textContent = t.replies;
    el.stats.attending.textContent = t.attendingSeats;
    el.stats.pending.textContent = t.pendingSeats;
    el.stats.seated.textContent = t.seated;
  }

  function renderGuests() {
    var seated = seatedIds();
    var list = state.guests.filter(function (g) { return filter === 'all' || g.status === filter; });
    el.count.textContent = state.guests.length;
    el.list.innerHTML = list.map(function (g) {
      var where = seated.indexOf(g.id) > -1 ? 'seated' : 'not seated';
      var meta = esc(g.email) + ' &middot; party of ' + (Number(g.party) || 1) + ' &middot; ' + where;
      if (g.diet) meta += ' &middot; ' + esc(g.diet);
      var delay = (state.guests.indexOf(g) * 0.05).toFixed(2);
      return '<li class="guest" style="animation-delay:' + delay + 's">' +
        '<span class="avatar" aria-hidden="true">' + esc(initials(g.name)) + '</span>' +
        '<div class="guest-main"><p class="guest-name">' + esc(g.name) + '</p><p class="guest-meta">' + meta + '</p></div>' +
        '<span class="tag ' + g.status + '">' + g.status + '</span>' +
        '<button class="icon-btn" type="button" data-remove="' + g.id + '" aria-label="Remove ' + esc(g.name) + '">&times;</button>' +
        '</li>';
    }).join('');
    el.empty.hidden = list.length > 0;
  }

  function guestChip(g) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-guest';
    btn.draggable = true;
    btn.dataset.guest = g.id;
    btn.textContent = g.name + ' +' + (Number(g.party) || 1);
    btn.setAttribute('aria-label', 'Drag ' + g.name + ' to a seat');
    btn.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', g.id);
      ev.dataTransfer.effectAllowed = 'move';
      btn.classList.add('is-dragging');
    });
    btn.addEventListener('dragend', function () { btn.classList.remove('is-dragging'); });
    return btn;
  }

  function renderSeating() {
    var seated = seatedIds();
    var unseated = state.guests.filter(function (g) {
      return g.status === 'attending' && seated.indexOf(g.id) === -1;
    });
    el.poolItems.innerHTML = '';
    unseated.forEach(function (g) { el.poolItems.appendChild(guestChip(g)); });
    if (!unseated.length) {
      el.poolItems.innerHTML = '<span class="empty">Everyone attending has a seat. Drop a name here to free it up.</span>';
    }

    el.floor.innerHTML = '';
    TABLES.forEach(function (name, ti) {
      var table = document.createElement('div');
      table.className = 'table';
      var filled = 0;
      for (var si = 0; si < SEATS_PER_TABLE; si++) { if (state.seats[ti + '-' + si]) filled++; }
      var head = document.createElement('h3');
      head.innerHTML = '<span>' + name + '</span><small>' + filled + '/' + SEATS_PER_TABLE + ' seats</small>';
      table.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'seats';
      for (var s = 0; s < SEATS_PER_TABLE; s++) {
        var key = ti + '-' + s;
        var seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.seat = key;
        var gid = state.seats[key];
        var guest = state.guests.filter(function (g) { return g.id === gid; })[0];
        if (guest) {
          seat.classList.add('is-filled');
          seat.setAttribute('draggable', 'true');
          seat.textContent = guest.name;
          seat.setAttribute('aria-label', name + ' seat ' + (s + 1) + ': ' + guest.name + '. Drag to move.');
          seat.addEventListener('dragstart', function (ev) {
            var dragId = state.seats[seat.dataset.seat];
            if (!dragId) { ev.preventDefault(); return; }
            ev.dataTransfer.setData('text/plain', dragId);
            ev.dataTransfer.effectAllowed = 'move';
          });
          seat.addEventListener('click', function () { unseat(seat.dataset.seat); });
        } else {
          seat.textContent = 'Seat ' + (s + 1);
          seat.setAttribute('aria-label', name + ' seat ' + (s + 1) + ': empty. Drop a guest here.');
        }
        seat.addEventListener('dragover', function (ev) { ev.preventDefault(); seat.classList.add('is-over'); });
        seat.addEventListener('dragleave', function () { seat.classList.remove('is-over'); });
        seat.addEventListener('drop', function (ev) {
          ev.preventDefault();
          seat.classList.remove('is-over');
          var id = ev.dataTransfer.getData('text/plain');
          if (id) assign(id, seat.dataset.seat);
        });
        grid.appendChild(seat);
      }
      table.appendChild(grid);
      el.floor.appendChild(table);
    });
  }

  function render() {
    renderStats();
    renderGuests();
    renderSeating();
  }

  function assign(guestId, seatKey) {
    Object.keys(state.seats).forEach(function (k) {
      if (state.seats[k] === guestId) delete state.seats[k];
    });
    var guest = state.guests.filter(function (g) { return g.id === guestId; })[0];
    if (!guest) return;
    if (guest.status !== 'attending') {
      guest.status = 'attending';
      toast(guest.name + ' marked as attending');
    }
    state.seats[seatKey] = guestId;
    save();
    render();
  }

  function unseat(seatKey) {
    delete state.seats[seatKey];
    save();
    render();
  }

  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = document.getElementById('f-name').value.trim();
    var email = document.getElementById('f-email').value.trim();
    var party = parseInt(document.getElementById('f-party').value, 10) || 1;
    var status = document.getElementById('f-status').value;
    var diet = document.getElementById('f-diet').value.trim();
    var note = document.getElementById('f-note').value.trim();

    if (name.length < 2 || email.indexOf('@') < 1) {
      el.msg.textContent = 'Please add a name and a valid email address.';
      el.msg.classList.add('err');
      return;
    }
    state.guests.unshift({ id: 'g' + Date.now(), name: name, email: email, party: party, status: status, diet: diet, note: note });
    save();
    filter = 'all';
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('is-active', c.dataset.filter === 'all');
    });
    ev.target.reset();
    el.msg.classList.remove('err');
    el.msg.textContent = 'Thanks ' + name + ' - your RSVP is in.';
    render();
    toast('RSVP saved for ' + name);
  });

  el.list.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-remove]');
    if (!btn) return;
    var id = btn.getAttribute('data-remove');
    state.guests = state.guests.filter(function (g) { return g.id !== id; });
    Object.keys(state.seats).forEach(function (k) { if (state.seats[k] === id) delete state.seats[k]; });
    save();
    render();
    toast('Guest removed');
  });

  document.querySelectorAll('.chip[data-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      filter = chip.dataset.filter;
      document.querySelectorAll('.chip[data-filter]').forEach(function (c) { c.classList.toggle('is-active', c === chip); });
      renderGuests();
    });
  });

  el.pool.addEventListener('dragover', function (ev) { ev.preventDefault(); el.pool.classList.add('is-over'); });
  el.pool.addEventListener('dragleave', function () { el.pool.classList.remove('is-over'); });
  el.pool.addEventListener('drop', function (ev) {
    ev.preventDefault();
    el.pool.classList.remove('is-over');
    var id = ev.dataTransfer.getData('text/plain');
    Object.keys(state.seats).forEach(function (k) { if (state.seats[k] === id) delete state.seats[k]; });
    save();
    render();
  });

  el.seed.addEventListener('click', function () {
    state = demoState();
    save();
    render();
    toast('Demo wedding loaded');
  });

  render();
})();