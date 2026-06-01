/**
 * Verification script for the RoutingTemplate service layer.
 * Run with: npx tsx scripts/verify-routing-template-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listRoutingTemplates,
  getRoutingTemplate,
  createRoutingTemplate,
  updateRoutingTemplate,
  deactivateRoutingTemplate,
  reactivateRoutingTemplate,
} from "../lib/routing-templates/service";
import { CreateRoutingTemplateSchema } from "../lib/routing-templates/schemas";
import {
  RoutingTemplateNotFoundError,
  RoutingTemplateNameCollisionError,
  RoutingTemplateAlreadyActiveError,
  RoutingTemplateAlreadyInactiveError,
  RoutingTemplateStepIndexError,
  RoutingTemplateInvalidProcessTypeError,
} from "../lib/errors/index";

const USER_ID = 1;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function assertThrows<E>(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: never[]) => E,
  label: string
): Promise<E> {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name} but no error was thrown — ${label}`);
  } catch (err) {
    if (err instanceof ErrorClass) return err;
    throw err;
  }
}

async function main() {
  let templateAId: number | null = null;
  let templateBId: number | null = null;

  try {
    // ── Seed lookup: grab real processTypeIds ─────────────────────────────────
    const machineType = await prisma.processType.findUniqueOrThrow({ where: { processCode: "MACHINE" } });
    const weldType = await prisma.processType.findUniqueOrThrow({ where: { processCode: "WELD" } });
    const paintType = await prisma.processType.findUniqueOrThrow({ where: { processCode: "PAINT" } });
    const inactivePt = await prisma.processType.findFirst({ where: { isActive: false } });

    // ── 1. Create with 3 valid steps ──────────────────────────────────────────
    const saveA = await createRoutingTemplate(
      {
        templateName: "__verify_template_A__",
        description: "Test template A",
        steps: [
          { stepIndex: 1, processTypeId: machineType.processTypeId },
          { stepIndex: 2, processTypeId: weldType.processTypeId },
          { stepIndex: 3, processTypeId: paintType.processTypeId },
        ],
      },
      USER_ID
    );
    templateAId = saveA.template.routingTemplateDefinitionId;
    assert(saveA.template.templateName === "__verify_template_A__", "1: templateName");
    assert(saveA.template.steps.length === 3, "1: stepCount");
    assert(saveA.template.steps[0]!.stepIndex === 1, "1: step 1 index");
    assert(saveA.template.steps[1]!.stepIndex === 2, "1: step 2 index");
    assert(saveA.template.steps[2]!.stepIndex === 3, "1: step 3 index");
    assert(saveA.flaggedWoCount === 0, "1: flaggedWoCount");
    console.log("1) Create 3-step template: PASS");

    // ── 2. Zod rejects steps: [] ──────────────────────────────────────────────
    const zodResult = CreateRoutingTemplateSchema.safeParse({
      templateName: "__verify_zod_empty__",
      steps: [],
    });
    assert(!zodResult.success, "2: empty steps rejected by Zod");
    console.log("2) Zod rejects steps:[]: PASS");

    // ── 3. Gap in stepIndex [1,2,4] → RoutingTemplateStepIndexError ──────────
    await assertThrows(
      () =>
        createRoutingTemplate(
          {
            templateName: "__verify_gap__",
            steps: [
              { stepIndex: 1, processTypeId: machineType.processTypeId },
              { stepIndex: 2, processTypeId: weldType.processTypeId },
              { stepIndex: 4, processTypeId: paintType.processTypeId },
            ],
          },
          USER_ID
        ),
      RoutingTemplateStepIndexError,
      "gap [1,2,4]"
    );
    console.log("3) Gap in stepIndex [1,2,4]: PASS");

    // ── 4. Duplicate stepIndex → RoutingTemplateStepIndexError ───────────────
    await assertThrows(
      () =>
        createRoutingTemplate(
          {
            templateName: "__verify_dup__",
            steps: [
              { stepIndex: 1, processTypeId: machineType.processTypeId },
              { stepIndex: 1, processTypeId: weldType.processTypeId },
            ],
          },
          USER_ID
        ),
      RoutingTemplateStepIndexError,
      "duplicate indices"
    );
    console.log("4) Duplicate stepIndex: PASS");

    // ── 5. Steps starting at 0 → RoutingTemplateStepIndexError ───────────────
    await assertThrows(
      () =>
        createRoutingTemplate(
          {
            templateName: "__verify_zero__",
            steps: [
              { stepIndex: 0, processTypeId: machineType.processTypeId },
              { stepIndex: 1, processTypeId: weldType.processTypeId },
            ],
          },
          USER_ID
        ),
      RoutingTemplateStepIndexError,
      "zero-start indices"
    );
    console.log("5) stepIndex starting at 0: PASS");

    // ── 6. Nonexistent processTypeId ──────────────────────────────────────────
    const badId = 999999;
    const err6 = await assertThrows(
      () =>
        createRoutingTemplate(
          { templateName: "__verify_bad_pt__", steps: [{ stepIndex: 1, processTypeId: badId }] },
          USER_ID
        ),
      RoutingTemplateInvalidProcessTypeError,
      "nonexistent processTypeId"
    );
    assert((err6 as RoutingTemplateInvalidProcessTypeError).details.reason === "process_type_not_found", "6: reason");
    console.log("6) Nonexistent processTypeId: PASS");

    // ── 7. Inactive processType ───────────────────────────────────────────────
    if (inactivePt) {
      const err7 = await assertThrows(
        () =>
          createRoutingTemplate(
            { templateName: "__verify_inactive_pt__", steps: [{ stepIndex: 1, processTypeId: inactivePt.processTypeId }] },
            USER_ID
          ),
        RoutingTemplateInvalidProcessTypeError,
        "inactive processType"
      );
      assert((err7 as RoutingTemplateInvalidProcessTypeError).details.reason === "process_type_inactive", "7: reason");
      console.log("7) Inactive processType: PASS");
    } else {
      console.log("7) Inactive processType: SKIP (no inactive ProcessType in DB)");
    }

    // ── 8. Name collision ─────────────────────────────────────────────────────
    await assertThrows(
      () =>
        createRoutingTemplate(
          {
            templateName: "__verify_template_A__",
            steps: [{ stepIndex: 1, processTypeId: machineType.processTypeId }],
          },
          USER_ID
        ),
      RoutingTemplateNameCollisionError,
      "name collision"
    );
    console.log("8) Name collision: PASS");

    // ── 9. Zod rejects >10 steps ──────────────────────────────────────────────
    const zodResult9 = CreateRoutingTemplateSchema.safeParse({
      templateName: "__verify_too_many__",
      steps: Array.from({ length: 11 }, (_, i) => ({ stepIndex: i + 1, processTypeId: machineType.processTypeId })),
    });
    assert(!zodResult9.success, "9: >10 steps rejected by Zod");
    console.log("9) Zod rejects >10 steps: PASS");

    // ── 10. List with active=true ─────────────────────────────────────────────
    const activeList = await listRoutingTemplates({ active: "true" });
    const foundA = activeList.find((t) => t.routingTemplateDefinitionId === templateAId);
    assert(foundA !== undefined, "10: template A in active list");
    assert(foundA!.stepCount === 3, "10: stepCount");
    console.log("10) List active=true: PASS");

    // ── 11. getRoutingTemplate detail ─────────────────────────────────────────
    const detail = await getRoutingTemplate(templateAId!);
    assert(detail.routingTemplateDefinitionId === templateAId, "11: id match");
    assert(detail.openWorkOrderCount === 0, "11: openWorkOrderCount=0");
    assert(detail.steps.length === 3, "11: steps");
    console.log("11) getRoutingTemplate detail: PASS");

    // ── 12. Update template name only ─────────────────────────────────────────
    const saveA2 = await updateRoutingTemplate(
      templateAId!,
      { templateName: "__verify_template_A_renamed__" },
      USER_ID
    );
    assert(saveA2.template.templateName === "__verify_template_A_renamed__", "12: renamed");
    assert(saveA2.template.steps.length === 3, "12: steps preserved");
    assert(saveA2.flaggedWoCount === 0, "12: flaggedWoCount");
    console.log("12) Update name (steps preserved): PASS");

    // ── 13. Update steps array (full replacement) ─────────────────────────────
    const saveA3 = await updateRoutingTemplate(
      templateAId!,
      {
        steps: [
          { stepIndex: 1, processTypeId: machineType.processTypeId },
          { stepIndex: 2, processTypeId: paintType.processTypeId },
        ],
      },
      USER_ID
    );
    assert(saveA3.template.steps.length === 2, "13: new step count");
    assert(saveA3.template.steps[1]!.processTypeId === paintType.processTypeId, "13: new step 2");
    // Verify old step count in DB (old 3 rows deleted)
    const dbSteps = await prisma.routingTemplateStep.findMany({
      where: { routingTemplateDefinitionId: templateAId! },
    });
    assert(dbSteps.length === 2, "13: DB step count");
    console.log("13) Update steps (full replacement): PASS");

    // ── 14. Update with invalid indexing → error, original unchanged ──────────
    const beforeBadUpdate = await getRoutingTemplate(templateAId!);
    await assertThrows(
      () =>
        updateRoutingTemplate(
          templateAId!,
          {
            steps: [
              { stepIndex: 1, processTypeId: machineType.processTypeId },
              { stepIndex: 3, processTypeId: paintType.processTypeId }, // gap
            ],
          },
          USER_ID
        ),
      RoutingTemplateStepIndexError,
      "update with invalid indexing"
    );
    const afterBadUpdate = await getRoutingTemplate(templateAId!);
    assert(afterBadUpdate.steps.length === beforeBadUpdate.steps.length, "14: steps unchanged after rollback");
    console.log("14) Update invalid indexing (rollback): PASS");

    // ── 15. Deactivate ────────────────────────────────────────────────────────
    const deactivated = await deactivateRoutingTemplate(templateAId!, USER_ID);
    assert(!deactivated.isActive, "15: isActive false");
    const auditRetire = await prisma.auditLog.findFirst({
      where: { entityId: templateAId!, entityType: "RoutingTemplate" },
      include: { action: true },
      orderBy: { timestamp: "desc" },
    });
    assert(auditRetire?.action.actionName === "RoutingTemplateRetired", "15: audit action");
    console.log("15) Deactivate: PASS");

    // ── 16. Deactivate again → RoutingTemplateAlreadyInactiveError ────────────
    await assertThrows(
      () => deactivateRoutingTemplate(templateAId!, USER_ID),
      RoutingTemplateAlreadyInactiveError,
      "double deactivate"
    );
    console.log("16) Double deactivate: PASS");

    // ── 17. Reactivate ────────────────────────────────────────────────────────
    const reactivated = await reactivateRoutingTemplate(templateAId!, USER_ID);
    assert(reactivated.isActive, "17: isActive true");
    console.log("17) Reactivate: PASS");

    // ── 18. Reactivate active template → RoutingTemplateAlreadyActiveError ────
    await assertThrows(
      () => reactivateRoutingTemplate(templateAId!, USER_ID),
      RoutingTemplateAlreadyActiveError,
      "double reactivate"
    );
    console.log("18) Double reactivate: PASS");

    // ── 19. SaveResponse on create has flaggedWoCount: 0 ─────────────────────
    const saveB = await createRoutingTemplate(
      {
        templateName: "__verify_template_B__",
        steps: [{ stepIndex: 1, processTypeId: machineType.processTypeId }],
      },
      USER_ID
    );
    templateBId = saveB.template.routingTemplateDefinitionId;
    assert(saveB.flaggedWoCount === 0, "19: flaggedWoCount on create");
    console.log("19) SaveResponse.flaggedWoCount on create: PASS");

    // ── 20. SaveResponse on update has flaggedWoCount: 0 ─────────────────────
    const saveBUpdate = await updateRoutingTemplate(
      templateBId!,
      { templateName: "__verify_template_B_updated__" },
      USER_ID
    );
    assert(saveBUpdate.flaggedWoCount === 0, "20: flaggedWoCount on update");
    console.log("20) SaveResponse.flaggedWoCount on update: PASS");

    console.log("\nAll verification steps passed.");
  } finally {
    // Cleanup: delete test templates
    const ids = [templateAId, templateBId].filter((id): id is number => id !== null);
    if (ids.length > 0) {
      await prisma.routingTemplateStep.deleteMany({
        where: { routingTemplateDefinitionId: { in: ids } },
      });
      await prisma.routingTemplateDefinition.deleteMany({
        where: { routingTemplateDefinitionId: { in: ids } },
      });
      console.log(`Cleanup: deleted ${ids.length} test template(s)`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
