(() => {
  "use strict";
  const host = document.getElementById("catalog");
  if (!host) return;

  const items = window.PromlabelProducts;
  const groups = ["Все", "Этикетки", "Упаковка", "Расходники", "Оборудование"];
  const products = new Map(items.map(item => [item.id, item]));
  const storageKey = "promlabel52:request:v1";
  const mail = "zakaz@promlabel52.ru";
  const maxQty = 999999999;
  const fmt = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 2});
  const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[char]));
  const validQty = value => Number.isSafeInteger(value) && value > 0 && value <= maxQty;
  function quantityAllowed(i, value) {
    const min = i.minQty ?? 1;
    return validQty(value) && value >= min && (value - min) % (i.step ?? 1) === 0;
  }
  function quantityAttrs(i, value) {
    return 'min="' + (i.minQty ?? 1) + '" max="' + maxQty + '" step="' + (i.step ?? 1) + '" required value="' + value + '"';
  }
  const hasPrice = item => Number.isFinite(item.price) && item.price >= 0;
  const rub = value => fmt.format(value) + " ₽";
  function unitPrice(id) {
    const item = products.get(id);
    const totalQty = rows.filter(row => row.id === id).reduce((sum, row) => sum + row.qty, 0);
    return (item.tiers ?? []).reduce((price, tier) => totalQty >= tier.qty ? tier.price : price, item.price);
  }
  function subtotal(row) {
    return Math.round(unitPrice(row.id) * 100) * row.qty / 100;
  }
  const lineCost = row => hasPrice(products.get(row.id)) ? rub(subtotal(row)) : "По запросу";
  function priceTable(i) {
    if (!hasPrice(i)) return "";
    const levels = [{qty: i.minQty ?? 1, price: i.price}, ...(i.tiers ?? [])];
    return '<div class="pc-pricing"><strong>Цена за ' + i.unit + '</strong><ul>' + levels.map(t => '<li><span>От ' + fmt.format(t.qty) + ' ' + i.unit + '</span><b>' + rub(t.price) + '</b></li>').join("") + '</ul></div>';
  }
  function orderSummary() {
    const priced = rows.filter(r => hasPrice(products.get(r.id)));
    const pending = rows.length - priced.length;
    if (!priced.length) return "Стоимость и срок подтвердит менеджер.";
    const total = priced.reduce((sum, r) => sum + Math.round(unitPrice(r.id) * 100) * r.qty, 0) / 100;
    return (pending ? "По позициям с ценой " : "Итого ") + rub(total) + (pending ? " + по запросу (" + pending + " поз.)" : "");
  }
  let rows = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) rows = saved.filter(r => r && products.has(r.id) && quantityAllowed(products.get(r.id), r.qty) && typeof r.spec === "string" && r.spec.length <= 300);
  } catch {}
  let group = "Все";
  let mode = "example";
  let query = "";
  let pageSize = 6;
  function normalize(value) {
    return value.toLowerCase().replaceAll("ё", "е")
      .replace(/(\d)\s*(?:мм|см|м)?\s*[xх×*]\s*(?=\d)/g, "$1×")
      .replace(/[^a-zа-я0-9×]+/g, " ").trim();
  }
  let opener = null;
  const dialog = document.createElement("dialog");
  dialog.className = "pc-dialog";
  dialog.setAttribute("aria-labelledby","pc-modal-title");
  document.body.append(dialog);
  dialog.addEventListener("close", () => { if (opener?.isConnected) opener.focus(); });
  dialog.addEventListener("click", e => {
    if (e.target !== dialog || dialog.querySelector("[data-busy]")) return;
    const box = dialog.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close();
  });

  function updateCounters() {
    document.querySelectorAll("[data-cart-count]").forEach(el => { el.textContent = String(rows.length); });
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch {}
    updateCounters();
  }
  function showDialog(content, source) {
    if (!dialog.open) opener = source || document.activeElement;
    dialog.innerHTML = '<button class="pc-close" type="button" aria-label="Закрыть">×</button>' + content;
    dialog.querySelector(".pc-close").onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector("h2").focus();
  }
  function drawCards() {
    const terms = normalize(query).split(" ").filter(Boolean);
    const activeItems = items.filter(i => i.kind === mode).sort((a,b) => Number(hasPrice(b)) - Number(hasPrice(a)));
    const matches = activeItems.filter(i => {
      const searchable = normalize([i.name, i.description, i.group, i.id, i.sourceSku].join(" "));
      return (group === "Все" || i.group === group) && terms.every(t => searchable.includes(t));
    });
    const visible = matches.slice(0, pageSize);
    host.querySelector(".pc-mode-note").textContent = mode === "example" ? "Цена указана за единицу заказа. Наличие и срок поставки подтвердит менеджер." : "Опишите нужные размеры, материал или модель при добавлении в заявку.";
    host.querySelector(".pc-result").textContent = "Показано " + visible.length + " из " + matches.length;
    host.querySelector("[data-more]").hidden = matches.length <= pageSize;
    host.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    host.querySelectorAll("[data-filter]").forEach(b => b.hidden = b.dataset.filter !== "Все" && !activeItems.some(i => i.group === b.dataset.filter));
    host.querySelector(".pc-grid").innerHTML = visible.map(i =>
      '<article class="pc-card"><span class="pc-group">' + i.group + '</span><h3>' + i.name + '</h3><p>' + i.description + '</p><div class="pc-cardfoot"><span>' + (hasPrice(i) ? rub(i.price) + " / " + i.unit : "Цена по запросу") + '</span><button type="button" data-select="' + i.id + '" aria-label="Выбрать: ' + i.name + '">Выбрать <b aria-hidden="true">+</b></button></div></article>'
    ).join("") || '<p class="pc-no-results">Совпадений нет. Попробуйте другой размер или выберите «По своим параметрам».</p>';
    host.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === group)));
  }
  function configure(id, source) {
    const i = products.get(id);
    showDialog('<h2 id="pc-modal-title" tabindex="-1">' + i.name + '</h2><p>' + i.description + '</p>' + priceTable(i) + '<form class="pc-fields"><label>Количество, ' + i.unit + '<input name="qty" type="number" ' + quantityAttrs(i, i.minQty ?? 1) + '>' + (i.step > 1 ? '<small>Кратно ' + i.step + ' ' + i.unit + '</small>' : '') + '</label><label>Параметры позиции<textarea name="spec" maxlength="300" placeholder="' + i.hint + '"></textarea></label><p class="pc-feedback" role="status"></p><button class="pc-primary">Добавить в заявку</button></form>', source);
    const form = dialog.querySelector("form");
    form.onsubmit = e => {
      e.preventDefault();
      const qty = Number(form.elements.qty.value);
      const spec = form.elements.spec.value.trim();
      if (!quantityAllowed(i, qty)) return;
      const found = rows.find(row => row.id === id && row.spec === spec);
      if (found && !validQty(found.qty + qty)) {
        form.querySelector("[role=status]").textContent = "Суммарное количество превышает " + fmt.format(maxQty) + ".";
        return;
      }
      if (found) found.qty += qty;
      else rows.push({id, qty, spec});
      save();
      showDialog('<h2 id="pc-modal-title" tabindex="-1">Добавлено в заявку</h2><p>' + i.name + ' · ' + fmt.format(qty) + ' ' + i.unit + '</p><div class="pc-actions"><button class="pc-primary" data-review>Открыть заявку</button><button class="pc-secondary" data-continue>Продолжить выбор</button></div>', source);
      dialog.querySelector("[data-review]").onclick = () => cart(source);
      dialog.querySelector("[data-continue]").onclick = () => dialog.close();
    };
  }
  const contacts = {company: "", contact: ""};
  function cart(source) {
    const summary = orderSummary();
    const list = rows.map((r, ix) => {
      const i = products.get(r.id);
      return '<li><strong>' + i.name + '</strong>' + (r.spec ? '<small>' + escape(r.spec) + '</small>' : '') + '<div class="pc-row"><label>Количество, ' + i.unit + '<input form="pc-order" data-index="' + ix + '" type="number" ' + quantityAttrs(i, r.qty) + '></label><span class="pc-price">' + lineCost(r) + '</span><button data-delete="' + ix + '" aria-label="Удалить ' + i.name + '">Удалить</button></div></li>';
    }).join("");
    showDialog('<h2 id="pc-modal-title" tabindex="-1">Ваша заявка</h2>' + (!rows.length ? '<p>Добавьте товары из каталога и укажите нужное количество.</p><a href="#catalog" class="pc-primary" data-return>Перейти в каталог</a>' : '<ul class="pc-lines">' + list + '</ul><p class="pc-summary">' + summary + '</p><form id="pc-order" class="pc-fields"><label>Компания <span>· необязательно</span><input name="company" maxlength="120" autocomplete="organization" value="' + escape(contacts.company) + '"></label><label>Контакт для ответа<input name="contact" required maxlength="150" placeholder="Телефон или email" value="' + escape(contacts.contact) + '"></label><div class="pc-actions"><button class="pc-secondary" value="file" formnovalidate>Скачать заявку .txt</button></div><p class="pc-note">Скачайте заявку и отправьте её в отдел продаж на ' + mail + '.</p><p role="status" class="pc-feedback"></p></form>'), source);
    if (!rows.length) {
      dialog.querySelector("[data-return]").onclick = () => dialog.close();
      return;
    }
    const form = dialog.querySelector("form");
    for (const field of ["company","contact"]) form.elements[field].oninput = () => { contacts[field] = form.elements[field].value; };
    dialog.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => { rows.splice(Number(b.dataset.delete), 1); save(); cart(source); });
    dialog.querySelectorAll("[data-index]").forEach(input => input.oninput = () => {
      const qty = Number(input.value);
      const row = rows[Number(input.dataset.index)];
      if (!quantityAllowed(products.get(row.id), qty)) return;
      row.qty = qty;
      save();
      dialog.querySelectorAll(".pc-price").forEach((el, ix) => { el.textContent = lineCost(rows[ix]); });
      dialog.querySelector(".pc-summary").textContent = orderSummary();
    });
    form.onsubmit = async e => {
      e.preventDefault();
      const date = new Date().toLocaleDateString("ru-RU");
      const subject = (rows.some(row => !hasPrice(products.get(row.id))) ? "Заявка на расчёт от " : "Заказ от ") + date;
      const body = [subject, contacts.company && "Компания: " + contacts.company, contacts.contact && "Контакт: " + contacts.contact, ...rows.map((r, ix) => {
        const i = products.get(r.id);
        return (ix + 1) + ". " + i.name + " — " + fmt.format(r.qty) + " " + i.unit + (i.kind === "example" ? "\n   " + i.description : "") + (hasPrice(i) ? "\n   Цена за " + i.unit + ": " + rub(unitPrice(i.id)) : "") + (r.spec ? "\n   " + r.spec : "") + "\n   Стоимость: " + lineCost(r);
      }), dialog.querySelector(".pc-summary").textContent].filter(Boolean).join("\r\n\r\n");
      const status = form.querySelector("[role=status]");
      function download() {
        const url = URL.createObjectURL(new Blob(["\uFEFF", body], {type:"text/plain;charset=utf-8"}));
        const a = document.createElement("a");
        a.href = url;
        a.download = "Заявка-Промышленная-этикетка-" + date + ".txt";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      if (e.submitter?.value === "file") { download(); status.textContent = "Файл заявки сформирован."; return; }
      if (!contacts.contact.trim()) { status.textContent = "Укажите телефон или email для ответа."; return; }
      const payload = {rows, company:contacts.company, contact:contacts.contact.trim()};
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
      const signature = Array.from(new Uint8Array(digest)).join(".");
      let key = crypto.randomUUID();
      try {
        const pending = JSON.parse(sessionStorage.getItem("promlabel:pending"));
        if (pending?.signature === signature) key = pending.key;
        sessionStorage.setItem("promlabel:pending", JSON.stringify({key,signature}));
      } catch {}
      if (form.dataset.busy) return;
      form.dataset.busy = "1";
      dialog.querySelectorAll("button,input").forEach(el => el.disabled = true);
      const keepOpen = event => event.preventDefault();
      dialog.addEventListener("cancel",keepOpen);
      status.textContent = "Отправляем заказ…";
      try {
        const response = await fetch("/api/orders", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,key}),signal:AbortSignal.timeout(25000)});
        const answer = await response.json();
        if (!response.ok || !answer.number) {
          status.textContent = answer.error === "mail_unconfigured" ? "Приём заказов через сайт подключается. Скачайте заявку или свяжитесь с отделом продаж: " + mail : "Отправка не подтверждена. Корзина сохранена. Можно повторить попытку.";
          return;
        }
        rows = []; save();
        try { sessionStorage.removeItem("promlabel:pending"); } catch {}
        contacts.company = ""; contacts.contact = "";
        showDialog('<h2 id="pc-modal-title" tabindex="-1">Заказ № ' + escape(answer.number) + '</h2><p>Почтовый сервис принял письмо для отдела продаж. Мы свяжемся с вами по указанному контакту.</p>', source);
      } catch {
        status.textContent = "Не удалось подтвердить отправку. Корзина сохранена. Попробуйте ещё раз.";
      } finally {
        delete form.dataset.busy;
        dialog.removeEventListener("cancel",keepOpen);
        dialog.querySelectorAll("button,input").forEach(el => el.disabled = false);
      }
    };
  }
  host.innerHTML = '<div class="pc-heading"><h2>Каталог продукции</h2><p>Выберите товары и количество. Корзина рассчитает стоимость с учётом объёма.</p></div><div class="pc-tools"><div class="pc-modes" role="group" aria-label="Подбор продукции"><button data-mode="example" type="button">Товары</button><button data-mode="custom" type="button">По своим параметрам</button></div><label class="pc-search"><span>Поиск по каталогу</span><input type="search" placeholder="Название или размер, например 58×40" aria-label="Поиск по названию или размеру"></label></div><p class="pc-mode-note"></p><div class="pc-filters" role="group" aria-label="Группы продукции">' + groups.map(g => '<button type="button" data-filter="' + g + '">' + g + '</button>').join("") + '</div><div class="pc-grid"></div><div class="pc-tail"><span class="pc-result" role="status"></span><button class="pc-secondary" data-more type="button">Показать ещё</button><button class="pc-secondary" type="button" data-cart-open>Моя заявка (<span data-cart-count>0</span>)</button></div>';
  host.querySelector("input[type=search]").oninput = e => { query = e.target.value; pageSize = 6; drawCards(); };
  drawCards();
  updateCounters();
  host.addEventListener("click", e => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.mode) {
      mode = button.dataset.mode;
      group = "Все";
      pageSize = 6;
      query = "";
      host.querySelector("input[type=search]").value = "";
      drawCards();
    }
    if (button.dataset.filter) { group = button.dataset.filter; pageSize = 6; drawCards(); }
    if (button.hasAttribute("data-more")) { pageSize += 6; drawCards(); }
    if (button.dataset.select) configure(button.dataset.select, button);
  });
  document.addEventListener("click", e => {
    const trigger = e.target.closest("[data-cart-open]");
    if (trigger) { e.preventDefault(); cart(trigger); }
  });
})();
