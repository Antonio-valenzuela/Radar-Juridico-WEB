import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath = "app/api/ai/chat-bubble/route.ts";

test("IA consulta cambios indexados antes de responder latest_changes", () => {
  const source = fs.readFileSync(routePath, "utf8");

  const changeIndex = source.indexOf("prisma.documentChange.findMany");
  const notificationIndex = source.indexOf("prisma.notification.findMany");
  const versionIndex = source.indexOf("prisma.documentVersion.findMany");
  const latestBranchIndex = source.indexOf('if (intent === "latest_changes")');

  assert.notEqual(changeIndex, -1, "missing DocumentChange query");
  assert.notEqual(notificationIndex, -1, "missing Notification query");
  assert.notEqual(versionIndex, -1, "missing DocumentVersion query");
  assert.ok(changeIndex < notificationIndex, "DocumentChange must be queried first");
  assert.ok(notificationIndex < versionIndex, "Notification must be queried before DocumentVersion");
  assert.notEqual(latestBranchIndex, -1, "missing latest_changes branch");
});

test("IA no inventa reformas si no hay cambios indexados", () => {
  const source = fs.readFileSync(routePath, "utf8");

  assert.match(source, /No encontré cambios indexados para ese periodo\./);
  assert.match(source, /buildIndexedChangesAnswer/);
  assert.match(source, /retrieveIndexedChangeEvidence/);
});
