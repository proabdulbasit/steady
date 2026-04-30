const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const Conversation = require("../models/Conversation");

const router = express.Router();

function isObjectId(value) {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function safeTitleFromText(text = "") {
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}…` : cleaned;
}

function autoTitleFromFirstMessage(text = "") {
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  const words = cleaned.split(" ").filter(Boolean).slice(0, 3);
  const title = words.join(" ");
  return title || "New chat";
}

function serializeConversationSummary(convo) {
  const last = Array.isArray(convo.messages) && convo.messages.length ? convo.messages[convo.messages.length - 1] : null;
  return {
    id: String(convo._id),
    title: convo.title || "New chat",
    pinned: Boolean(convo.pinned),
    updatedAt: convo.updatedAt,
    lastMessagePreview: last?.content ? String(last.content).slice(0, 90) : "",
  };
}

function serializeConversationFull(convo) {
  return {
    id: String(convo._id),
    title: convo.title || "New chat",
    pinned: Boolean(convo.pinned),
    pinnedAt: convo.pinnedAt,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt,
    messages: (convo.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      attachments: Array.isArray(m.attachments)
        ? m.attachments.map((a) => ({
            kind: a.kind,
            name: a.name,
            type: a.type,
            size: a.size,
            mediaType: a.mediaType,
            base64: a.base64,
          }))
        : [],
      createdAt: m.createdAt,
    })),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const conversations = await Conversation.find({ userId })
    .sort({ pinned: -1, pinnedAt: -1, updatedAt: -1 })
    .limit(50)
    .select({ title: 1, pinned: 1, pinnedAt: 1, updatedAt: 1, messages: { $slice: -1 } });

  return res.json({ conversations: conversations.map(serializeConversationSummary) });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const { title = "", firstMessage = "" } = req.body || {};
  const finalTitle = title ? safeTitleFromText(title) : autoTitleFromFirstMessage(firstMessage);

  const convo = await Conversation.create({
    userId,
    title: finalTitle,
    messages: [],
  });

  return res.status(201).json({ conversation: serializeConversationFull(convo) });
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid conversation id." });

  const convo = await Conversation.findOne({ _id: id, userId });
  if (!convo) return res.status(404).json({ error: "Conversation not found." });

  return res.json({ conversation: serializeConversationFull(convo) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid conversation id." });

  const { title, pinned } = req.body || {};

  const convo = await Conversation.findOne({ _id: id, userId });
  if (!convo) return res.status(404).json({ error: "Conversation not found." });

  if (typeof title === "string") {
    convo.title = safeTitleFromText(title);
  }

  if (typeof pinned === "boolean") {
    convo.pinned = pinned;
    convo.pinnedAt = pinned ? new Date() : null;
  }

  await convo.save();
  return res.json({ conversation: serializeConversationFull(convo) });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid conversation id." });

  const convo = await Conversation.findOneAndDelete({ _id: id, userId });
  if (!convo) return res.status(404).json({ error: "Conversation not found." });

  return res.json({ ok: true });
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid conversation id." });

  const body = req.body || {};
  const incoming = Array.isArray(body.messages)
    ? body.messages
    : body.message
      ? [body.message]
      : body.role && body.content
        ? [{ role: body.role, content: body.content }]
        : [];

  const messages = incoming
    .map((m) => {
      const role = typeof m?.role === "string" ? m.role : "";
      const content = typeof m?.content === "string" ? m.content : "";
      const rawAttachments = Array.isArray(m?.attachments) ? m.attachments : [];
      const attachments = rawAttachments
        .map((a) => ({
          kind: a?.kind === "image" ? "image" : a?.kind === "file" ? "file" : "",
          name: typeof a?.name === "string" ? a.name : "",
          type: typeof a?.type === "string" ? a.type : "",
          size: typeof a?.size === "number" ? a.size : 0,
          mediaType: typeof a?.mediaType === "string" ? a.mediaType : "",
          base64: typeof a?.base64 === "string" ? a.base64 : "",
        }))
        .filter((a) => a.kind && a.name);

      return { role, content, attachments };
    })
    .filter((m) => (m.role === "user" || m.role === "assistant" || m.role === "system") && m.content.trim());

  if (!messages.length) {
    return res.status(400).json({ error: "Missing messages." });
  }

  const convo = await Conversation.findOne({ _id: id, userId });
  if (!convo) return res.status(404).json({ error: "Conversation not found." });

  // If title is still default-ish, set it from the first user message we see.
  if (!convo.title || convo.title === "New chat") {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      convo.title = autoTitleFromFirstMessage(firstUser.content);
    }
  }

  convo.messages.push(...messages);
  await convo.save();

  return res.json({ conversation: serializeConversationFull(convo) });
});

module.exports = router;

