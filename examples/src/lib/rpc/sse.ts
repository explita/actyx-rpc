import { procedure } from "./init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";

export const watchStock = procedure
  .input(
    zodResolver(
      z.object({
        symbol: z.string(),
      })
    )
  )
  .sse(async function* ({ input }) {
    let price = 150.0; // Base price for AAPL simulation
    
    // Simulate stock price changes over time
    while (true) {
      // Send the current price
      yield {
        event: "price-update",
        data: {
          symbol: input.symbol,
          price: parseFloat(price.toFixed(2)),
          at: new Date().toISOString(),
        },
      };

      // Wait between 1 and 3 seconds before next update
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise((r) => setTimeout(r, delay));

      // Random price walk
      const change = (Math.random() - 0.5) * 5; // Change between -2.5 and +2.5
      price = Math.max(1, price + change); // Never go below 1
    }
  });
