import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Initialize demo bank accounts for new users
export const initializeDemoAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingAccounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existingAccounts.length > 0) {
      return { message: "Accounts already exist" };
    }

    await ctx.db.insert("bankAccounts", {
      userId,
      accountNumber: `CHK${Math.random().toString().slice(2, 12)}`,
      accountType: "checking",
      balance: 5000.00,
      isActive: true
    });

    await ctx.db.insert("bankAccounts", {
      userId,
      accountNumber: `SAV${Math.random().toString().slice(2, 12)}`,
      accountType: "savings",
      balance: 15000.00,
      isActive: true
    });

    return { message: "Demo accounts created successfully" };
  },
});
