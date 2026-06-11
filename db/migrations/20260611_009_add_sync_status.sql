-- Persistent sync status: track an in-progress sync so the UI can show it
-- after the user navigates away and back.

alter table store_connections add column if not exists sync_started_at timestamptz;

-- Allow a 'syncing' status value.
alter table store_connections drop constraint if exists store_connections_status_check;
alter table store_connections add constraint store_connections_status_check
  check (status in ('connected', 'expired', 'error', 'disconnected', 'syncing'));
