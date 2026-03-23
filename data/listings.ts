export type Listing = {
  id: string;
  agentName: string;
  tone: "friendly" | "formal" | "warm";
  personality: string;
  photo?: string;
  title: string;
  price: number;
  priceLabel: string;
  address: string;
  district: string;
  metro: string;
  metroColor: string;
  rooms: number;
  area: number;
  floor: number;
  totalFloors: number;
  badge?: string;
  kb: {
    listing: Record<string, string>;
    conditions: Record<string, string>;
    apartment: Record<string, string>;
    viewing: Record<string, string>;
    faq: Array<{ q: string; r: string }>;
    owner_notes: string;
  };
};

export const LISTINGS: Listing[] = [
  {
    id: "usacheva-11",
    agentName: "Марина",
    tone: "warm",
    personality: "Опытный агент, знает район, говорит по-соседски тепло",
    photo: "/listings/usacheva-11.jpg",
    title: "2-комн. квартира, 54 м², 7/12 эт.",
    price: 95000,
    priceLabel: "95 000 ₽/мес",
    address: "ул. Усачёва, 11",
    district: "Хамовники",
    metro: "Спортивная",
    metroColor: "#E42313",
    rooms: 2,
    area: 54,
    floor: 7,
    totalFloors: 12,
    badge: "Топ",
    kb: {
      listing: {
        address: "Москва, Хамовники, ул. Усачёва, 11",
        price: "95 000 ₽/мес",
        deposit: "95 000 ₽ (1 месяц)",
        commission: "0",
        available_from: "сейчас",
      },
      conditions: {
        lease_term: "от 11 месяцев",
        pets: "кошки — ок, собаки — уточнять",
        children: "можно",
        smoking: "нельзя",
        sublease: "нельзя",
        utilities:
          "включены ХВС, ГВС, отопление. Электричество по счётчику (~2 500 ₽/мес)",
      },
      apartment: {
        rooms: "2",
        area: "54 м²",
        floor: "7 из 12",
        renovation: "евроремонт 2021",
        furniture: "полностью меблирована: диван, кровать 160см, шкафы, кухня",
        appliances:
          "холодильник, стиральная машина, посудомойка, духовка, кондиционер",
        windows: "во двор, тихо",
        parking: "платная во дворе, 5 000 ₽/мес",
        internet: "есть (Ростелеком)",
      },
      viewing: {
        weekdays: "после 18:00",
        weekends: "с 10:00 до 18:00",
        notice: "за 2 часа",
        contact: "через чат",
      },
      faq: [
        {
          q: "торг",
          r: "Небольшой торг возможен при длительном договоре (от года).",
        },
        { q: "счётчики", r: "Электричество по счётчику, остальное включено." },
        { q: "животные", r: "Кошки ок, собак уточняем с хозяйкой." },
      ],
      owner_notes:
        "Хозяйка ценит аккуратных арендаторов. Предпочтительно без вечеринок.",
    },
  },
  {
    id: "mitino-studio",
    agentName: "Артём",
    tone: "friendly",
    personality: "Молодой агент, простой и прямой, без лишних формальностей",
    photo: "/listings/mitino-studio.jpg",
    title: "Студия, 28 м², 3/9 эт.",
    price: 42000,
    priceLabel: "42 000 ₽/мес",
    address: "ул. Пятницкое шоссе, 18",
    district: "Митино",
    metro: "Митино",
    metroColor: "#0066CC",
    rooms: 0,
    area: 28,
    floor: 3,
    totalFloors: 9,
    badge: "Новинка",
    kb: {
      listing: {
        address: "Москва, Митино, Пятницкое шоссе, 18",
        price: "42 000 ₽/мес",
        deposit: "42 000 ₽",
        commission: "0",
        available_from: "с 1 апреля",
      },
      conditions: {
        lease_term: "от 6 месяцев",
        pets: "нельзя",
        children: "можно",
        smoking: "нельзя",
        sublease: "нельзя",
        utilities: "коммуналка ~4 000 ₽/мес сверху",
      },
      apartment: {
        rooms: "студия",
        area: "28 м²",
        floor: "3 из 9",
        renovation: "свежий косметический ремонт",
        furniture: "кровать, стол, стул, кухонный гарнитур",
        appliances: "холодильник, стиральная машина, плита",
        windows: "на улицу",
        parking: "бесплатная во дворе",
        internet: "нет, можно подключить",
      },
      viewing: {
        weekdays: "с 10:00 до 20:00",
        weekends: "с 10:00 до 16:00",
        notice: "за 1 час",
        contact: "через чат",
      },
      faq: [
        { q: "торг", r: "Возможен при оплате за 3 месяца вперёд." },
        { q: "коммуналка", r: "Примерно 4 000 ₽/мес, по факту." },
        { q: "парковка", r: "Бесплатная во дворе, мест хватает." },
      ],
      owner_notes:
        "Отличный вариант для одного человека или пары. Тихий двор.",
    },
  },
  {
    id: "vykhino-1room",
    agentName: "Анна",
    tone: "friendly",
    personality: "Доброжелательный, отвечает по делу, без воды",
    photo: "/listings/vykhino-1room.jpg",
    title: "1-комн. квартира, 38 м², 5/16 эт.",
    price: 58000,
    priceLabel: "58 000 ₽/мес",
    address: "ул. Ферганская, 7к2",
    district: "Выхино",
    metro: "Выхино",
    metroColor: "#FF6600",
    rooms: 1,
    area: 38,
    floor: 5,
    totalFloors: 16,
    kb: {
      listing: {
        address: "Москва, Выхино, ул. Ферганская, 7к2",
        price: "58 000 ₽/мес",
        deposit: "58 000 ₽",
        commission: "0",
        available_from: "сейчас",
      },
      conditions: {
        lease_term: "от 12 месяцев",
        pets: "кошки — ок",
        children: "можно",
        smoking: "нельзя",
        sublease: "нельзя",
        utilities: "включены все, кроме интернета",
      },
      apartment: {
        rooms: "1",
        area: "38 м²",
        floor: "5 из 16",
        renovation: "хороший ремонт 2019",
        furniture: "диван-кровать, стол, шкаф-купе, кухня",
        appliances: "холодильник, стиралка, микроволновка",
        windows: "во двор, зелёный вид",
        parking: "нет",
        internet: "3 000 ₽/мес отдельно",
      },
      viewing: {
        weekdays: "19:00–21:00",
        weekends: "в любое время",
        notice: "за 3 часа",
        contact: "через чат",
      },
      faq: [
        { q: "торг", r: "Цена окончательная." },
        { q: "коммуналка", r: "Включена в стоимость, кроме интернета." },
        {
          q: "мебель",
          r: "Возможна замена по договорённости с хозяином.",
        },
      ],
      owner_notes:
        "Аккуратная квартира, без животных до этого. Ищем спокойных жильцов.",
    },
  },
  {
    id: "presnya-3room",
    agentName: "Дмитрий",
    tone: "formal",
    personality: "Профессиональный брокер, деловой стиль, обращение на Вы",
    photo: "/listings/presnya-3room.jpg",
    title: "3-комн. квартира, 89 м², 12/24 эт.",
    price: 130000,
    priceLabel: "130 000 ₽/мес",
    address: "Краснопресненская наб., 14",
    district: "Пресненский",
    metro: "Краснопресненская",
    metroColor: "#7F0000",
    rooms: 3,
    area: 89,
    floor: 12,
    totalFloors: 24,
    badge: "Премиум",
    kb: {
      listing: {
        address: "Москва, Пресненский, Краснопресненская наб., 14",
        price: "130 000 ₽/мес",
        deposit: "130 000 ₽",
        commission: "0",
        available_from: "с 15 апреля",
      },
      conditions: {
        lease_term: "от 12 месяцев",
        pets: "нельзя",
        children: "можно",
        smoking: "нельзя",
        sublease: "нельзя",
        utilities: "включены все коммунальные",
      },
      apartment: {
        rooms: "3",
        area: "89 м²",
        floor: "12 из 24",
        renovation: "дизайнерский ремонт 2023",
        furniture:
          "полностью: диваны, кровати 180см, гардеробная, кухня с островом",
        appliances: "полный комплект Bosch, кондиционеры в каждой комнате",
        windows: "панорамные, вид на Москву-реку",
        parking: "1 место в подземном паркинге включено",
        internet: "оптика 1Гбит включена",
      },
      viewing: {
        weekdays: "с 12:00 до 19:00",
        weekends: "с 11:00 до 17:00",
        notice: "за 24 часа",
        contact: "через чат",
      },
      faq: [
        { q: "торг", r: "При аренде от 2 лет возможна скидка 5%." },
        {
          q: "парковка",
          r: "Одно место в подземном паркинге включено в цену.",
        },
        {
          q: "вид",
          r: "С 12 этажа открывается вид на Москву-реку и Сити.",
        },
      ],
      owner_notes:
        "Элитный объект. Желательны официально трудоустроенные арендаторы.",
    },
  },
  {
    id: "lyublino-1room",
    agentName: "Светлана",
    tone: "friendly",
    personality: "Хозяйка рядом, простая и открытая, как разговор с соседом",
    photo: "/listings/lyublino-1room.jpg",
    title: "1-комн. квартира, 42 м², 2/5 эт.",
    price: 52000,
    priceLabel: "52 000 ₽/мес",
    address: "ул. Совхозная, 22",
    district: "Люблино",
    metro: "Люблино",
    metroColor: "#FF6600",
    rooms: 1,
    area: 42,
    floor: 2,
    totalFloors: 5,
    kb: {
      listing: {
        address: "Москва, Люблино, ул. Совхозная, 22",
        price: "52 000 ₽/мес",
        deposit: "52 000 ₽",
        commission: "0",
        available_from: "сейчас",
      },
      conditions: {
        lease_term: "от 6 месяцев",
        pets: "можно (небольшие)",
        children: "можно",
        smoking: "на балконе",
        sublease: "нельзя",
        utilities: "3 500 ₽/мес примерно",
      },
      apartment: {
        rooms: "1",
        area: "42 м²",
        floor: "2 из 5",
        renovation: "жилое состояние",
        furniture: "кровать, шкаф, кухонный стол",
        appliances: "холодильник, плита",
        windows: "во двор",
        parking: "во дворе бесплатно",
        internet: "есть",
      },
      viewing: {
        weekdays: "после 18:00",
        weekends: "весь день",
        notice: "за 1 час",
        contact: "через чат",
      },
      faq: [
        { q: "торг", r: "Небольшой торг уместен." },
        {
          q: "животные",
          r: "Небольших животных — ок, уточним породу.",
        },
        { q: "балкон", r: "Есть балкон, застеклённый." },
      ],
      owner_notes:
        "Простая уютная квартира. Хозяйка живёт рядом, всегда на связи.",
    },
  },
];

export const getListingById = (id: string): Listing | undefined =>
  LISTINGS.find((l) => l.id === id);

export const LISTING = LISTINGS[0].kb;
