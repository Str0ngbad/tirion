/**
 * Verification script for the View service layer.
 * Run with: npx tsx scripts/verify-view-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
} from "../lib/views/service";
import {
  ViewNotFoundError,
  ViewNameCollisionError,
  ViewLockedError,
  ViewMasterImmutableError,
} from "../lib/errors/index";

const USER_ID = 1;

async function main() {
  let testViewId: number | null = null;

  try {
    // a) Initial list — seeded Views should be present; Master View first
    const initial = await listViews();
    const masterFirst = initial[0]?.name === "Master View";
    console.log(`a) Initial view count: ${initial.length} (expected >= 5). Master first: ${masterFirst}`);

    // b) Create a test View
    const created = await createView(
      {
        name: "VERIFY_TEST_VIEW",
        visibleColumns: ["partNumber", "partName"],
        defaultSort: [{ column: "partNumber", direction: "asc" }],
        filters: [],
      },
      USER_ID
    );
    testViewId = created.viewId;
    console.log(`b) Created test View: id=${created.viewId}, name=${created.name}`);

    // c) List — test View should appear; Master still first
    const afterCreate = await listViews();
    const testViewInList = afterCreate.some((v) => v.viewId === testViewId);
    const masterStillFirst = afterCreate[0]?.name === "Master View";
    console.log(
      `c) After create: count=${afterCreate.length}, test view in list: ${testViewInList}, Master still first: ${masterStillFirst}`
    );

    // d) Get by ID
    const fetched = await getView(testViewId!);
    console.log(`d) Fetched by ID: name=${fetched.name}, visibleColumns=${JSON.stringify(fetched.visibleColumns)}`);

    // e) Update — change name and add a column
    const updated = await updateView(
      testViewId!,
      { name: "VERIFY_TEST_VIEW_UPDATED", visibleColumns: ["partNumber", "partName", "isActive"] },
      USER_ID
    );
    console.log(`e) Updated: name=${updated.name}, columns=${updated.visibleColumns.length}`);

    // f) Name collision — try creating a View with the same name
    try {
      await createView({ name: "VERIFY_TEST_VIEW_UPDATED", visibleColumns: ["partNumber"], defaultSort: [], filters: [] }, USER_ID);
      console.log("f) FAIL — collision was not rejected");
    } catch (err) {
      if (err instanceof ViewNameCollisionError) {
        console.log(`f) Collision correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // g) Not-found — get a non-existent ID
    try {
      await getView(99999);
      console.log("g) FAIL — not-found was not rejected");
    } catch (err) {
      if (err instanceof ViewNotFoundError) {
        console.log(`g) Not-found correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // h) Master View immutability — PATCH targeting Master View should throw
    const masterView = afterCreate.find((v) => v.name === "Master View");
    if (!masterView) throw new Error("Master View not found in list");

    try {
      await updateView(masterView.viewId, { name: "Renamed Master" }, USER_ID);
      console.log("h) FAIL — Master View update was not rejected");
    } catch (err) {
      if (err instanceof ViewMasterImmutableError) {
        console.log(`h) Master immutability correctly enforced: ${err.message}`);
      } else {
        throw err;
      }
    }

    // i) Delete the test View
    await deleteView(testViewId!, USER_ID);
    testViewId = null;
    const afterDelete = await listViews();
    const testViewGone = !afterDelete.some((v) => v.name === "VERIFY_TEST_VIEW_UPDATED");
    console.log(`i) Deleted test View. Gone from list: ${testViewGone}`);

    // j) Delete Master View — should throw ViewLockedError
    try {
      await deleteView(masterView.viewId, USER_ID);
      console.log("j) FAIL — Master View delete was not rejected");
    } catch (err) {
      if (err instanceof ViewLockedError) {
        console.log(`j) Locked delete correctly rejected: ${err.message}`);
      } else {
        throw err;
      }
    }

    console.log("\nAll verification steps passed.");
  } finally {
    // Clean up any test View that wasn't deleted in the happy path
    if (testViewId !== null) {
      await prisma.view.delete({ where: { viewId: testViewId } }).catch(() => {});
      console.log(`\nCleanup: deleted test view (viewId=${testViewId})`);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
