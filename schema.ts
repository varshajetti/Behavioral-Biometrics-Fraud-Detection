import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User behavioral profiles
  behaviorProfiles: defineTable({
    userId: v.id("users"),
    typingPattern: v.object({
      avgKeystrokeInterval: v.number(),
      avgDwellTime: v.number(),
      keystrokeVariance: v.number(),
      commonBigrams: v.array(v.object({
        keys: v.string(),
        interval: v.number()
      }))
    }),
    mousePattern: v.object({
      avgSpeed: v.number(),
      avgAcceleration: v.number(),
      clickPressure: v.number(),
      movementStyle: v.string() // "smooth", "jerky", "precise"
    }),
    navigationPattern: v.object({
      commonPaths: v.array(v.string()),
      avgSessionDuration: v.number(),
      preferredFeatures: v.array(v.string()),
      timeOfDayUsage: v.array(v.number()) // 24-hour distribution
    }),
    deviceFingerprint: v.object({
      screenResolution: v.string(),
      timezone: v.string(),
      language: v.string(),
      userAgent: v.string()
    }),
    lastUpdated: v.number(),
    confidenceScore: v.number() // How well-established this profile is
  }).index("by_user", ["userId"]),

  // Real-time behavioral sessions
  behaviorSessions: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    keystrokeData: v.array(v.object({
      key: v.string(),
      timestamp: v.number(),
      dwellTime: v.number(),
      flightTime: v.number()
    })),
    mouseData: v.array(v.object({
      x: v.number(),
      y: v.number(),
      timestamp: v.number(),
      eventType: v.string(), // "move", "click", "scroll"
      pressure: v.optional(v.number())
    })),
    navigationData: v.array(v.object({
      page: v.string(),
      timestamp: v.number(),
      action: v.string() // "visit", "click", "form_submit"
    })),
    riskScore: v.optional(v.number()),
    anomalies: v.array(v.string())
  }).index("by_user_session", ["userId", "sessionId"])
    .index("by_user", ["userId"]),

  // Banking accounts and transactions
  bankAccounts: defineTable({
    userId: v.id("users"),
    accountNumber: v.string(),
    accountType: v.string(), // "checking", "savings", "credit"
    balance: v.number(),
    isActive: v.boolean()
  }).index("by_user", ["userId"]),

  transactions: defineTable({
    accountId: v.id("bankAccounts"),
    userId: v.id("users"),
    amount: v.number(),
    type: v.string(), // "transfer", "payment", "withdrawal", "deposit"
    recipient: v.optional(v.string()),
    description: v.string(),
    timestamp: v.number(),
    sessionId: v.string(),
    riskScore: v.number(),
    status: v.string(), // "pending", "approved", "flagged", "blocked"
    fraudFlags: v.array(v.string())
  }).index("by_account", ["accountId"])
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // Fraud alerts and investigations
  fraudAlerts: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    transactionId: v.optional(v.id("transactions")),
    alertType: v.string(), // "behavioral_anomaly", "high_risk_transaction", "device_change"
    severity: v.string(), // "low", "medium", "high", "critical"
    description: v.string(),
    riskFactors: v.array(v.string()),
    status: v.string(), // "open", "investigating", "resolved", "false_positive"
    timestamp: v.number(),
    investigatorNotes: v.optional(v.string())
  }).index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_severity", ["severity"]),

  // System configuration
  fraudConfig: defineTable({
    configKey: v.string(),
    configValue: v.union(v.string(), v.number(), v.boolean()),
    description: v.string(),
    lastModified: v.number()
  }).index("by_key", ["configKey"])
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
