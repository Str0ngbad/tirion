/**
 * Verification script for the ProcessTypeSubStatus service layer.
 * Run with: npx tsx scripts/verify-process-type-sub-status-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listProcessTypeSubStatuses,
  getProcessTypeSubStatus,
  createProcessTypeSubStatus,
  updateProcessTypeSubStatus,
  deactivateProcessTypeSubStatus,
  reactivateProcessTypeSubStatus,
} from "../lib/process-type-sub-statuses/service";
import {
  ProcessTypeSubStatusNotFoundError,
  ProcessTypeSubStatusCollisionError,
  ProcessTypeSubStatusAlreadyActiveError,
  ProcessTypeSubStatusAlreadyInactiveError,
  ProcessTypeNotFoundError,
} from "../lib/errors/index";

const USER_ID = 1;

async function main() {
  let subStatusAId: number | null = null;
  let subStatusBId: number | null = null;

  try {
    // a) Query ProcessTypes to get valid processTypeIds
    const processTypes = await prisma.processType.findMany({
      select: { processTypeId: true, processCode: true },
      orderBy: { processCode: "asc" },
    });
    if (processTypes.length < 1) throw new Error("Expected at least 1 seeded ProcessType");
    const TEST_PT_ID = processTypes[0]!.processTypeId;
    console.log(`a) Using processTypeId: ${TEST_PT_ID} (${processTypes[0]!.processCode})`);

    // b) List active sub-statuses for TEST_PT_ID — capture initial count
    const initialList = await listProcessTypeSubStatuses({
      active: "true",
      processTypeId: TEST_PT_ID,
    });
    const initialCount = initialList.length;
    console.log(`b) Initial active sub-status count for processTypeId ${TEST_PT_ID}: ${initialCount}`);

    // c) Create test sub-status A
    const subStatusA = await createProcessTypeSubStatus(
      {
        processTypeId: TEST_PT_ID,
        subStatusName: "TEST_SUB_A",
        description: "Test sub-status alpha",
        displayOrder: 100,
      },
      USER_ID
    );
    subStatusAId = subStatusA.processTypeSubStatusId;
    console.log(`c) Created TEST_SUB_A: id=${subStatusAId}, processCode=${subStatusA.processCode}`);

    // d) Create test sub-status B
    const subStatusB = await createProcessTypeSubStatus(
      {
        processTypeId: TEST_PT_ID,
        subStatusName: "TEST_SUB_B",
        displayOrder: 101,
      },
      USER_ID
    );
    subStatusBId = subStatusB.processTypeSubStatusId;
    console.log(`d) Created TEST_SUB_B: id=${subStatusBId}`);

    // e) Attempt duplicate composite → expect ProcessTypeSubStatusCollisionError
    try {
      await createProcessTypeSubStatus(
        { processTypeId: TEST_PT_ID, subStatusName: "TEST_SUB_A" },
        USER_ID
      );
      throw new Error("Expected ProcessTypeSubStatusCollisionError but none was thrown");
    } catch (err) {
      if (!(err instanceof ProcessTypeSubStatusCollisionError)) throw err;
      console.log(
        `e) Collision correctly thrown: processTypeId=${err.details.processTypeId}, subStatusName=${err.details.subStatusName}`
      );
    }

    // f) Attempt create with nonexistent processTypeId → expect ProcessTypeNotFoundError
    try {
      await createProcessTypeSubStatus(
        { processTypeId: 99999, subStatusName: "TEST_SUB_A" },
        USER_ID
      );
      throw new Error("Expected ProcessTypeNotFoundError but none was thrown");
    } catch (err) {
      if (!(err instanceof ProcessTypeNotFoundError)) throw err;
      console.log(`f) ProcessTypeNotFoundError correctly thrown: processTypeId=${err.details.processTypeId}`);
    }

    // g) List filtered by TEST_PT_ID → count should be initialCount + 2
    const filteredList = await listProcessTypeSubStatuses({
      active: "true",
      processTypeId: TEST_PT_ID,
    });
    const expectedCount = initialCount + 2;
    if (filteredList.length !== expectedCount) {
      throw new Error(`g) Expected ${expectedCount} sub-statuses, got ${filteredList.length}`);
    }
    console.log(`g) Filtered list count: ${filteredList.length} (initial ${initialCount} + 2 test records)`);

    // h) List with no processTypeId filter → should include seeded sub-statuses across all ProcessTypes
    const allList = await listProcessTypeSubStatuses({ active: "true" });
    if (allList.length < filteredList.length) {
      throw new Error("h) Unfiltered list should have at least as many records as filtered list");
    }
    console.log(`h) Unfiltered list count: ${allList.length} (includes all active sub-statuses)`);

    // i) Get test sub-status A by id → returns full record with processCode and processName joined
    const fetched = await getProcessTypeSubStatus(subStatusAId);
    if (!fetched.processCode || !fetched.processName) {
      throw new Error("i) Expected processCode and processName to be joined");
    }
    console.log(`i) Get by id: subStatusName=${fetched.subStatusName}, processCode=${fetched.processCode}, processName=${fetched.processName}`);

    // j) Get id 99999 → expect ProcessTypeSubStatusNotFoundError
    try {
      await getProcessTypeSubStatus(99999);
      throw new Error("Expected ProcessTypeSubStatusNotFoundError but none was thrown");
    } catch (err) {
      if (!(err instanceof ProcessTypeSubStatusNotFoundError)) throw err;
      console.log(`j) ProcessTypeSubStatusNotFoundError correctly thrown: id=${err.details.processTypeSubStatusId}`);
    }

    // k) Update test sub-status A: change displayOrder to 102
    const updated = await updateProcessTypeSubStatus(
      subStatusAId,
      { displayOrder: 102 },
      USER_ID
    );
    if (updated.displayOrder !== 102) throw new Error(`k) Expected displayOrder=102, got ${updated.displayOrder}`);
    console.log(`k) Updated displayOrder to 102`);

    // l) Update test sub-status A's subStatusName to "TEST_SUB_B" → collision
    try {
      await updateProcessTypeSubStatus(subStatusAId, { subStatusName: "TEST_SUB_B" }, USER_ID);
      throw new Error("Expected ProcessTypeSubStatusCollisionError but none was thrown");
    } catch (err) {
      if (!(err instanceof ProcessTypeSubStatusCollisionError)) throw err;
      console.log(`l) Collision correctly thrown on rename to TEST_SUB_B: processTypeId=${err.details.processTypeId}`);
    }

    // m) Update test sub-status A's subStatusName back to "TEST_SUB_A" → success
    const renamedBack = await updateProcessTypeSubStatus(
      subStatusAId,
      { subStatusName: "TEST_SUB_A" },
      USER_ID
    );
    if (renamedBack.subStatusName !== "TEST_SUB_A") {
      throw new Error(`m) Expected subStatusName=TEST_SUB_A, got ${renamedBack.subStatusName}`);
    }
    console.log(`m) Rename back to TEST_SUB_A succeeded`);

    // n) Deactivate test sub-status B
    const deactivated = await deactivateProcessTypeSubStatus(subStatusBId, USER_ID);
    if (deactivated.isActive) throw new Error("n) Expected isActive=false after deactivation");
    console.log(`n) Deactivated TEST_SUB_B`);

    // o) List active filtered by TEST_PT_ID → B excluded
    const activeAfterDeactivate = await listProcessTypeSubStatuses({
      active: "true",
      processTypeId: TEST_PT_ID,
    });
    const bPresent = activeAfterDeactivate.some((s) => s.processTypeSubStatusId === subStatusBId);
    if (bPresent) throw new Error("o) Expected TEST_SUB_B to be excluded from active list");
    console.log(`o) Active list excludes TEST_SUB_B: count=${activeAfterDeactivate.length}`);

    // p) List with active=all → B included
    const allAfterDeactivate = await listProcessTypeSubStatuses({
      active: "all",
      processTypeId: TEST_PT_ID,
    });
    const bIncluded = allAfterDeactivate.some((s) => s.processTypeSubStatusId === subStatusBId);
    if (!bIncluded) throw new Error("p) Expected TEST_SUB_B to be included in active=all list");
    console.log(`p) active=all list includes TEST_SUB_B: count=${allAfterDeactivate.length}`);

    // q) Reactivate test sub-status B
    const reactivated = await reactivateProcessTypeSubStatus(subStatusBId, USER_ID);
    if (!reactivated.isActive) throw new Error("q) Expected isActive=true after reactivation");
    console.log(`q) Reactivated TEST_SUB_B`);

    // r) Attempt to reactivate B again → ProcessTypeSubStatusAlreadyActiveError
    try {
      await reactivateProcessTypeSubStatus(subStatusBId, USER_ID);
      throw new Error("Expected ProcessTypeSubStatusAlreadyActiveError but none was thrown");
    } catch (err) {
      if (!(err instanceof ProcessTypeSubStatusAlreadyActiveError)) throw err;
      console.log(`r) AlreadyActiveError correctly thrown: id=${err.details.processTypeSubStatusId}`);
    }

    console.log("\nAll steps passed.");
  } finally {
    // Cleanup: delete test sub-statuses
    const idsToDelete = [subStatusAId, subStatusBId].filter((id): id is number => id !== null);
    if (idsToDelete.length > 0) {
      await prisma.processTypeSubStatus.deleteMany({
        where: { processTypeSubStatusId: { in: idsToDelete } },
      });
      console.log(`\nCleanup: deleted test sub-statuses ${idsToDelete.join(", ")}`);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
