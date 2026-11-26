const FDC_URL = 'https://api.nal.usda.gov/fdc/v1';
const MEAL_URL = 'https://www.themealdb.com/api/json/v1/1';
const nutritionCache = new Map();

// Workers return Web Response objects instead of opening a Node HTTP server.
function send(status, payload) {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

// Map USDA nutrient IDs to the smaller nutrient shape used by the mobile app.
function nutrientsFor(food) {
  const nutrients = food.foodNutrients || [];
  const get = (id, names) => {
    const exact = nutrients.find((item) => item.nutrientId === id || item.nutrient?.id === id);
    const match =
      exact ||
      nutrients.find((item) => {
        const name = (item.nutrientName || item.nutrient?.name || '').toLowerCase();
        const unit = (item.unitName || item.nutrient?.unitName || '').toLowerCase();
        return names.includes(name) && (!name.includes('energy') || unit === 'kcal');
      });
    return typeof match?.value === 'number' ? match.value : null;
  };
  return {
    kcal: get(1008, ['energy']),
    protein: get(1003, ['protein']),
    fat: get(1004, ['total lipid (fat)', 'total fat']),
    carbohydrates: get(1005, ['carbohydrate, by difference', 'carbohydrate']),
    fiber: get(1079, ['fiber, total dietary', 'dietary fiber']),
    sugars: get(2000, ['sugars, total including nlea']),
  };
}

// Normalize USDA records and convert branded label values to per-100-gram values when possible.
function normalizeFood(food) {
  const servingSize = typeof food.servingSize === 'number' ? food.servingSize : null;
  const servingSizeUnit = food.servingSizeUnit || null;
  const canConvertServingTo100g =
    food.dataType === 'Branded' && servingSize && servingSizeUnit?.toLowerCase() === 'g';
  const multiplier = canConvertServingTo100g ? 100 / servingSize : 1;
  const rawNutrients = nutrientsFor(food);
  const nutrients = Object.fromEntries(
    Object.entries(rawNutrients).map(([key, value]) => [
      key,
      value === null ? null : Number((value * multiplier).toFixed(2)),
    ]),
  );
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType || null,
    brandName: food.brandName || food.brandOwner || null,
    servingSize,
    servingSizeUnit,
    nutritionBasis:
      food.dataType === 'Branded' && !canConvertServingTo100g
        ? `per ${servingSize || 'label'} ${servingSizeUnit || 'serving'}`
        : 'per 100 g',
    per100g: food.dataType !== 'Branded' || Boolean(canConvertServingTo100g),
    nutrients,
  };
}

async function fdcSearch(query, env) {
  if (!env.FDC_API_KEY) throw new Error('USDA API key is not configured on the API server.');
  const url = new URL(`${FDC_URL}/foods/search`);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '8');
  url.searchParams.set('sortBy', 'score');
  url.searchParams.set('sortOrder', 'desc');
  for (const type of ['Foundation', 'SR Legacy', 'FNDDS', 'Branded'])
    url.searchParams.append('dataType', type);
  url.searchParams.set('api_key', env.FDC_API_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`USDA search failed (${response.status}).`);
  const data = await response.json();
  const results = (data.foods || []).map(normalizeFood);
  const brandedQuery = results.some(
    (food) => food.brandName && query.toLowerCase().includes(food.brandName.toLowerCase()),
  );
  return results.sort((left, right) => {
    const rank = (food) => {
      const brandMatch =
        brandedQuery && food.brandName && query.toLowerCase().includes(food.brandName.toLowerCase())
          ? -20
          : 0;
      const rawFoodBias = /\b(raw|fresh)\b/i.test(food.description) ? 0 : 10;
      const sourceBias =
        food.dataType === 'Foundation'
          ? 0
          : food.dataType === 'SR Legacy'
            ? 1
            : food.dataType === 'FNDDS'
              ? 2
              : 5;
      return brandMatch + rawFoodBias + sourceBias;
    };
    return rank(left) - rank(right);
  });
}

function mealIngredients(meal) {
  return Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    const name = (meal[`strIngredient${number}`] || '').trim();
    const measure = (meal[`strMeasure${number}`] || '').trim();
    return name ? { name, measure } : null;
  }).filter(Boolean);
}

function gramsFromMeasure(measure) {
  const match = measure.match(/(\d+(?:\.\d+)?|\d+\/\d+)\s*(kg|g|grams?|oz|ounces?|lb|pounds?)\b/i);
  if (!match) return null;
  const amount = match[1].includes('/')
    ? match[1]
        .split('/')
        .map(Number)
        .reduce((numerator, denominator) => numerator / denominator)
    : Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor =
    unit === 'kg'
      ? 1000
      : unit.startsWith('oz') || unit.startsWith('ounce')
        ? 28.3495
        : unit === 'lb' || unit.startsWith('pound')
          ? 453.592
          : 1;
  return amount * factor;
}

