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

// Test: InputParams in form mode with Date check and recursive mapping
import { InputParams } from "../src/types/misc.js";

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
  updatedAt: 1234567890,   // Date | undefined maps to unknown, so number/undefined is accepted
  nested: {
    time: new Date(),      // Nested objects are recursively mapped
    flag: "yes",           // Primitive leaf values are relaxed to unknown
  }
};

// @ts-expect-error - nested must still match the object structure
const invalidFormInput: FormInput = {
  nested: "not-an-object"
};

console.log("Type checks passed!");
