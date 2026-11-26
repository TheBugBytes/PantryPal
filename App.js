import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import Constants from 'expo-constants';
import {
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Home,
  Pencil,
  Plus,
  Refrigerator,
  Settings,
  Trash2,
} from 'lucide-react-native';
import { supabase, supabaseConfigured } from './supabase';
import { requestExpiryNotificationPermissions, syncExpiryReminders } from './expiryNotifications';
// Keep the app's typography and colors in one place so screens stay visually consistent.
const FONT = {
  fredokaRegular: 'Fredoka_400Regular',
  fredokaMedium: 'Fredoka_500Medium',
  fredokaSemibold: 'Fredoka_600SemiBold',
  fredokaBold: 'Fredoka_700Bold',
  nunitoRegular: 'Nunito_400Regular',
  nunitoMedium: 'Nunito_500Medium',
  nunitoSemibold: 'Nunito_600SemiBold',
  nunitoBold: 'Nunito_700Bold',
};
const C = {
  paper: '#FCF5E3',
  white: '#FFFFFF',
  ink: '#202938',
  muted: '#545E6F',
  mutedFill: '#F3EEE3',
  line: '#E4DDCF',
  green: '#239D6A',
  greenSoft: '#D5F4E2',
  greenInk: '#0A3723',
  peach: '#FFD9C4',
  peachInk: '#5C2A17',
  red: '#DA404E',
  mint: '#BDF4D5',
  categoryPeach: '#FFD0B8',
  lemon: '#FBF1B2',
  sky: '#B9EAFF',
  lilac: '#E4D6FF',
  rose: '#FFCCD3',
  shadow: '#202938',
};
// Expiry and calendar helpers
function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function dateKeyFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
function suggestedExpiryDays(category) {
  if (category === 'Meat') return 2;
  if (category === 'Leafy Greens') return 4;
  return 7;
}
function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function monthKeyFrom(key, offset) {
  const date = dateFromKey(key);
  return dateKey(new Date(date.getFullYear(), date.getMonth() + offset, 1, 12));
}
function dayKeyInMonth(monthKey, selectedDateKey) {
  const month = dateFromKey(monthKey);
  const selectedDay = dateFromKey(selectedDateKey).getDate();
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return dateKey(
    new Date(month.getFullYear(), month.getMonth(), Math.min(selectedDay, lastDay), 12),
  );
}
function calendarDates(expanded, today) {
  if (expanded) {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    const dayCount = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
    return [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from(
        { length: dayCount },
        (_, index) => new Date(today.getFullYear(), today.getMonth(), index + 1, 12),
      ),
    ];
  }
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}
const categoryEmoji = {
  Produce: '🥕',
  'Leafy Greens': '🥬',
  Grains: '🌾',
  Dairy: '🥛',
  Bakery: '🍞',
  Protein: '🥚',
  Meat: '🥩',
  Pantry: '🥫',
};
const QUANTITY_UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'g', label: 'Grams' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'oz', label: 'Ounces' },
  { value: 'lb', label: 'Pounds' },
  { value: 'mL', label: 'Milliliters' },
  { value: 'L', label: 'Liters' },
  { value: 'cup', label: 'Cups' },
  { value: 'tbsp', label: 'Tablespoons' },
  { value: 'tsp', label: 'Teaspoons' },
];
function quantityDescription(amount, unit) {
  const quantity = amount.trim() || '1';
  if (unit === 'pcs') return `${quantity} ${Number(quantity) === 1 ? 'piece' : 'pieces'}`;
  return `${quantity} ${unit}`;
}
// The order here controls the bottom navigation layout.
const tabs = [
  { key: 'Home', icon: 'home' },
  { key: 'Pantry', icon: 'fridge' },
  { key: 'Add', icon: '+' },
  { key: 'Recipes', icon: 'chef' },
  { key: 'Profile', icon: 'settings' },
];
function TabIcon({ name, color }) {
  const Icon =
    name === 'home'
      ? Home
      : name === 'fridge'
        ? Refrigerator
        : name === 'chef'
          ? ChefHat
          : Settings;
  return <Icon size={28} color={color} strokeWidth={2} />;
}
// API and local persistence configuration
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_BASE = process.env.EXPO_PUBLIC_API_URL || `http://${expoHost || 'localhost'}:3001`;
const PANTRY_STORAGE_KEY = 'pantrypal:foods:v1';
const FAVORITES_STORAGE_KEY = 'pantrypal:recipe-favorites:v1';
const PANTRY_OWNER_KEY = 'pantrypal:pantry-owner:v1';
const PANTRY_UPDATED_KEY = 'pantrypal:pantry-updated:v1';
const ACCESS_MODE_KEY = 'pantrypal:access-mode:v1';
const PROFILE_ICON_KEY = 'pantrypal:profile-icon:v1';
const EXPIRY_NOTIFICATIONS_KEY = 'pantrypal:expiry-notifications:v1';
const REMINDER_LEAD_KEY = 'pantrypal:reminder-lead:v1';
const PROFILE_ICONS = [
  '🥗',
  '🍎',
  '🥑',
  '🥕',
  '🥦',
  '🍓',
  '🍋',
  '🫐',
  '🍳',
  '🍞',
  '🧀',
  '🐝',
  '🌱',
  '🌻',
  '🐱',
  '🐶',
  '⭐',
  '🏡',
  '🧑‍🍳',
  '🧺',
];
function parseSavedFoods(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function parseSavedFavorites(value) {
  if (!value) return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((recipe) => recipe && typeof recipe.id === 'string')
    : [];
}
function mergePantryFoods(localFoods, remoteFoods) {
  // Use IDs to combine snapshots; local copies win when an item exists in both places.
  const merged = new Map();
  remoteFoods.forEach((food) => merged.set(food.id, food));
  localFoods.forEach((food) => merged.set(food.id, food));
  return [...merged.values()];
}
function mergeFavorites(localFavorites, remoteFavorites) {
  const merged = new Map(remoteFavorites.map((recipe) => [recipe.id, recipe]));
  localFavorites.forEach((recipe) => merged.set(recipe.id, recipe));
  return [...merged.values()];
}
async function fetchWithTimeout(url, options = {}) {
  // Network requests should fail with a useful message instead of leaving a spinner running.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'The USDA service timed out. Check that your phone and computer are on the same Wi-Fi and the API server is running.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
// Shared text, card, chip, and food-row components
function fontFor(style) {
  const flatStyle = StyleSheet.flatten(style);
  if (flatStyle?.fontFamily) return flatStyle.fontFamily;
  const weight = flatStyle?.fontWeight;
  if (weight === '500') return FONT.nunitoMedium;
  if (weight === '600') return FONT.nunitoSemibold;
  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900')
    return FONT.nunitoBold;
  return FONT.nunitoRegular;
}
function Text({ style, ...props }) {
  return <NativeText {...props} style={[{ fontFamily: fontFor(style) }, style]} />;
}
function Header({ eyebrow, title, right }) {
  return (
    <View style={s.header}>
      <View>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={s.title}>{title}</Text>
      </View>
      {right ? <Text style={s.headerRight}>{right}</Text> : null}
    </View>
  );
}
function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}
function NutritionTile({ label, value, unit, background }) {
  const formatted =
    value == null
      ? '—'
      : unit === 'kcal'
        ? String(Math.round(value))
        : String(Number(value.toFixed(1)));
  return (
    <View style={[s.nutritionTile, { backgroundColor: background }]}>
      <Text style={s.nutritionTileValue}>
        {formatted}
        <Text style={s.nutritionTileUnit}> {unit}</Text>
      </Text>
      <Text style={s.nutritionTileLabel}>{label}</Text>
    </View>
  );
}
function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
function categoryTint(category) {
  switch (category) {
    case 'Produce':
    case 'Leafy Greens':
    case 'Protein':
      return C.mint;
    case 'Bakery':
      return C.categoryPeach;
    case 'Dairy':
    case 'Grains':
      return C.lemon;
    case 'Frozen':
      return C.sky;
    case 'Pantry':
      return C.lilac;
    case 'Meat':
      return C.rose;
    default:
      return C.mutedFill;
  }
}
function expiryTone(days) {
  if (days <= 0) return { background: C.rose, foreground: C.red };
  if (days <= 3) return { background: C.categoryPeach, foreground: C.peachInk };
  return { background: C.mint, foreground: C.greenInk };
}
function FoodRow({ item, trailingAction, deleteAction }) {
  const expiry = expiryTone(item.days);
  const expiryLabel = item.days < 0 ? 'Expired' : item.days === 0 ? 'Today' : `${item.days}d left`;
  return (
    <View style={s.foodRow}>
      <View style={[s.foodEmoji, { backgroundColor: categoryTint(item.category) }]}>
        <Text style={s.foodEmojiText}>{item.emoji}</Text>
      </View>
      <View style={s.foodCopy}>
        <Text style={s.foodName}>{item.name}</Text>
        <Text style={s.foodSub}>
          {item.qty} · {item.category}
          {item.opened ? '  ·  Opened' : ''}
        </Text>
      </View>
      <View style={s.foodRight}>
        {trailingAction}
        <View style={[s.expiryBadge, { backgroundColor: expiry.background }]}>
          <Text style={[s.days, { color: expiry.foreground }]}>{expiryLabel}</Text>
        </View>
        {deleteAction}
      </View>
    </View>
  );
}
function RecipeCard({
  item,
  saved,
  instructionsOpen,
  nutritionOpen,
  onToggleFavorite,
  onToggleInstructions,
  onToggleNutrition,
}) {
  return (
    <Card style={s.recipeCard}>
      <View style={s.recipeTop}>
        <Image source={{ uri: item.image }} style={s.recipeImage} />
        <View style={s.recipeSummary}>
          <Text style={s.recipeTitle}>{item.title}</Text>
          <Text style={s.recipeMeta}>{[item.category, item.area].filter(Boolean).join(' · ')}</Text>
          <Text style={s.recipeIngredientCount}>
            {item.matchedIngredients.length} of {item.ingredients.length} ingredients in your pantry
          </Text>
          <Text style={s.recipeMeta}>Recipe source: TheMealDB</Text>
        </View>
        <TouchableOpacity
          onPress={onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from favorites' : 'Add to favorites'}
          style={s.favoriteButton}
        >
          <Heart
            size={23}
            color={saved ? C.red : C.muted}
            fill={saved ? C.rose : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
      <View style={s.tagWrap}>
        {item.ingredients.map((ingredient, index) => {
          const inPantry = item.matchedIngredients.includes(ingredient.name);
          return (
            <View
              key={`${ingredient.name}-${index}`}
              style={[s.tinyTag, inPantry && s.tinyTagOwned]}
            >
              <Text style={[s.tinyTagText, inPantry && s.tinyTagTextOwned]}>{ingredient.name}</Text>
            </View>
          );
        })}
      </View>
      <TouchableOpacity
        style={[s.nutritionToggle, s.recipeNutritionToggle]}
        onPress={onToggleNutrition}
        accessibilityRole="button"
        accessibilityLabel={`${nutritionOpen ? 'Hide' : 'Show'} nutrition for ${item.title}`}
      >
        <Text style={s.nutritionToggleText}>
          {nutritionOpen ? 'Hide nutrition' : 'Show nutrition'}
        </Text>
      </TouchableOpacity>
      {nutritionOpen ? (
        <View style={s.recipeNutritionPanel}>
          <Text style={s.nutritionPanelHeading}>Nutrition estimate for listed amounts</Text>
          {item.nutrition ? (
            <>
              <View style={s.nutritionGrid}>
                <NutritionTile
                  label="Calories"
                  value={item.nutrition.kcal}
                  unit="kcal"
                  background={C.categoryPeach}
                />
                <NutritionTile
                  label="Protein"
                  value={item.nutrition.protein}
                  unit="g"
                  background={C.mint}
                />
                <NutritionTile
                  label="Carbs"
                  value={item.nutrition.carbohydrates}
                  unit="g"
                  background={C.lemon}
                />
                <NutritionTile
                  label="Fat"
                  value={item.nutrition.fat}
                  unit="g"
                  background={C.rose}
                />
                <NutritionTile
                  label="Fiber"
                  value={item.nutrition.fiber}
                  unit="g"
                  background={C.sky}
                />
                <NutritionTile
                  label="Sugar"
                  value={item.nutrition.sugars}
                  unit="g"
                  background={C.lilac}
                />
              </View>
              <Text style={s.nutritionSource}>
                Source: USDA FoodData Central · {item.nutrition.matchedIngredients}/
                {item.nutrition.totalIngredients} ingredients matched
              </Text>
            </>
          ) : (
            <Text style={s.foodSub}>
              A nutrition estimate isn’t available for this recipe’s listed amounts.
            </Text>
          )}
        </View>
      ) : null}
      {instructionsOpen ? <Text style={s.steps}>{item.instructions}</Text> : null}
      <TouchableOpacity style={s.recipeAction} onPress={onToggleInstructions}>
        <Text style={s.recipeActionText}>
          {instructionsOpen ? 'Hide instructions' : 'Quick instructions'}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}
// Main application state, persistence, and screen layouts
export default function App() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  // Authentication and sync state
  const [appMode, setAppMode] = useState('boot');
  const [sessionUser, setSessionUser] = useState(null);
  const [profileIcon, setProfileIcon] = useState('🥗');
  const [profileIconPickerOpen, setProfileIconPickerOpen] = useState(false);
  const [customProfileIcon, setCustomProfileIcon] = useState('');
  const [profileIconError, setProfileIconError] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearingPantry, setClearingPantry] = useState(false);
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const [pantryOwnerId, setPantryOwnerId] = useState(null);
  const [pantryUpdatedAt, setPantryUpdatedAt] = useState(0);
  // Navigation and calendar state
  const [page, setPage] = useState('Home');
  const [expanded, setExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => dateKey(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => dateKey(new Date()));
  const [expandedNutritionId, setExpandedNutritionId] = useState(null);
  // Pantry, search, and recipe state
  const [foods, setFoods] = useState([]);
  const [pantryReady, setPantryReady] = useState(false);
  const [pantryError, setPantryError] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [reminderLead, setReminderLead] = useState('3 days');
  const [notificationPermissionBusy, setNotificationPermissionBusy] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => dateKeyFromToday(7));
  const [expiryPickerMonth, setExpiryPickerMonth] = useState(() => dateKeyFromToday(7));
  const [expiryPickerOpen, setExpiryPickerOpen] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodEmoji, setFoodEmoji] = useState('🥕');
  const [foodQty, setFoodQty] = useState('1');
  const [foodQtyUnit, setFoodQtyUnit] = useState('pcs');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [foodCategory, setFoodCategory] = useState('Produce');
  const [usdaFoods, setUsdaFoods] = useState([]);
  const [selectedUsdaFood, setSelectedUsdaFood] = useState(null);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState('');
  const [pantryLookupFoodId, setPantryLookupFoodId] = useState(null);
  const [pantryLookupResults, setPantryLookupResults] = useState([]);
  const [pantryLookupLoading, setPantryLookupLoading] = useState(false);
  const [pantryLookupError, setPantryLookupError] = useState('');
  const [nutritionCheckedIds, setNutritionCheckedIds] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState('');
  const [openRecipe, setOpenRecipe] = useState(null);
  const [openRecipeNutrition, setOpenRecipeNutrition] = useState(null);
  // Load and merge this device's pantry and saved recipes with the account snapshot.
  const synchronizePantry = async (
    user,
    localFoods,
    localFavorites,
    localOwnerId,
    localUpdatedAt,
  ) => {
    if (!supabase) return false;
    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from('pantry_snapshots')
        .select('foods, favorites, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      const remoteFoods = Array.isArray(data?.foods) ? data.foods : [];
      const remoteFavorites = parseSavedFavorites(data?.favorites);
      const remoteUpdatedAt = data?.updated_at ? Date.parse(data.updated_at) : 0;
      // Keep the newer account snapshot, except when switching accounts or merging guest data.
      let nextFoods;
      let nextFavorites;
      if (!data) {
        nextFoods = localFoods;
        nextFavorites = localFavorites;
      } else if (localOwnerId && localOwnerId !== user.id) {
        nextFoods = remoteFoods;
        nextFavorites = remoteFavorites;
      } else if (localOwnerId === user.id && localUpdatedAt > remoteUpdatedAt) {
        nextFoods = localFoods;
        nextFavorites = localFavorites;
      } else if (!localOwnerId) {
        nextFoods = mergePantryFoods(localFoods, remoteFoods);
        nextFavorites = mergeFavorites(localFavorites, remoteFavorites);
      } else {
        nextFoods = remoteFoods;
        nextFavorites = remoteFavorites;
      }
      const now = Date.now();
      const { error: saveError } = await supabase.from('pantry_snapshots').upsert(
        {
          user_id: user.id,
          foods: nextFoods,
          favorites: nextFavorites,
          updated_at: new Date(now).toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (saveError) throw saveError;
      await AsyncStorage.multiSet([
        [PANTRY_STORAGE_KEY, JSON.stringify(nextFoods)],
        [FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites)],
        [PANTRY_OWNER_KEY, user.id],
        [PANTRY_UPDATED_KEY, String(now)],
      ]);
      setFoods(nextFoods);
      setFavorites(nextFavorites);
      setPantryOwnerId(user.id);
      setPantryUpdatedAt(now);
      setAccountSyncReady(true);
      setPantryError('');
      return true;
    } catch {
      setFoods(localFoods);
      setFavorites(localFavorites);
      setAccountSyncReady(false);
      setPantryError('Cloud sync is unavailable. Your pantry is saved on this device.');
      return false;
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => {
    // Restore this device's data first, then resume the saved guest or account session.
    let active = true;
    const initialize = async () => {
      let localFoods = [];
      let localFavorites = [];
      let ownerId = null;
      let updatedAt = 0;
      let storedMode = null;
      try {
        const [
          storedFoods,
          storedFavorites,
          storedOwner,
          storedUpdatedAt,
          mode,
          storedProfileIcon,
          storedNotifications,
          storedReminderLead,
        ] = await AsyncStorage.multiGet([
          PANTRY_STORAGE_KEY,
          FAVORITES_STORAGE_KEY,
          PANTRY_OWNER_KEY,
          PANTRY_UPDATED_KEY,
          ACCESS_MODE_KEY,
          PROFILE_ICON_KEY,
          EXPIRY_NOTIFICATIONS_KEY,
          REMINDER_LEAD_KEY,
        ]);
        localFoods = parseSavedFoods(storedFoods[1]);
        localFavorites = parseSavedFavorites(storedFavorites[1]);
        ownerId = storedOwner[1];
        updatedAt = Number(storedUpdatedAt[1] || 0);
        storedMode = mode[1];
        if (storedProfileIcon?.[1]) setProfileIcon(storedProfileIcon[1]);
        setNotifications(storedNotifications?.[1] === 'true');
        if (['1 day', '3 days', '1 week'].includes(storedReminderLead?.[1])) {
          setReminderLead(storedReminderLead[1]);
        }
        // Import an existing development-server pantry once, so switching to device storage keeps current items.
        if (!storedFoods[1]) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          try {
            const response = await fetch(`${API_BASE}/api/pantry`, { signal: controller.signal });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data.foods)) localFoods = data.foods;
            }
          } catch {
            // Guest mode remains usable if the old local server is unavailable.
          } finally {
            clearTimeout(timeout);
          }
        }
      } catch {
        localFoods = [];
      }
      if (!active) return;
      setPantryOwnerId(ownerId);
      setPantryUpdatedAt(updatedAt);
      let session = null;
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          session = data.session?.user ?? null;
        } catch {
          // A cached guest pantry can still be opened if Supabase is unreachable.
        }
      }
      if (!active) return;
      if (session) {
        setSessionUser(session);
        if (typeof session.user_metadata?.avatar_icon === 'string')
          setProfileIcon(session.user_metadata.avatar_icon);
        setFoods(localFoods);
        setFavorites(localFavorites);
        await synchronizePantry(session, localFoods, localFavorites, ownerId, updatedAt);
        if (active) setAppMode('account');
      } else {
        setFoods(localFoods);
        setFavorites(localFavorites);
        setAccountSyncReady(false);
        setAppMode(storedMode === 'guest' ? 'guest' : 'auth');
      }
      if (active) setPantryReady(true);
    };
    void initialize();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    // Save pantry and favorites locally, then debounce account snapshot writes.
    if (!pantryReady) return;
    const updatedAt = Date.now();
    setPantryUpdatedAt(updatedAt);
    void AsyncStorage.multiSet([
      [PANTRY_STORAGE_KEY, JSON.stringify(foods)],
      [FAVORITES_STORAGE_KEY, JSON.stringify(favorites)],
      [PANTRY_UPDATED_KEY, String(updatedAt)],
    ]).catch(() => setPantryError('Could not save your pantry on this device.'));
    const client = supabase;
    if (appMode !== 'account' || !sessionUser || !accountSyncReady || !client) return;
    const timer = setTimeout(async () => {
      setSyncing(true);
      const { error } = await client.from('pantry_snapshots').upsert(
        {
          user_id: sessionUser.id,
          foods,
          favorites,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error)
        setPantryError(
          'Cloud sync failed. Your changes are still saved on this device; tap Sync now when online.',
        );
      else setPantryError('');
      setSyncing(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [foods, favorites, pantryReady, appMode, sessionUser?.id, accountSyncReady]);
  useEffect(() => {
    // Keep the device's scheduled reminders aligned with the saved pantry and profile settings.
    if (!pantryReady) return;

    let active = true;
    const reconcileReminders = async () => {
      const result = await syncExpiryReminders(foods, notifications, reminderLead);
      if (!active) return;

      if (notifications && !result.permissionGranted) {
        setNotifications(false);
        await AsyncStorage.setItem(EXPIRY_NOTIFICATIONS_KEY, 'false').catch(() => {});
        setNotificationError('Allow notifications in device settings to receive expiry reminders.');
      } else if (notifications) {
        setNotificationError('');
      }
    };

    void reconcileReminders().catch(() => {
      if (active) setNotificationError('Could not update your expiry reminders.');
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void reconcileReminders().catch(() => {
          if (active) setNotificationError('Could not update your expiry reminders.');
        });
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [foods, notifications, reminderLead, pantryReady]);
  useEffect(() => {
    // Reflect sign-in and sign-out events initiated outside this screen.
    const client = supabase;
    if (!client) return;
    const subscription = client.auth.onAuthStateChange((event, session) => {
      setSessionUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setAccountSyncReady(false);
        setAppMode('auth');
      }
    }).data.subscription;
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    // Supabase token refresh should run only while the app is active.
    const client = supabase;
    if (!client) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    // Search USDA as the user types; debounce requests and ignore stale responses.
    const search = foodName.trim();
    if (page !== 'Add' || search.length < 2 || selectedUsdaFood) {
      setUsdaFoods([]);
      setUsdaLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setUsdaLoading(true);
      setUsdaError('');
      try {
        const response = await fetchWithTimeout(
          `${API_BASE}/api/foods/search?q=${encodeURIComponent(search)}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not search USDA foods.');
        if (!cancelled) {
          setUsdaFoods(data.foods || []);
          if (!data.foods?.length)
            setUsdaError(
              'No USDA matches found. You can still add this food without nutrition data.',
            );
        }
      } catch (error) {
        if (!cancelled)
          setUsdaError(
            error instanceof Error
              ? error.message
              : 'Could not connect to the USDA search service.',
          );
      } finally {
        if (!cancelled) setUsdaLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, foodName, selectedUsdaFood]);
  // Values derived from current state for the home calendar and filtered lists.
  const today = new Date();
  const todayKey = dateKey(today);
  const displayedCalendarDate = expanded ? dateFromKey(calendarMonth) : today;
  const calendarDays = calendarDates(expanded, displayedCalendarDate);
  const expiryCalendarDays = calendarDates(true, dateFromKey(expiryPickerMonth));
  const selectedDayFoods = foods.filter((food) => food.expiresOn === selectedCalendarDate);
  const calendarDateKeys = calendarDays.filter((date) => date !== null).map(dateKey);
  const calendarExpiringCount = foods.filter((food) =>
    calendarDateKeys.includes(food.expiresOn),
  ).length;
  const filteredFoods = useMemo(
    () =>
      foods.filter(
        (food) =>
          (category === 'All' || food.category === category) &&
          food.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [foods, category, query],
  );
  const filteredRecipes = favoritesOnly
    ? favorites.filter((recipe) =>
        recipe.title?.toLowerCase().includes(recipeSearch.trim().toLowerCase()),
      )
    : recipes;
  const expiring = foods
    .filter((food) => food.days >= 0 && food.days <= 3)
    .sort((a, b) => a.days - b.days);
  const expiringSoon = expiring.filter((food) => food.days > 0);
  useEffect(() => {
    // Load recipes by search term, or recommend recipes from the first five pantry foods.
    if (page !== 'Recipes') return;
    if (favoritesOnly) {
      setRecipesLoading(false);
      setRecipesError('');
      return;
    }
    const search = recipeSearch.trim();
    if (!search && foods.length === 0) {
      setRecipes([]);
      setRecipesError('');
      setRecipesLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setRecipesLoading(true);
        setRecipesError('');
        const params = new URLSearchParams();
        if (search) params.set('q', search);
        else
          params.set(
            'ingredients',
            foods
              .map((food) => food.name)
              .slice(0, 5)
              .join(','),
          );
        try {
          const response = await fetchWithTimeout(`${API_BASE}/api/recipes?${params.toString()}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not load recipes.');
          if (!cancelled) setRecipes(data.recipes || []);
        } catch (error) {
          if (!cancelled)
            setRecipesError(
              error instanceof Error ? error.message : 'Could not connect to Pantrypal API.',
            );
        } finally {
          if (!cancelled) setRecipesLoading(false);
        }
      },
      search ? 350 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, recipeSearch, foods, favoritesOnly]);
  // Nutrition lookup helpers connect a pantry item to USDA data and save the chosen match.
  const findPantryNutrition = async (food) => {
    setPantryLookupFoodId(food.id);
    setPantryLookupResults([]);
    setPantryLookupLoading(true);
    setPantryLookupError('');
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/foods/search?q=${encodeURIComponent(food.name)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not search USDA foods.');
      setPantryLookupResults(data.foods || []);
      if (!data.foods?.length) setPantryLookupError('No USDA matches found.');
    } catch (error) {
      setPantryLookupError(
        error instanceof Error ? error.message : 'Could not connect to the USDA search service.',
      );
    } finally {
      setPantryLookupLoading(false);
    }
  };
  const attachNutrition = (foodId, match) => {
    setFoods((current) =>
      current.map((food) =>
        food.id !== foodId
          ? food
          : {
              ...food,
              fdcId: match.fdcId,
              fdcDescription: match.description,
              nutritionBasis: match.nutritionBasis,
              kcal: match.nutrients.kcal,
              protein: match.nutrients.protein,
              fat: match.nutrients.fat,
              carbohydrates: match.nutrients.carbohydrates,
              fiber: match.nutrients.fiber,
              sugars: match.nutrients.sugars,
            },
      ),
    );
    setPantryLookupFoodId(null);
    setPantryLookupResults([]);
    setPantryLookupError('');
  };
  const refreshNutrition = async (food) => {
    if (!food.fdcId || nutritionCheckedIds.includes(food.id)) return;
    setNutritionCheckedIds((current) => [...current, food.id]);
    setPantryLookupFoodId(food.id);
    setPantryLookupLoading(true);
    setPantryLookupError('');
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/foods/search?q=${encodeURIComponent(food.fdcDescription || food.name)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not refresh USDA nutrition.');
      const match = (data.foods || []).find((result) => result.fdcId === food.fdcId);
      if (match) attachNutrition(food.id, match);
      else {
        setPantryLookupError('Could not refresh this USDA match.');
        setNutritionCheckedIds((current) => current.filter((id) => id !== food.id));
      }
    } catch (error) {
      setPantryLookupError(
        error instanceof Error ? error.message : 'Could not refresh USDA nutrition.',
      );
      setNutritionCheckedIds((current) => current.filter((id) => id !== food.id));
    } finally {
      setPantryLookupLoading(false);
    }
  };
  // Pantry actions
  const addFood = () => {
    if (!foodName.trim()) return;
    const todayKey = dateKey(new Date());
    const days = Math.round(
      (dateFromKey(expiryDate).getTime() - dateFromKey(todayKey).getTime()) / 86400000,
    );
    setFoods((current) => [
      {
        id: `${Date.now()}`,
        name: foodName.trim(),
        category: foodCategory,
        emoji: foodEmoji || categoryEmoji[foodCategory] || '🥕',
        qty: quantityDescription(foodQty, foodQtyUnit),
        days,
        expiresOn: expiryDate,
        opened: false,
        fdcId: selectedUsdaFood?.fdcId ?? null,
        fdcDescription: selectedUsdaFood?.description ?? null,
        nutritionBasis: selectedUsdaFood?.nutritionBasis ?? null,
        kcal: selectedUsdaFood?.nutrients.kcal ?? null,
        protein: selectedUsdaFood?.nutrients.protein ?? null,
        fat: selectedUsdaFood?.nutrients.fat ?? null,
        carbohydrates: selectedUsdaFood?.nutrients.carbohydrates ?? null,
        fiber: selectedUsdaFood?.nutrients.fiber ?? null,
        sugars: selectedUsdaFood?.nutrients.sugars ?? null,
      },
      ...current,
    ]);
    setFoodName('');
    setUnitPickerOpen(false);
    setFoodEmoji(categoryEmoji[foodCategory] || '🥕');
    setUsdaFoods([]);
    setSelectedUsdaFood(null);
    setUsdaError('');
    setExpiryDate(dateKeyFromToday(7));
    setExpiryPickerMonth(dateKeyFromToday(7));
    setExpiryPickerOpen(false);
    setPage('Pantry');
  };
  const markFoodOpened = (food) => {
    const days = suggestedExpiryDays(food.category);
    const expiresOn = dateKeyFromToday(days);
    setFoods((current) =>
      current.map((item) =>
        item.id === food.id ? { ...item, opened: true, days, expiresOn } : item,
      ),
    );
  };
  const removeFood = (food) => {
    Alert.alert(`Remove ${food.name}?`, 'This item will be removed from your pantry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove item',
        style: 'destructive',
        onPress: () => {
          setFoods((current) => current.filter((item) => item.id !== food.id));
          if (expandedNutritionId === food.id) setExpandedNutritionId(null);
          setNutritionCheckedIds((current) => current.filter((id) => id !== food.id));
        },
      },
    ]);
  };
  const toggleExpiryNotifications = async () => {
    setNotificationError('');
    if (notifications) {
      setNotifications(false);
      await AsyncStorage.setItem(EXPIRY_NOTIFICATIONS_KEY, 'false').catch(() => {});
      return;
    }

    setNotificationPermissionBusy(true);
    try {
      const permissionGranted = await requestExpiryNotificationPermissions();
      if (!permissionGranted) {
        setNotificationError('Allow notifications in device settings to receive expiry reminders.');
        return;
      }

      setNotifications(true);
      await AsyncStorage.setItem(EXPIRY_NOTIFICATIONS_KEY, 'true').catch(() => {});
    } catch {
      setNotificationError('Could not enable notifications. Please try again.');
    } finally {
      setNotificationPermissionBusy(false);
    }
  };
  const updateReminderLead = async (value) => {
    setReminderLead(value);
    await AsyncStorage.setItem(REMINDER_LEAD_KEY, value).catch(() => {});
  };
  // Account actions
  const continueAsGuest = async () => {
    await AsyncStorage.setItem(ACCESS_MODE_KEY, 'guest');
    setAuthError('');
    setAuthMessage('');
    setAppMode('guest');
  };
  const submitAuth = async () => {
    setAuthError('');
    setAuthMessage('');
    if (!supabase) {
      setAuthError(
        'Account access is not configured yet. Add your Supabase URL and publishable key to the local .env file.',
      );
      return;
    }
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Enter your email and password to continue.');
      return;
    }
    if (authMode === 'signup' && authPassword.length < 6) {
      setAuthError('Use a password with at least 6 characters.');
      return;
    }
    if (authMode === 'signup' && authPassword !== authConfirmPassword) {
      setAuthError('Your passwords do not match.');
      return;
    }
    setAuthBusy(true);
    try {
      const result =
        authMode === 'signup'
          ? await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
          : await supabase.auth.signInWithPassword({
              email: authEmail.trim(),
              password: authPassword,
            });
      if (result.error) throw result.error;
      if (!result.data.session || !result.data.user) {
        setAuthMessage(
          'Check your email for a confirmation link, then log in to sync your pantry.',
        );
        return;
      }
      const user = result.data.user;
      await AsyncStorage.setItem(ACCESS_MODE_KEY, 'account');
      setSessionUser(user);
      setAccountSyncReady(false);
      setAppMode('account');
      setAuthPassword('');
      setAuthConfirmPassword('');
      await synchronizePantry(user, foods, favorites, pantryOwnerId, pantryUpdatedAt);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Could not sign in. Check your connection and try again.',
      );
    } finally {
      setAuthBusy(false);
    }
  };
  const syncNow = async () => {
    if (!sessionUser) return;
    await synchronizePantry(sessionUser, foods, favorites, pantryOwnerId, pantryUpdatedAt);
  };
  useEffect(() => {
    // Refresh the account pantry when the app returns to the foreground.
    if (appMode !== 'account' || !sessionUser || !accountSyncReady) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void synchronizePantry(sessionUser, foods, favorites, pantryOwnerId, pantryUpdatedAt);
      }
    });
    return () => subscription.remove();
  }, [
    appMode,
    sessionUser?.id,
    accountSyncReady,
    foods,
    favorites,
    pantryOwnerId,
    pantryUpdatedAt,
  ]);
  const logOut = async () => {
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
    await AsyncStorage.removeItem(ACCESS_MODE_KEY);
    setSessionUser(null);
    setAccountSyncReady(false);
    setPantryError('');
    setAuthMode('login');
    setAppMode('auth');
  };
  const clearPantry = () => {
    Alert.alert(
      'Clear your pantry?',
      sessionUser
        ? 'This removes all pantry items from this device and your account.'
        : 'This removes all pantry items stored on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear pantry',
          style: 'destructive',
          onPress: () => {
            void confirmClearPantry();
          },
        },
      ],
    );
  };
  const chooseProfileIcon = async (icon) => {
    const selectedIcon = icon.trim();
    if (!selectedIcon) return;
    setProfileIcon(selectedIcon);
    setCustomProfileIcon('');
    setProfileIconError('');
    await AsyncStorage.setItem(PROFILE_ICON_KEY, selectedIcon).catch(() => {});
    if (sessionUser && supabase) {
      try {
        const { data, error } = await supabase.auth.updateUser({
          data: { avatar_icon: selectedIcon },
        });
        if (error) throw error;
        setSessionUser(data.user);
      } catch {
        setProfileIconError('Saved on this device, but the account icon could not sync.');
      }
    }
  };
  const confirmClearPantry = async () => {
    if (clearingPantry) return;
    setClearingPantry(true);
    setPantryError('');
    try {
      const updatedAt = Date.now();
      if (sessionUser && supabase) {
        const { error } = await supabase.from('pantry_snapshots').upsert(
          {
            user_id: sessionUser.id,
            foods: [],
            updated_at: new Date(updatedAt).toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        await AsyncStorage.multiSet([
          [PANTRY_STORAGE_KEY, '[]'],
          [PANTRY_OWNER_KEY, sessionUser.id],
          [PANTRY_UPDATED_KEY, String(updatedAt)],
        ]);
        setPantryOwnerId(sessionUser.id);
      } else {
        await AsyncStorage.multiSet([
          [PANTRY_STORAGE_KEY, '[]'],
          [PANTRY_UPDATED_KEY, String(updatedAt)],
        ]);
        await AsyncStorage.removeItem(PANTRY_OWNER_KEY);
        setPantryOwnerId(null);
      }
      setFoods([]);
      setPantryUpdatedAt(updatedAt);
      setAccountSyncReady(Boolean(sessionUser && supabase));
    } catch (error) {
      setPantryError(
        sessionUser
          ? 'Could not clear the pantry from your account. Check your connection and try again.'
          : 'Could not clear the pantry from this device. Please try again.',
      );
    } finally {
      setClearingPantry(false);
    }
  };
  // Keep screen renderers inside App so keystrokes do not replace inputs and steal focus.
  // Each renderer contains the layout and interactions for one destination.
  // Home shows calendar activity, items nearing expiry, and a shortcut to recipes.
  const renderHome = () => (
    <>
      <View style={s.homeHeading}>
        <Text style={s.eyebrow}>WELCOME</Text>
        <Text style={s.homeBrand}>PantryPal</Text>
      </View>
      {pantryError ? <Text style={s.apiError}>{pantryError}</Text> : null}
      <View style={s.statsRow}>
        <View style={[s.statCard, s.statBlue]}>
          <Text style={s.statValue}>{foods.length}</Text>
          <Text style={s.statLabel}>Items</Text>
        </View>
        <View style={[s.statCard, s.statPeach]}>
          <Text style={s.statValue}>{expiring.length}</Text>
          <Text style={s.statLabel}>Expiring</Text>
        </View>
        <View style={[s.statCard, s.statPink]}>
          <Text style={s.statValue}>{foods.filter((food) => food.days < 0).length}</Text>
          <Text style={s.statLabel}>Expired</Text>
        </View>
      </View>
      <Card style={s.calendar}>
        <View style={s.calendarHead}>
          <View>
            <Text style={s.sectionTitle}>{expanded ? 'This month' : 'This week'}</Text>
            <Text style={s.month}>
              {dateFromKey(selectedCalendarDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={s.calendarControls}>
            {expanded ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => {
                    const month = monthKeyFrom(calendarMonth, -1);
                    setCalendarMonth(month);
                    setSelectedCalendarDate(dayKeyInMonth(month, selectedCalendarDate));
                  }}
                  style={s.calendarNavButton}
                >
                  <ChevronLeft size={20} color={C.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => {
                    const month = monthKeyFrom(calendarMonth, 1);
                    setCalendarMonth(month);
                    setSelectedCalendarDate(dayKeyInMonth(month, selectedCalendarDate));
                  }}
                  style={s.calendarNavButton}
                >
                  <ChevronRight size={20} color={C.ink} />
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => setExpanded((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Collapse calendar to week view' : 'Expand calendar to month view'
              }
              style={s.calendarToggle}
            >
              {expanded ? (
                <ChevronUp size={21} color={C.green} />
              ) : (
                <ChevronDown size={21} color={C.green} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={[s.calendarDays, expanded && s.monthCalendarDays]}>
          {calendarDays.map((date, index) => {
            if (!date) return <View key={`blank-${index}`} style={[s.dayCell, s.monthDayCell]} />;
            const key = dateKey(date);
            const isSelected = key === selectedCalendarDate;
            const hasExpiringFood = foods.some((food) => food.expiresOn === key);
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${hasExpiringFood ? ', food expiring' : ''}`}
                onPress={() => setSelectedCalendarDate(key)}
                style={[s.dayCell, expanded && s.monthDayCell]}
              >
                <Text style={s.dayLabel}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </Text>
                <View
                  style={[s.dayNum, hasExpiringFood && s.dayExpiring, isSelected && s.daySelected]}
                >
                  <Text style={[s.dayNumText, isSelected && s.selectedDayText]}>
                    {date.getDate()}
                  </Text>
                </View>
                <View
                  style={[
                    s.dayDot,
                    hasExpiringFood && s.dayDotActive,
                    isSelected && s.selectedDayDot,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.calendarFoot}>
          <View style={s.dotOrange} />
          <Text style={s.foodSub}>Food items nearing their best</Text>
          <Text style={[s.foodSub, s.weekCount]}>
            {calendarExpiringCount} {expanded ? 'this month' : 'this week'}
          </Text>
        </View>
      </Card>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>
          {selectedCalendarDate === todayKey
            ? 'Expiring Today'
            : `Expiring ${dateFromKey(selectedCalendarDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
        </Text>
        <Text style={s.foodSub}>
          {selectedDayFoods.length} {selectedDayFoods.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
      {selectedDayFoods.length
        ? selectedDayFoods.map((food) => (
            <Card key={`selected-${food.id}`} style={s.homeFoodCard}>
              <FoodRow item={food} />
            </Card>
          ))
        : null}
      {!selectedDayFoods.length ? (
        <Card style={s.emptyDayCard}>
          <Text style={s.foodSub}>
            {selectedCalendarDate === todayKey
              ? 'Nothing is expiring today.'
              : 'Nothing is expiring on this day.'}
          </Text>
        </Card>
      ) : null}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Expiring soon</Text>
        <TouchableOpacity onPress={() => setPage('Pantry')}>
          <Text style={s.link}>View pantry →</Text>
        </TouchableOpacity>
      </View>
      {expiringSoon.length ? (
        expiringSoon.slice(0, 3).map((food) => (
          <Card key={food.id} style={s.homeFoodCard}>
            <FoodRow item={food} />
          </Card>
        ))
      ) : (
        <Card style={s.emptyDayCard}>
          <Text style={s.foodSub}>
            {foods.length
              ? 'Nothing is expiring soon.'
              : 'Your pantry is empty. Add a food item to start tracking expiry dates.'}
          </Text>
        </Card>
      )}
      <Card style={s.tipCard}>
        <View style={s.tipCopy}>
          <Text style={s.foodSub}>Recipe ideas</Text>
          <Text style={s.tipTitle}>Cook with what you have</Text>
          <Text style={s.foodSub}>Find real recipes matched to your pantry.</Text>
        </View>
        <TouchableOpacity onPress={() => setPage('Recipes')}>
          <Text style={s.link}>Browse →</Text>
        </TouchableOpacity>
      </Card>
    </>
  );
  // Pantry supports search, category filters, expiry actions, and nutrition details.
  const renderPantry = () => (
    <>
      <Header eyebrow="WHAT’S IN YOUR KITCHEN" title="Your pantry" right="☰" />
      {pantryError ? <Text style={s.apiError}>{pantryError}</Text> : null}
      <View style={s.search}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your food"
          placeholderTextColor={C.muted}
          style={s.searchInput}
        />
      </View>
      <View style={s.pantryToolsRow}>
        <TouchableOpacity
          style={[s.sortByButton, sortMenuOpen && s.sortByButtonActive]}
          onPress={() => setSortMenuOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={
            sortMenuOpen ? 'Close sort by category menu' : 'Open sort by category menu'
          }
        >
          <Text style={[s.sortByText, sortMenuOpen && s.sortByTextActive]}>Sort by</Text>
          {sortMenuOpen ? (
            <ChevronUp size={17} color={C.green} />
          ) : (
            <ChevronDown size={17} color={C.muted} />
          )}
        </TouchableOpacity>
        <Text style={s.pantryCount}>
          {filteredFoods.length === foods.length
            ? foods.length
            : `${filteredFoods.length} of ${foods.length}`}{' '}
          {foods.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
      {sortMenuOpen ? (
        <View style={s.sortMenu}>
          <Text style={s.cardKicker}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.sortCategoryScroll}
            contentContainerStyle={s.categoryScrollContent}
          >
            {[
              'All',
              'Produce',
              'Leafy Greens',
              'Grains',
              'Dairy',
              'Bakery',
              'Protein',
              'Meat',
              'Pantry',
            ].map((value) => (
              <Chip
                key={value}
                label={value}
                active={category === value}
                onPress={() => setCategory(value)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={s.listHeader}>
        <Text style={s.cardKicker}>YOUR FOOD</Text>
        <Text style={s.cardKicker}>BEST BEFORE</Text>
      </View>
      <View style={s.pantryList}>
        {filteredFoods.map((food) => (
          <Card key={food.id} style={s.pantryItemCard}>
            <FoodRow
              item={food}
              trailingAction={
                food.fdcId ? (
                  <TouchableOpacity
                    style={s.nutritionToggle}
                    accessibilityRole="button"
                    accessibilityLabel={`${expandedNutritionId === food.id ? 'Hide' : 'Show'} nutrition for ${food.name}`}
                    onPress={() => {
                      const opening = expandedNutritionId !== food.id;
                      setExpandedNutritionId(opening ? food.id : null);
                      if (
                        opening &&
                        (!food.fdcDescription || food.sugars === undefined) &&
                        !nutritionCheckedIds.includes(food.id)
                      ) {
                        refreshNutrition(food);
                      }
                    }}
                  >
                    <Text style={s.nutritionToggleText}>
                      {expandedNutritionId === food.id ? 'Hide nutrition' : 'Show nutrition'}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              deleteAction={
                <TouchableOpacity
                  style={s.removeFoodButton}
                  onPress={() => removeFood(food)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${food.name} from pantry`}
                  hitSlop={4}
                >
                  <Trash2 size={16} color={C.red} strokeWidth={2} />
                </TouchableOpacity>
              }
            />
            {food.category === 'Pantry' ? (
              food.opened ? (
                <View style={s.openedStatus}>
                  <Text style={s.openedStatusText}>
                    Opened · expiry updated to{' '}
                    {dateFromKey(food.expiresOn).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.markOpenedButton}
                  onPress={() => markFoodOpened(food)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${food.name} as opened and set a seven day expiry`}
                >
                  <Text style={s.markOpenedText}>Mark opened · set 7-day expiry</Text>
                </TouchableOpacity>
              )
            ) : null}
            {!food.fdcId ? (
              <View style={s.nutritionLookup}>
                <TouchableOpacity onPress={() => findPantryNutrition(food)}>
                  <Text style={s.recipeActionText}>Link USDA nutrition</Text>
                </TouchableOpacity>
                {pantryLookupFoodId === food.id && pantryLookupLoading ? (
                  <ActivityIndicator size="small" color={C.green} />
                ) : null}
                {pantryLookupFoodId === food.id && pantryLookupError ? (
                  <Text style={s.apiError}>{pantryLookupError}</Text>
                ) : null}
                {pantryLookupFoodId === food.id &&
                  pantryLookupResults.map((match) => (
                    <TouchableOpacity
                      key={match.fdcId}
                      style={s.usdaResult}
                      onPress={() => attachNutrition(food.id, match)}
                    >
                      <View style={s.usdaResultCopy}>
                        <Text style={s.foodName}>{match.description}</Text>
                        <Text style={s.foodSub}>
                          {match.brandName || match.dataType || 'USDA FoodData Central'}
                        </Text>
                      </View>
                      <Text style={s.usdaCalories}>
                        {match.nutrients.kcal === null
                          ? '—'
                          : `${match.nutrients.kcal} kcal ${match.nutritionBasis}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            ) : null}
            {food.fdcId ? (
              <>
                {expandedNutritionId === food.id ? (
                  <View style={s.nutritionPanel}>
                    <Text style={s.nutritionPanelHeading}>
                      Nutrition {food.nutritionBasis || 'per 100 g'}
                    </Text>
                    {pantryLookupFoodId === food.id && pantryLookupLoading ? (
                      <View style={s.nutritionRefresh}>
                        <ActivityIndicator size="small" color={C.green} />
                        <Text style={s.foodSub}>Refreshing USDA values…</Text>
                      </View>
                    ) : null}
                    {pantryLookupFoodId === food.id && pantryLookupError ? (
                      <Text style={s.apiError}>{pantryLookupError}</Text>
                    ) : null}
                    <View style={s.nutritionGrid}>
                      <NutritionTile
                        label="Calories"
                        value={food.kcal}
                        unit="kcal"
                        background={C.categoryPeach}
                      />
                      <NutritionTile
                        label="Protein"
                        value={food.protein}
                        unit="g"
                        background={C.mint}
                      />
                      <NutritionTile
                        label="Carbs"
                        value={food.carbohydrates}
                        unit="g"
                        background={C.lemon}
                      />
                      <NutritionTile label="Fat" value={food.fat} unit="g" background={C.rose} />
                      <NutritionTile label="Fiber" value={food.fiber} unit="g" background={C.sky} />
                      <NutritionTile
                        label="Sugar"
                        value={food.sugars ?? null}
                        unit="g"
                        background={C.lilac}
                      />
                    </View>
                    <Text style={s.nutritionSource}>
                      Source: USDA — {food.fdcDescription || food.name}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </Card>
        ))}
      </View>
      {!filteredFoods.length ? (
        <Card style={s.emptyDayCard}>
          <Text style={s.foodSub}>
            {foods.length
              ? 'No foods match this search.'
              : 'Your pantry is empty. Add an item to see it here.'}
          </Text>
        </Card>
      ) : null}
      <Text style={s.sourceNote}>
        Nutrition values are from USDA FoodData Central; the serving basis appears when expanded.
      </Text>
    </>
  );
  // Recipes can be searched, matched against pantry items, and saved as favorites.
  const renderRecipes = () => (
    <>
      <Header eyebrow="COOK WITH WHAT YOU HAVE" title="Recipes for you" />
      <Text style={s.intro}>Fresh ideas, starting with your pantry.</Text>
      <View style={s.search}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={recipeSearch}
          onChangeText={setRecipeSearch}
          placeholder="Search recipes or ingredients"
          placeholderTextColor={C.muted}
          style={s.searchInput}
        />
      </View>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>
          {favoritesOnly ? 'Your favorites' : 'A good match today'}
        </Text>
        <TouchableOpacity
          style={[s.favoritesFilter, favoritesOnly && s.favoritesFilterActive]}
          onPress={() => setFavoritesOnly((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={favoritesOnly ? 'Show all recipes' : 'Show favorite recipes only'}
        >
          <Heart
            size={15}
            color={favoritesOnly ? C.red : C.muted}
            fill={favoritesOnly ? C.rose : 'transparent'}
            strokeWidth={2}
          />
          <Text style={[s.favoritesFilterText, favoritesOnly && s.favoritesFilterTextActive]}>
            Favorites {favorites.length}
          </Text>
        </TouchableOpacity>
      </View>
      {!favoritesOnly && recipesLoading ? (
        <ActivityIndicator color={C.green} style={s.loading} />
      ) : null}
      {!favoritesOnly && recipesError ? <Text style={s.apiError}>{recipesError}</Text> : null}
      {filteredRecipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          item={recipe}
          saved={favorites.some((favorite) => favorite.id === recipe.id)}
          instructionsOpen={openRecipe === recipe.id}
          nutritionOpen={openRecipeNutrition === recipe.id}
          onToggleFavorite={() =>
            setFavorites((current) =>
              current.some((favorite) => favorite.id === recipe.id)
                ? current.filter((favorite) => favorite.id !== recipe.id)
                : [...current, recipe],
            )
          }
          onToggleInstructions={() =>
            setOpenRecipe((current) => (current === recipe.id ? null : recipe.id))
          }
          onToggleNutrition={() =>
            setOpenRecipeNutrition((current) => (current === recipe.id ? null : recipe.id))
          }
        />
      ))}
      {(favoritesOnly || (!recipesLoading && !recipesError)) && !filteredRecipes.length ? (
        <Card style={s.emptyDayCard}>
          <Text style={s.foodSub}>
            {recipeSearch
              ? 'No recipes matched that search.'
              : favoritesOnly
                ? 'No favorite recipes yet. Tap the heart on a recipe to save it here.'
                : 'Add foods to your pantry to see matching recipes, or search for a recipe above.'}
          </Text>
        </Card>
      ) : null}
    </>
  );
  // The add form collects food details and an expiry date before saving the item.
  const renderAdd = () => (
    <>
      <Header eyebrow="ADD SOMETHING FRESH" title="Add to pantry" />
      <Text style={s.intro}>Keep track of what you bring home.</Text>
      <Card style={s.formCard}>
        <Text style={s.fieldLabel}>FOOD ITEM</Text>
        <TextInput
          value={foodName}
          onChangeText={(value) => {
            setFoodName(value);
            setSelectedUsdaFood(null);
            setUsdaFoods([]);
            setUsdaError('');
          }}
          placeholder="e.g. Ripe bananas"
          style={s.fieldInput}
          returnKeyType="search"
        />
        <View style={s.usdaSearchStatus}>
          {usdaLoading ? <ActivityIndicator size="small" color={C.green} /> : null}
          <Text style={s.sourceNote}>USDA nutrition matches appear as you type.</Text>
        </View>
        {selectedUsdaFood ? (
          <View style={s.usdaSelected}>
            <Text style={s.usdaSelectedTitle}>USDA match selected</Text>
            <Text style={s.foodSub}>
              {selectedUsdaFood.description}
              {selectedUsdaFood.brandName ? ` · ${selectedUsdaFood.brandName}` : ''}
            </Text>
            {selectedUsdaFood.nutrients.kcal !== null ? (
              <Text style={s.foodSub}>
                {selectedUsdaFood.nutrients.kcal} kcal {selectedUsdaFood.nutritionBasis} · FoodData
                Central
              </Text>
            ) : null}
          </View>
        ) : null}
        {usdaFoods.map((food) => (
          <TouchableOpacity
            key={food.fdcId}
            style={s.usdaResult}
            onPress={() => {
              setSelectedUsdaFood(food);
              setUsdaFoods([]);
            }}
          >
            <View style={s.usdaResultCopy}>
              <Text style={s.foodName}>{food.description}</Text>
              <Text style={s.foodSub}>
                {food.brandName || food.dataType || 'USDA FoodData Central'}
              </Text>
            </View>
            <Text style={s.usdaCalories}>
              {food.nutrients.kcal === null
                ? '—'
                : `${food.nutrients.kcal} kcal ${food.nutritionBasis}`}
            </Text>
          </TouchableOpacity>
        ))}
        {usdaError ? <Text style={s.apiError}>{usdaError}</Text> : null}
        <Text style={s.sourceNote}>
          Choose a USDA result to add its real nutrition values. You can add without a match if USDA
          doesn’t have the item.
        </Text>
        <Text style={s.fieldLabel}>CATEGORY</Text>
        <View style={s.categoryGrid}>
          {Object.keys(categoryEmoji).map((value) => (
            <Chip
              key={value}
              label={value}
              active={foodCategory === value}
              onPress={() => {
                setFoodCategory(value);
                setFoodEmoji(categoryEmoji[value]);
                const suggestedDate = dateKeyFromToday(suggestedExpiryDays(value));
                setExpiryDate(suggestedDate);
                setExpiryPickerMonth(suggestedDate);
                setExpiryPickerOpen(false);
              }}
            />
          ))}
        </View>
        <View style={s.formLine}>
          <View style={s.formHalf}>
            <Text style={s.fieldLabel}>QUANTITY</Text>
            <TextInput
              value={foodQty}
              onChangeText={setFoodQty}
              keyboardType="decimal-pad"
              placeholder="1"
              style={s.fieldInput}
              accessibilityLabel="Food quantity"
            />
          </View>
          <View style={s.formSpacer} />
          <View style={s.formHalf}>
            <Text style={s.fieldLabel}>UNIT</Text>
            <TouchableOpacity
              style={[s.unitSelect, unitPickerOpen && s.unitSelectActive]}
              onPress={() => setUnitPickerOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={`Quantity unit, currently ${QUANTITY_UNITS.find((unit) => unit.value === foodQtyUnit)?.label || foodQtyUnit}`}
              accessibilityState={{ expanded: unitPickerOpen }}
            >
              <Text style={s.unitSelectText} numberOfLines={1}>
                {QUANTITY_UNITS.find((unit) => unit.value === foodQtyUnit)?.label || 'Pieces'} (
                {foodQtyUnit})
              </Text>
              {unitPickerOpen ? (
                <ChevronUp size={17} color={C.green} />
              ) : (
                <ChevronDown size={17} color={C.muted} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {unitPickerOpen ? (
          <View style={s.unitOptions}>
            {QUANTITY_UNITS.map((unit) => (
              <TouchableOpacity
                key={unit.value}
                style={[s.unitOption, foodQtyUnit === unit.value && s.unitOptionActive]}
                onPress={() => {
                  setFoodQtyUnit(unit.value);
                  setUnitPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={unit.label}
                accessibilityState={{ selected: foodQtyUnit === unit.value }}
              >
                <Text
                  style={[s.unitOptionText, foodQtyUnit === unit.value && s.unitOptionTextActive]}
                >
                  {unit.label} ({unit.value})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={[s.formLine, s.symbolRow]}>
          <View style={s.formHalf}>
            <Text style={s.fieldLabel}>FOOD SYMBOL</Text>
            <TextInput
              value={foodEmoji}
              onChangeText={setFoodEmoji}
              style={[s.fieldInput, s.emojiInput]}
              accessibilityLabel="Food symbol"
            />
          </View>
        </View>
        <Text style={s.fieldLabel}>BEST BEFORE</Text>
        <TouchableOpacity
          style={s.expiryDateInput}
          onPress={() => setExpiryPickerOpen((value) => !value)}
          accessibilityRole="button"
        >
          <CalendarDays size={22} color={C.green} strokeWidth={2} />
          <View style={s.expiryDateCopy}>
            <Text style={s.foodName}>Expiry date</Text>
            <Text style={s.foodSub}>
              {dateFromKey(expiryDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Text style={s.link}>{expiryPickerOpen ? 'Close' : 'Choose'}</Text>
        </TouchableOpacity>
        <View style={s.expiryPresetRow}>
          {[
            { label: '2 days', days: 2 },
            { label: '4 days', days: 4 },
            { label: '1 week', days: 7 },
            { label: '2 weeks', days: 14 },
            { label: '1 month', days: 30 },
          ].map((preset) => {
            const presetDate = dateKeyFromToday(preset.days);
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                active={expiryDate === presetDate}
                onPress={() => {
                  setExpiryDate(presetDate);
                  setExpiryPickerMonth(presetDate);
                  setExpiryPickerOpen(false);
                }}
              />
            );
          })}
        </View>
        {expiryPickerOpen ? (
          <View style={s.expiryPicker}>
            <View style={s.expiryPickerHeader}>
              <TouchableOpacity
                style={s.monthArrow}
                onPress={() => setExpiryPickerMonth(monthKeyFrom(expiryPickerMonth, -1))}
                accessibilityLabel="Previous month"
              >
                <ChevronLeft size={20} color={C.ink} />
              </TouchableOpacity>
              <Text style={s.expiryPickerTitle}>
                {dateFromKey(expiryPickerMonth).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={s.monthArrow}
                onPress={() => setExpiryPickerMonth(monthKeyFrom(expiryPickerMonth, 1))}
                accessibilityLabel="Next month"
              >
                <ChevronRight size={20} color={C.ink} />
              </TouchableOpacity>
            </View>
            <View style={s.expiryWeekdays}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
                <Text key={`${label}-${index}`} style={s.expiryWeekday}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={s.expiryDaysGrid}>
              {expiryCalendarDays.map((date, index) =>
                date ? (
                  <TouchableOpacity
                    key={dateKey(date)}
                    style={s.expiryDayCell}
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    onPress={() => {
                      setExpiryDate(dateKey(date));
                      setExpiryPickerOpen(false);
                    }}
                  >
                    <View style={[s.dayNum, expiryDate === dateKey(date) && s.daySelected]}>
                      <Text style={s.dayNumText}>{date.getDate()}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View key={`expiry-blank-${index}`} style={s.expiryDayCell} />
                ),
              )}
            </View>
          </View>
        ) : null}
        <TouchableOpacity style={s.primaryButton} onPress={addFood}>
          <Text style={s.primaryText}>Add to my pantry →</Text>
        </TouchableOpacity>
      </Card>
      <Text style={s.sourceNote}>
        You can edit the expiry date and nutrition details after saving.
      </Text>
    </>
  );
  // Sign-in and sign-up share this screen; guest mode is available without Supabase.
  const renderAuth = () => (
    <View style={s.authScreen}>
      <View style={s.authHeading}>
        <Text style={s.authBrand}>PantryPal</Text>
        <Text style={s.authSubtitle}>Your food, organized your way.</Text>
      </View>
      <Card style={s.authCard}>
        <View style={s.authTabs}>
          <TouchableOpacity
            style={[s.authTab, authMode === 'login' && s.authTabActive]}
            onPress={() => {
              setAuthMode('login');
              setAuthError('');
              setAuthMessage('');
              setAuthConfirmPassword('');
            }}
          >
            <Text style={[s.authTabText, authMode === 'login' && s.authTabTextActive]}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.authTab, authMode === 'signup' && s.authTabActive]}
            onPress={() => {
              setAuthMode('signup');
              setAuthError('');
              setAuthMessage('');
              setAuthConfirmPassword('');
            }}
          >
            <Text style={[s.authTabText, authMode === 'signup' && s.authTabTextActive]}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={s.authTitle}>
          {authMode === 'login' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={s.authDescription}>Sign in to sync your pantry across devices.</Text>
        <Text style={s.fieldLabel}>EMAIL</Text>
        <TextInput
          value={authEmail}
          onChangeText={setAuthEmail}
          style={s.fieldInput}
          placeholder="you@example.com"
          placeholderTextColor={C.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
        />
        <Text style={s.fieldLabel}>PASSWORD</Text>
        <TextInput
          value={authPassword}
          onChangeText={setAuthPassword}
          style={s.fieldInput}
          placeholder="At least 6 characters"
          placeholderTextColor={C.muted}
          secureTextEntry
          textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
        />
        {authMode === 'signup' ? (
          <>
            <Text style={s.fieldLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              value={authConfirmPassword}
              onChangeText={setAuthConfirmPassword}
              style={s.fieldInput}
              placeholder="Type your password again"
              placeholderTextColor={C.muted}
              secureTextEntry
              textContentType="newPassword"
            />
          </>
        ) : null}
        {authError ? <Text style={s.apiError}>{authError}</Text> : null}
        {authMessage ? <Text style={s.authMessage}>{authMessage}</Text> : null}
        {!supabaseConfigured ? (
          <Text style={s.authSetupNote}>
            Connect your Supabase project to enable accounts. You can use guest mode now.
          </Text>
        ) : null}
        <TouchableOpacity
          style={[s.primaryButton, (authBusy || !supabaseConfigured) && s.disabledButton]}
          onPress={submitAuth}
          disabled={authBusy || !supabaseConfigured}
        >
          {authBusy ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={s.primaryText}>{authMode === 'login' ? 'Log in' : 'Create account'}</Text>
          )}
        </TouchableOpacity>
      </Card>
      <TouchableOpacity style={s.guestButton} onPress={continueAsGuest}>
        <Text style={s.guestButtonText}>Continue without an account</Text>
      </TouchableOpacity>
      <Text style={s.authDisclaimer}>
        Without an account, your pantry is stored locally and won’t sync across devices. You can
        create an account anytime to sync your items. USDA nutrition and recipe search need an
        internet connection.
      </Text>
    </View>
  );
  // Profile contains reminder preferences, account actions, and pantry sync controls.
  const renderProfile = () => (
    <>
      <Header eyebrow="MAKE IT YOURS" title="Your profile" />
      <Card style={s.profileCard}>
        <TouchableOpacity
          style={s.avatar}
          onPress={() => {
            setProfileIconPickerOpen((value) => !value);
            setProfileIconError('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose profile icon"
        >
          <Text style={s.avatarEmoji}>{profileIcon}</Text>
          <View style={s.avatarEdit}>
            <Pencil size={11} color={C.white} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
        <View style={s.profileCopy}>
          <Text style={s.recipeTitle}>{sessionUser?.email || 'Guest mode'}</Text>
          <Text style={s.foodSub}>
            {sessionUser
              ? syncing
                ? 'Syncing your pantry…'
                : accountSyncReady
                  ? 'Synced with your account'
                  : 'Saved on this device'
              : 'Saved on this device · no account'}
          </Text>
        </View>
      </Card>
      {profileIconPickerOpen ? (
        <Card style={s.profileIconPicker}>
          <Text style={s.foodName}>Choose your profile icon</Text>
          <Text style={s.foodSub}>Pick a symbol or type your own emoji.</Text>
          <View style={s.profileIconGrid}>
            {PROFILE_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[s.profileIconChoice, profileIcon === icon && s.profileIconChoiceActive]}
                onPress={() => {
                  void chooseProfileIcon(icon);
                  setProfileIconPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${icon} as profile icon`}
              >
                <Text style={s.profileIconChoiceText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.customProfileIconRow}>
            <TextInput
              value={customProfileIcon}
              onChangeText={setCustomProfileIcon}
              style={[s.fieldInput, s.customProfileIconInput]}
              placeholder="Type or paste an emoji or symbol"
              placeholderTextColor={C.muted}
              maxLength={8}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[s.customProfileIconButton, !customProfileIcon.trim() && s.disabledButton]}
              onPress={() => {
                void chooseProfileIcon(customProfileIcon);
                setProfileIconPickerOpen(false);
              }}
              disabled={!customProfileIcon.trim()}
              accessibilityRole="button"
              accessibilityLabel="Save custom profile icon"
            >
              <Text style={s.accountButtonText}>Use</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}
      {profileIconError ? <Text style={s.apiError}>{profileIconError}</Text> : null}
      <Text style={s.sectionTitle}>Preferences</Text>
      <Card style={s.settingsCard}>
        {Platform.OS === 'web' ? (
          <Text style={s.foodSub}>
            Local expiry reminders are available in the Android and iOS apps.
          </Text>
        ) : (
          <>
            <View style={s.settingRow}>
              <View>
                <Text style={s.foodName}>Expiry reminders</Text>
                <Text style={s.foodSub}>Get a reminder at 9 AM on your selected day</Text>
              </View>
              <TouchableOpacity
                style={[s.toggle, notifications && s.toggleOn]}
                onPress={toggleExpiryNotifications}
                disabled={notificationPermissionBusy}
                accessibilityRole="switch"
                accessibilityLabel="Expiry reminders"
                accessibilityState={{
                  checked: notifications,
                  disabled: notificationPermissionBusy,
                }}
              >
                <View style={[s.toggleKnob, notifications && s.knobOn]} />
              </TouchableOpacity>
            </View>
            {notificationError ? <Text style={s.apiError}>{notificationError}</Text> : null}
            <View style={s.separator} />
            <Text style={s.fieldLabel}>REMIND ME</Text>
            <View style={s.expiryChoices}>
              {['1 day', '3 days', '1 week'].map((value) => (
                <Chip
                  key={value}
                  label={value}
                  active={reminderLead === value}
                  onPress={() => updateReminderLead(value)}
                />
              ))}
            </View>
          </>
        )}
      </Card>
      {sessionUser ? (
        <>
          <TouchableOpacity style={s.primaryButton} onPress={syncNow} disabled={syncing}>
            <Text style={s.primaryText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logout} onPress={logOut}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Card style={s.guestInfoCard}>
          <Text style={s.foodName}>Using Pantrypal as a guest</Text>
          <Text style={s.foodSub}>
            Your pantry works offline and stays on this device. USDA nutrition and recipe search are
            limited without internet, and your pantry will not sync to other devices.
          </Text>
          <TouchableOpacity
            style={s.accountButton}
            onPress={() => {
              setAuthMode('login');
              setAuthError('');
              setAuthMessage('');
              setAppMode('auth');
            }}
          >
            <Text style={s.accountButtonText}>Sign in or create an account</Text>
          </TouchableOpacity>
        </Card>
      )}
      {pantryError ? <Text style={s.apiError}>{pantryError}</Text> : null}
      <TouchableOpacity
        style={[s.clearPantryButton, clearingPantry && s.disabledButton]}
        onPress={clearPantry}
        disabled={clearingPantry}
      >
        {clearingPantry ? (
          <ActivityIndicator color={C.red} />
        ) : (
          <Text style={s.clearPantryText}>Clear pantry</Text>
        )}
      </TouchableOpacity>
      <Text style={s.version}>Pantrypal by BugBytes</Text>
    </>
  );
  if (!fontsLoaded) return null;
  if (appMode === 'boot') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, s.bootScreen]}>
          <StatusBar barStyle="dark-content" />
          <ActivityIndicator size="large" color={C.green} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (appMode === 'auth') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.safe}>
          <StatusBar barStyle="dark-content" />
          <ScrollView contentContainerStyle={s.authContent} keyboardShouldPersistTaps="handled">
            {renderAuth()}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  // Route to the selected screen; keep the shared tab bar outside the screen renderers.
  const content =
    page === 'Home'
      ? renderHome()
      : page === 'Pantry'
        ? renderPantry()
        : page === 'Recipes'
          ? renderRecipes()
          : page === 'Add'
            ? renderAdd()
            : renderProfile();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
        <View style={s.tabBar}>
          {tabs.map((tab) =>
            tab.key === 'Add' ? (
              <TouchableOpacity
                key={tab.key}
                style={s.addTab}
                onPress={() => setPage('Add')}
                accessibilityLabel="Add food"
              >
                <View style={[s.addButton, page === 'Add' && s.addButtonActive]}>
                  <Plus size={29} color={C.white} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={tab.key}
                style={s.tab}
                onPress={() => {
                  setPage(tab.key);
                  setQuery('');
                }}
              >
                <TabIcon name={tab.icon} color={page === tab.key ? C.green : C.muted} />
                <Text style={[s.tabText, page === tab.key && s.tabTextActive]}>{tab.key}</Text>
                {page === tab.key ? <View style={s.activeDot} /> : null}
              </TouchableOpacity>
            ),
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
// Shared visual styles
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 120 },
  bootScreen: { alignItems: 'center', justifyContent: 'center' },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  authScreen: { width: '100%' },
  authHeading: { alignItems: 'center', marginBottom: 18 },
  authBrand: { fontFamily: FONT.fredokaBold, fontSize: 38, fontWeight: '700', color: C.ink },
  authSubtitle: { color: C.muted, fontSize: 13, marginTop: 2 },
  authCard: { padding: 18, marginBottom: 10 },
  authTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: C.mutedFill,
    marginBottom: 18,
  },
  authTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  authTabActive: { backgroundColor: C.white },
  authTabText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  authTabTextActive: { color: C.greenInk },
  authTitle: { fontFamily: FONT.fredokaSemibold, color: C.ink, fontSize: 22, fontWeight: '600' },
  authDescription: { color: C.muted, fontSize: 12, marginTop: 3 },
  authMessage: { color: C.greenInk, fontSize: 11, lineHeight: 16, marginTop: 7 },
  authSetupNote: {
    color: C.peachInk,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    backgroundColor: C.peach,
    borderRadius: 10,
    padding: 10,
  },
  authDisclaimer: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  guestButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
  },
  guestButtonText: { color: C.greenInk, fontSize: 12, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  homeHeading: { marginBottom: 16 },
  homeGreeting: { fontSize: 15, color: C.ink, marginBottom: 2 },
  homeBrand: {
    fontFamily: FONT.fredokaBold,
    fontSize: 34,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.8,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBlue: { backgroundColor: C.sky },
  statPeach: { backgroundColor: C.peach },
  statPink: { backgroundColor: C.rose },
  statValue: {
    fontFamily: FONT.fredokaBold,
    color: C.ink,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 31,
  },
  statLabel: { color: C.ink, fontSize: 12, fontWeight: '500', marginTop: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: C.green, fontWeight: '700', marginBottom: 7 },
  title: {
    fontFamily: FONT.fredokaBold,
    fontSize: 29,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.4,
  },
  headerRight: { fontSize: 22, color: C.green, padding: 8 },
  intro: { fontSize: 14, color: C.muted, marginTop: 3, marginBottom: 20 },
  card: {
    backgroundColor: C.white,
    borderRadius: 21,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  calendar: { padding: 18 },
  calendarHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 19,
  },
  calendarControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.mutedFill,
  },
  calendarToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenSoft,
    marginLeft: 4,
  },
  cardKicker: { fontSize: 9, letterSpacing: 1.2, color: C.muted, fontWeight: '700' },
  month: {
    fontFamily: FONT.fredokaSemibold,
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
    marginTop: 5,
  },
  link: { fontSize: 12, color: C.green, fontWeight: '600' },
  calendarDays: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthCalendarDays: { justifyContent: 'flex-start' },
  dayCell: { alignItems: 'center', width: '14%', marginBottom: 0 },
  monthDayCell: { width: '14.285%', marginBottom: 13 },
  dayLabel: { fontSize: 8, color: C.muted, fontWeight: '600', marginBottom: 9 },
  dayNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayExpiring: { borderWidth: 1.5, borderColor: C.red },
  daySelected: { backgroundColor: C.lemon },
  dayNumText: { fontFamily: FONT.fredokaSemibold, fontSize: 16, color: C.ink, fontWeight: '600' },
  selectedDayText: { color: C.ink },
  dayDot: { width: 4, height: 4, borderRadius: 3, marginTop: 4, backgroundColor: 'transparent' },
  dayDotActive: { backgroundColor: C.categoryPeach },
  selectedDayDot: { backgroundColor: C.green },
  calendarFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 12,
  },
  emptyDayCard: { paddingVertical: 14, paddingHorizontal: 16 },
  dotOrange: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.peachInk, marginRight: 7 },
  foodSub: { fontSize: 11, color: C.muted },
  apiError: { color: C.red, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  loading: { marginVertical: 18 },
  weekCount: { marginLeft: 'auto' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
    marginBottom: 11,
  },
  sectionTitle: { fontFamily: FONT.fredokaSemibold, fontSize: 17, fontWeight: '700', color: C.ink },
  homeFoodCard: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 10,
    borderRadius: 20,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 10,
    minWidth: 0,
  },
  foodEmoji: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.mutedFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  foodEmojiText: { fontSize: 24 },
  foodCopy: { flex: 1, minWidth: 0 },
  foodName: { fontSize: 13, fontWeight: '700', color: C.ink },
  foodRight: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
  expiryBadge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    maxWidth: 78,
    alignItems: 'center',
  },
  days: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  nutritionToggle: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 18,
    backgroundColor: C.green,
  },
  nutritionToggleText: { fontSize: 10, fontWeight: '700', color: C.white },
  removeFoodButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFF0F1',
  },
  recipeNutritionToggle: { alignSelf: 'flex-start', marginTop: 12 },
  recipeNutritionPanel: { marginTop: 10, gap: 10 },
  nutritionPanel: { marginTop: 8, gap: 10 },
  nutritionPanelHeading: { fontSize: 14, fontWeight: '700', color: C.muted, marginBottom: 1 },
  nutritionRefresh: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  nutritionTile: {
    width: '31%',
    minHeight: 82,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  nutritionTileValue: {
    fontFamily: FONT.fredokaSemibold,
    fontSize: 21,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
  },
  nutritionTileUnit: { fontFamily: FONT.nunitoBold, fontSize: 13, fontWeight: '700', color: C.ink },
  nutritionTileLabel: { fontSize: 12, color: C.ink, marginTop: 2, textAlign: 'center' },
  nutritionSource: { fontSize: 11, color: C.muted, marginTop: 1 },
  separator: { height: 1, backgroundColor: C.line, marginHorizontal: 4 },
  tipCard: {
    backgroundColor: C.lilac,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    padding: 18,
    borderColor: C.lilac,
  },
  tipCopy: { flex: 1 },
  tipTitle: {
    fontFamily: FONT.fredokaSemibold,
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
    marginVertical: 4,
  },
  tabBar: {
    position: 'absolute',
    bottom: 18,
    left: '4%',
    width: '92%',
    height: 82,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 42,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingBottom: 2,
    shadowColor: C.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  tab: { alignItems: 'center', justifyContent: 'center', width: '19%', height: 58 },
  tabText: { fontSize: 10, color: C.muted, fontWeight: '700' },
  tabTextActive: { color: C.green, fontWeight: '700' },
  activeDot: { width: 4, height: 4, borderRadius: 3, backgroundColor: C.green, marginTop: 4 },
  addTab: {
    width: '22%',
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.green,
    borderWidth: 4,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.green,
    shadowOpacity: 0.25,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  addButtonActive: { backgroundColor: C.ink },
  search: {
    height: 48,
    backgroundColor: C.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 18 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.ink,
    paddingVertical: 0,
    fontFamily: FONT.nunitoRegular,
  },
  pantryToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortByButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  sortByButtonActive: { backgroundColor: C.greenSoft, borderColor: C.greenSoft },
  sortByText: { fontSize: 11, fontWeight: '700', color: C.ink },
  sortByTextActive: { color: C.greenInk },
  pantryCount: { color: C.ink, fontSize: 12, fontWeight: '700' },
  sortMenu: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 15,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  sortCategoryScroll: { maxHeight: 48, marginTop: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.greenSoft },
  chipText: { fontSize: 11, fontWeight: '500', color: C.muted },
  chipTextActive: { color: C.greenInk },
  categoryScrollContent: { gap: 8 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 8,
  },
  pantryList: { width: '100%', alignSelf: 'stretch' },
  pantryItemCard: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
    borderRadius: 20,
  },
  sourceNote: { fontSize: 10, color: C.muted, lineHeight: 16, marginHorizontal: 3 },
  recipeCard: { padding: 16, marginBottom: 12 },
  recipeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recipeImage: { width: 74, height: 74, borderRadius: 15, backgroundColor: C.lilac },
  recipeSummary: { flex: 1, minWidth: 0, gap: 2 },
  favoriteButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: C.mutedFill,
  },
  favoritesFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  favoritesFilterActive: { backgroundColor: C.greenSoft, borderColor: C.greenSoft },
  favoritesFilterText: { fontSize: 10, fontWeight: '700', color: C.muted },
  favoritesFilterTextActive: { color: C.greenInk },
  recipeTitle: { fontFamily: FONT.fredokaSemibold, fontSize: 16, fontWeight: '700', color: C.ink },
  recipeMeta: { fontSize: 10, color: C.muted, marginTop: 5 },
  recipeIngredientCount: { fontSize: 11, color: C.ink, fontWeight: '700', marginTop: 2 },
  tagWrap: { flexDirection: 'row', gap: 6, marginTop: 11, flexWrap: 'wrap' },
  tinyTag: {
    backgroundColor: C.mutedFill,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tinyTagOwned: { backgroundColor: C.greenSoft },
  tinyTagText: { fontSize: 9, color: C.muted, fontWeight: '500' },
  tinyTagTextOwned: { color: C.greenInk },
  usdaSearchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 7,
  },
  nutritionLookup: { marginLeft: 56, marginBottom: 6, gap: 6 },
  usdaSelected: {
    backgroundColor: C.greenSoft,
    padding: 11,
    borderRadius: 12,
    marginBottom: 9,
    gap: 3,
  },
  usdaSelectedTitle: { color: C.greenInk, fontSize: 11, fontWeight: '700' },
  usdaResult: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 8,
    gap: 10,
  },
  usdaResultCopy: { flex: 1 },
  usdaCalories: { fontSize: 10, color: C.greenInk, fontWeight: '700' },
  recipeAction: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: C.line },
  recipeActionText: { fontSize: 11, color: C.green, fontWeight: '600' },
  steps: {
    fontSize: 12,
    color: C.ink,
    lineHeight: 18,
    marginTop: 11,
    backgroundColor: C.paper,
    padding: 11,
    borderRadius: 10,
  },
  formCard: { padding: 19 },
  fieldLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: C.muted,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 7,
  },
  fieldInput: {
    height: 45,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: C.ink,
    fontSize: 13,
    backgroundColor: C.white,
    fontFamily: FONT.nunitoRegular,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  formLine: { flexDirection: 'row' },
  formHalf: { flex: 1 },
  formSpacer: { width: 20 },
  unitSelect: {
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  unitSelectActive: { borderColor: C.green },
  unitSelectText: { flex: 1, fontSize: 11, color: C.ink },
  unitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 7,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  unitOption: {
    width: '48%',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
  },
  unitOptionActive: { backgroundColor: C.greenSoft, borderColor: C.greenSoft },
  unitOptionText: { fontSize: 10, color: C.muted, textAlign: 'center' },
  unitOptionTextActive: { color: C.greenInk, fontWeight: '700' },
  symbolRow: { marginTop: 0 },
  emojiInput: { textAlign: 'center', fontSize: 22 },
  expiryDateInput: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
  },
  markOpenedButton: {
    alignSelf: 'flex-end',
    marginRight: 4,
    marginTop: -1,
    marginBottom: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: C.greenSoft,
  },
  markOpenedText: { color: C.greenInk, fontSize: 10, fontWeight: '700' },
  openedStatus: { alignSelf: 'flex-end', marginRight: 4, marginTop: -1, marginBottom: 5 },
  openedStatusText: { color: C.greenInk, fontSize: 10, fontWeight: '600' },
  expiryPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
    marginBottom: 3,
  },
  expiryDateCopy: { flex: 1, gap: 3 },
  expiryPicker: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  expiryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  expiryPickerTitle: {
    fontFamily: FONT.fredokaSemibold,
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
  },
  monthArrow: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: C.mutedFill,
  },
  expiryWeekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  expiryWeekday: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
  },
  expiryDaysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  expiryDayCell: { width: '14.2%', alignItems: 'center', marginBottom: 4, paddingVertical: 2 },
  expiryChoices: { flexDirection: 'row', gap: 7, marginTop: 4 },
  primaryButton: {
    height: 50,
    backgroundColor: C.green,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryText: { fontSize: 13, color: C.white, fontWeight: '600' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    marginBottom: 23,
  },
  guestInfoCard: { gap: 9 },
  accountButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: C.greenSoft,
    marginTop: 3,
  },
  accountButtonText: { color: C.greenInk, fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: C.mutedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  avatarEdit: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: C.white,
  },
  profileIconPicker: { padding: 15, marginTop: -11, marginBottom: 17, gap: 8 },
  profileIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  profileIconChoice: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: C.mutedFill,
    borderWidth: 1,
    borderColor: C.mutedFill,
  },
  profileIconChoiceActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  profileIconChoiceText: { fontSize: 23 },
  customProfileIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  customProfileIconInput: { flex: 1 },
  customProfileIconButton: {
    minWidth: 52,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: C.greenSoft,
  },
  profileCopy: { flex: 1 },
  settingsCard: { padding: 16, marginTop: 10, marginBottom: 20 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 13,
  },
  toggle: {
    width: 43,
    height: 25,
    borderRadius: 15,
    backgroundColor: C.mutedFill,
    justifyContent: 'center',
    padding: 3,
  },
  toggleOn: { backgroundColor: C.green },
  toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.white },
  knobOn: { alignSelf: 'flex-end' },
  accountRow: {
    height: 43,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logout: {
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.rose,
    borderRadius: 13,
    marginTop: 13,
  },
  logoutText: { fontSize: 12, color: C.red, fontWeight: '600' },
  clearPantryButton: {
    minHeight: 47,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.rose,
    borderRadius: 13,
    marginTop: 13,
  },
  clearPantryText: { fontSize: 12, color: C.red, fontWeight: '700' },
  version: { fontSize: 10, color: C.muted, letterSpacing: 0.2, textAlign: 'center', marginTop: 19 },
});
