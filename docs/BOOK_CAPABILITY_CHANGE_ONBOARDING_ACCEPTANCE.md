# Acceptance scenarios — capability access changes

## Grant while master is already working

- Admin enables one or more BOOLEAN capabilities and saves.
- Master does not reload Book.
- On the master's next activity, Book refreshes access from the server.
- A blocking summary modal appears.
- After acknowledgement the new UI is visible.
- On first click into each newly granted capability, its own blocking introduction appears.
- After acknowledgement the requested section/action opens.

## Grant while master is offline

- Admin enables capability and saves.
- Master later logs in.
- A blocking summary modal appears on that login.
- The section-specific introduction remains pending until the first click into that section.

## Several grants

- One save enables several capabilities.
- One common summary modal is shown.
- No sequence of section intros starts automatically.
- Each section intro appears only on that section's first click.

## Revoke

- Admin disables capability and saves.
- On next master activity, the capability disappears from the UI without a full page reload.
- A blocking summary modal reports the access change.
- Any uncompleted intro for that capability is cancelled server-side.

## Persistence

- Pending summary/introduction survives browser close, new login and another device.
- Browser storage is not the source of truth for this state.
