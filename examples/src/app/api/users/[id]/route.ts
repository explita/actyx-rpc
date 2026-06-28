import { procedure, procedure2 } from "@/lib/rpc/init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createRouteHandler } from "@/dist/adapters/next";
import { redirect } from "next/navigation";

// A mock user database
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

const mockUsers: Record<string, User> = {
  "123": {
    id: "123",
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "admin",
  },
  "456": {
    id: "456",
    name: "Bob Smith",
    email: "bob@example.com",
    role: "user",
  },
};

/**
 * GET /api/users/[id]?fields=name,email
 *
 * Demonstrates:
 * 1. Merging dynamic route parameters ([id]) and query search parameters (?fields=...)
 * 2. Return of a custom NextResponse/Response for HTTP control (e.g. 404 Not Found)
 * 3. Automatic success response wrapping for returned plain JS objects.
 */
export const GET = createRouteHandler(
  procedure
    .input(
      zodResolver(
        z.object({
          id: z.string(),
          fields: z.string().optional(),
        }),
      ),
    )
    .webRoute(async ({ ctx, input }, req, context) => {
      // console.log("Actyx RPC GET nextRoute executed. Procedure context:", ctx);
      // console.log({ req, context, input });
      const user = mockUsers[input.id];
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (input.fields) {
        const allowedFields = input.fields.split(",");
        const filteredUser: any = {};
        allowedFields.forEach((field) => {
          if (field in user) {
            filteredUser[field] = user[field as keyof User];
          }
        });
        return NextResponse.json(filteredUser);
      }

      return NextResponse.json(user);
    }),
);

/**
 * POST /api/users/[id]
 *
 * Demonstrates:
 * 1. Merging dynamic route parameters ([id]) with JSON body properties ({ name, email })
 * 2. Automatic schema validation for both path and body properties.
 */

export const POST = createRouteHandler(
  procedure
    .input(
      zodResolver(
        z.object({
          id: z.string(),
          name: z.string().min(2).optional(),
          email: z.email().optional(),
          fields: z.string().optional(),
          // file: z.instanceof(File).check((ctx) => {
          //   if (ctx.value.size <= 0) {
          //     ctx.issues.push({
          //       code: "custom",
          //       message: "File size must be greater than 0",
          //       path: ["file"],
          //       input: ctx.value,
          //     });
          //   }
          // }),
        }),
      ),
    )
    .use(({ input, next, ctx }, req, context) => {
      console.log("mw", req, context);
      return next({ item: "from middleware" });
    })
    .webRoute(async ({ ctx, input }, req, context) => {
      // console.log("Actyx RPC POST nextRoute executed. Procedure context:", ctx);
      // console.log({ req, context, input });
      // console.log(await req.json());
      // console.log(await context.params);

      const user = mockUsers[input.id];
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      if (input.name) user.name = input.name;
      if (input.email) user.email = input.email;

      return NextResponse.json({ success: true, user });
    }),
);
