# Verification Checklist ✅

Complete this checklist after implementing the changes to verify everything works correctly.

## Pre-Implementation
- [ ] Backup current app code
- [ ] Verify app currently builds and runs
- [ ] Note current version number from app.json

## Implementation
- [ ] Add new file: `lib/favorites.ts` 
- [ ] Update: `components/AppHeader.tsx`
- [ ] Update: `components/ProductCard.tsx`
- [ ] Verify: No other files need changes
- [ ] Run: `npm install` (check for any new dependency warnings)

## Post-Build Testing

### Header Changes ✓
- [ ] App launches without errors
- [ ] Header shows: Menu icon | Logo | Brand text | Notifications bell
- [ ] **NO search bar** in the header (this is correct - removed aesthetic search)
- [ ] Notification bell shows unread count (if notifications exist)
- [ ] Bell icon is clickable and navigates to notifications screen

### Search Consolidation ✓
- [ ] Navigate to Catalog tab
- [ ] Search bar appears at TOP of catalog (inside the list header)
- [ ] Type in search bar and products filter in real-time
- [ ] Search works across product names, brands, descriptions
- [ ] Clear search with X button and list resets
- [ ] Search results update smoothly without lag

### Favorites Feature ✓

#### First Time Using Favorites
- [ ] Open any product catalog
- [ ] Look at heart icons on product cards
- [ ] Heart is **gray outline** (not favorited)
- [ ] Tap heart icon - it should turn **red and filled**
- [ ] Tap same heart again - it should return to **gray outline**
- [ ] Tap heart multiple times - toggles smoothly between states

#### Persistence Test (App Restart)
- [ ] With app still open, favorite 3-5 products (hearts turn red)
- [ ] Note which products you favorited
- [ ] Close the app completely (swipe up to close, not just minimize)
- [ ] Wait 3 seconds
- [ ] Reopen the app
- [ ] Navigate back to same products
- [ ] **IMPORTANT:** Hearts should still be RED for those products
- [ ] This proves data persists across app sessions

#### Persistence Test (Device Restart)
- [ ] Favorite 2-3 products and close app
- [ ] Restart device completely
- [ ] Reopen app
- [ ] Hearts should still show RED for favorited products
- [ ] This proves data survives even device restarts

#### Multiple Products
- [ ] Favorite products in different categories
- [ ] Favorite products from different brands
- [ ] Favorite same product multiple times (toggle on/off)
- [ ] All toggles should work instantly

#### Accessibility
- [ ] Tap heart with screen reader enabled
- [ ] Should announce: "Adicionar a favoritos" (not favorited) or "Remover de favoritos" (favorited)

### All Navigation Still Works ✓
- [ ] Menu button (☰) - opens/closes sidebar
- [ ] Logo circle - navigates to home
- [ ] Home tab - displays hero, offers, news, brands
- [ ] Catalog tab - shows products with filters
- [ ] Brands tab - shows all brands
- [ ] Offers tab - shows promotion products
- [ ] News tab - shows new products
- [ ] Notifications bell - shows notification list

### Filters Still Work ✓
- [ ] Department filter - shows sections within selected department
- [ ] Section filter - shows categories within selected section
- [ ] Category filter - shows products in selected category
- [ ] Brand filter - shows products from selected brand
- [ ] Combined filters (department + brand) - works correctly
- [ ] Clear filters button - resets all selections
- [ ] Cascading behavior preserved (selecting department updates sections)

### Category Shortcuts ✓
- [ ] Home screen shows category shortcuts (e.g., Bebidas, Higiene, etc.)
- [ ] Tapping shortcut filters catalog correctly
- [ ] "Ver tudo" button shows all products

### Brands Section ✓
- [ ] Brands display with logos
- [ ] Tapping brand filters catalog to that brand
- [ ] Brand count shows correctly
- [ ] "Ver todas" navigates to brands tab

### Offers & Promotions ✓
- [ ] Offer countdown timer updates every second
- [ ] Offer products display correctly
- [ ] % OFF badge shows on products with active offers
- [ ] Offer products are clickable

### Product Details ✓
- [ ] Tap "Informações" button on any product
- [ ] Product details screen opens
- [ ] Product image displays
- [ ] Product specs and details show
- [ ] Can navigate back

### Offline Mode ✓
- [ ] Turn off internet connection
- [ ] App continues to work with cached data
- [ ] "Sem conexão" banner appears in header
- [ ] Products still display
- [ ] Favorites still work offline
- [ ] Reconnect and content refreshes

## Performance Checks

- [ ] App launches in < 3 seconds
- [ ] Typing in search bar feels responsive (no lag)
- [ ] Scrolling through product lists is smooth
- [ ] Heart toggle is instant (no delay)
- [ ] Switching tabs is smooth
- [ ] No memory leaks (open app for 5+ minutes, no slowdown)

## Edge Cases

- [ ] Favorite product while searching - heart toggles correctly
- [ ] Favorite product while filtered - heart toggles correctly
- [ ] Favorite product, clear filters, unfavorite - works correctly
- [ ] Favorite same product in search and full view - both show as favorited
- [ ] Close app mid-favorite toggle - data saves correctly
- [ ] Favorite count reaches 100+ - app still performs well

## Error Handling

- [ ] Close app abruptly - no data corruption
- [ ] Low storage space - graceful handling
- [ ] Network interrupted during refresh - fallback to cache
- [ ] AsyncStorage full - app still works with some favorites

## Final Sign-Off

- [ ] All tests passed ✓
- [ ] No console errors in debug mode
- [ ] No warnings about missing props or state
- [ ] Ready for EAS build
- [ ] Ready to submit to Play Store / App Store

## Known Limitations (Acceptable)

- ⓘ Favorites are device-local (not synced across devices)
- ⓘ Favorites don't sync with web platform yet
- ⓘ No favorites import/export feature yet
- ⓘ No favorite count display (can add later)

## If Tests Fail

**Heart icon not showing as favorited:**
- Check favorites.ts is in lib/ folder
- Check ProductCard.tsx has useFavorite import
- Check AsyncStorage is installed: `npm list react-native-async-storage`

**Search bar still shows in header:**
- Check AppHeader.tsx searchBar code was removed
- Check searchPlaceholder styles were removed
- Clear app cache and rebuild

**Favorites don't persist:**
- Check AsyncStorage works: `adb shell pm clear <app-package>` on Android
- Check app has WRITE_EXTERNAL_STORAGE permission (if needed)
- Check device has sufficient storage

**Performance issues:**
- Check for console errors
- Verify useDeferredValue is in catalogo.tsx
- Verify ProductCard is wrapped with memo()
- Check image-cache is working properly

---

## Deployment Readiness

Once all tests pass:

1. [ ] Version bump in app.json (e.g., 1.0.0 → 1.0.1)
2. [ ] Create git commit: "feat: consolidate search, add favorites"
3. [ ] Tag release: `git tag v1.0.1`
4. [ ] Build with EAS: `eas build --platform all`
5. [ ] Test on real devices
6. [ ] Submit to stores

**Estimated time to complete all tests: 30-45 minutes**

Good luck! 🚀
