import assert from 'node:assert/strict';
import fs from 'node:fs';

const affordance = fs.readFileSync('ui/v2/z-affordance.js', 'utf8');
const stack = fs.readFileSync('ui/v2/z-stack.js', 'utf8');

assert.match(
  affordance,
  /'margin:20px 0 0 18px'/,
  'Shared Z/Q dismiss affordance must live below the rounded top-left corner, in the visible second header band.',
);
assert.match(
  affordance,
  /'color:#111'/,
  'Shared Z/Q dismiss affordance must keep full readable contrast.',
);
assert.match(
  affordance,
  /filter:drop-shadow\(0 2px 3px rgba\(0,0,0,\.45\)\)/,
  'Shared Z/Q dismiss affordance must retain its visible shadow.',
);
assert.match(
  stack,
  /if \(dismiss\) dismiss\.hidden = blocked;/,
  'Only the active Z layer may expose its dismiss affordance; obscured Z1/Z2/Z3 controls must not remain visible and dead.',
);
assert.match(
  stack,
  /node\.style\.setProperty\('--v2-z-layer-shift', `\$\{depth \* 12\}px`\);/,
  'Each nested Z layer must retain its own physical layer shift so the active affordance moves with that layer.',
);

console.log('z-dismiss-affordance-contract: PASS');
