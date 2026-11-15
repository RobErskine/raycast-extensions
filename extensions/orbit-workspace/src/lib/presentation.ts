import { Color, Icon, type Image } from "@raycast/api";

import type { Priority, Status } from "../api/types";

export const PRIORITY_TITLE: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No Priority",
};

export function priorityIcon(priority: Priority): Image.ImageLike {
  switch (priority) {
    case "urgent":
      return { source: Icon.ExclamationMark, tintColor: Color.Red };
    case "high":
      return { source: Icon.Signal3, tintColor: Color.Orange };
    case "medium":
      return { source: Icon.Signal2, tintColor: Color.Yellow };
    case "low":
      return { source: Icon.Signal1, tintColor: Color.SecondaryText };
    default:
      return { source: Icon.Minus, tintColor: Color.SecondaryText };
  }
}

export function statusIcon(status: Status | undefined): Image.ImageLike {
  if (!status) return { source: Icon.Circle, tintColor: Color.SecondaryText };
  const tintColor = status.color || Color.SecondaryText;
  switch (status.category) {
    case "started":
      return { source: Icon.CircleProgress, tintColor };
    case "completed":
      return { source: Icon.CheckCircle, tintColor };
    case "cancelled":
    case "duplicate":
      return { source: Icon.MinusCircle, tintColor };
    default:
      return { source: Icon.Circle, tintColor };
  }
}

/** A colored dot for projects and labels. */
export function colorDot(color: string | undefined): Image.ImageLike {
  return { source: Icon.CircleFilled, tintColor: color || Color.SecondaryText };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
