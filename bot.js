/* SlangQuest Chatbot — modal UI + FAQ-first + direct Gemini fallback
   NOTE: Direct calls expose your API key in the browser. Use only for local/testing.
*/

/* ============ CONFIG ============ */
const GEMINI_API_KEY = "AIzaSyATzbYDvAEGuTyjdnmh85walxygZLMcSpg"; // <— your real key
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
  encodeURIComponent(GEMINI_API_KEY);

/* ============ FAQ DB (your hotel sample) ============ */
const EmoTiPawFAQs = {
  "hello": "How can I help you today?",
  "how do i start": "Go to Play → press “Start Level 1”. Each level unlocks as you progress (or you can deep-link with ?level=2, etc.).",
  "how many levels": "There are 10 levels in this prototype, each with 10 questions.",
  "what is emotipaw": "EmoTiPaw is a quick-fire slang learning game: 10 levels × 10 multiple-choice questions, with a 5-second timer per question and instant feedback.",
  "how is scoring calculated": "Each correct answer is +1. Your per-level score is out of 10 and appears on the end-of-level panel and Feedback page.",
  "what's the timer": "You have 5 seconds per question. When time runs out you can still press Next to continue, but you won’t get the point.",
  "can i retry a level": "Yes. After finishing a level, choose “Retry Level” to restart that level from question 1.",
  "how do i go to the next level": "Finish a level and choose “Next Level” on the end-of-level panel. On the last level you’ll be routed to the Feedback page.",
  "how do i go back to level 1": "Use the end-of-level “Go to Level 1” button if present, or open play.html?level=1.",
  "what are achievements": "Achievements are badges shown on the Achievements page (e.g., First Quest, High Scorer, Perfect 10). They unlock based on progress and accuracy.",
  "where is my feedback": "After completing levels, open the Feedback page for your donut chart, per-level breakdown, tips, and motivation.",
  "does progress save": "Yes. Progress is stored in your browser’s localStorage for the logged-in user account—scores, streaks, and your current play state.",
  "can i reset results": "Yes. On the Feedback page, press “Clear Results” to erase saved scores for the current user.",
  "how do accounts work": "Create an account on the Auth page. New users start at Level 1. Each login restores that user’s local progress.",
  "which devices or browsers": "Best on the latest Chrome, Edge, Safari, or Firefox on desktop or mobile. Reduce-motion and high-contrast modes are supported by your OS/browser.",
  "is it free": "Yes—this study prototype is free to play.",
  "is there a chatbot": "Yep! Click the 🤖 icon in the top nav to open the SlangQuest Bot. It can answer questions about gameplay and slang. Quick FAQs are answered before using the AI.",
  "why didn’t the bot reply": "Make sure you’re online and that the modal is open. If an error happens, close and reopen the bot or try again later.",
  "can i play offline": "You can load pages from cache if your browser has them, but AI chatbot features and some assets require an internet connection.",
  "privacy": "This prototype stores game data in localStorage only and does not sell personal data. For account deletion or questions, use the Contact link in the footer.",
  "how to report a bug": "Use the Contact link in the footer or send screenshots and steps to reproduce to the project maintainer."
};
function matchFAQ(message) {
  const m = String(message).toLowerCase();
  for (const q in EmoTiPawFAQs) {
    if (m.includes(q)) return EmoTiPawFAQs[q];
  }
  return null;
}

/* ============ UI WIRING (matches your modal markup) ============ */
(function () {
  const modal = document.getElementById("botModal");
  const openers = document.querySelectorAll(".bot-trigger"); // your 🤖 link uses this
  const closer = document.getElementById("botClose");
  const form = document.getElementById("botForm");
  const input = document.getElementById("chat-input");
  const win = document.getElementById("chat-window");

  // Guard: only run if modal exists on this page
  if (!modal || !form || !input || !win) return;

  // open/close
  function openBot(e) {
    if (e) e.preventDefault();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    input.focus();
  }
  function closeBot() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  openers.forEach((a) => a.addEventListener("click", openBot));
  if (closer) closer.addEventListener("click", closeBot);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeBot(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBot(); });

  // helpers
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function addMsg(text, who = "user") {
    const wrap = document.createElement("div");
    wrap.className = `msg ${who}`;
    wrap.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    win.appendChild(wrap);
    win.scrollTop = win.scrollHeight;
  }

  /* ============ Gemini call (fixed) ============ */
  async function askGemini(userText) {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in bot.js");

    const body = {
      contents: [{ role: "user", parts: [{ text: userText }]}]
    };

    let res, data;
    try {
      res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      data = await res.json();
    } catch (err) {
      throw new Error("Network error. Are you online?");
    }

    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data ??
      "";

    if (!reply) {
      const reason = data?.candidates?.[0]?.finishReason || "UNKNOWN";
      if (reason === "SAFETY") return "The response was blocked by safety settings.";
      return "Sorry, I couldn't generate a response.";
    }

    return reply;
  }

  /* ============ submit ============ */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    addMsg(userText, "user");
    input.value = "";
    addMsg("…", "bot"); // typing placeholder

    // 1) Try FAQ first
    const faq = matchFAQ(userText);
    if (faq) {
      const last = win.querySelector(".msg.bot:last-child .bubble");
      if (last) last.textContent = faq;
      win.scrollTop = win.scrollHeight;
      return;
    }

    // 2) Gemini fallback
    try {
      const chatbotResponse = await askGemini(userText);
      const last = win.querySelector(".msg.bot:last-child .bubble");
      if (last) last.textContent = chatbotResponse;
      win.scrollTop = win.scrollHeight;
    } catch (err) {
      const last = win.querySelector(".msg.bot:last-child .bubble");
      if (last) last.textContent = "Error calling Gemini API. Try again.";
      console.error("Gemini error:", err);
    }
  });
})();
