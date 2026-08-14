/**
 * Rewrite Steady advice into plain language an owner can share with staff.
 */

const EXPLAIN_TO_TEAM_SYSTEM = `You rewrite business advice for a small-business owner to share with their staff.

Start with exactly: "Starting tomorrow, here's what we're doing differently:"

Rules:
- Extremely simple language a cook, cashier, technician, or cleaner understands immediately.
- No jargon. No corporate speak. No buzzwords.
- Write as if talking directly to a frontline employee, not management.
- Be specific about exactly what they should DO differently starting tomorrow.
- Keep it short — employees won't read a novel.
- Friendly but direct.
- Format as a simple numbered list of actions.
- Keep the important facts and numbers from the original advice.
- Do not add new strategies that were not in the original.
- Output ONLY the staff-ready message. No preamble like "Here's a rewrite".`;

async function callAnthropic({ system, userContent, maxTokens = 1200 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    const err = new Error("Missing ANTHROPIC_API_KEY on the backend.");
    err.status = 500;
    throw err;
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Anthropic request failed.");
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { model, text };
}

async function explainAdviceForTeam({ advice, ownerName = "", industry = "" }) {
  const source = String(advice || "").trim();
  if (!source) {
    const err = new Error("Nothing to rewrite. Ask Steady something first.");
    err.status = 400;
    throw err;
  }
  if (source.length > 50000) {
    const err = new Error("Advice is too long to rewrite. Try a shorter response.");
    err.status = 400;
    throw err;
  }

  const who = String(ownerName || "").trim();
  const ind = String(industry || "").trim();

  const userContent = `Rewrite the Steady advice below into a plain staff message the owner can copy and send to their team.
${who ? `Owner name: ${who}\n` : ""}${ind ? `Business type: ${ind}\n` : ""}
--- ORIGINAL ADVICE ---
${source}
--- END ---`;

  const { model, text } = await callAnthropic({
    system: EXPLAIN_TO_TEAM_SYSTEM,
    userContent,
  });

  if (!text) {
    const err = new Error("Could not rewrite this advice. Try again.");
    err.status = 502;
    throw err;
  }

  return { explanation: text, model };
}

module.exports = {
  explainAdviceForTeam,
  EXPLAIN_TO_TEAM_SYSTEM,
};
