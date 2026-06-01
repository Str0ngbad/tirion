// Filter object discriminated union — operator is the discriminator.
// Each variant's value shape matches the Filter Operator Inventory in
// spec/parts_master_grid_spec.md "Filter Operator Inventory" section.

// String / URL operators
type FilterContains        = { column: string; operator: "contains";           value: string };
type FilterNotContains     = { column: string; operator: "not_contains";       value: string };
type FilterEquals          = { column: string; operator: "equals";             value: string };
type FilterNotEquals       = { column: string; operator: "not_equals";         value: string };
type FilterStartsWith      = { column: string; operator: "starts_with";        value: string };
type FilterEndsWith        = { column: string; operator: "ends_with";          value: string };
type FilterIsEmpty         = { column: string; operator: "is_empty" };
type FilterIsNotEmpty      = { column: string; operator: "is_not_empty" };

// Numeric operators (int / decimal)
type FilterNumericEquals   = { column: string; operator: "num_equals";         value: number };
type FilterNumericNotEq    = { column: string; operator: "num_not_equals";     value: number };
type FilterGt              = { column: string; operator: "greater_than";       value: number };
type FilterGte             = { column: string; operator: "greater_than_or_eq"; value: number };
type FilterLt              = { column: string; operator: "less_than";          value: number };
type FilterLte             = { column: string; operator: "less_than_or_eq";    value: number };
type FilterBetween         = { column: string; operator: "between";            value: { from: number; to: number } };
type FilterNumericIsEmpty  = { column: string; operator: "num_is_empty" };
type FilterNumericIsNotEmp = { column: string; operator: "num_is_not_empty" };

// Boolean operators
type FilterIsTrue  = { column: string; operator: "is_true" };
type FilterIsFalse = { column: string; operator: "is_false" };

// Categorical (enum / chips) operator
type FilterIsAnyOf = { column: string; operator: "is_any_of"; value: string[] };

// Datetime operators
type FilterDateEquals    = { column: string; operator: "date_equals";    value: string };
type FilterBefore        = { column: string; operator: "before";         value: string };
type FilterAfter         = { column: string; operator: "after";          value: string };
type FilterDateBetween   = { column: string; operator: "date_between";   value: { from: string; to: string } };
type FilterDateIsEmpty   = { column: string; operator: "date_is_empty" };
type FilterDateIsNotEmp  = { column: string; operator: "date_is_not_empty" };

// Routing matrix operator — maps process type ID (string) to constraint state.
// "unconstrained" rows are omitted from the stored value; only active constraints
// are stored to keep the JSON compact.
type RoutingConstraint  = "include" | "exclude";
type FilterRoutingMatrix = {
  column: string;
  operator: "routing_matrix";
  value: Record<string, RoutingConstraint>;
};

export type FilterObject =
  | FilterContains
  | FilterNotContains
  | FilterEquals
  | FilterNotEquals
  | FilterStartsWith
  | FilterEndsWith
  | FilterIsEmpty
  | FilterIsNotEmpty
  | FilterNumericEquals
  | FilterNumericNotEq
  | FilterGt
  | FilterGte
  | FilterLt
  | FilterLte
  | FilterBetween
  | FilterNumericIsEmpty
  | FilterNumericIsNotEmp
  | FilterIsTrue
  | FilterIsFalse
  | FilterIsAnyOf
  | FilterDateEquals
  | FilterBefore
  | FilterAfter
  | FilterDateBetween
  | FilterDateIsEmpty
  | FilterDateIsNotEmp
  | FilterRoutingMatrix;

export type SortSpec = {
  column: string;
  direction: "asc" | "desc";
};

export type ViewRow = {
  viewId: number;
  name: string;
  isDefault: boolean;
  isLocked: boolean;
  visibleColumns: string[];
  defaultSort: SortSpec[];
  filters: FilterObject[];
};

export type CreateViewInput = {
  name: string;
  visibleColumns: string[];
  defaultSort: SortSpec[];
  filters: FilterObject[];
};

export type UpdateViewInput = Partial<CreateViewInput>;
