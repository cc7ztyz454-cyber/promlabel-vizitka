(() => {
  "use strict";

  const widget = document.querySelector(".sales-help");
  if (!widget) return;
  const dialog = widget.querySelector("dialog");
  const messages = dialog.querySelector(".sales-messages");
  const launch = widget.querySelector("[data-chat-open]");
  const enabled = widget.dataset.engagement === "live";
  const advise = window.createPromlabelAdvisor(window.PromlabelProducts ?? []);
  const telegramAccount = widget.dataset.telegram;
  const telegram = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(telegramAccount ?? "") ? telegramAccount : "";
  const managerLink = dialog.querySelector("[data-manager-contact]");
  let lastTopic = "";
  let source = "callback";
  let requestId;

  function contactAction(draft) {
    if (!telegram) return {link:"tel:+79877532533", label:"Позвонить менеджеру"};
    const url = new URL("https://t.me/" + telegram);
    if (draft) url.searchParams.set("text", draft);
    return {link:url.href, label:"Написать Антону Фёдорову в Telegram", external:true};
  }

  function addMessage(text, who, actions = []) {
    const line = document.createElement("p");
    line.className = "sales-" + who;
    line.textContent = text;
    for (const action of actions) {
      const link = document.createElement("a");
      link.href = action.link;
      link.textContent = action.label;
      if (action.query) link.dataset.catalogQuery = action.query;
      if (action.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else if (action.link.startsWith("#")) {
        link.addEventListener("click", () => {
          dialog.close();
          if (action.link === "#callback") source = "chat";
        });
      }
      line.append(document.createElement("br"), link);
    }
    messages.append(line);
    while (messages.childElementCount > 20) messages.firstElementChild.remove();
    messages.scrollTop = messages.scrollHeight;
  }
  function answer(question, topic) {
    if (!question.trim()) return;
    addMessage(question, "visitor");
    const reply = advise(question, topic);
    if (reply.topic) lastTopic = ["labels","ribbons","printing","delivery","price"].includes(reply.topic) ? reply.topic : "other";
    const actions = reply.actions ?? [];
    if (reply.handoff) {
      actions.push(contactAction(reply.draft));
      if (enabled) actions.push({link:"#callback", label:"Заказать обратный звонок"});
    }
    addMessage(reply.text, "reply", actions);
  }
  Object.assign(managerLink, {href:contactAction().link, textContent:contactAction().label});
  if (telegram) Object.assign(managerLink, {target:"_blank", rel:"noopener noreferrer"});

  async function post(path, payload) {
    return fetch(path, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  }

  launch.hidden = false;
  launch.addEventListener("click", () => {
    dialog.showModal();
    if (enabled) count("chat");
  });
  for (const button of dialog.querySelectorAll("[data-topic]")) {
    button.addEventListener("click", () => answer(button.textContent, button.dataset.topic));
  }
  for (const link of dialog.querySelectorAll("[data-chat-close]")) {
    link.addEventListener("click", () => dialog.close());
  }
  dialog.querySelector(".sales-question").addEventListener("submit", event => {
    event.preventDefault();
    const input = event.currentTarget.elements.question;
    const question = input.value.trim();
    answer(question);
    input.value = "";
  });

  let browserId;
  const counted = new Set();
  function count(event) {
    if (counted.has(event)) return;
    browserId ||= crypto.randomUUID();
    try {
      const day = new Date().toISOString().slice(0, 10);
      const stored = localStorage.getItem("promlabel:daily-visit");
      if (stored?.startsWith(day + "|")) browserId = stored.split("|")[1];
      else localStorage.setItem("promlabel:daily-visit", day + "|" + browserId);
    } catch {}
    counted.add(event);
    post("/api/engagement/" + event, {id: browserId}).then(response => {
      if (!response.ok) counted.delete(event);
    }).catch(() => counted.delete(event));
  }
  if (!enabled) return;

  count("visit");
  const section = document.querySelector("#callback");
  section.hidden = false;
  for (const link of document.querySelectorAll("[data-callback]")) {
    link.hidden = false;
    link.addEventListener("click", () => {
      source = link.closest("dialog") ? "chat" : "callback";
      section.querySelector("[name=name]").focus({preventScroll:true});
    });
  }
  const form = section.querySelector("form");
  form.addEventListener("input", () => { requestId = undefined; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button.disabled) return;
    const status = form.querySelector("[role=status]");
    const data = new FormData(form);
    requestId ||= crypto.randomUUID();
    button.disabled = true;
    status.textContent = "Отправляем заявку…";
    try {
      const response = await post("/api/engagement/lead", {
        id: requestId, name: data.get("name"), phone: data.get("phone"),
        website: data.get("website"), consent: data.get("consent") === "on",
        source, topic: source === "chat" ? lastTopic : "",
      });
      if (response.status === 422) {
        status.textContent = "Проверьте имя, номер телефона и согласие.";
      } else if (response.ok) {
        form.reset();
        requestId = undefined;
        source = "callback";
        status.textContent = "Заявка принята. Менеджер свяжется с вами.";
      } else {
        status.textContent = "Заявку пока не удалось принять. Попробуйте позже или позвоните в отдел заказов.";
      }
    } catch {
      status.textContent = "Связь прервалась. Попробуйте ещё раз или позвоните в отдел заказов.";
    } finally {
      button.disabled = false;
    }
  });
})();
