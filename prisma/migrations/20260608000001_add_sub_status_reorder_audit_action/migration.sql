INSERT INTO "AuditAction" ("actionName", "category", "description")
VALUES ('ProcessTypeSubStatusesReordered', 'Configuration', 'ProcessTypeSubStatus displayOrder values updated via drag-to-reorder')
ON CONFLICT ("actionName") DO NOTHING;
