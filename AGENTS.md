# Project continuity

Read `HANDOFF.md` at the start of work to recover the last checkpoint, pending
changes, verification results, and user preferences. Confirm the actual Git
state before relying on the note.

Preserve compatibility with existing JSON databases, image references, invoice
snapshots, counters, and backup ZIP files. Test migration/backup behavior when
changing persistence. Never use real shop data for automated tests.

Do not publish, push, or change release versions unless the user requests it.
