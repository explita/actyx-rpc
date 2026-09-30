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

import { useInfiniteQuery } from "../../packages/react/src/index.js";

declare const procWithInput: (
  input: { id: string; cursor?: number },
  extra: number,
) => Promise<
  SrvQueryResult<
    { data: string[]; hasMore: boolean },
    { id: string; cursor?: number },
    [extra: number]
  >
>;

// Should succeed:
useInfiniteQuery(procWithInput, { input: { id: "hello" } }, 42);

// @ts-expect-error - input id must be string, not number
useInfiniteQuery(procWithInput, { input: { id: 123 } }, 42);

// @ts-expect-error - missing extra argument 42
useInfiniteQuery(procWithInput, { input: { id: "hello" } });

// @ts-expect-error - wrong extra argument type
useInfiniteQuery(procWithInput, { input: { id: "hello" } }, "not a number");

declare const procNoInput: (
  extra: number,
) => Promise<SrvQueryResult<{ data: string[]; hasMore: boolean }>>;

// Should succeed:
useInfiniteQuery(procNoInput, {}, 42);

// @ts-expect-error - missing required extra argument 42
useInfiniteQuery(procNoInput, {});

// @ts-expect-error - wrong extra argument type
useInfiniteQuery(procNoInput, {}, "not a number");

declare const procNoInputObj: (
  filter: { category: string; limit?: number },
) => Promise<SrvQueryResult<{ data: string[]; hasMore: boolean }>>;

// Should succeed with trailing args:
useInfiniteQuery(procNoInputObj, {}, { category: "news" });

// @ts-expect-error - missing required category in trailing arg
useInfiniteQuery(procNoInputObj, {}, { limit: 10 });

// @ts-expect-error - missing required filter trailing argument
useInfiniteQuery(procNoInputObj, {});

// @ts-expect-error - opts.input is NOT allowed when procedure has no schema
useInfiniteQuery(procNoInputObj, { input: { category: "news" } });

import { usePaginatedQuery } from "../../packages/react/src/index.js";

// Should succeed:
usePaginatedQuery(procWithInput, { input: { id: "hello" } }, 42);
usePaginatedQuery(procNoInput, {}, 42);
usePaginatedQuery(procNoInputObj, {}, { category: "news" });

// @ts-expect-error - opts.input is NOT allowed when procedure has no schema
usePaginatedQuery(procNoInputObj, { input: { category: "news" } });

// @ts-expect-error - missing required extra argument
usePaginatedQuery(procNoInput, {});

// @ts-expect-error - missing required category in trailing arg
usePaginatedQuery(procNoInputObj, {}, { limit: 10 });

// MutationCall test
import type { MutationCall } from "../../packages/react/src/types/client.js";
declare const mutationProc: MutationCall<{ text: string }, { id: string; text: string }>;
const mutationHook = mutationProc.useMutation();
// mutate should accept (input: { text: string }) and return Promise<MutationResult<{ id: string; text: string }, { text: string }, []>>
type MutateFn = typeof mutationHook.mutate;
type ExpectedMutateFn = (input: { text: string }) => Promise<MutationResult<{ id: string; text: string }, { text: string }, []>>;
const _testMutateFn: ExpectedMutateFn = mutationHook.mutate;

// useSSEInfiniteQuery & useWSInfiniteQuery tests
import { useSSEInfiniteQuery, useWSInfiniteQuery } from "../../packages/react/src/index.js";

// Should succeed:
useSSEInfiniteQuery(procWithInput, { url: "/sse", queryOpts: { input: { id: "hello" } } }, 42);
useSSEInfiniteQuery(procNoInput, { url: "/sse" }, 42);
useSSEInfiniteQuery(procNoInputObj, { url: "/sse" }, { category: "news" });

useWSInfiniteQuery(procWithInput, { url: "/ws", queryOpts: { input: { id: "hello" } } }, 42);
useWSInfiniteQuery(procNoInput, { url: "/ws" }, 42);
useWSInfiniteQuery(procNoInputObj, { url: "/ws" }, { category: "news" });

// @ts-expect-error - missing required queryOpts.input when schema is provided
useSSEInfiniteQuery(procWithInput, { url: "/sse" }, 42);

// @ts-expect-error - queryOpts.input is NOT allowed when procedure has no schema
useSSEInfiniteQuery(procNoInputObj, { url: "/sse", queryOpts: { input: { category: "news" } } }, { category: "news" });

// @ts-expect-error - missing required extra argument 42
useSSEInfiniteQuery(procWithInput, { url: "/sse", queryOpts: { input: { id: "hello" } } });

// @ts-expect-error - missing required queryOpts.input when schema is provided
useWSInfiniteQuery(procWithInput, { url: "/ws" }, 42);

// @ts-expect-error - queryOpts.input is NOT allowed when procedure has no schema
useWSInfiniteQuery(procNoInputObj, { url: "/ws", queryOpts: { input: { category: "news" } } }, { category: "news" });

// @ts-expect-error - missing required extra argument 42
useWSInfiniteQuery(procWithInput, { url: "/ws", queryOpts: { input: { id: "hello" } } });

declare const procCursorOnly: (
  props: { cursor: number },
) => Promise<
  SrvQueryResult<
    { data: string[]; hasMore: boolean },
    undefined,
    [props: { cursor: number }]
  >
>;

// Should succeed without passing cursor prop manually, and with destructured onData:
useSSEInfiniteQuery(procCursorOnly, {
  url: "/sse",
  queryOpts: { onSuccess(data) {} },
  enabled: true,
  onData: ({
    data,
    allData,
    event,
    prepend,
  }: {
    data: any;
    allData: any;
    event: any;
    prepend: any;
  }) => {},
});

useInfiniteQuery(procCursorOnly, {});
usePaginatedQuery(procCursorOnly, {});
useWSInfiniteQuery(procCursorOnly, { url: "/ws" });

console.log("Type checks passed!");


