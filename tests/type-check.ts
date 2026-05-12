import { Unwrap } from "../src/react/types.js";

type SuccessResponse = { success: boolean; data: { id: number; name: string } };

// Test: unwrap = true
type Unwrapped = Unwrap<SuccessResponse, true>;
const testUnwrapped: Unwrapped = { id: 1, name: "test" };
// @ts-expect-error - success should not be there
const failUnwrapped: Unwrapped = { success: true, data: { id: 1, name: "test" } };

// Test: unwrap = false (default)
type NotUnwrapped = Unwrap<SuccessResponse, false>;
const testNotUnwrapped: NotUnwrapped = { success: true, data: { id: 1, name: "test" } };
// @ts-expect-error - should expect full object
const failNotUnwrapped: NotUnwrapped = { id: 1, name: "test" };

// Test: unwrap = true on non-standard response
type NonStandard = { other: string };
type UnwrappedNonStandard = Unwrap<NonStandard, true>;
const testNonStandard: UnwrappedNonStandard = { other: "field" };

console.log("Type checks passed!");
