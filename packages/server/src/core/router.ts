import type { ProcedureDefinition } from "../types/procedure.js";

export type AnyProcedure =
  | ((...args: any[]) => Promise<any>)
  | ((...args: any[]) => AsyncIterable<any>)
  | ((...args: any[]) => (wsContext: any) => Promise<void>)
  | ProcedureDefinition<any, any, any>
  | {
      _def: {
        type: string;
        [key: string]: any;
      };
    };

export type RouterRecord = {
  [key: string]: AnyProcedure | RouterRecord;
};

export function createRouter<T extends RouterRecord>(procedures: T): T {
  return procedures;
}
