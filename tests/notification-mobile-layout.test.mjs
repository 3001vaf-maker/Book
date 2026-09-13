import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('ui/shell/shell.css', 'utf8');
const account = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const notifications = fs.readFileSync('online-booking/notifications.js', 'utf8');

assert.match(shell, /\.app-view-shell\{[^}]*overflow-x:hidden/s);
assert.match(shell, /\.message-composer\{[^}]*grid-template-columns:minmax\(0,1fr\) 46px/s);
assert.match(shell, /\.message-bubble\{[^}]*max-width:82%/s);
assert.match(shell, /\.app-header\{[^}]*grid-template-columns:var\(--shell-icon-slot\) minmax\(0,1fr\) var\(--shell-action-slot\) var\(--shell-icon-slot\)/s);
assert.match(account, /messageComposer\(/);
assert.match(account, /settingsPanel\(/);
assert.doesNotMatch(account, /createElement\('style'\)|<style>/);
assert.doesNotMatch(notifications, /createElement\('style'\)|<style>|white-space:nowrap/);

console.log('mobile notification and messages layout regression test passed');
