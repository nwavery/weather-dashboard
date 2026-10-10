import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeAlerts, alertTiming } from '../src/lib/alerts.js';

const TZ = 'America/Chicago';
// Newer ICU puts a narrow no-break space before AM/PM; compare on plain spaces.
const t = (...args) => alertTiming(...args).replace(/ /g, ' ');
const NOW = Date.parse('2026-10-10T12:00:00-05:00'); // Saturday noon, CDT

// The real pair from the Oct 9-10 2026 ozone alert for Oklahoma City: NWS
// re-issued it at 4:17 PM and left the 2:57 PM original in the active feed,
// identical text and no `references` link.
const TEXT = 'AIR QUALITY ALERT IN EFFECT UNTIL 10 PM CDT THIS EVENING... ...AIR QUALITY ALERT IN EFFECT FROM 10 AM TO 10 PM CDT SATURDAY';
const reissue = {
  id: 'urn:oid:2.49.0.1.840.0.75307351db51e021fcb05ae0f722ff6a58c416ec.001.1',
  event: 'Air Quality Alert',
  sent: '2026-10-09T16:17:00-05:00',
  onset: '2026-10-09T16:17:00-05:00',
  ends: '2026-10-10T16:30:00-05:00',
  references: [],
  text: TEXT
};
const original = {
  id: 'urn:oid:2.49.0.1.840.0.5364742f9591f18957f62a8222a45e75d7bd85f8.001.1',
  event: 'Air Quality Alert',
  sent: '2026-10-09T14:57:00-05:00',
  onset: '2026-10-09T14:57:00-05:00',
  ends: '2026-10-10T15:00:00-05:00',
  references: [],
  text: TEXT
};

test('a re-issued alert shows once, as its newest version', () => {
  assert.deepEqual(dedupeAlerts([reissue, original]).map((a) => a.id), [reissue.id]);
  assert.deepEqual(dedupeAlerts([original, reissue]).map((a) => a.id), [reissue.id]); // order-independent
});

test('an alert another one formally supersedes is dropped', () => {
  const update = { ...reissue, id: 'new', text: 'updated wording', references: [original.id] };
  assert.deepEqual(dedupeAlerts([original, update]).map((a) => a.id), ['new']);
});

test('genuinely different alerts are all kept', () => {
  const heat = { id: 'heat', event: 'Heat Advisory', sent: reissue.sent, text: 'HEAT ADVISORY IN EFFECT', references: [] };
  const otherAq = { ...original, id: 'aq2', text: 'AIR QUALITY ALERT IN EFFECT SUNDAY' };
  assert.equal(dedupeAlerts([reissue, heat, otherAq]).length, 3);
  // Alerts with no message text can't be matched, so they never collapse.
  assert.equal(dedupeAlerts([{ id: 'a', event: 'X' }, { id: 'b', event: 'X' }]).length, 2);
});

test('an alert spanning two days shows the dates (the Oct 9-10 case)', () => {
  assert.equal(t(reissue.onset, reissue.ends, TZ, NOW), ' · Oct 9 – Oct 10, 4:30 PM');
});

test('an upcoming multi-day alert shows both dates and times', () => {
  assert.equal(
    t('2026-10-11T20:00:00-05:00', '2026-10-12T06:00:00-05:00', TZ, NOW),
    ' · Oct 11, 8:00 PM – Oct 12, 6:00 AM'
  );
});

test('a one-day alert keeps the short form', () => {
  assert.equal(t('2026-10-10T09:00:00-05:00', '2026-10-10T20:00:00-05:00', TZ, NOW), ' until 8:00 PM');
  assert.equal(t('2026-10-11T10:00:00-05:00', '2026-10-11T22:00:00-05:00', TZ, NOW), ' · Sun 10:00 AM–10:00 PM');
  assert.equal(t('2026-10-11T10:00:00-05:00', null, TZ, NOW), ' · from Sun 10:00 AM');
});

test('an open-ended alert that started on an earlier day says since when', () => {
  assert.equal(t('2026-10-09T16:17:00-05:00', null, TZ, NOW), ' · since Oct 9');
  assert.equal(t('2026-10-10T08:00:00-05:00', null, TZ, NOW), ''); // started today: nothing to add
});

test('days are judged in the card\'s zone, not UTC', () => {
  // 7 PM to 11 PM CDT is one local day even though it crosses midnight UTC.
  assert.equal(t('2026-10-10T19:00:00-05:00', '2026-10-10T23:00:00-05:00', TZ, NOW), ' · 7:00 PM–11:00 PM');
});
