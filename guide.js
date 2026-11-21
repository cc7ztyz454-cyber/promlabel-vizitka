(() => {
  "use strict";

  const form = document.querySelector("#quote-form");
  if (!form) return;
  form.hidden = false;

  const fields = {
    type: "Продукция",
    size: "Размер",
    volume: "Тираж",
    printer: "Принтер",
    notes: "Материал и условия применения",
  };

  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const lines = ["ПромЛейбл — запрос на расчёт тиража", ""];
    for (const [name, label] of Object.entries(fields)) {
      const value = data.get(name).trim();
      if (value) lines.push(label + ": " + value);
    }

    const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], {type: "text/plain;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ПромЛейбл-заявка-на-расчёт.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    form.querySelector(".brief-status").textContent = "Файл готов. Приложите его к письму в отдел заказов.";
  });
})();
