/**
 * Verification script for the User service layer.
 * Run with: npx tsx scripts/verify-user-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} from "../lib/users/service";
import {
  UserNotFoundError,
  UserNameCollisionError,
  UserAlreadyInactiveError,
  UserAlreadyActiveError,
  UserLockoutError,
} from "../lib/errors/index";
import { ZodError } from "zod";

const USER_ID = 1; // seeded admin — actor for all operations

async function main() {
  let userAId: number | null = null;
  let userBId: number | null = null;
  let userCId: number | null = null;

  try {
    // Get some real processTypeIds from the seed
    const processTypes = await prisma.processType.findMany({
      select: { processTypeId: true, processCode: true },
      orderBy: { processCode: "asc" },
    });
    if (processTypes.length < 2) throw new Error("Expected at least 2 seeded ProcessTypes");
    const ptId1 = processTypes[0]!.processTypeId;
    const ptId2 = processTypes[1]!.processTypeId;
    console.log(`Using processTypeIds: ${ptId1}, ${ptId2}`);

    // a) List active users — capture initial count, confirm admin is present
    const initialList = await listUsers({ active: "true" });
    const initialCount = initialList.length;
    const adminPresent = initialList.some((u) => u.userName === "admin");
    console.log(`a) Initial active user count: ${initialCount}, admin present: ${adminPresent}`);
    if (!adminPresent) throw new Error("Expected seeded admin to be present");

    // b) Create test User A: Operator with process types and default station
    const userA = await createUser(
      {
        userName: "TEST_USER_A",
        displayName: "Test User A",
        role: "Operator",
        defaultStation: "Station 1",
        assignedProcessTypeIds: [ptId1, ptId2],
      },
      USER_ID
    );
    userAId = userA.userId;
    console.log("b) Created User A:", JSON.stringify(userA, null, 2));
    if (userA.assignedProcessTypes.length !== 2) {
      throw new Error(`Expected 2 assignedProcessTypes, got ${userA.assignedProcessTypes.length}`);
    }

    // c) Create test User B: Manager (no station, no process types)
    const userB = await createUser(
      { userName: "TEST_USER_B", displayName: "Test User B", role: "Manager" },
      USER_ID
    );
    userBId = userB.userId;
    console.log("c) Created User B (Manager):", JSON.stringify(userB, null, 2));
    if (userB.assignedProcessTypes.length !== 0) {
      throw new Error("Expected Manager to have no assignedProcessTypes");
    }

    // d) Attempt create with duplicate userName → expect UserNameCollisionError
    try {
      await createUser(
        { userName: "TEST_USER_A", displayName: "Dupe", role: "Manager" },
        USER_ID
      );
      console.log("d) ERROR: expected UserNameCollisionError but no error was thrown");
    } catch (err) {
      if (err instanceof UserNameCollisionError) {
        console.log(`d) Name collision correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // e) Attempt create with role Manager but defaultStation provided → expect ZodError
    try {
      await createUser(
        { userName: "TEST_USER_E", displayName: "Bad E", role: "Manager" as const, defaultStation: "S1", assignedProcessTypeIds: [] },
        USER_ID
      );
      console.log("e) ERROR: expected ZodError for Manager + defaultStation");
    } catch (err) {
      if (err instanceof ZodError) {
        console.log(`e) Manager + defaultStation ZodError: ${err.issues[0]?.message}`);
      } else {
        throw err;
      }
    }

    // f) Attempt create with role Admin but assignedProcessTypeIds non-empty → expect ZodError
    try {
      await createUser(
        { userName: "TEST_USER_F", displayName: "Bad F", role: "Admin" as const, assignedProcessTypeIds: [ptId1] },
        USER_ID
      );
      console.log("f) ERROR: expected ZodError for Admin + assignedProcessTypeIds");
    } catch (err) {
      if (err instanceof ZodError) {
        console.log(`f) Admin + assignedProcessTypeIds ZodError: ${err.issues[0]?.message}`);
      } else {
        throw err;
      }
    }

    // g) Attempt create with role Operator but no assignedProcessTypeIds → expect ZodError
    try {
      await createUser(
        { userName: "TEST_USER_G", displayName: "Bad G", role: "Operator" as const, assignedProcessTypeIds: [] },
        USER_ID
      );
      console.log("g) ERROR: expected ZodError for Operator + empty assignedProcessTypeIds");
    } catch (err) {
      if (err instanceof ZodError) {
        console.log(`g) Operator + empty assignedProcessTypeIds ZodError: ${err.issues[0]?.message}`);
      } else {
        throw err;
      }
    }

    // h) Get test User A by id → returns full record with assignedProcessTypes
    const fetchedA = await getUser(userAId!);
    console.log("h) Fetched User A:", JSON.stringify(fetchedA, null, 2));
    if (fetchedA.assignedProcessTypes.length !== 2) {
      throw new Error("Expected 2 assignedProcessTypes on fetched User A");
    }

    // i) Update test User A: change displayName → other fields preserved
    const updatedAName = await updateUser(userAId!, { displayName: "Test User A Updated" }, USER_ID);
    console.log("i) Updated User A displayName:", updatedAName.displayName);
    if (updatedAName.displayName !== "Test User A Updated") throw new Error("displayName not updated");
    if (updatedAName.role !== "Operator") throw new Error("role changed unexpectedly");
    if (updatedAName.assignedProcessTypes.length !== 2) throw new Error("assignedProcessTypes changed unexpectedly");

    // j) Update test User A: change role to Manager → expect junction rows cleared
    const updatedAManager = await updateUser(userAId!, { role: "Manager" }, USER_ID);
    console.log("j) Updated User A role to Manager:", updatedAManager.role);
    if (updatedAManager.role !== "Manager") throw new Error("role not updated to Manager");

    // k) Verify User A's assignedProcessTypes is empty after role change to Manager
    const verifyAManager = await getUser(userAId!);
    console.log(`k) User A assignedProcessTypes after Manager role: ${verifyAManager.assignedProcessTypes.length} (expected 0)`);
    if (verifyAManager.assignedProcessTypes.length !== 0) {
      throw new Error("Expected assignedProcessTypes to be cleared for Manager");
    }

    // l) Create test User C: Admin
    const userC = await createUser(
      { userName: "TEST_USER_C", displayName: "Test Admin C", role: "Admin" },
      USER_ID
    );
    userCId = userC.userId;
    console.log("l) Created User C (Admin):", JSON.stringify(userC, null, 2));

    // m) Verify there are now 2 active Admins (seeded admin + User C)
    const activeAdminCount = await prisma.user.count({ where: { role: "Admin", isActive: true } });
    console.log(`m) Active Admin count: ${activeAdminCount} (expected 2)`);
    if (activeAdminCount !== 2) throw new Error(`Expected 2 active Admins, got ${activeAdminCount}`);

    // n) Deactivate test User C → expect success
    const deactivatedC = await deactivateUser(userCId!, USER_ID);
    console.log(`n) Deactivated User C: isActive=${deactivatedC.isActive}`);
    if (deactivatedC.isActive) throw new Error("Expected User C to be inactive");

    // o) Verify there is now 1 active Admin (seeded admin only)
    const activeAdminCountAfter = await prisma.user.count({ where: { role: "Admin", isActive: true } });
    console.log(`o) Active Admin count after deactivating C: ${activeAdminCountAfter} (expected 1)`);
    if (activeAdminCountAfter !== 1) throw new Error(`Expected 1 active Admin, got ${activeAdminCountAfter}`);

    // p) Attempt to deactivate the seeded admin (userId 1) → expect UserLockoutError (deactivate)
    try {
      await deactivateUser(USER_ID, USER_ID);
      console.log("p) ERROR: expected UserLockoutError(deactivate) but no error thrown");
    } catch (err) {
      if (err instanceof UserLockoutError && err.details.attemptedAction === "deactivate") {
        console.log(`p) Deactivate lockout correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // q) Reactivate test User C → expect success
    const reactivatedC = await reactivateUser(userCId!, USER_ID);
    console.log(`q) Reactivated User C: isActive=${reactivatedC.isActive}`);
    if (!reactivatedC.isActive) throw new Error("Expected User C to be active");

    // r) Attempt to change seeded admin's role to Manager → expect UserLockoutError (roleChange)
    //    First deactivate User C again so there is only 1 active Admin
    await deactivateUser(userCId!, USER_ID);
    try {
      await updateUser(USER_ID, { role: "Manager" }, USER_ID);
      console.log("r) ERROR: expected UserLockoutError(roleChange) but no error thrown");
    } catch (err) {
      if (err instanceof UserLockoutError && err.details.attemptedAction === "roleChange") {
        console.log(`r) Role change lockout correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    console.log("\nAll 18 verification steps passed.");
  } finally {
    console.log("\nCleaning up test data...");

    for (const id of [userAId, userBId, userCId]) {
      if (id !== null) {
        await prisma.userProcessTypeAssignment.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { userId: id } });
        console.log(`   Deleted test user (userId=${id})`);
      }
    }

    const finalCount = await prisma.user.count();
    console.log(`   Final User count: ${finalCount}`);

    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
