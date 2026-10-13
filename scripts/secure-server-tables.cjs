// Default is an audit. --apply enables RLS atomically on this reviewed allowlist.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({quiet:true});
const {PrismaClient, Prisma} = require('@prisma/client');
const prisma = new PrismaClient();
const sql = fs.readFileSync(path.join(__dirname,'../prisma/migrations-manual/20261008_enable_rls_server_tables.sql'),'utf8');
const statements = sql.split('\n').filter(line=>line.startsWith('ALTER TABLE '));
const names = statements.map(line=>{
  const match=/^ALTER TABLE public\.([a-z_]+) ENABLE ROW LEVEL SECURITY;$/.exec(line);
  assert.ok(match,'Only reviewed ENABLE RLS statements are allowed');
  return match[1];
});
assert.equal(names.length,19);
async function inspect(db) {
  return db.$queryRaw(Prisma.sql`SELECT c.relname AS name, c.relrowsecurity AS rls,
    pg_get_userbyid(c.relowner) AS owner,
    (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
    EXISTS(SELECT 1 FROM pg_publication_tables p WHERE p.schemaname='public' AND p.tablename=c.relname) AS published
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN (${Prisma.join(names)}) ORDER BY c.relname`);
}
(async()=>{
  const before=await inspect(prisma);
  assert.equal(before.length,19);
  console.log(JSON.stringify({before:before.map(({name,rls})=>({name,rls}))}));
  if(!process.argv.includes('--apply')) return;
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    const role=await tx.$queryRaw`SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    assert.equal(role[0].rolbypassrls,true,'Backend must retain privileged access');
    const current=await inspect(tx);
    for(const table of current) {
      assert.equal(table.policies,0,'Unexpected policies on '+table.name);
      assert.equal(table.published,false,'Realtime table must be reviewed separately: '+table.name);
    }
    for(const statement of statements) await tx.$executeRawUnsafe(statement);
    assert.ok((await inspect(tx)).every(t=>t.rls));
    // Backend reads still work; never log records or credentials.
    const visibilityQuery = names.map(name=>`SELECT '${name}' AS name, EXISTS(SELECT 1 FROM public."${name}" LIMIT 1) AS visible`).join(' UNION ALL ');
    await tx.$queryRawUnsafe(visibilityQuery);
    for(const roleName of ['anon','authenticated']) {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${roleName}`);
      const states=await tx.$queryRawUnsafe(names.map(name=>`SELECT '${name}' AS name, row_security_active('public.${name}'::regclass) AS active, has_table_privilege(current_user,'public.${name}','SELECT') AS selectable`).join(' UNION ALL '));
      for(const state of states) {
        const name=state.name;
        assert.equal(state.active,true,`${roleName}: RLS not active on ${name}`);
      }
      const selectable=states.filter(state=>state.selectable);
      if(selectable.length) {
        const rows=await tx.$queryRawUnsafe(selectable.map(({name})=>`SELECT '${name}' AS name, EXISTS(SELECT 1 FROM public."${name}" LIMIT 1) AS visible`).join(' UNION ALL '));
        assert.ok(rows.every(row=>!row.visible),`${roleName} can read protected rows`);
      }
      await tx.$executeRawUnsafe('RESET ROLE');
    }
  },{timeout:120000,maxWait:10000});
  console.log(JSON.stringify({enabled:(await inspect(prisma)).filter(t=>t.rls).length,backendReads:'passed',anonAndAuthenticated:'RLS active, no visible rows; no permissive policies'}));
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
