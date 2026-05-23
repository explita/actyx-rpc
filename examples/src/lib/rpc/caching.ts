"use server";

import { procedure } from "./init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";

// Mock database
let userProfile = {
  id: "user-42",
  name: "Jane Doe",
  role: "Engineer",
  lastUpdated: new Date().toISOString(),
};

export const getUserProfile = procedure
  .cache({
    ttl: 30000, // 30 seconds
    key: () => "userProfile", // fixed key for this demo
  })
  .query(async () => {
    // Artificial delay to simulate DB load
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return userProfile;
  });

export const updateUserProfile = procedure
  .input(
    zodResolver(
      z.object({
        name: z.string().min(2),
        role: z.string().min(2),
      })
    )
  )
  .invalidate({ keys: ["userProfile"] }) // Invalidate cache after mutation
  .mutation(async ({ input }) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    userProfile = {
      ...userProfile,
      name: input.name,
      role: input.role,
      lastUpdated: new Date().toISOString(),
    };
    
    return userProfile;
  });

// Resilience Demo
let failureCount = 0;

export const getFlakyData = procedure
  .retry({
    attempts: 4,
    backoff: "exponential",
    initialDelay: 500,
  })
  .query(async () => {
    failureCount++;
    // Simulate a flaky network that fails 3 times before succeeding
    if (failureCount < 3) {
      console.log(`[getFlakyData] Network failure (attempt ${failureCount})`);
      throw new Error("Simulated network failure");
    }
    
    // Reset for next test
    failureCount = 0;
    
    return {
      success: true,
      data: "This data finally loaded after multiple automatic retries!",
      timestamp: new Date().toISOString()
    };
  });

export const getServerStatus = procedure
  .cache({
    ttl: 10000, // 10 seconds
    key: () => "serverStatus",
  })
  .query(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      status: "Healthy",
      uptime: "99.99%",
      region: "us-east-1",
      checkedAt: new Date().toISOString(),
    };
  });

