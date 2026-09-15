import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('ui/shell/shell.css', 'utf8');
const account = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const notifications = fs.readFileSync('online-booking/notifications.js', 'utf8');

assert.match(shell, /\.app-view-shell\{[^}]*overflow-x:hidden/s);
assert.match(shell, /\.app-view-shell--chat\{[^}]*overflow:hidden/s);
assert.match(shell, /\.app-view-shell--chat \.app-view-shell__screen\{[^}]*overflow-y:auto/s);
assert.match(shell, /\.message-composer\{[^}]*position:fixed[^}]*grid-template-columns:minmax\(0,1fr\) 46px/s);
assert.match(shell, /\.message-composer--with-attachments\{[^}]*grid-template-columns:44px minmax\(0,1fr\) 46px/s);
assert.match(shell, /\.message-composer__attach\{[^}]*width:44px[^}]*height:44px/s);
assert.match(shell, /\.message-bubble\{[^}]*max-width:82%/s);
assert.match(shell, /\.app-header\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto auto/s);
assert.match(shell, /\.app-header__slot\.is-empty\{[^}]*width:0/s);
assert.match(account, /messageComposer\(\{ attachments: true, rich: true \}\)/);
assert.match(account, /bindRichTextEditor\(form\)/);
assert.match(account, /data-message-attachment/);
assert.match(account, /settingsPanel\(/);
assert.doesNotMatch(account, /createElement\('style'\)|<style>/);
assert.doesNotMatch(notifications, /createElement\('style'\)|<style>|white-space:nowrap/);

console.log('mobile notification and messages layout regression test passed');
