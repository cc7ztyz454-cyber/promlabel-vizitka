(() => {
  "use strict";

  const widget = document.querySelector(".sales-help");
  if (!widget) return;
  const dialog = widget.querySelector("dialog");
  const messages = dialog.querySelector(".sales-messages");
  const launch = widget.querySelector("[data-chat-open]");
  const enabled = widget.dataset.engagement === "live";
  const topics = [
    { key: "delivery", pattern: /достав|склад|самовывоз|адрес|проезд|график|оплат/u, answer: "Доставляем транспортными компаниями и своим транспортом. Возможность самовывоза согласуйте с менеджером. Склад в Дзержинске, Автозаводское шоссе, 85И. Схема проезда есть в контактах.", link: "#warehouse", label: "Схема проезда" },
    { key: "ribbons", pattern: /риббон|красящ|wax|resin|лента|ленту/u, answer: "Для прямой термопечати на Термо ЭКО и Термо ТОП красящая лента не нужна. Для термотрансферной печати подбираем риббон по материалу этикетки, модели принтера, втулке и намотке.", link: "#guide", label: "Как выбрать риббон" },
    { key: "printing", pattern: /тираж|макет|логотип|цветн|цифров|флексо/u, answer: "Для расчёта печати нужны размер, тираж, поверхность и условия применения. Если есть макет или фотография этикетки, их можно приложить к письму вместе с заявкой.", link: "#quote", label: "Собрать заявку" },
    { key: "labels", pattern: /этикет|эко|топ|принтер|втулк|термо|намот/u, answer: "Термо ЭКО подходит для краткосрочной маркировки в сухих условиях. Термо ТОП защищён от истирания и влаги лучше ЭКО. Сверьте размеры этикетки, втулку и внешний диаметр рулона с инструкцией к принтеру.", link: "#catalog", label: "Открыть каталог" },
    { key: "price", pattern: /цен|стоим|налич|срок|сколько/u, answer: "Цены и единицы продажи указаны в каталоге. Корзина рассчитывает сумму, а наличие и срок поставки подтвердит менеджер.", link: "#catalog", label: "Открыть каталог" },
  ];

  let lastTopic = "";
  let source = "callback";
  let requestId;
  function addMessage(text, who, topic) {
    const line = document.createElement("p");
    line.className = "sales-" + who;
    line.textContent = text;
    if (topic) {
      const link = document.createElement("a");
      link.href = topic.link;
      link.textContent = topic.label;
      link.addEventListener("click", () => dialog.close());
      line.append(document.createElement("br"), link);
    }
    messages.append(line);
    while (messages.childElementCount > 20) messages.firstElementChild.remove();
    messages.scrollTop = messages.scrollHeight;
  }
  function answer(question, topic) {
    if (!question.trim()) return;
    addMessage(question, "visitor");
    lastTopic = topic?.key ?? "other";
    addMessage(topic?.answer ?? "По этому вопросу лучше уточнить у менеджера. Могу подсказать по этикеткам, риббонам, печати и доставке.", "reply", topic);
  }
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
    button.addEventListener("click", () => answer(button.textContent, topics.find(topic => topic.key === button.dataset.topic)));
  }
  for (const link of dialog.querySelectorAll("[data-chat-close]")) {
    link.addEventListener("click", () => dialog.close());
  }
  dialog.querySelector(".sales-question").addEventListener("submit", event => {
    event.preventDefault();
    const input = event.currentTarget.elements.question;
    const question = input.value.trim();
    const normalized = question.toLocaleLowerCase("ru");
    answer(question, topics.find(topic => topic.pattern.test(normalized)));
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
