/* Starting content, written to data/db.json on first run.
 *
 * !!! TEST DATA !!!
 * Every calorie figure, allergen list and dietary tag below is PLACEHOLDER data
 * invented for the prototype. It MUST be replaced by the caterer's verified
 * information (Admin → Menu) before this is used with real guests.
 */

const IMG = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`;

const temps = (...t) => t;

const menu = [
  // ---------- DRINKS (TEST DATA) ----------
  { id: 'd-espresso', type: 'drink', name: 'Espresso', desc: 'A short, dark double shot with a long, quiet finish.',
    kcal: 5, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { sugar: true, temps: temps('hot') }, soldOut: false },
  { id: 'd-cappuccino', type: 'drink', name: 'Cappuccino', desc: 'Velvety steamed milk over a rich espresso.',
    kcal: 8, allergens: [], diet: ['vegetarian'],
    options: { milk: true, defaultMilk: 'whole', sugar: true, temps: temps('hot', 'warm') }, soldOut: false },
  { id: 'd-filter', type: 'drink', name: 'Filter Coffee', desc: 'Single-origin, slow-brewed, gently sweet.',
    kcal: 3, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { milk: true, defaultMilk: 'none', sugar: true, temps: temps('hot', 'warm') }, soldOut: false },
  { id: 'd-chai', type: 'drink', name: 'Masala Chai', desc: 'Black tea simmered with cardamom, ginger and clove.',
    kcal: 20, allergens: [], diet: ['vegetarian'],
    options: { milk: true, defaultMilk: 'whole', sugar: true, temps: temps('hot', 'warm') }, soldOut: false },
  { id: 'd-green', type: 'drink', name: 'Japanese Green Tea', desc: 'Light and grassy; calming rather than caffeinated.',
    kcal: 0, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { sugar: true, temps: temps('hot', 'warm', 'cold') }, soldOut: false },
  { id: 'd-juice', type: 'drink', name: 'Fresh Pressed Juice', desc: 'Orange, apple and a little ginger, pressed this morning.',
    kcal: 105, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { ice: true, temps: temps('cold') }, soldOut: false },
  { id: 'd-water', type: 'drink', name: 'Mineral Water', desc: 'Still or sparkling, served as you like it.',
    kcal: 0, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { variants: ['Still', 'Sparkling'], ice: true, temps: temps('cold', 'warm') }, soldOut: false },
  { id: 'd-coldbrew', type: 'drink', name: 'Cold Brew', desc: 'Steeped for eighteen hours. Smooth, low acidity.',
    kcal: 5, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'],
    options: { milk: true, defaultMilk: 'none', sugar: true, ice: true, temps: temps('cold') }, soldOut: false },

  // ---------- SNACKS (TEST DATA) ----------
  { id: 's-biscotti', type: 'snack', name: 'Almond Biscotti', desc: 'Twice-baked, crisp, made for dipping.',
    kcal: 110, allergens: ['gluten', 'nuts', 'eggs'], diet: ['vegetarian'], soldOut: false },
  { id: 's-fruit', type: 'snack', name: 'Seasonal Fruit Plate', desc: 'Whatever is best at the market this week.',
    kcal: 80, allergens: [], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'], soldOut: false },
  { id: 's-hummus', type: 'snack', name: 'Hummus & Crackers', desc: 'Silky chickpea hummus with seeded crackers.',
    kcal: 190, allergens: ['gluten', 'sesame'], diet: ['vegan', 'vegetarian', 'nut-free', 'dairy-free'], soldOut: false },
  { id: 's-cookies', type: 'snack', name: 'Butter Cookies', desc: 'Two soft-centred cookies, baked in-house.',
    kcal: 240, allergens: ['gluten', 'eggs', 'milk', 'soya'], diet: ['vegetarian', 'nut-free'], soldOut: false },
  { id: 's-nuts', type: 'snack', name: 'Roasted Mixed Nuts', desc: 'Lightly salted almonds, cashews and walnuts.',
    kcal: 170, allergens: ['nuts'], diet: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], soldOut: false },
  { id: 's-chocolate', type: 'snack', name: 'Dark Chocolate', desc: 'Three squares of 70% single-estate chocolate.',
    kcal: 130, allergens: ['soya'], diet: ['vegan', 'vegetarian', 'gluten-free', 'nut-free', 'dairy-free'], soldOut: false },
  { id: 's-cheese', type: 'snack', name: 'Cheese & Oatcakes', desc: 'Aged cheddar with Scottish oatcakes and fig.',
    kcal: 210, allergens: ['milk', 'gluten'], diet: ['vegetarian', 'nut-free'], soldOut: false },
  { id: 's-bites', type: 'snack', name: 'Date & Coconut Bites', desc: 'Naturally sweet, with a little crushed almond.',
    kcal: 120, allergens: ['nuts'], diet: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], soldOut: false },
];

// Free Unsplash stock photography, placeholders only. Project names are fictional.
const portfolio = [
  { id: 'p1', title: 'The Glasshouse', location: 'Mumbai', type: 'Residential', image: IMG('1600585154340-be6161a56a0c') },
  { id: 'p2', title: 'Meridian Tower', location: 'Bengaluru', type: 'Commercial', image: IMG('1486406146926-c627a92ad1ab') },
  { id: 'p3', title: 'Casa Alba', location: 'Goa', type: 'Villa & Interiors', image: IMG('1511818966892-d7d671e672a2') },
  { id: 'p4', title: 'Linen & Stone', location: 'Delhi', type: 'Interiors', image: IMG('1600607687939-ce8a6c25118c') },
  { id: 'p5', title: 'The Courtyard Pavilion', location: 'Chennai', type: 'Hospitality', image: IMG('1487958449943-2429e8be8625') },
  { id: 'p6', title: 'Quiet Light', location: 'Pune', type: 'Residential Interiors', image: IMG('1618221195710-dd6b41faaea6') },
];

const news = [
  { id: 'n1', title: 'Meridian Tower reaches topping out', body: 'The final structural beam was placed this month, six weeks ahead of programme.', date: '2026-10-12' },
  { id: 'n2', title: 'Shortlisted for the Hospitality Design Awards', body: 'The Courtyard Pavilion is on the shortlist in the “Place to Pause” category.', date: '2026-10-05' },
  { id: 'n3', title: 'Open studio evening, 14 November', body: 'Join us for an evening of models, materials and conversation. Ask at reception.', date: '2026-09-28' },
];

const settings = {
  idleMessage: 'passion to design',
  welcomeLine: 'Please make yourself comfortable.',
  inactivitySeconds: 90,   // guest screen returns to idle after this much inactivity
  confirmSeconds: 20,      // confirmation screen → idle
  slideSeconds: 9,         // idle slideshow pace
  waitBaseMinutes: 4,      // approximate wait = base + perOrder × orders already queued
  waitPerOrderMinutes: 2,
  retentionHours: 4,       // guest names/orders are purged after this long regardless
};

module.exports = { menu, portfolio, news, settings };
