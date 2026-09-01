-- ProjectIQ: extensions + enum types shared across the schema.

create extension if not exists pgcrypto;
create extension if not exists vector;

create type approval_status as enum ('pending', 'approved', 'rejected');
create type confidence_type as enum ('fact', 'inference', 'recommendation');

create type user_role as enum ('admin', 'pm', 'contributor', 'viewer');

create type project_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
create type project_health as enum ('green', 'amber', 'red');

create type action_priority as enum ('low', 'medium', 'high', 'critical');
create type action_status as enum ('open', 'in_progress', 'done', 'cancelled');

create type risk_probability as enum ('low', 'medium', 'high');
create type risk_impact as enum ('low', 'medium', 'high');
create type risk_severity as enum ('low', 'medium', 'high', 'critical');
create type risk_status as enum ('open', 'mitigated', 'closed', 'accepted');

create type issue_severity as enum ('low', 'medium', 'high', 'critical');
create type issue_status as enum ('open', 'investigating', 'resolved', 'closed');

create type dependency_status as enum ('planned', 'in_progress', 'blocked', 'complete');

create type change_signal_status as enum ('open', 'acknowledged', 'resolved');
