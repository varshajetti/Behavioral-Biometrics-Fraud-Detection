import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Start a new behavioral session
export const startBehaviorSession = mutation({
  args: {
    sessionId: v.string(),
    deviceFingerprint: v.object({
      screenResolution: v.string(),
      timezone: v.string(),
      language: v.string(),
      userAgent: v.string()
    })
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.insert("behaviorSessions", {
      userId,
      sessionId: args.sessionId,
      startTime: Date.now(),
      keystrokeData: [],
      mouseData: [],
      navigationData: [],
      anomalies: []
    });

    // Update or create behavior profile with device info
    const existingProfile = await ctx.db
      .query("behaviorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existingProfile) {
      await ctx.db.insert("behaviorProfiles", {
        userId,
        typingPattern: {
          avgKeystrokeInterval: 150,
          avgDwellTime: 100,
          keystrokeVariance: 50,
          commonBigrams: []
        },
        mousePattern: {
          avgSpeed: 200,
          avgAcceleration: 50,
          clickPressure: 0.5,
          movementStyle: "smooth"
        },
        navigationPattern: {
          commonPaths: [],
          avgSessionDuration: 300000,
          preferredFeatures: [],
          timeOfDayUsage: new Array(24).fill(0)
        },
        deviceFingerprint: args.deviceFingerprint,
        lastUpdated: Date.now(),
        confidenceScore: 0.1
      });
    }

    return { success: true };
  },
});

// Record keystroke data
export const recordKeystroke = mutation({
  args: {
    sessionId: v.string(),
    keystrokeData: v.array(v.object({
      key: v.string(),
      timestamp: v.number(),
      dwellTime: v.number(),
      flightTime: v.number()
    }))
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) throw new Error("Session not found");

    const updatedKeystrokeData = [...session.keystrokeData, ...args.keystrokeData];

    await ctx.db.patch(session._id, {
      keystrokeData: updatedKeystrokeData
    });

    // Trigger risk analysis if we have enough data
    if (updatedKeystrokeData.length > 10) {
      await ctx.scheduler.runAfter(0, internal.biometrics.analyzeSessionRisk, {
        sessionId: args.sessionId,
        userId
      });
    }

    return { success: true };
  },
});

// Record mouse movement data
export const recordMouseMovement = mutation({
  args: {
    sessionId: v.string(),
    mouseData: v.array(v.object({
      x: v.number(),
      y: v.number(),
      timestamp: v.number(),
      eventType: v.string(),
      pressure: v.optional(v.number())
    }))
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) throw new Error("Session not found");

    await ctx.db.patch(session._id, {
      mouseData: [...session.mouseData, ...args.mouseData]
    });

    return { success: true };
  },
});

// Record navigation data
export const recordNavigation = mutation({
  args: {
    sessionId: v.string(),
    page: v.string(),
    action: v.string()
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) throw new Error("Session not found");

    const navigationEntry = {
      page: args.page,
      timestamp: Date.now(),
      action: args.action
    };

    await ctx.db.patch(session._id, {
      navigationData: [...session.navigationData, navigationEntry]
    });

    return { success: true };
  },
});

// Analyze session risk using behavioral patterns
export const analyzeSessionRisk = internalAction({
  args: {
    sessionId: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(internal.biometrics.getSessionData, {
      sessionId: args.sessionId,
      userId: args.userId
    });

    const profile = await ctx.runQuery(internal.biometrics.getUserProfile, {
      userId: args.userId
    });

    if (!session || !profile) return;

    let riskScore = 0;
    const anomalies: string[] = [];

    // Analyze typing patterns
    if (session.keystrokeData.length > 5) {
      const avgInterval = session.keystrokeData.reduce((sum: number, k: any) => sum + k.flightTime, 0) / session.keystrokeData.length;
      const expectedInterval = profile.typingPattern.avgKeystrokeInterval;
      
      const intervalDeviation = Math.abs(avgInterval - expectedInterval) / expectedInterval;
      if (intervalDeviation > 0.3) {
        riskScore += 0.2;
        anomalies.push("unusual_typing_rhythm");
      }
    }

    // Analyze mouse patterns
    if (session.mouseData.length > 10) {
      const movements = session.mouseData.filter((m: any) => m.eventType === "move");
      if (movements.length > 1) {
        let totalSpeed = 0;
        for (let i = 1; i < movements.length; i++) {
          const distance = Math.sqrt(
            Math.pow(movements[i].x - movements[i-1].x, 2) + 
            Math.pow(movements[i].y - movements[i-1].y, 2)
          );
          const time = movements[i].timestamp - movements[i-1].timestamp;
          totalSpeed += distance / time;
        }
        const avgSpeed = totalSpeed / (movements.length - 1);
        
        const speedDeviation = Math.abs(avgSpeed - profile.mousePattern.avgSpeed) / profile.mousePattern.avgSpeed;
        if (speedDeviation > 0.4) {
          riskScore += 0.15;
          anomalies.push("unusual_mouse_speed");
        }
      }
    }

    // Analyze navigation patterns
    const currentHour = new Date().getHours();
    const expectedUsage = profile.navigationPattern.timeOfDayUsage[currentHour];
    if (expectedUsage < 0.1 && profile.confidenceScore > 0.5) {
      riskScore += 0.1;
      anomalies.push("unusual_time_of_access");
    }

    // Device fingerprint check
    // This would be more sophisticated in a real system
    riskScore += 0.05; // Base risk for any session

    // Cap risk score at 1.0
    riskScore = Math.min(riskScore, 1.0);

    await ctx.runMutation(internal.biometrics.updateSessionRisk, {
      sessionId: args.sessionId,
      userId: args.userId,
      riskScore,
      anomalies
    });

    // Create fraud alert for high-risk sessions
    if (riskScore > 0.7) {
      await ctx.runMutation(internal.biometrics.createBehaviorAlert, {
        userId: args.userId,
        sessionId: args.sessionId,
        riskScore,
        anomalies
      });
    }
  },
});

// Internal queries and mutations
export const getSessionData = internalQuery({
  args: { sessionId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();
  },
});

export const getUserProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("behaviorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateSessionRisk = internalMutation({
  args: {
    sessionId: v.string(),
    userId: v.id("users"),
    riskScore: v.number(),
    anomalies: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("behaviorSessions")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (session) {
      await ctx.db.patch(session._id, {
        riskScore: args.riskScore,
        anomalies: args.anomalies
      });
    }
  },
});

export const createBehaviorAlert = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    riskScore: v.number(),
    anomalies: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("fraudAlerts", {
      userId: args.userId,
      sessionId: args.sessionId,
      alertType: "behavioral_anomaly",
      severity: args.riskScore > 0.8 ? "high" : "medium",
      description: `Behavioral anomalies detected: ${args.anomalies.join(", ")}`,
      riskFactors: args.anomalies,
      status: "open",
      timestamp: Date.now()
    });
  },
});
