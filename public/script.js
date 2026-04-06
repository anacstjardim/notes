
(function () {
  const API_BASE = "/api/notes";

  const form = document.getElementById("note-form");
  const titleInput = document.getElementById("note-title");
  const contentInput = document.getElementById("note-content");
  const editingIdInput = document.getElementById("editing-id");
  const submitBtn = document.getElementById("submit-btn");
  const cancelEditBtn = document.getElementById("cancel-edit");
  const modeLabel = document.getElementById("editor-mode-label");
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("notes-list");
  const emptyEl = document.getElementById("list-empty");

  let notesCache = [];
  let loading = false;

  function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.className = "status" + (type ? " " + type : "");
  }

  function setLoading(isLoading) {
    loading = isLoading;
    submitBtn.disabled = isLoading;
  }

  
  async function parseResponse(res) {
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("Invalid response from server");
    }
    if (!res.ok) {
      const msg =
        data && data.error
          ? data.error
          : "Request failed (" + res.status + ")";
      const err = new Error(msg);
      err.details = data && data.details;
      throw err;
    }
    return data;
  }

  async function fetchNotes() {
    const res = await fetch(API_BASE);
    return parseResponse(res);
  }

  async function createNote(payload) {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  }

  async function updateNote(id, payload) {
    const res = await fetch(API_BASE + "/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  }

  async function deleteNote(id) {
    const res = await fetch(API_BASE + "/" + encodeURIComponent(id), {
      method: "DELETE",
    });
    if (res.status === 204) {
      return true;
    }
    return parseResponse(res);
  }

  function formatDate(iso) {
    if (!iso) {
      return "";
    }
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderList() {
    listEl.innerHTML = "";
    const editingId = editingIdInput.value;

    if (!notesCache.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    notesCache.forEach(function (note) {
      const li = document.createElement("li");
      li.className = "note-card" + (note.id === editingId ? " is-editing" : "");
      li.dataset.id = note.id;

      const header = document.createElement("div");
      header.className = "note-card-header";
      const h3 = document.createElement("h3");
      h3.className = "note-title";
      h3.textContent = note.title;
      const meta = document.createElement("span");
      meta.className = "note-meta";
      meta.textContent = formatDate(note.updatedAt);
      header.appendChild(h3);
      header.appendChild(meta);

      const body = document.createElement("p");
      body.className = "note-content";
      body.textContent = note.content || "(No content)";

      const actions = document.createElement("div");
      actions.className = "note-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn small ghost";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", "Edit note " + note.title);
      editBtn.addEventListener("click", function () {
        startEdit(note);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn small danger";
      delBtn.textContent = "Delete";
      delBtn.setAttribute("aria-label", "Delete note " + note.title);
      delBtn.addEventListener("click", function () {
        onDelete(note.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(header);
      li.appendChild(body);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  function startEdit(note) {
    editingIdInput.value = note.id;
    titleInput.value = note.title;
    contentInput.value = note.content || "";
    modeLabel.textContent = "Edit note";
    submitBtn.textContent = "Update note";
    cancelEditBtn.hidden = false;
    setStatus("");
    renderList();
    titleInput.focus();
  }

  function resetForm() {
    editingIdInput.value = "";
    titleInput.value = "";
    contentInput.value = "";
    modeLabel.textContent = "New note";
    submitBtn.textContent = "Save note";
    cancelEditBtn.hidden = true;
    renderList();
  }

  async function refresh() {
    setStatus("Loading notes...");
    try {
      notesCache = await fetchNotes();
      setStatus("");
      renderList();
    } catch (err) {
      setStatus(err.message || "Could not load notes", "err");
      notesCache = [];
      renderList();
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("");

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title) {
      setStatus("Please enter a title.", "err");
      titleInput.focus();
      return;
    }

    const id = editingIdInput.value;
    setLoading(true);

    try {
      if (id) {
        await updateNote(id, { title: title, content: content });
        setStatus("Note updated.", "ok");
      } else {
        await createNote({ title: title, content: content });
        setStatus("Note saved.", "ok");
      }
      resetForm();
      await refresh();
    } catch (err) {
      var msg = err.message || "Something went wrong";
      if (err.details && err.details.length) {
        msg += " " + err.details.join("; ");
      }
      setStatus(msg, "err");
    } finally {
      setLoading(false);
    }
  });

  cancelEditBtn.addEventListener("click", function () {
    resetForm();
    setStatus("Edit cancelled.");
  });

  async function onDelete(id) {
    if (!window.confirm("Delete this note? This cannot be undone.")) {
      return;
    }
    setStatus("");
    setLoading(true);
    try {
      await deleteNote(id);
      if (editingIdInput.value === id) {
        resetForm();
      }
      setStatus("Note deleted.", "ok");
      await refresh();
    } catch (err) {
      setStatus(err.message || "Could not delete note", "err");
    } finally {
      setLoading(false);
    }
  }

  refresh();
})();
