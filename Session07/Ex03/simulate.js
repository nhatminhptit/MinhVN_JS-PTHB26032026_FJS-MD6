const fs = require("fs");
const path = require("path");

const backendPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, "policies/backend-policy.json"), "utf8"));
const devopsPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, "policies/devops-policy.json"), "utf8"));
const dataPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, "policies/data-engineer-policy.json"), "utf8"));
const partnerPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, "policies/partner-policy.json"), "utf8"));

function evaluate(policies, { action, resource, mfa = false, currentTime = "2026-04-01T00:00:00Z" }) {
  const polList = Array.isArray(policies) ? policies : [policies];
  let isDeny = false, isAllow = false;

  for (const pol of polList) {
    for (const stmt of pol.Statement) {
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
      const matchAct = actions.some(a => a === "*" || a === action || (a.endsWith("*") && action.startsWith(a.slice(0, -1))));
      const matchRes = resources.some(r => r === "*" || r === resource || (r.endsWith("*") && resource.startsWith(r.slice(0, -1))));

      if (matchAct && matchRes) {
        let conditionApplies = true;
        if (stmt.Condition) {
          if (stmt.Condition.BoolIfExists && stmt.Condition.BoolIfExists["aws:MultiFactorAuthPresent"] === "false") {
            conditionApplies = (!mfa);
          } else if (stmt.Condition.DateLessThan && stmt.Condition.DateLessThan["aws:CurrentTime"]) {
            const exp = new Date(stmt.Condition.DateLessThan["aws:CurrentTime"]).getTime();
            const cur = new Date(currentTime).getTime();
            conditionApplies = (cur < exp);
          }
        }

        if (conditionApplies) {
          if (stmt.Effect === "Deny") isDeny = true;
          if (stmt.Effect === "Allow") isAllow = true;
        }
      }
    }
  }
  return isDeny ? "DENY" : (isAllow ? "ALLOW" : "DENY");
}

const tests = [
  { id: 1, name: "Backend Dev: Ghi vao S3 Dev", pol: backendPolicy, ctx: { action: "s3:PutObject", resource: "arn:aws:s3:::shopfast-dev-assets/file.js" }, exp: "ALLOW" },
  { id: 2, name: "Backend Dev: Doc S3 Prod", pol: backendPolicy, ctx: { action: "s3:GetObject", resource: "arn:aws:s3:::shopfast-prod-data/file.js" }, exp: "ALLOW" },
  { id: 3, name: "Backend Dev: Ghi S3 Prod (Chan)", pol: backendPolicy, ctx: { action: "s3:PutObject", resource: "arn:aws:s3:::shopfast-prod-data/hack.js" }, exp: "DENY" },
  { id: 4, name: "DevOps: Xoa EC2 Prod CO MFA", pol: devopsPolicy, ctx: { action: "ec2:TerminateInstances", resource: "arn:aws:ec2:*:*:instance/i-prod", mfa: true }, exp: "ALLOW" },
  { id: 5, name: "DevOps: Xoa EC2 Prod KHONG CO MFA (Chan)", pol: devopsPolicy, ctx: { action: "ec2:TerminateInstances", resource: "arn:aws:ec2:*:*:instance/i-prod", mfa: false }, exp: "DENY" },
  { id: 6, name: "Data Engineer: Goi dich vu EC2 (Chan)", pol: dataPolicy, ctx: { action: "ec2:DescribeInstances", resource: "*" }, exp: "DENY" },
  { id: 7, name: "Doi tac: Doc log payment sau 90 ngay (Chan)", pol: partnerPolicy, ctx: { action: "logs:GetLogEvents", resource: "arn:aws:logs:ap-southeast-1:123456789012:log-group:/shopfast/payment-service:*", currentTime: "2026-08-15T00:00:00Z" }, exp: "DENY" },
  { id: 8, name: "Quyen mau thuan: Explicit Deny luon thang", pol: [{ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }, { Effect: "Deny", Action: "s3:GetObject", Resource: "arn:aws:s3:::shopfast-prod-secret/*" }] }], ctx: { action: "s3:GetObject", resource: "arn:aws:s3:::shopfast-prod-secret/api_keys.json" }, exp: "DENY" }
];

let pass = 0;
tests.forEach(t => {
  const res = evaluate(t.pol, t.ctx);
  const ok = res === t.exp;
  if (ok) pass++;
  console.log(`[Tình hu?ng ${t.id}] ${t.name}: ${res} => ${ok ? "PASS" : "FAIL"}`);
});
console.log(`Ket qua danh gia: ${pass}/${tests.length} tests passed.`);
process.exit(pass === tests.length ? 0 : 1);
