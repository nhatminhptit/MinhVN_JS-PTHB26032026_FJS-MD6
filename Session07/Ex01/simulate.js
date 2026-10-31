const fs = require("fs");
const path = require("path");
const policy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "policy.json"), "utf8"),
);

function evaluate(action, resource) {
  let isDeny = false,
    isAllow = false;
  for (const stmt of policy.Statement) {
    const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
    const resources = Array.isArray(stmt.Resource)
      ? stmt.Resource
      : [stmt.Resource];
    const matchAct = actions.some(
      (a) =>
        a === "*" ||
        a === action ||
        (a.endsWith("*") && action.startsWith(a.slice(0, -1))),
    );
    const matchRes = resources.some(
      (r) =>
        r === "*" ||
        r === resource ||
        (r.endsWith("*") && resource.startsWith(r.slice(0, -1))),
    );
    if (matchAct && matchRes) {
      if (stmt.Effect === "Deny") isDeny = true;
      if (stmt.Effect === "Allow") isAllow = true;
    }
  }
  return isDeny ? "DENY" : isAllow ? "ALLOW" : "DENY";
}

const tests = [
  {
    id: 1,
    name: "Ghi vao bucket dev",
    act: "s3:PutObject",
    res: "arn:aws:s3:::shopfast-dev-bucket/image.png",
    exp: "ALLOW",
  },
  {
    id: 2,
    name: "Xoa bucket prod",
    act: "s3:DeleteBucket",
    res: "arn:aws:s3:::shopfast-prod-backup-db",
    exp: "DENY",
  },
  {
    id: 3,
    name: "Tu gan quyen admin IAM",
    act: "iam:AttachUserPolicy",
    res: "arn:aws:iam::123456789012:user/dev",
    exp: "DENY",
  },
  {
    id: 4,
    name: "Xoa may chu EC2",
    act: "ec2:TerminateInstances",
    res: "arn:aws:ec2:*:*:instance/i-12345",
    exp: "DENY",
  },
];

let pass = 0;
tests.forEach((t) => {
  const res = evaluate(t.act, t.res);
  const ok = res === t.exp;
  if (ok) pass++;
  console.log(
    `[Tinh huong ${t.id}] ${t.name}: ${res} => ${ok ? "PASS" : "FAIL"}`,
  );
});
console.log(`Ket qua: ${pass}/${tests.length} tests passed.`);
process.exit(pass === tests.length ? 0 : 1);
