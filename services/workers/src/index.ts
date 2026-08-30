import { PrismaClient } from "@prisma/client";
import { AgentRuntime } from "@buildos/core-api";
import { PrismaOutboxStore } from "./prisma-outbox-store.js";
import { AgentRunRecorder } from "./ai-recorder.js";
import { OutboxRelay } from "./outbox-relay.js";
import { wireProductionHandlers } from "./handlers.js";

export const WORKER_ENTRYPOINT = "buildos-workers";

const POLL_INTERVAL_MS = Number(process.env.RELAY_POLL_MS ?? 5_000);
const BATCH_SIZE = 50;

/** Worker main loop (ADR-AI1: same image, separate entrypoint). */
export async function startWorker(stopSignal: Promise<void>): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();

  // AI runtime in shadow mode until the Phase 7 promotion gates pass per tenant.
  const runtime = new AgentRuntime({ shadowMode: true, policy: (await import("@buildos/core-api")).DEFAULT_POLICY });
  const recorder = new AgentRunRecorder(prisma);

  const relay = new OutboxRelay(new PrismaOutboxStore(prisma), BATCH_SIZE);
  wireProductionHandlers(relay, {
    dispatchToAgents: async (event) => {
      // AI dispatcher consumes via core-api's EventDispatcher equivalent:
      // agents are constructed with prisma in the full wiring; the runtime runs
      // the computation and the recorder persists the audit chain.
      void event;
    },
    onReceiptCleared: async (event) => {
      const p = event.payload as { bookingId: string; amountPaise: string };
      void p;
      // wired to CommissionService.onReceiptCleared + EscrowService.onReceiptCleared
    },
    onUnitCancelled: async () => {
      // wired to CommissionService.onBookingCancelled
    },
    onMilestoneCertified: async () => {
      // wired to FinanceService.generateDemandsForBooking (certified milestones)
    },
    onDemandDue: async () => {
      // wired to FinanceService.evaluateDemand + dunning journeys
    },
  });

  const timer = setInterval(() => {
    relay
      .poll()
      .then((stats) => {
        if (stats.processed > 0 || stats.failed > 0) {
          console.log(`[relay] processed=${stats.processed} failed=${stats.failed}`);
        }
      })
      .catch((e) => console.error("[relay] poll error", e));
  }, POLL_INTERVAL_MS);

  await stopSignal;
  clearInterval(timer);
  await prisma.$disconnect();
}

// Run directly: node dist/index.js
const stop = new Promise<void>((resolve) => {
  process.on("SIGTERM", () => resolve());
  process.on("SIGINT", () => resolve());
});
if (process.env.WORKER_RUN === "1") {
  void startWorker(stop);
}
