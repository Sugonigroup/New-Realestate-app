// k6 load test — launch-day burst (Phase 9, docs/architecture/25 §1)
// Run: k6 run -e BASE=https://staging-api load/launch-day-burst.js
// Gates (02 §6): p95 < 300ms API, no 5xx beyond error budget.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:8080";
const TENANT = __ENV.TENANT || "";

export const options = {
  scenarios: {
    read_burst: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: [
        { target: 200, duration: "2m" },
        { target: 500, duration: "3m" }, // burst: 500 rps for 15 min per NFR
        { target: 500, duration: "10m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    checks: ["rate>0.999"],
  },
};

export default function () {
  const headers = TENANT ? { "x-tenant-id": TENANT } : {};
  const health = http.get(`${BASE}/v1/health`, { headers });
  check(health, { "health 200": (r) => r.status === 200 });
  sleep(1);
}
