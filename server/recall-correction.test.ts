import { rmSync } from "node:fs";
import { beforeEach, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import { closeMessageDb, insertMessage } from "./message-db.ts";
import { buildRecall } from "./recall.ts";
import { writeMemoryTopic, WORKSPACES_DIR } from "./workspace.ts";
import type { Message } from "./store.ts";

const BOT = "bot-recall-correction";
const THREAD = "thread-recall-correction";
const day = (d: number, h: number) => Date.UTC(2026, 10, d, h);
const said = (id: string, text: string, at: number): Message => ({ id, role: "user", kind: "text", text, at });
const recall = (message: string) =>
  buildRecall({ botId: BOT, message, threadIds: [THREAD], label: () => "chat", author: () => "Person" })?.text ?? "";

beforeEach(() => {
  closeMessageDb();
  rmSync(DATA_DIR, { recursive: true, force: true });
  rmSync(WORKSPACES_DIR, { recursive: true, force: true });
});

it("conversation: a later correction that does not repeat the question's words still reaches the turn", () => {
  insertMessage(THREAD, said("m1", "My coworking space is Nook in Al Quoz.", day(16, 7)));
  insertMessage(THREAD, said("m2", "Not Nook anymore, we moved to Letswork in DIFC.", day(17, 6)));
  const text = recall("Which coworking space do I use now?");
  expect(text).toContain("Nook in Al Quoz");
  expect(text).toContain("Letswork");
});

it("conversation: adds nothing when no later message names what the hit named", () => {
  insertMessage(THREAD, said("m1", "My coworking space is Nook in Al Quoz.", day(16, 7)));
  insertMessage(THREAD, said("m2", "We moved the standup to Letswork hours.", day(17, 6)));
  insertMessage(THREAD, { ...said("m3", "Nook has good coffee, noted.", day(17, 7)), role: "bot" });
  insertMessage(THREAD, said("m0", "Nook is closed on Fridays.", day(15, 7)));
  const text = recall("Which coworking space do I use now?");
  expect(text).toContain("Nook in Al Quoz");
  expect(text).not.toContain("standup");
  expect(text).not.toContain("good coffee");
  expect(text).not.toContain("closed on Fridays");
});

it("conversation: shows only the newest later mention, once", () => {
  insertMessage(THREAD, said("m1", "My coworking space is Nook in Al Quoz.", day(16, 7)));
  insertMessage(THREAD, said("m2", "Thinking of leaving Nook.", day(17, 6)));
  insertMessage(THREAD, said("m3", "Not Nook anymore, we moved to Letswork in DIFC.", day(18, 6)));
  const text = recall("Which coworking space do I use now?");
  expect(text).toContain("Letswork");
  expect(text).not.toContain("Thinking of leaving");
  expect(text.split("Letswork")).toHaveLength(2);
});

it("notes: a later note that does not repeat the question's words still reaches the turn", () => {
  writeMemoryTopic(BOT, "work.md", "---\naliases: [office, desk]\n---\n- 2026-11-16 · The person's coworking space is Nook in Al Quoz.\n- 2026-11-17 · The person moved from Nook to Letswork in DIFC.\n");
  const text = recall("Which coworking space do I use now?");
  expect(text).toContain("Letswork");
});
