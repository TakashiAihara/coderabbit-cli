#!/usr/bin/env bun
import { Command } from 'commander';

import { auditLogsList } from './generated/audit-logs/audit-logs';
import { getSeatAssignmentMode, listUsers, reviewMetrics } from './generated/default/default';
import { learningsList } from './generated/learnings/learnings';
import { mcpMetrics, reviewCommentMetrics } from './generated/metrics/metrics';
import { organizationRepositoriesList, organizationsList } from './generated/organizations/organizations';
import { getRole, listRolePermissionOptions, listRoles } from './generated/role-management/role-management';
import { securityScansCodeList } from './generated/security/security';

// --query k=v を繰り返し受けて API のクエリにそのまま渡す。パラメータ名は OpenAPI のものを使う
export const collect = (kv: string, acc: Record<string, string>) => {
  const i = kv.indexOf('=');
  if (i <= 0) throw new Error(`--query expects key=value: ${kv}`);
  return { ...acc, [kv.slice(0, i)]: kv.slice(i + 1) };
};

const print = (result: unknown) => {
  if (result === undefined) return;
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
};

type Query = { query: Record<string, string> };

const withQuery = (cmd: Command) => cmd.option('-q, --query <key=value>', 'API query parameter (repeatable)', collect, {});

export const program = new Command('coderabbit-cli').description('CLI for the CodeRabbit API');

withQuery(program.command('organizations').description('GET /v1/organizations')).action(
  async (o: Query) => print(await organizationsList(o.query)),
);
withQuery(program.command('repositories <organizationId>').description('GET /v1/organizations/{organization_id}/repositories')).action(
  async (id: string, o: Query) => print(await organizationRepositoriesList(id, o.query)),
);
withQuery(program.command('users').description('GET /v1/users')).action(async (o: Query) => print(await listUsers(o.query)));
program.command('seat-mode').description('GET /v1/users/seats/assignment').action(async () => print(await getSeatAssignmentMode()));
withQuery(program.command('roles').description('GET /v1/roles')).action(async (o: Query) => print(await listRoles(o.query)));
withQuery(program.command('role <roleId>').description('GET /v1/roles/{roleId}')).action(
  async (id: string, o: Query) => print(await getRole(id, o.query)),
);
withQuery(program.command('role-permissions').description('GET /v1/roles/permissions')).action(
  async (o: Query) => print(await listRolePermissionOptions(o.query)),
);
withQuery(program.command('learnings').description('GET /v1/learnings')).action(async (o: Query) => print(await learningsList(o.query)));
withQuery(program.command('audit-logs').description('GET /v1/audit-logs')).action(async (o: Query) => print(await auditLogsList(o.query)));
// 必須の query (from / to など) の検証は API に任せる
withQuery(program.command('review-metrics').description('GET /v1/metrics/reviews')).action(
  async (o: Query) => print(await reviewMetrics(o.query as never)),
);
withQuery(program.command('review-comment-metrics').description('GET /v1/metrics/review-comments')).action(
  async (o: Query) => print(await reviewCommentMetrics(o.query as never)),
);
withQuery(program.command('mcp-metrics').description('GET /v1/metrics/mcp')).action(async (o: Query) => print(await mcpMetrics(o.query as never)));
withQuery(program.command('security-code').description('GET /v1/security/scans/code')).action(
  async (o: Query) => print(await securityScansCodeList(o.query)),
);

if (import.meta.main) {
  program.parseAsync().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
