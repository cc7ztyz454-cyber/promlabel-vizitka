(() => {
  "use strict";
  const host = document.getElementById("catalog");
  if (!host) return;

  const items = window.PromlabelProducts;
  const groups = ["Все", "Этикетки", "Упаковка", "Расходники", "Оборудование"];
  const products = new Map(items.map(item => [item.id, item]));
  const storageKey = "promlabel52:request:v1";
  const checkoutEnabled = host.dataset.checkout === "live";
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
    const activeItems = items.filter(i => i.kind === mode);
    const matches = activeItems.filter(i => {
      const searchable = normalize([i.name, i.description, i.group, i.id, i.sourceSku].join(" "));
      return (group === "Все" || i.group === group) && terms.every(t => searchable.includes(t));
    });
    const visible = matches.slice(0, pageSize);
    host.querySelector(".pc-mode-note").textContent = mode === "example" ? "Наличие и срок поставки подтвердит менеджер." : "Укажите нужные размеры, материал или модель при добавлении в корзину.";
    host.querySelector(".pc-result").textContent = "Показано " + visible.length + " из " + matches.length;
    host.querySelector("[data-more]").hidden = matches.length <= pageSize;
    host.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    host.querySelectorAll("[data-filter]").forEach(b => b.hidden = b.dataset.filter !== "Все" && !activeItems.some(i => i.group === b.dataset.filter));
    host.querySelector(".pc-grid").innerHTML = visible.map(i =>
      '<article class="pc-card"><span class="pc-group">' + i.group + '</span><h3>' + i.name + '</h3><p>' + i.description + '</p><div class="pc-cardfoot"><span>' + ("Ед. заказа · " + i.unit) + '</span><button type="button" data-select="' + i.id + '" aria-label="Выбрать: ' + i.name + '">Выбрать <b aria-hidden="true">+</b></button></div></article>'
    ).join("") || '<p class="pc-no-results">Совпадений нет. Попробуйте другой размер или выберите «По своим параметрам».</p>';
    host.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === group)));
  }
  function configure(id, source) {
    const i = products.get(id);
    showDialog('<h2 id="pc-modal-title" tabindex="-1">' + i.name + '</h2><p>' + i.description + '</p>' + '<form class="pc-fields"><label>Количество, ' + i.unit + '<input name="qty" type="number" ' + quantityAttrs(i, i.minQty ?? 1) + '>' + (i.step > 1 ? '<small>Кратно ' + i.step + ' ' + i.unit + '</small>' : '') + '</label><label>Параметры позиции<textarea name="spec" maxlength="300" placeholder="' + i.hint + '"></textarea></label><p class="pc-feedback" role="status"></p><button class="pc-primary">В корзину</button></form>', source);
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
      showDialog('<h2 id="pc-modal-title" tabindex="-1">Товар в корзине</h2><p>' + i.name + ' · ' + fmt.format(qty) + ' ' + i.unit + '</p><div class="pc-actions"><button class="pc-primary" data-review>Открыть корзину</button><button class="pc-secondary" data-continue>Продолжить выбор</button></div>', source);
      dialog.querySelector("[data-review]").onclick = () => cart(source);
      dialog.querySelector("[data-continue]").onclick = () => dialog.close();
    };
  }
  const contacts = {company: "", contact: ""};
  function telegramCart() {
    const account = document.querySelector(".sales-help")?.dataset.telegram;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(account ?? "")) return "";
    const text = ["Здравствуйте! Хочу оформить заказ в ПромЛейбл.", ...rows.map((row, ix) => {
      const item = products.get(row.id);
      return (ix + 1) + ". " + item.name + " — " + fmt.format(row.qty) + " " + item.unit;
    })].join("\n");
    const url = new URL("https://t.me/" + account);
    if (text.length <= 2400) url.searchParams.set("text", text);
    return url.href;
  }
  function cart(source) {
    const list = rows.map((row, ix) => {
      const item = products.get(row.id);
      return '<li><strong>' + item.name + '</strong>' + (row.spec ? '<small>' + escape(row.spec) + '</small>' : '')
        + '<div class="pc-row"><label>Количество, ' + item.unit + '<input form="pc-order" data-index="' + ix
        + '" type="number" ' + quantityAttrs(item, row.qty) + '></label><button type="button" data-delete="' + ix + '" aria-label="Удалить ' + item.name + '">Удалить</button></div></li>';
    }).join("");
    const maxLink = document.querySelector("[data-max-contact]:not([hidden])")?.href;
    const formMarkup = checkoutEnabled
      ? '<label>Компания <span>· необязательно</span><input name="company" maxlength="120" autocomplete="organization" value="' + escape(contacts.company)
        + '"></label><label>Телефон или email для ответа<input name="contact" required maxlength="150" value="' + escape(contacts.contact)
        + '"></label><label class="pc-consent"><input name="consent" type="checkbox" required> <span>Согласен на обработку контактных данных для заказа. '
        + '<a href="/order-consent.html" target="_blank" rel="noopener">Текст согласия</a></span></label>'
        + '<button class="pc-primary" type="submit">Оформить заказ</button><p role="status" class="pc-feedback"></p>'
      : '<p class="pc-note">Заказ можно согласовать с Антоном. В Telegram откроется черновик с позициями из корзины.</p>'
        + '<div class="pc-actions">'
        + (maxLink ? '<a class="pc-primary" href="' + escape(maxLink) + '" target="_blank" rel="noopener noreferrer">Написать в MAX</a>' : '')
        + '<a class="' + (maxLink ? 'pc-secondary' : 'pc-primary') + '" data-order-telegram target="_blank" rel="noopener noreferrer">Отправить заказ в Telegram</a>'
        + '<a class="pc-secondary" href="tel:+79877532533">Позвонить</a></div>';
    showDialog('<h2 id="pc-modal-title" tabindex="-1">Корзина</h2>' + (!rows.length
      ? '<p>Корзина пуста. Выберите товары в каталоге.</p><a href="#catalog" class="pc-primary" data-return>Перейти в каталог</a>'
      : '<ul class="pc-lines">' + list + '</ul><form id="pc-order" class="pc-fields">' + formMarkup + '</form>'), source);
    if (!rows.length) {
      dialog.querySelector("[data-return]").onclick = () => dialog.close();
      return;
    }
    const form = dialog.querySelector("form");
    const telegram = form.querySelector("[data-order-telegram]");
    const refreshContactLink = () => {
      if (!telegram) return;
      const url = telegramCart();
      telegram.hidden = !url;
      if (url) telegram.href = url;
      else telegram.removeAttribute("href");
    };
    const quantityInputs = [...dialog.querySelectorAll("[data-index]")];
    const updateQuantity = input => {
      const row = rows[Number(input.dataset.index)];
      const qty = Number(input.value);
      if (!quantityAllowed(products.get(row.id), qty)) return;
      row.qty = qty;
      save();
      refreshContactLink();
    };
    dialog.querySelector("[data-order-telegram]")?.addEventListener("click", event => {
      const invalid = quantityInputs.find(input => !input.validity.valid);
      if (invalid) { event.preventDefault(); invalid.reportValidity(); }
    });
    quantityInputs.forEach(input => {
      input.addEventListener("input", () => updateQuantity(input));
      input.addEventListener("blur", () => {
        if (!input.validity.valid) input.value = rows[Number(input.dataset.index)].qty;
      });
    });
    dialog.querySelectorAll("[data-delete]").forEach(button => {
      button.onclick = () => { rows.splice(Number(button.dataset.delete), 1); save(); cart(source); };
    });
    refreshContactLink();
    form.onsubmit = async event => {
      event.preventDefault();
      if (!checkoutEnabled || form.dataset.busy) return;
      const data = new FormData(form);
      contacts.company = data.get("company").trim();
      contacts.contact = data.get("contact").trim();
      const status = form.querySelector("[role=status]");
      if (!contacts.contact || data.get("consent") !== "on") {
        status.textContent = "Укажите контакт и отметьте согласие на обработку данных.";
        return;
      }
      const payload = {rows:rows.map(row => ({...row})), company:contacts.company, contact:contacts.contact, consent:true};
      form.dataset.busy = "1";
      const controls = [...dialog.querySelectorAll("button,input")];
      controls.forEach(control => { control.disabled = true; });
      const keepOpen = event => event.preventDefault();
      dialog.addEventListener("cancel", keepOpen);
      status.textContent = "Отправляем заказ…";
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
        const signature = Array.from(new Uint8Array(digest)).join(".");
        let key = crypto.randomUUID();
        try {
          const pending = JSON.parse(sessionStorage.getItem("promlabel:pending"));
          if (pending?.signature === signature) key = pending.key;
          sessionStorage.setItem("promlabel:pending", JSON.stringify({key,signature}));
        } catch {}
        const response = await fetch("/api/orders", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({...payload,key}), signal:AbortSignal.timeout(25000),
        });
        const answer = await response.json();
        if (!response.ok || !answer.number) throw new Error("Order not confirmed");
        rows = [];
        save();
        try { sessionStorage.removeItem("promlabel:pending"); } catch {}
        contacts.company = "";
        contacts.contact = "";
        showDialog('<h2 id="pc-modal-title" tabindex="-1">Заказ № ' + escape(answer.number)
          + '</h2><p>Заказ отправлен в отдел продаж. Менеджер свяжется с вами по указанному контакту.</p>', source);
      } catch {
        status.textContent = "Отправка пока не подтверждена. Корзина сохранена. Попробуйте ещё раз или позвоните в отдел заказов.";
      } finally {
        delete form.dataset.busy;
        dialog.removeEventListener("cancel", keepOpen);
        controls.forEach(control => { control.disabled = false; });
      }
    };
  }
  host.innerHTML = '<div class="pc-heading"><h2>Каталог продукции</h2><p>Выберите товары и укажите количество для заказа.</p></div><nav class="catalog-shortcuts" aria-label="Быстрый выбор в каталоге"><a href="#catalog" data-catalog-query="58×40">Этикетки 58×40</a><a href="#catalog" data-catalog-query="100×150">Этикетки 100×150</a><a href="#catalog" data-catalog-query="риббон">Риббоны</a><a href="#guide">Как выбрать</a></nav><div class="pc-tools"><div class="pc-modes" role="group" aria-label="Подбор продукции"><button data-mode="example" type="button">Товары</button><button data-mode="custom" type="button">По своим параметрам</button></div><label class="pc-search"><span>Поиск по каталогу</span><input type="search" placeholder="Название или размер, например 58×40" aria-label="Поиск по названию или размеру"></label></div><p class="pc-mode-note"></p><div class="pc-filters" role="group" aria-label="Группы продукции">' + groups.map(g => '<button type="button" data-filter="' + g + '">' + g + '</button>').join("") + '</div><div class="pc-grid"></div><div class="pc-tail"><span class="pc-result" role="status"></span><button class="pc-secondary" data-more type="button">Показать ещё</button><button class="pc-secondary" type="button" data-cart-open>Корзина (<span data-cart-count>0</span>)</button></div>';
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
    const shortcut = e.target.closest("[data-catalog-query]");
    if (shortcut) {
      mode = "example";
      group = "Все";
      pageSize = 6;
      query = shortcut.dataset.catalogQuery;
      host.querySelector("input[type=search]").value = query;
      drawCards();
    }
    const custom = e.target.closest("[data-custom-product]");
    if (custom && products.get(custom.dataset.customProduct)?.kind === "custom") {
      e.preventDefault();
      configure(custom.dataset.customProduct, custom);
    }
    const trigger = e.target.closest("[data-cart-open]");
    if (trigger) { e.preventDefault(); cart(trigger); }
  });
})();
