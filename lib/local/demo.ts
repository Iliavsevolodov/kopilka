import { addDays, format, parseISO, subMonths } from "date-fns";
import { emptyState, today, type State } from "./model";
export function demoState(): State {
  const s = emptyState();
  const now = today();
  s.mode = "demo";
  s.profile = {
    ...s.profile,
    name: "Илья",
    onboarded: true,
    monthlyIncomeMinor: 15000000,
    mandatoryMinor: 3500000,
    reserveMonths: 3,
  };
  s.accounts = [
    {
      id: "card",
      name: "Основная карта",
      type: "card",
      initialMinor: 0,
      currency: "RUB",
      includeInTotal: true,
      archived: false,
      color: "#19765f",
    },
    {
      id: "savings",
      name: "На большое будущее",
      type: "savings",
      initialMinor: 24000000,
      currency: "RUB",
      includeInTotal: true,
      archived: false,
      color: "#9383c5",
    },
    {
      id: "cash",
      name: "Наличные",
      type: "cash",
      initialMinor: 1850000,
      currency: "RUB",
      includeInTotal: true,
      archived: false,
      color: "#c29b55",
    },
  ];
  let counter = 0;
  const cat = (name: string, kind = "expense") =>
    s.categories.find((c) => c.name === name && c.kind === kind)!.id;
  function tx(
    date: string,
    type: "income" | "expense",
    name: string,
    amount: number,
    description: string,
    mandatory = false,
  ) {
    s.transactions.push({
      id: `demo-${counter++}`,
      type,
      amountMinor: amount * 100,
      accountId: "card",
      categoryId: cat(name, type),
      date,
      description,
      mandatory,
      impulsive: !mandatory && counter % 13 === 0,
      source: "demo",
      createdAt: `${date}T12:00:00.000Z`,
    });
  }
  const start = format(
    subMonths(parseISO(now.slice(0, 7) + "-01"), 6),
    "yyyy-MM-dd",
  );
  for (
    let d = parseISO(start);
    format(d, "yyyy-MM-dd") <= now;
    d = addDays(d, 1)
  ) {
    const date = format(d, "yyyy-MM-dd"),
      day = d.getDate(),
      month = d.getMonth();
    if (day === 10)
      tx(
        date,
        "income",
        "Зарплата",
        105000 + (month % 3) * 4200,
        "Основной доход",
      );
    if (day === 25)
      tx(
        date,
        "income",
        "Бизнес",
        42000 + (month % 4) * 3100,
        "Доход от проектов",
      );
    if (day === 5) tx(date, "expense", "Дом", 28000, "Аренда квартиры", true);
    if (day === 18)
      tx(
        date,
        "expense",
        "ЖКХ",
        6100 + month * 70,
        "Коммунальные услуги",
        true,
      );
    if (day === 12) tx(date, "expense", "Подписки", 799, "Музыка и кино", true);
    if (day % 3 === 0)
      tx(
        date,
        "expense",
        "Продукты",
        1800 + ((day * 137 + month * 79) % 2100),
        "Покупки в супермаркете",
      );
    if (day % 4 === 1)
      tx(
        date,
        "expense",
        "Кафе и рестораны",
        690 + ((day * 173) % 2200),
        "Кофе и встречи",
      );
    if (day % 5 === 0)
      tx(
        date,
        "expense",
        "Такси",
        380 + ((day * 59) % 620),
        "Поездка по городу",
      );
    if (day === 22)
      tx(date, "expense", "Одежда", 6200 + month * 400, "Обновление гардероба");
    if (day === 27)
      tx(
        date,
        "expense",
        "Здоровье",
        3100 + month * 150,
        "Здоровье и забота о себе",
      );
  }
  const net = s.transactions.reduce(
    (n, t) => n + (t.type === "income" ? t.amountMinor : -t.amountMinor),
    0,
  );
  s.accounts[0].initialMinor = 18400000 - net;
  s.budgets = [
    { id: "food-budget", categoryId: cat("Продукты"), limitMinor: 3000000 },
    {
      id: "cafe-budget",
      categoryId: cat("Кафе и рестораны"),
      limitMinor: 1200000,
    },
    { id: "taxi-budget", categoryId: cat("Такси"), limitMinor: 700000 },
  ];
  s.goals = [
    {
      id: "travel",
      name: "Большое путешествие",
      targetMinor: 50000000,
      savedMinor: 12500000,
      date: format(addDays(parseISO(now), 300), "yyyy-MM-dd"),
      icon: "🌴",
      archived: false,
    },
    {
      id: "home",
      name: "Дом, в котором хорошо",
      targetMinor: 300000000,
      savedMinor: 8000000,
      date: format(addDays(parseISO(now), 1000), "yyyy-MM-dd"),
      icon: "🏡",
      archived: false,
    },
  ];
  s.recurring = [
    {
      id: "salary",
      name: "Основной доход",
      type: "income",
      amountMinor: 11000000,
      accountId: "card",
      categoryId: cat("Зарплата", "income"),
      day: 10,
      startDate: now,
      active: true,
      mandatory: false,
    },
    {
      id: "business",
      name: "Доход от проектов",
      type: "income",
      amountMinor: 4500000,
      accountId: "card",
      categoryId: cat("Бизнес", "income"),
      day: 25,
      startDate: now,
      active: true,
      mandatory: false,
    },
    {
      id: "rent",
      name: "Аренда квартиры",
      type: "expense",
      amountMinor: 2800000,
      accountId: "card",
      categoryId: cat("Дом"),
      day: 5,
      startDate: now,
      active: true,
      mandatory: true,
    },
    {
      id: "utilities",
      name: "Коммунальные услуги",
      type: "expense",
      amountMinor: 680000,
      accountId: "card",
      categoryId: cat("ЖКХ"),
      day: 18,
      startDate: now,
      active: true,
      mandatory: true,
    },
    {
      id: "subscription",
      name: "Музыка и кино",
      type: "expense",
      amountMinor: 79900,
      accountId: "card",
      categoryId: cat("Подписки"),
      day: 12,
      startDate: now,
      active: true,
      mandatory: true,
    },
  ];
  return s;
}
