/**
 * Shared enums used throughout the Cognitive Core.
 */

export enum ReplyStyle {
  Natural = "natural",
  Friendly = "friendly",
  Technical = "technical",
  Professional = "professional",
  Educational = "educational",
  Analytical = "analytical",
}

export enum DecisionType {
  Respond = "respond",
  AskQuestion = "ask-question",
  Clarify = "clarify",
  Refuse = "refuse",
  Ignore = "ignore",
}

export enum ConfidenceLevel {
  VeryLow = "very-low",
  Low = "low",
  Medium = "medium",
  High = "high",
  VeryHigh = "very-high",
}

export enum ResponseStrategy {
  Answer = "answer",
  Clarify = "clarify",
  FollowUp = "follow_up",
  Acknowledge = "acknowledge",
  Explore = "explore",
  Recall = "recall",
  Comfort = "comfort",
  Challenge = "challenge",
  Agree = "agree",
  Disagree = "disagree",
  Explain = "explain",
  Celebrate = "celebrate",
  Encourage = "encourage",
  StaySilent = "stay_silent",
}
