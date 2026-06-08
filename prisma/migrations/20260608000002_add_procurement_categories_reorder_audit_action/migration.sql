INSERT INTO "AuditAction" ("actionName", "category", "description")
VALUES ('ProcurementCategoriesReordered', 'Configuration', 'ProcurementCategory displayOrder values updated via drag-to-reorder')
ON CONFLICT ("actionName") DO NOTHING;
