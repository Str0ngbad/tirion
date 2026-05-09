# Tirion — Routing Template Editor Spec

## Purpose

The Routing Template Editor is a minimal configuration view for creating and managing
named routing presets. Templates are the source of truth for how parts are produced.
Parts reference templates; Work Orders are generated from them as snapshots at
Project compilation time.

This is a low-traffic, high-consequence view. Users visit it to define a new template
or make a deliberate change to an existing one. It is not a day-to-day operational view.

---

## Template Library

The main view is a simple list of all routing templates.

Each row shows:
- Template Name
- Description
- Step count
- Step sequence (compact process type pills — one per step, ProcessType color)
- Parts using this template (count)
- Active toggle

Default sort: Template Name alphabetical.
Filter: Active / Inactive / All (default: Active).

**Design note:** Template names should be descriptive enough to be self-explanatory
in a dropdown. Examples: "Machined Part", "Machined + Blackened Part",
"Welded Assembly", "Painted Bracket", "Purchased Finished Component",
"3D Printed Part." These are the options a user sees when assigning routing
to a part — the name must communicate the sequence without requiring the
user to open the form.

---

## Creating a New Template

Triggered by "Add Template" button. Opens the Template Form in create mode.

**Required fields:**
- Template Name (must be unique)

**Optional:**
- Description

**Steps section:**
- Add steps via ProcessType dropdown (searchable)
- Steps display in order with step number and process type pill
- Reorder via drag or up/down controls
- Remove step via delete control

**Validation:**
- Template Name must be unique — inline error if duplicate detected before save
- No validation on process type combinations at creation time — the constraint
  (no Purchase/Receive steps on Assembly parts) is enforced at part assignment
  time, not template creation time
- No hard step count limit. The color-coding visual system supports approximately
  8 ProcessTypes effectively — beyond that, color differentiation becomes
  unreliable. This is a design constraint, not a system limit.

On save: template created, appears in library, available for part assignment.

---

## Editing an Existing Template

Clicking a template row opens the Template Form in edit mode.

**Before the form opens — Edit-Time Dialog (Definition Change Flag System):**

If the template is referenced by Parts (always the case for active templates) or
has open Work Orders that would be affected, an acknowledgment dialog appears
before opening the form. This is the Routing Template Editor surface of the
Definition Change Flag system (see `definition_change_flag_spec.md`).

The dialog shows:

**Header:** "This change has downstream impact"

**Section 1 — Definition References:**
- "[Template Name] is assigned to [N] Parts"
- Expandable list of Parts using this template

**Section 2 — WIP Impact** (shown when open WOs reference this template):
- "[N] open Work Orders will be flagged for review"
- Expandable list with WO ID, Project + Top-Level Reference, Part Number,
  current step, status
- Batched WOs indicate batch context

**Section 3 — Stock Impact** (shown when affected Parts have stock > 0):
- Aggregate stock counts across affected Parts
- Reminder: existing stock may need review for conformity

**Buttons:** Confirm Change / Cancel

The dialog has no "apply to WIP" option. The user's only choices are confirm
(saves the change, creates flags for affected open WOs) or cancel (discards
the change entirely).

If confirmed: form opens, all fields editable.

### What Can Be Edited

- Template Name
- Description
- Steps (add, remove, reorder)

### What Cannot Be Edited

Nothing is technically locked — the dialog communicates the weight of the
change before the user proceeds. This friction is intentional.

### On Save

Atomic transaction:
1. Template updated
2. AuditLog entry written for the underlying change
3. One flag created per open Work Order that references this template
4. For batched WOs: batch flag created and member flags reference it
5. All Parts referencing this template now show the updated step sequence in
   their Part Form view
6. Future Work Orders generated from these Parts use the new sequence
7. Existing open Work Orders are NOT modified (Principle 10) — they retain
   their snapshot routing until manager resolves their flags
8. Toast: "Template saved. [N] WOs flagged for review."

### Hard Rules

- **RTE-DCF-1:** No Routing Template change silently affects open Work Orders
  generated from this template. The user must always acknowledge the impact
  before saving.
- **RTE-DCF-2:** Template changes do not modify WorkOrderStep records on existing
  open WOs. Step state and structure are preserved per Principle 10. Only flags
  are created.
- **RTE-DCF-3:** Accept Change resolution on a Routing Template flag is the only
  mechanism by which an existing WO's steps can be regenerated from the new
  template. See `definition_change_flag_spec.md` for the regeneration workflow.

---

## Retiring a Template (Soft Delete)

Toggling `isActive = false` on a template retires it. Retirement is a
high-consequence action and requires the same confirmation screen as editing.

**Before retiring — confirmation screen showing:**
- Template name
- Number of parts currently referencing this template
- Number of open Work Orders on parts that use this template
- Statement: "Retiring this template will prevent new Work Orders from being
  generated for parts that reference it. Existing open Work Orders are not
  affected. Parts referencing this template must be assigned a new active
  template before new Work Orders can be compiled."
- Confirm / Cancel

**After retiring:**
- Retired templates are hidden from the part assignment dropdown
- Parts currently referencing a retired template retain the reference —
  their existing open Work Orders continue unaffected (Principle 10)
- New WO generation (Project compilation) for parts referencing a retired
  template is blocked at compilation time — see Project Compilation Gate below
- Retired templates remain visible in the template library under the
  Inactive filter and can be reactivated

---

## Project Compilation Gate

Before generating Work Orders from a Project, the system validates every Part
in the BOM tree. Compilation is blocked entirely if any Part fails validation.
No partial WO trees are created.

**Validation checks at compilation:**
- Every Part has an assigned Routing Template
- Every assigned Routing Template is active (not retired)

**Error behavior:** The compilation attempt is cancelled. The user sees a
pre-compilation error screen listing every Part that failed validation and
the reason (no template assigned / template retired). No Work Orders are
created until all failures are resolved.

**Hard rule:** Project compilation is all-or-nothing. A partial WO tree is
never created under any circumstances.

Full workflow spec for Project Creation and WO generation is a separate view
spec to be written in Stage 5. See OQ-015.

---

## Part Assignment (in Part Form)

Templates are assigned to parts in the Part Form's Routing section, not here.
The Part Form shows:
- Currently assigned template name and step pills (read-only), or
  "No template assigned" if none
- "Change Template" control — searchable dropdown of active templates only
- "View / Edit in Routing Template Editor" link — navigates to this view
  with the current template pre-selected

When a template is assigned to an Assembly part, the system checks whether
the template contains Purchase or Receive steps. If it does, assignment is
blocked with an inline error: "This template includes purchasing steps and
cannot be assigned to an Assembly part."

Changing a Part's assigned template when open WOs exist triggers the
Principle 10 confirmation screen. See Parts Master spec.

---

## Design Notes

- This view deliberately feels deliberate and slightly friction-ful. The
  confirmation screen on edit and retirement is not an obstacle — it is the
  feature. Template changes have broad consequences and users should feel
  that weight.
- The step pills in the template library give users a visual scan of the
  sequence without opening the form. This is the primary navigation aid
  when choosing between similar templates.
- The color-coding visual system for routing step pills supports approximately
  8 ProcessTypes. Adding new ProcessTypes beyond that requires a design
  decision about how to maintain visual clarity.
