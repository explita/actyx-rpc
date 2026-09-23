import { Unwrap } from "../../packages/react/src/types/main.js";

type SuccessResponse = { success: boolean; data: { id: number; name: string } };

// Test: unwrap = true
type Unwrapped = Unwrap<SuccessResponse, true>;
const testUnwrapped: Unwrapped = { id: 1, name: "test" };
// @ts-expect-error - success should not be there
const failUnwrapped: Unwrapped = {
  success: true,
  data: { id: 1, name: "test" },
};

// Test: unwrap = false (default)
type NotUnwrapped = Unwrap<SuccessResponse, false>;
const testNotUnwrapped: NotUnwrapped = {
  success: true,
  data: { id: 1, name: "test" },
};
// @ts-expect-error - should expect full object
const failNotUnwrapped: NotUnwrapped = { id: 1, name: "test" };

// Test: unwrap = true on non-standard response
type NonStandard = { other: string };
type UnwrappedNonStandard = Unwrap<NonStandard, true>;
const testNonStandard: UnwrappedNonStandard = { other: "field" };

// Test: InputParams in form mode with Date check and recursive mapping
import { InputParams } from "../../packages/server/src/types/misc.js";

type TestInput = {
  createdAt: Date;
  updatedAt?: Date;
  nested: {
    time: Date;
    flag: boolean;
  };
};

type FormInput = InputParams<TestInput, { mode: "form" }, undefined>;

// Verifies that fields are correctly mapped to unknown/recursive structures
const validFormInput: FormInput = {
  createdAt: "2026-06-12", // Date maps to unknown, so string is accepted
  updatedAt: 1234567890, // Date | undefined maps to unknown, so number/undefined is accepted
  nested: {
    time: new Date(), // Nested objects are recursively mapped
    flag: "yes", // Primitive leaf values are relaxed to unknown
  },
};

// @ts-expect-error - nested must still match the object structure
const invalidFormInput: FormInput = {
  nested: "not-an-object",
};

// Test: QueryResult array helpers conditional presence
import type { QueryResult } from "../../packages/react/src/types/main.js";

declare const arrayQueryResult: QueryResult<
  string[],
  undefined,
  false,
  string[]
>;
arrayQueryResult.prepend("item");
arrayQueryResult.append("item");
arrayQueryResult.insert(0, "item");
arrayQueryResult.remove(0);

declare const objectQueryResult: QueryResult<
  { id: number },
  undefined,
  false,
  { id: number }
>;
// @ts-expect-error - prepend should not exist on non-array QueryResult
objectQueryResult.prepend;
// @ts-expect-error - append should not exist on non-array QueryResult
objectQueryResult.append;
// @ts-expect-error - insert should not exist on non-array QueryResult
objectQueryResult.insert;
// @ts-expect-error - remove should not exist on non-array QueryResult
objectQueryResult.remove;

// Array update: 2-arg targeted update returns () => void (rollback)
const rollbackTargeted: () => void = arrayQueryResult.update(
  (item) => item === "a",
  (item) => item.toUpperCase(),
);
// Array update: 1-arg whole-array update returns string[] | undefined
const wholeUpdated: string[] | undefined = arrayQueryResult.update(["new"]);

// Object update: 1-arg whole-object update works
const objUpdated: { id: number } | undefined = objectQueryResult.update({ id: 2 });
// @ts-expect-error - 2-arg targeted update should NOT exist on non-array QueryResult
objectQueryResult.update(0, { id: 2 });

// Test: ClientInstance procedure without input taking trailing ...args
import { ClientInstance } from "../../packages/react/src/types/client.js";
import { QueryResult as SrvQueryResult } from "../../packages/server/src/types/misc.js";

type TestRouter = {
  list: (name: string) => Promise<SrvQueryResult<{ data: string[]; hasMore: boolean }>>;
};

declare const testClient: ClientInstance<TestRouter>;
testClient.list.useQuery({}, "arg1");
testClient.list.useInfiniteQuery({}, "arg1");
testClient.list.usePaginatedQuery({}, "arg1");
// @ts-expect-error - requires string as trailing arg
testClient.list.useInfiniteQuery({}, 123);

console.log("Type checks passed!");


