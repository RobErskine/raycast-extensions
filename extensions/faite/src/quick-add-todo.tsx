import {
  AI,
  closeMainWindow,
  environment,
  getPreferenceValues,
  LaunchProps,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { api } from "./lib/api";
import { captureContext } from "./lib/capture-context";
import { withFaite } from "./lib/auth";
import { todayIn } from "./lib/dates";
import type { List, Profile, Todo } from "./lib/types";

/**
 * Quick Add — the whole point of the extension.
 *
 * Capture has to cost nothing, so this is a `no-view` command: type, hit
 * enter, done. Everything else here exists to keep that true when something
 * is unavailable.
 *
 * Natural language is parsed with Raycast AI when it is available, and the
 * command falls back to a literal title when it is not. It never fails
 * because AI is missing, slow, or returns nonsense — a captured to-do with a
 * clumsy title beats a lost one.
 */

interface Preferences {
  shouldCloseMainWindow: boolean;
  dontUseAI: boolean;
  captureContext: boolean;
}

interface ParsedTodo {
  title: string;
  scheduledDate?: string | null;
  deadline?: string | null;
  priority?: Todo["priority"];
  listId?: string | null;
}

/**
 * Asks the model to resolve a phrase into fields, given the account's REAL
 * lists and today's date.
 *
 * The lists are passed with their `description` — that field exists to say
 * what belongs in a list, and it is the only thing that lets "call the
 * dentist" land somewhere better than Backlog. Ids are supplied so the model
 * picks one rather than inventing a name that would then have to be matched
 * back, which is where this kind of prompt usually goes wrong.
 */
async function parseWithAI(text: string, lists: List[], today: string): Promise<ParsedTodo> {
  const listCatalog = lists
    .filter((list) => !list.archivedAt)
    .map((list) => `- id: ${list.id} | name: ${list.name}${list.description ? ` | for: ${list.description}` : ""}`)
    .join("\n");

  const answer = await AI.ask(
    [
      "Convert a to-do written in natural language into JSON. Reply with ONLY the JSON object, no prose and no code fence.",
      "",
      `Today is ${today}.`,
      "",
      "Fields:",
      '- "title" (required): the task, with any date or priority wording REMOVED. "buy milk tomorrow" -> "Buy milk".',
      '- "scheduledDate" (optional): YYYY-MM-DD, only if the text names a day to work on it.',
      '- "deadline" (optional): YYYY-MM-DD, only if the text names a hard due date ("due", "by").',
      '- "priority" (optional): one of low, medium, high, urgent. Only if the text implies urgency.',
      '- "listId" (optional): the id of the best-matching list below. Omit it unless the text clearly belongs there.',
      "",
      "Lists:",
      listCatalog || "(none)",
      "",
      `To-do: "${text}"`,
    ].join("\n"),
    { creativity: "none" },
  );

  // The model is asked for bare JSON but sometimes fences it anyway; take the
  // outermost object rather than trusting the whole response to parse.
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON in response");

  const parsed = JSON.parse(match[0]) as ParsedTodo;
  if (typeof parsed.title !== "string" || !parsed.title.trim()) throw new Error("no title in response");

  // A hallucinated list id would be rejected by the API as a foreign key that
  // does not exist; drop it here instead so the to-do still lands.
  if (parsed.listId && !lists.some((list) => list.id === parsed.listId)) delete parsed.listId;

  return parsed;
}

async function QuickAddTodo(props: LaunchProps<{ arguments: { text: string; notes?: string } }>) {
  const { shouldCloseMainWindow, dontUseAI, captureContext: shouldCapture } = getPreferenceValues<Preferences>();

  // `fallbackText` is what makes this usable as a Raycast AI fallback command:
  // type anything into Raycast, pick Quick Add, and it becomes a to-do.
  const text = (props.fallbackText ?? props.arguments.text ?? "").trim();
  if (!text) {
    await showFailureToast(new Error("Nothing to add"), { title: "Quick Add" });
    return;
  }

  if (shouldCloseMainWindow) {
    await closeMainWindow();
  } else {
    await showToast({ style: Toast.Style.Animated, title: "Adding to-do…" });
  }

  try {
    let parsed: ParsedTodo = { title: text };
    let lists: List[] = [];

    // `canAccess` rather than a try/catch around AI.ask: a user without AI
    // access should not pay for a failed request to find that out.
    const useAI = !dontUseAI && environment.canAccess(AI);

    if (useAI) {
      const [profile, fetchedLists] = await Promise.all([api.get<Profile>("/profile"), api.get<List[]>("/lists")]);
      lists = fetchedLists;

      try {
        parsed = await parseWithAI(text, lists, todayIn(profile.timezone));
      } catch {
        // Every AI failure mode lands here — no access, a timeout, unparseable
        // output, a missing title. The literal text is always a valid to-do,
        // so capture never depends on the model behaving.
        parsed = { title: text };
      }
    }

    // Resolved in parallel with nothing else outstanding, and never awaited
    // on the critical path in a way that could fail the create — see
    // `captureContext`, which returns undefined for every failure it has.
    const source = shouldCapture ? await captureContext() : undefined;

    const created = await api.post<Todo>("/todos", {
      title: parsed.title,
      ...(source ? { source } : {}),
      ...(props.arguments.notes ? { description: props.arguments.notes } : {}),
      ...(parsed.scheduledDate ? { scheduledDate: parsed.scheduledDate } : {}),
      ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.listId ? { listId: parsed.listId } : {}),
    });

    const destination = lists.find((list) => list.id === created.listId)?.name;
    const message = destination ? `${created.title} → ${destination}` : created.title;

    if (shouldCloseMainWindow) {
      await showHUD(`Added ${message}`);
    } else {
      await showToast({ style: Toast.Style.Success, title: "Added to-do", message });
    }
  } catch (error) {
    await showFailureToast(error, { title: "Couldn't add that to-do" });
  }
}

export default withFaite(QuickAddTodo);