async function nutritionForRecipe(ingredients, env) {
  // Recipe totals include only ingredients with measurable weights and a matching USDA record.
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbohydrates = 0;
  let fiber = 0;
  let sugars = 0;
  let included = 0;
  let weighed = 0;

  for (const ingredient of ingredients) {
    const grams = gramsFromMeasure(ingredient.measure);
    if (!grams) continue;
    weighed += 1;
    const cacheKey = ingredient.name.toLowerCase();
    let match = nutritionCache.get(cacheKey);
    if (match === undefined) {
      try {
        match =
          (await fdcSearch(ingredient.name, env)).find(
            (food) => food.per100g && food.nutrients.kcal !== null,
          ) || null;
      } catch {
        match = null;
      }
      nutritionCache.set(cacheKey, match);
    }
    if (!match) continue;
    const ratio = grams / 100;
    included += 1;
    kcal += (match.nutrients.kcal || 0) * ratio;
    protein += (match.nutrients.protein || 0) * ratio;
    fat += (match.nutrients.fat || 0) * ratio;
    carbohydrates += (match.nutrients.carbohydrates || 0) * ratio;
    fiber += (match.nutrients.fiber || 0) * ratio;
    sugars += (match.nutrients.sugars || 0) * ratio;
  }

  return included
    ? {
        basis: 'measurable ingredients only',
        complete: included === ingredients.length && weighed === ingredients.length,
        matchedIngredients: included,
        totalIngredients: ingredients.length,
        kcal: Math.round(kcal),
        protein: Number(protein.toFixed(1)),
        fat: Number(fat.toFixed(1)),
        carbohydrates: Number(carbohydrates.toFixed(1)),
        fiber: Number(fiber.toFixed(1)),
        sugars: Number(sugars.toFixed(1)),
      }
    : null;
}

async function normalizeMeal(meal, availableIngredients = [], env) {
  const ingredients = mealIngredients(meal);
  const pantry = availableIngredients.map((value) => value.toLowerCase());
  const matchedIngredients = ingredients
    .filter((ingredient) =>
      pantry.some(
        (value) =>
          ingredient.name.toLowerCase().includes(value) ||
          value.includes(ingredient.name.toLowerCase()),
      ),
    )
    .map((ingredient) => ingredient.name);
  return {
    id: meal.idMeal,
    title: meal.strMeal,
    category: meal.strCategory || '',
    area: meal.strArea || '',
    image: meal.strMealThumb || '',
    instructions: meal.strInstructions || '',
    sourceUrl: meal.strSource || '',
    ingredients,
    matchedIngredients,
    nutrition: await nutritionForRecipe(ingredients, env),
  };
}

async function mealRequest(path, query = {}) {
  const url = new URL(`${MEAL_URL}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Recipe search failed (${response.status}).`);
  return response.json();
}

async function route(request, env) {
  // Routes cover the health check, USDA search, and MealDB recipes.
  if (request.method === 'OPTIONS') return send(204, {});
  const url = new URL(request.url);
  if (url.pathname === '/api/health')
    return send(200, { ok: true, usdaConfigured: Boolean(env.FDC_API_KEY) });

  try {
    if (url.pathname === '/api/pantry' && request.method === 'GET')
      // Pantry items belong to each device or Supabase account, never a public global KV value.
      return send(200, { foods: [] });

    if (url.pathname === '/api/foods/search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query) return send(400, { error: 'Enter a food name to search.' });
      return send(200, { foods: await fdcSearch(query, env) });
    }

    if (url.pathname === '/api/recipes') {
      const query = url.searchParams.get('q')?.trim();
      const ingredients = (url.searchParams.get('ingredients') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 5);
      let meals = [];
      if (query) {
        const data = await mealRequest('search.php', { s: query });
        meals = data.meals || [];
      } else if (ingredients.length) {
        const candidateMap = new Map();
        for (const ingredient of ingredients) {
          const data = await mealRequest('filter.php', { i: ingredient.replaceAll(' ', '_') });
          for (const meal of data.meals || []) candidateMap.set(meal.idMeal, meal);
        }
        const candidates = [...candidateMap.values()].slice(0, 12);
        const details = await Promise.all(
          candidates.map((meal) => mealRequest('lookup.php', { i: meal.idMeal })),
        );
        meals = details.map((data) => data.meals?.[0]).filter(Boolean);
      }

      const normalized = await Promise.all(
        meals.map((meal) => normalizeMeal(meal, ingredients, env)),
      );
      if (!query)
        normalized.sort(
          (left, right) => right.matchedIngredients.length - left.matchedIngredients.length,
        );
      return send(200, { recipes: normalized });
    }

    return send(404, { error: 'Route not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected API error.';
    return send(502, { error: message });
  }
}

export default {
  fetch(request, env) {
    return route(request, env);
  },
};
