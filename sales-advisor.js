(() => {
  "use strict";

  const normalize = value => value.toLowerCase().replaceAll("ё", "е").trim();
  const sizePattern = /(\d{2,3})\s*(?:мм\s*)?(?:[xх×*]|на)\s*(\d{2,3})(?!\d)/u;
  const quantityPattern = /(\d{1,3}(?:[ \u00a0]\d{3})+|\d{1,8})\s*(?:рулон|ролик|рул\.)/u;
  const number = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 2});
  const fit = {
    labels: "Этикетки",
    ribbons: "Риббоны",
    printing: "Печать по макету",
    delivery: "Доставка или самовывоз",
    equipment: "Принтеры",
    packaging: "Упаковка",
    other: "Консультация",
  };
  const materials = {eco:"Термо ЭКО", top:"Термо ТОП", gloss:"Полуглянец", pp:"Полипропилен"};
  const materialCodes = {eco:/эко/u, top:/\btop\b|топ/u, gloss:/полуглян/u, pp:/полипропилен|полимер/u};
  const ribbonCodes = {mixed:/wax\s*[/+–-]\s*resin|воск.{0,4}смол/u, wax:/\bwax\b|воск/u, resin:/\bresin\b|смол/u};
  const plainLink = (link, label) => ({link, label});

  function theme(text) {
    if (/достав|самовывоз|склад|адрес|проезд|график|оплат/u.test(text)) return "delivery";
    if (/макет|логотип|флексо|полноцвет|по своим размерам|печать тиража/u.test(text)) return "printing";
    if (/риббон|красящ|wax|resin|лент[ау]/u.test(text)) return "ribbons";
    if (/стрейч|скотч|пленк|упаковочн/u.test(text)) return "packaging";
    if (/принтер/u.test(text) && /купить|модел|подскажите принтер|какой принтер/u.test(text) && !/этикет/u.test(text)) return "equipment";
    if (/этикет|термо|эко|полуглян|полипропилен|втулк|намот/u.test(text)) return "labels";
    return "";
  }

  function variants(items, state) {
    const matches = items.filter(item => {
      const name = normalize(item.name);
      const size = name.match(sizePattern)?.slice(1).join("×");
      if (state.topic === "labels") {
        return item.group === "Этикетки" && size === state.size
          && (!state.material || materialCodes[state.material].test(name));
      }
      if (state.topic === "ribbons") {
        return name.startsWith("риббон") && state.size === size
          && (!state.ribbon || Object.keys(ribbonCodes).find(key => ribbonCodes[key].test(name)) === state.ribbon);
      }
      return false;
    });
    const eligible = item => state.quantity >= (item.minQty ?? 1) && (state.quantity - (item.minQty ?? 1)) % (item.step ?? 1) === 0;
    const cost = item => !Number.isFinite(item.price) ? Infinity : (eligible(item) ? (item.tiers ?? []).reduce((price, tier) => state.quantity >= tier.qty ? tier.price : price, item.price) : item.price);
    return matches.sort((a, b) => cost(a) - cost(b)).slice(0, 3).map(item => {
      const price = cost(item);
      const summary = !Number.isFinite(price) ? "цена по запросу" : number.format(price) + " ₽ / " + item.unit;
      const total = eligible(item) && Number.isFinite(price) ? " · " + number.format(price * state.quantity) + " ₽ за " + number.format(state.quantity) + " " + item.unit : "";
      return {link:"#catalog", label:item.name + " — " + summary + total, query:item.id};
    });
  }

  window.createPromlabelAdvisor = products => {
    const items = products.filter(item => item.kind === "example");
    let state = {topic:"", size:"", quantity:0, material:"", ribbon:"", conditions:""};
    const handoff = (text, reason = "") => ({
      topic: state.topic || "other", text, handoff: true,
      draft: [
        "Здравствуйте! Перехожу из чата сайта ПромЛейбл.",
        state.topic && "Тема: " + fit[state.topic],
        state.size && "Размер: " + state.size + (state.topic === "ribbons" ? " (мм × м)" : " мм"),
        state.quantity && "Количество рулонов: " + number.format(state.quantity),
        state.material && "Материал: " + materials[state.material],
        state.conditions && "Условия: " + state.conditions,
        reason && "Вопрос: " + reason,
      ].filter(Boolean).join("\n"),
    });

    return (input, selectedTopic) => {
      const text = normalize(input);
      const explicit = selectedTopic || theme(text);
      const size = text.match(sizePattern)?.slice(1).join("×");
      const quantity = Number(text.match(quantityPattern)?.[1].replace(/\D/g, "") || (state.size && /^\d{1,8}$/.test(text) ? text : 0));
      const stock = /в налич|наличие|срок|сроч|сегодня|завтра|когда привез/u.test(text);
      const price = /цен|стоим|прайс|сколько.{0,12}стоит|скидк|дешев/u.test(text);
      const human = /менеджер|оператор|жив(ой|ого|ым)\s+(человек|сотрудник)|человека|свяжи|телеграм|telegram|федоров|коммерческ|выстав.{0,5}счет|позвони/u.test(text);
      if (explicit && explicit !== state.topic) state = {topic:explicit, size:"", quantity:0, material:"", ribbon:"", conditions:""};
      if (size) {
        state.topic ||= "labels";
        state.size = size;
      }
      if (quantity) state.quantity = quantity;
      const material = Object.keys(materialCodes).find(key => materialCodes[key].test(text));
      if (material && !/или|отлич|сравн/u.test(text)) state.material = material;
      const ribbon = Object.keys(ribbonCodes).find(key => ribbonCodes[key].test(text));
      if (ribbon) state.ribbon = ribbon;
      if (/мороз|замороз/u.test(text)) state.conditions = "заморозка или низкая температура";
      else if (/влаг|вод[аыу]|холодиль|конденсат/u.test(text)) state.conditions = "влага или конденсат";
      else if (/сух|коротк/u.test(text)) state.conditions = "сухое хранение";
      if (human) return handoff("Конечно. Вот как связаться с менеджером и обсудить заказ напрямую.", /коммерческ|счет/u.test(text) ? "Нужен счёт или коммерческое предложение" : "");
      if (stock) return handoff("Точное наличие и дату отгрузки проверит менеджер. Для обращения уже есть параметры, которые мы уточнили.", "Уточнить наличие и срок отгрузки");
      if (/^(привет|здравствуйте|добрый (день|вечер|утро))[!. ]*$/u.test(text)) return {text:"Здравствуйте! Подберём расходники для принтера или обсудим печать тиража. Что вам нужно?"};
      if (/^(спасибо|благодарю)[!. ]*$/u.test(text)) return {text:"Пожалуйста. Если понадобится сверить параметры рулона или уточнить поставку, я на связи."};
      const continuation = size || quantity || material || ribbon || price
        || /мороз|замороз|влаг|конденсат|пленк|сух|холодиль|короб|пластик|модель|tsc|zebra|godex|втулк|намот/u.test(text);
      if (!explicit && !continuation) {
        return handoff("По этому вопросу лучше уточнить у менеджера. Если хотите, могу ещё посмотреть размер этикетки или подсказать по риббону.");
      }
      if (state.topic === "delivery") return {
        topic:"delivery", text:"Отправляем по России транспортными компаниями. Склад — Дзержинск, Автозаводское шоссе, 85И. Самовывоз и условия доставки по вашему адресу лучше согласовать с менеджером.",
        actions:[plainLink("#warehouse", "Открыть схему проезда")],
      };
      if (state.topic === "printing") return {
        topic:"printing", text: state.size
          ? "Размер " + state.size + " мм записал. Для расчёта добавьте тираж, материал или поверхность и приложите макет, если он есть."
          : "Чтобы рассчитать печать по макету, подскажите размер, тираж и на какую поверхность клеится этикетка. Если размера пока нет, опишите задачу.",
        actions:[plainLink("#quote", "Собрать заявку на расчёт")],
      };
      if (state.topic === "ribbons" && /нуж|требу|без лент/u.test(text) && /эко|термо топ|прям.{0,6}терм/u.test(text)) {
        return {topic:"ribbons", text:"Для прямой термопечати на Термо ЭКО или Термо ТОП риббон не нужен. Он нужен для термотрансферной печати, например по полуглянцевой бумаге или полипропилену. Если сомневаетесь, назовите модель принтера и материал этикетки."};
      }
      if (/отлич|сравн|эко или|эко и топ/u.test(text) && /эко|топ/u.test(text)) {
        return {topic:"labels", text:"Для краткосрочной маркировки в сухих условиях обычно берут Термо ЭКО. Термо ТОП лучше выдерживает влагу и трение. Для заморозки уточните также температуру нанесения и тип клея. В каких условиях будет использоваться этикетка?", actions:[plainLink("#guide","Сравнить материалы")]};
      }
      if (state.topic === "equipment" || state.topic === "packaging") {
        const group = state.topic === "equipment" ? "Оборудование" : "Упаковка";
        return {text:state.topic === "equipment"
          ? "Помогу с выбором. Какая ширина этикетки, сколько печатаете в день и нужна ли печать с риббоном?"
          : "Какая упаковка нужна: стрейч-плёнка или скотч? Для расчёта уточните ширину, толщину и количество рулонов.",
          actions:[{link:"#catalog", label:"Смотреть " + group.toLowerCase(), query:group}]};
      }
      if (state.topic === "labels" && state.conditions === "заморозка или низкая температура" && state.size) {
        return handoff("Для этикетки " + state.size + " мм под заморозку надо сверить температуру нанесения и подобрать клей под поверхность. Менеджер уточнит подходящий материал.", "Подбор этикетки под заморозку");
      }
      if ((state.topic === "labels" || state.topic === "ribbons") && state.size) {
        const offers = variants(items, state);
        const topic = state.topic;
        if (!offers.length) return handoff("В каталоге не вижу точного совпадения по этим параметрам. Менеджер проверит, что можно поставить или изготовить под вашу задачу.", "Подобрать позицию");
        const next = state.quantity ? "Перед заказом сверим совместимость с вашим принтером и наличие." : "Сколько рулонов нужно? От количества может зависеть цена.";
        return {topic,text:"Вот подходящие варианты из каталога. " + next, actions:offers};
      }
      if (state.topic === "ribbons") {
        return {topic:"ribbons", text:"Подберём под принтер. Подскажите модель, материал этикетки и параметры старой ленты, если есть. Например, 57 мм × 74 м, намотка OUT. Для бумаги обычно начинают с WAX, для синтетики часто нужен RESIN."};
      }
      if (state.topic === "labels") {
        if (state.conditions === "заморозка или низкая температура") return {topic:"labels", text:"Для морозилки важны и материал, и клей. Уточните, на что клеите этикетку, при какой температуре наносите и какой нужен размер. По этим данным можно проверить подходящий вариант."};
        if (state.conditions === "влага или конденсат") return {topic:"labels", text:"Для влаги и конденсата обычно рассматривают Термо ТОП. Если нужна длительная стойкость, стоит проверить термотрансферный вариант. Какой размер этикетки и на что будете её клеить?"};
        return {topic:"labels", text:(price ? "Цена зависит от размера, материала и количества рулонов. " : "Помогу подобрать этикетку. ") + "Какой нужен размер? Напишите, например, 58×40 мм. Если знаете модель принтера или условия хранения, тоже укажите."};
      }
      if (price) return {topic:"price", text:"Стоимость зависит от позиции и количества. Что ищете: этикетки, риббон, упаковку или печать по макету?", actions:[plainLink("#catalog","Смотреть цены в каталоге")]};
      return handoff("Пока не хватает параметров для подбора. Уточните задачу у менеджера или напишите, какие этикетки или расходники нужны.");
    };
  };
})();
