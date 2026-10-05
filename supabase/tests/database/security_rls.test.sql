begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

-- Stable identities make failures easier to reproduce and inspect.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'suspended@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set status = 'suspended' where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000004';

insert into public.projects (id, user_id, name)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Owner A project'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Owner B project'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Suspended project');

insert into public.diagrams (id, project_id, user_id, title, type, content)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Owner A diagram', 'erd', '{"nodes":[],"edges":[],"drawings":[]}'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Owner B diagram', 'erd', '{"nodes":[],"edges":[],"drawings":[]}'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Suspended diagram', 'erd', '{"nodes":[],"edges":[],"drawings":[]}');

-- Owner A can see only their own row.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  'select id::text from public.diagrams order by id',
  array['30000000-0000-0000-0000-000000000001'::text],
  'an active owner can read their diagram'
);
select results_eq(
  $$select count(*) from public.diagrams where id = '30000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'an active user cannot read another user diagram'
);
reset role;

-- Anonymous callers cannot enumerate database-backed diagrams.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq(
  'select count(*) from public.diagrams',
  array[0::bigint],
  'anonymous callers cannot read diagrams'
);
reset role;

-- Suspended accounts are denied even for rows they own.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  'select count(*) from public.diagrams',
  array[0::bigint],
  'a suspended user cannot read their diagram'
);
reset role;

-- Administrators retain visibility needed for governance.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  'select count(*) from public.diagrams',
  array[3::bigint],
  'an administrator can read all diagrams'
);
reset role;

-- Owner A cannot create a diagram inside owner B's project.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.diagrams (id, project_id, user_id, title, type, content)
    values ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Cross-project write', 'erd', '{"nodes":[],"edges":[]}')$$,
  '42501', null,
  'RLS rejects creating a diagram in another user project'
);
select lives_ok(
  $$insert into public.diagrams (id, project_id, user_id, title, type, content)
    values ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Valid write', 'erd', '{"nodes":[],"edges":[]}')$$,
  'an active owner can create a bounded diagram in their project'
);

select throws_ok(
  $$insert into public.audit_logs (user_id, user_email, action, target)
    values ('10000000-0000-0000-0000-000000000001', 'forged@example.test', 'forged_action', 'forged target')$$,
  '42501', null,
  'authenticated callers cannot insert audit rows directly'
);
select lives_ok(
  $$select public.log_user_activity('signed_in', 'Security test session')$$,
  'authenticated callers can log bounded telemetry through the actor-bound RPC'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.log_user_activity(text,text)', 'execute'),
  'authenticated has execute permission on log_user_activity'
);
select ok(
  not has_function_privilege('anon', 'public.log_user_activity(text,text)', 'execute'),
  'anonymous callers cannot execute log_user_activity'
);

-- Anonymous text feedback remains supported, but workflow columns are protected.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select lives_ok(
  $$insert into public.feedback (user_id, user_email, type, rating, message, priority)
    values (null, 'guest@example.test', 'general', 5, 'Bounded feedback', 'medium')$$,
  'anonymous callers can submit validated text feedback'
);
select throws_ok(
  $$insert into public.feedback (user_id, user_email, type, rating, message, priority, status)
    values (null, 'guest@example.test', 'general', 5, 'Forged workflow', 'medium', 'resolved')$$,
  '42501', null,
  'anonymous callers cannot set trusted feedback workflow columns'
);
reset role;

-- Direct API writes still hit the coarse database complexity boundary.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.diagrams (id, project_id, user_id, title, type, content)
    select
      '30000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'Oversized node collection',
      'erd',
      jsonb_build_object(
        'nodes', jsonb_agg(jsonb_build_object('id', 'node-' || value, 'label', 'Node')),
        'edges', '[]'::jsonb
      )
    from generate_series(1, 501) as value$$,
  '23514', null,
  'database rejects a diagram with more than 500 nodes'
);
select throws_ok(
  $$insert into public.diagrams (id, project_id, user_id, title, type, content)
    values ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Malformed content', 'erd', '{"nodes":[]}'::jsonb)$$,
  '23514', null,
  'database rejects diagram content without an edge array'
);
reset role;

select * from finish();
rollback;
