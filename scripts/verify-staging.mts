import { stagingProblems } from "../src/lib/staging-policy";
// Process environment only: never loads .env.local or prints values.
const errors = stagingProblems(process.env);
console.log(JSON.stringify({ gate: "A", execution: "disabled", configurationValid: errors.length === 0, errors,
  externalAcceptance: "Still requires project ownership, publishable-key provenance, OAuth, protection, schema/ACL and operator approvals." }, null, 2));
if (errors.length) process.exitCode = 1;
