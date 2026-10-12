# ADR 0024: Restore Workspace Tabs per Browser Page Session

- Status: Accepted
- Date: 2026-10-12
- Extends: ADR 0019 and ADR 0023
- Supersedes: the deferred tab-session restoration boundary in ADR 0023

## Context

The workspace supports a permanent navigation home, pinned tabs and drag ordering. A browser reload
currently discards all visited tabs except the home and current URL. Users need their open workspace
to survive a reload, while independent browser tabs and signed-in identities remain isolated.

## Decision

Web owns a versioned `sessionStorage` snapshot scoped by tenant ID and user ID. Preserve the ordered
tab locations, stable navigation code, route key and user pin preference. Store concrete URLs with
their last query/hash; derive titles and UI props from current navigation rather than cached labels.
Anonymous workspaces remain in memory. Storage access and parsing failures fall back to the home
and current page without blocking startup.

Restore after authenticated navigation and Edition routes are installed. Revalidate every saved entry
against the currently authorized Navigation projection and installed base-layout route. Drop unsafe
URLs, removed or disabled nodes, changed route identities, invalid records and duplicate paths.
Do this on every restoration, including navigation version changes: valid tabs survive a new version,
while cached state never supplies authorization or installs a route.

Regenerate the locked first tab from the current version's home. Its forced pin is not a saved user
pin, so a former home becomes an ordinary tab when the home changes. Preserve user-pinned tabs and
the native pinned/normal group order. The browser URL determines the active tab and overrides that
tab's cached query/hash; a recognized deep link must never redirect to an old cached selection.

Persist after visits, query/hash changes, pin changes, close actions and reordering. On scope changes,
replace the collection with the new identity's validated session rather than copying another user's
tabs. `sessionStorage` is owned by the current browser page session; do not add cross-window syncing,
server persistence, KeepAlive or storage of page component/business state.

## Consequences

Reloading a page restores its workspace, including tab order and pins. Separate browser tabs can
maintain independent collections. Closing a browser page session does not promise restoration in a
new session, and unsaved page forms still reload normally. Runtime schema validation and browser tests
must cover reloads, closed tabs, navigation changes, deep links and identity isolation.
