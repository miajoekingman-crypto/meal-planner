/* Shared between server (require) and browsers (<script>).
   Allergen vocabulary + how a drink's customisation changes allergens/calories. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // The 14 major allergens regulated in the EU (Regulation 1169/2011).
  const ALLERGENS = [
    { id: 'celery', label: 'Celery' },
    { id: 'gluten', label: 'Cereals containing gluten' },
    { id: 'crustaceans', label: 'Crustaceans' },
    { id: 'eggs', label: 'Eggs' },
    { id: 'fish', label: 'Fish' },
    { id: 'lupin', label: 'Lupin' },
    { id: 'milk', label: 'Milk' },
    { id: 'molluscs', label: 'Molluscs' },
    { id: 'mustard', label: 'Mustard' },
    { id: 'nuts', label: 'Tree nuts' },
    { id: 'peanuts', label: 'Peanuts' },
    { id: 'sesame', label: 'Sesame' },
    { id: 'soya', label: 'Soya' },
    { id: 'sulphites', label: 'Sulphites' },
  ];
  const DIET_TAGS = [
    { id: 'vegan', label: 'Vegan' },
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'gluten-free', label: 'Gluten-free' },
    { id: 'nut-free', label: 'Nut-free' },
    { id: 'dairy-free', label: 'Dairy-free' },
  ];
  // TEST DATA: milk calories (per serving) and the allergens each milk brings.
  const MILKS = [
    { id: 'whole', label: 'Whole', kcal: 60, allergens: ['milk'], diet: [] },
    { id: 'oat', label: 'Oat', kcal: 45, allergens: ['gluten'], diet: ['vegan'] },
    { id: 'almond', label: 'Almond', kcal: 25, allergens: ['nuts'], diet: ['vegan'] },
    { id: 'soy', label: 'Soy', kcal: 40, allergens: ['soya'], diet: ['vegan'] },
    { id: 'none', label: 'None', kcal: 0, allergens: [], diet: ['vegan'] },
  ];
  const SUGARS = [0, 25, 50, 75, 100];
  const ICES = ['none', 'light', 'regular'];
  const TEMPS = ['hot', 'warm', 'cold'];
  const SUGAR_KCAL_AT_100 = 20; // TEST DATA

  const allergenLabel = (id) => (ALLERGENS.find((a) => a.id === id) || { label: id }).label;
  const milkById = (id) => MILKS.find((m) => m.id === id);

  function defaultChoices(item) {
    const o = item.options || {};
    const c = {};
    if (o.milk) c.milk = o.defaultMilk || 'none';
    if (o.sugar) c.sugar = 0;
    if (o.ice) c.ice = 'none';
    if (o.temps && o.temps.length) c.temp = o.temps[0];
    if (o.variants && o.variants.length) c.variant = o.variants[0];
    return c;
  }

  // Allergens + calories once the guest's choices are applied.
  function effective(item, choices) {
    choices = choices || {};
    const allergens = new Set(item.allergens || []);
    let kcal = Number(item.kcal) || 0;
    if (item.options && item.options.milk && choices.milk) {
      const m = milkById(choices.milk);
      if (m) { m.allergens.forEach((a) => allergens.add(a)); kcal += m.kcal; }
    }
    if (item.options && item.options.sugar && choices.sugar) {
      kcal += Math.round((SUGAR_KCAL_AT_100 * choices.sugar) / 100);
    }
    return { allergens: [...allergens], kcal };
  }

  // Which milks can this guest safely have (given allergens to avoid)?
  function safeMilks(item, avoid) {
    return MILKS.filter((m) => !m.allergens.some((a) => (avoid || []).includes(a)));
  }

  // Can the guest have this item in at least one configuration?
  function suitable(item, avoid) {
    avoid = avoid || [];
    if (!avoid.length) return true;
    if ((item.allergens || []).some((a) => avoid.includes(a))) return false;
    if (item.options && item.options.milk && !safeMilks(item, avoid).length) return false;
    return true;
  }

  function describeChoices(item, c) {
    c = c || {};
    const parts = [];
    if (c.variant) parts.push(c.variant);
    if (c.temp) parts.push(c.temp[0].toUpperCase() + c.temp.slice(1));
    if (c.milk) parts.push(c.milk === 'none' ? 'No milk' : milkById(c.milk).label + ' milk');
    if (c.sugar !== undefined) parts.push(c.sugar === 0 ? 'No sugar' : c.sugar + '% sugar');
    if (c.ice) parts.push(c.ice === 'none' ? 'No ice' : c.ice[0].toUpperCase() + c.ice.slice(1) + ' ice');
    return parts.join(' · ');
  }

  return { ALLERGENS, DIET_TAGS, MILKS, SUGARS, ICES, TEMPS, allergenLabel, milkById,
    defaultChoices, effective, safeMilks, suitable, describeChoices };
});
