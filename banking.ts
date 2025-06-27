import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's bank accounts
export const getUserAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("bankAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get recent transactions
export const getRecentTransactions = query({
  args: { accountId: v.optional(v.id("bankAccounts")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const limit = args.limit || 20;

    if (args.accountId) {
      return await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .order("desc")
        .take(limit);
    } else {
      return await ctx.db
        .query("transactions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }
  },
});

// Create a new transaction
export const createTransaction = mutation({
  args: {
    accountId: v.id("bankAccounts"),
    amount: v.number(),
    type: v.string(),
    recipient: v.optional(v.string()),
    description: v.string(),
    sessionId: v.string()
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify account ownership
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found or access denied");
    }

    // Get current session for risk analysis
    const session = await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .first();

    const riskScore = session?.riskScore || 0.5;
    
    // Determine transaction status based on risk
    let status = "approved";
    const fraudFlags: string[] = [];

    if (riskScore > 0.8) {
      status = "blocked";
      fraudFlags.push("high_risk_behavior");
    } else if (riskScore > 0.6) {
      status = "flagged";
      fraudFlags.push("elevated_risk");
    }

    // Check for unusual transaction patterns
    if (args.amount > 10000) {
      fraudFlags.push("large_amount");
      if (status === "approved") status = "flagged";
    }

    const transactionId = await ctx.db.insert("transactions", {
      accountId: args.accountId,
      userId,
      amount: args.amount,
      type: args.type,
      recipient: args.recipient,
      description: args.description,
      timestamp: Date.now(),
      sessionId: args.sessionId,
      riskScore,
      status,
      fraudFlags
    });

    // Create fraud alert if transaction is flagged or blocked
    if (status !== "approved") {
      await ctx.db.insert("fraudAlerts", {
        userId,
        sessionId: args.sessionId,
        transactionId,
        alertType: "high_risk_transaction",
        severity: status === "blocked" ? "critical" : "medium",
        description: `Transaction ${status} due to behavioral risk factors`,
        riskFactors: fraudFlags,
        status: "open",
        timestamp: Date.now()
      });
    }

    return { transactionId, status, riskScore };
  },
});

// Get fraud alerts for user
export const getFraudAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("fraudAlerts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});
