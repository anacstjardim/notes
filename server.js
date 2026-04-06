/**
 * Notes API and static file server for the W07 full-stack notes app.
 * Serves /public and REST routes under /api/notes.
 */

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");

app.use(express.json({ limit: "512kb" }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * Read all notes from data.json. Returns [] if missing or invalid.
 */
async function readNotesFromFile() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * Persist the notes array to data.json (pretty-printed for readability).
 */
async function writeNotesToFile(notes) {
  await fs.writeFile(DATA_PATH, JSON.stringify(notes, null, 2), "utf8");
}

/**
 * Validate a note payload for create/update. Returns { ok, errors }.
 */
function validateNoteBody(body) {
  const errors = [];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title) {
    errors.push("title is required");
  }
  if (title.length > 200) {
    errors.push("title must be at most 200 characters");
  }
  if (content.length > 20000) {
    errors.push("content must be at most 20000 characters");
  }

  return {
    ok: errors.length === 0,
    errors,
    title,
    content,
  };
}

// GET all notes (newest first)
app.get("/api/notes", async (req, res) => {
  try {
    const notes = await readNotesFromFile();
    const sorted = [...notes].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    res.json(sorted);
  } catch (err) {
    console.error("GET /api/notes", err);
    res.status(500).json({ error: "Could not read notes" });
  }
});

// GET one note by id
app.get("/api/notes/:id", async (req, res) => {
  try {
    const notes = await readNotesFromFile();
    const note = notes.find((n) => n.id === req.params.id);
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    res.json(note);
  } catch (err) {
    console.error("GET /api/notes/:id", err);
    res.status(500).json({ error: "Could not read note" });
  }
});

// CREATE note
app.post("/api/notes", async (req, res) => {
  const check = validateNoteBody(req.body || {});
  if (!check.ok) {
    return res.status(400).json({ error: "Validation failed", details: check.errors });
  }

  try {
    const notes = await readNotesFromFile();
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      title: check.title,
      content: check.content,
      createdAt: now,
      updatedAt: now,
    };
    notes.push(note);
    await writeNotesToFile(notes);
    res.status(201).json(note);
  } catch (err) {
    console.error("POST /api/notes", err);
    res.status(500).json({ error: "Could not save note" });
  }
});

// UPDATE note
app.put("/api/notes/:id", async (req, res) => {
  const check = validateNoteBody(req.body || {});
  if (!check.ok) {
    return res.status(400).json({ error: "Validation failed", details: check.errors });
  }

  try {
    const notes = await readNotesFromFile();
    const index = notes.findIndex((n) => n.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Note not found" });
    }

    const existing = notes[index];
    const updated = {
      ...existing,
      title: check.title,
      content: check.content,
      updatedAt: new Date().toISOString(),
    };
    notes[index] = updated;
    await writeNotesToFile(notes);
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/notes/:id", err);
    res.status(500).json({ error: "Could not update note" });
  }
});

// DELETE note
app.delete("/api/notes/:id", async (req, res) => {
  try {
    const notes = await readNotesFromFile();
    const next = notes.filter((n) => n.id !== req.params.id);
    if (next.length === notes.length) {
      return res.status(404).json({ error: "Note not found" });
    }
    await writeNotesToFile(next);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/notes/:id", err);
    res.status(500).json({ error: "Could not delete note" });
  }
});

// JSON error handler for malformed JSON bodies
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Notes app listening on http://localhost:${PORT}`);
});
