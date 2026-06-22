import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { apiRequest, readSession, writeSession } from "./src/api";

const COLORS = {
  ink: "#1D1C19",
  muted: "#706F68",
  paper: "#F8F5EF",
  white: "#FFFFFF",
  line: "#E6E0D7",
  orange: "#E65F3C",
  orangeDark: "#B83A21",
  green: "#235B45",
  cream: "#F3E8D7",
  blush: "#F9DDD3",
};

const MENU_IMAGE_FALLBACKS = {
  "Sparkling Water": "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80",
};

const money = (value) => `EUR ${Number(value || 0).toFixed(2)}`;

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const wide = width >= 1080;
  const scrollRef = useRef(null);
  const menuTop = useRef(0);

  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [session, setSession] = useState(() => readSession());
  const [view, setView] = useState("menu");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStorefront = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setStorefront(await apiRequest("/storefront"));
    } catch (error) {
      setLoadError(`${error.message} Make sure Flask and MySQL are running.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorefront();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const restaurant = storefront?.restaurant;
  const menuItems = storefront?.menu_items || [];
  const categories = storefront?.categories || [];
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inCategory = category === "all"
        || (category === "popular" ? item.is_popular : String(item.category_id) === String(category));
      const matches = !term || `${item.name} ${item.description}`.toLowerCase().includes(term);
      return inCategory && matches;
    });
  }, [category, menuItems, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const deliveryFee = Number(restaurant?.delivery_fee || 0);

  const changeQuantity = (item, delta) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (!existing && delta > 0) return [...current, { ...item, quantity: 1 }];
      return current
        .map((entry) => entry.id === item.id
          ? { ...entry, quantity: entry.quantity + delta }
          : entry)
        .filter((entry) => entry.quantity > 0);
    });
    if (delta > 0) setNotice(`${item.name} added to your basket.`);
  };

  const beginCheckout = () => {
    if (!session) {
      setCartOpen(false);
      setAuthOpen(true);
      setNotice("Sign in to continue to checkout.");
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const openMenu = () => {
    setView("menu");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: menuTop.current, animated: true }));
  };

  const openOrders = async () => {
    if (!session) {
      setAuthOpen(true);
      return;
    }
    setView("orders");
    setOrdersLoading(true);
    try {
      const data = await apiRequest("/orders", { token: session.token });
      setOrders(data.orders);
    } catch (error) {
      if (error.status === 401) {
        setSession(null);
        writeSession(null);
        setAuthOpen(true);
      }
      setNotice(error.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const saveSession = (nextSession) => {
    setSession(nextSession);
    writeSession(nextSession);
    setAuthOpen(false);
    setNotice(`Welcome, ${nextSession.user.full_name.split(" ")[0]}.`);
  };

  const logout = async () => {
    if (session) {
      apiRequest("/auth/logout", { method: "POST", token: session.token }).catch(() => {});
    }
    setSession(null);
    writeSession(null);
    setView("menu");
    setNotice("You are signed out.");
  };

  if (loading) return <CenteredState><ActivityIndicator size="large" color={COLORS.orange} /><Text style={styles.stateText}>Warming up the kitchen...</Text></CenteredState>;
  if (loadError) return <CenteredState><Text style={styles.errorTitle}>We could not load the menu</Text><Text style={styles.stateText}>{loadError}</Text><PrimaryButton label="Try again" onPress={loadStorefront} /></CenteredState>;

  return (
    <View style={styles.app}>
      <StatusBar barStyle="dark-content" />
      <Header
        compact={compact}
        cartCount={cartCount}
        user={session?.user}
        onMenu={openMenu}
        onOrders={openOrders}
        onCart={() => setCartOpen(true)}
        onAccount={() => (session ? logout() : setAuthOpen(true))}
      />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>
        {view === "orders" ? (
          <OrdersView orders={orders} loading={ordersLoading} onBack={openMenu} />
        ) : (
          <>
            <Hero restaurant={restaurant} compact={compact} onOrder={openMenu} />
            <StoreFacts restaurant={restaurant} compact={compact} />
            <View
              onLayout={(event) => { menuTop.current = event.nativeEvent.layout.y; }}
              style={[styles.contentShell, wide && styles.contentShellWide]}
            >
              <View style={styles.menuColumn}>
                <View style={[styles.menuHeadingRow, compact && styles.menuHeadingCompact]}>
                  <View>
                    <Text style={styles.eyebrow}>MADE TO ORDER</Text>
                    <Text style={styles.sectionTitle}>Our menu</Text>
                  </View>
                  <TextInput
                    accessibilityLabel="Search menu"
                    placeholder="Search dishes"
                    placeholderTextColor="#9B9991"
                    value={search}
                    onChangeText={setSearch}
                    style={[styles.search, compact && styles.searchCompact]}
                  />
                </View>
                <CategoryTabs categories={categories} value={category} onChange={setCategory} />
                {visibleItems.length ? (
                  <View style={styles.menuGrid}>
                    {visibleItems.map((item) => (
                      <MenuCard
                        key={item.id}
                        item={item}
                        compact={compact}
                        columns={wide ? 2 : 1}
                        onAdd={() => changeQuantity(item, 1)}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No dishes found</Text><Text style={styles.muted}>Try another search or category.</Text></View>
                )}
              </View>
              {wide && (
                <View style={styles.cartColumn}>
                  <CartPanel
                    cart={cart}
                    subtotal={subtotal}
                    deliveryFee={deliveryFee}
                    minimum={Number(restaurant.minimum_order)}
                    onChange={changeQuantity}
                    onCheckout={beginCheckout}
                  />
                </View>
              )}
            </View>
            <Footer restaurant={restaurant} />
          </>
        )}
      </ScrollView>

      {!wide && cartCount > 0 && (
        <Pressable style={styles.floatingCart} onPress={() => setCartOpen(true)}>
          <Text style={styles.floatingBadge}>{cartCount}</Text>
          <Text style={styles.floatingText}>View basket</Text>
          <Text style={styles.floatingText}>{money(subtotal)}</Text>
        </Pressable>
      )}
      {notice ? <View style={styles.toast}><Text style={styles.toastText}>{notice}</Text></View> : null}

      <Sheet visible={cartOpen} onClose={() => setCartOpen(false)} title="Your basket">
        <CartPanel
          cart={cart}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          minimum={Number(restaurant.minimum_order)}
          onChange={changeQuantity}
          onCheckout={beginCheckout}
          flat
        />
      </Sheet>
      <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} onSuccess={saveSession} />
      <CheckoutModal
        visible={checkoutOpen}
        session={session}
        cart={cart}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={(order) => {
          setCheckoutOpen(false);
          setCart([]);
          setNotice(`Order #${order.id} is confirmed.`);
          openOrders();
        }}
      />
    </View>
  );
}

function Header({ compact, cartCount, user, onMenu, onOrders, onCart, onAccount }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onMenu} style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
        {!compact && <View><Text style={styles.brand}>EMBER & OLIVE</Text><Text style={styles.brandSub}>KITCHEN & DELIVERY</Text></View>}
      </Pressable>
      <View style={[styles.headerActions, compact && styles.headerActionsCompact]}>
        {!compact && <Pressable onPress={onMenu}><Text style={styles.navLink}>Menu</Text></Pressable>}
        <Pressable onPress={onOrders}><Text style={styles.navLink}>Orders</Text></Pressable>
        <Pressable onPress={onAccount} style={styles.accountButton}><Text style={styles.accountText}>{user ? "Sign out" : "Sign in"}</Text></Pressable>
        <Pressable onPress={onCart} style={styles.headerCart}><Text style={styles.headerCartText}>Basket {cartCount ? `(${cartCount})` : ""}</Text></Pressable>
      </View>
    </View>
  );
}

function Hero({ restaurant, compact, onOrder }) {
  return (
    <ImageBackground source={{ uri: restaurant.hero_image_url }} style={[styles.hero, compact && styles.heroCompact]} imageStyle={styles.heroImage}>
      <View style={styles.heroOverlay} />
      <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
        <View style={styles.openPill}><View style={styles.openDot} /><Text style={styles.openText}>{restaurant.is_open ? "OPEN FOR DELIVERY" : "CLOSED"}</Text></View>
        <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{restaurant.tagline}</Text>
        <Text style={styles.heroDescription}>{restaurant.description}</Text>
        <PrimaryButton label="Explore the menu" onPress={onOrder} light />
      </View>
    </ImageBackground>
  );
}

function StoreFacts({ restaurant, compact }) {
  const facts = [
    ["Delivery", `${restaurant.eta_min}-${restaurant.eta_max} min`],
    ["Rating", `${restaurant.rating} / 5`],
    ["Delivery fee", money(restaurant.delivery_fee)],
    ["Minimum", money(restaurant.minimum_order)],
  ];
  return <View style={[styles.facts, compact && styles.factsCompact]}>{facts.map(([label, value]) => <View key={label} style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>)}</View>;
}

function CategoryTabs({ categories, value, onChange }) {
  const tabs = [{ id: "all", name: "All dishes" }, { id: "popular", name: "Popular" }, ...categories.filter((item) => item.name !== "Popular")];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={[styles.tab, String(value) === String(tab.id) && styles.tabActive]}><Text style={[styles.tabText, String(value) === String(tab.id) && styles.tabTextActive]}>{tab.name}</Text></Pressable>)}</ScrollView>;
}

function MenuCard({ item, compact, columns, onAdd }) {
  const imageUrl = item.image_url || MENU_IMAGE_FALLBACKS[item.name];

  return (
    <View style={[styles.menuCard, columns === 2 && styles.menuCardHalf, compact && styles.menuCardCompact, !item.is_available && styles.unavailable]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.dishImage, columns === 2 && styles.dishImageWide, compact && styles.dishImageCompact]} /> : <View style={[styles.dishImage, columns === 2 && styles.dishImageWide, styles.imageFallback]}><Text style={styles.imageFallbackText}>E&O</Text></View>}
      <View style={styles.dishBody}>
        <View style={styles.dishTop}><Text style={styles.dishName}>{item.name}</Text><Text style={styles.price}>{money(item.price)}</Text></View>
        <Text style={styles.dishDescription} numberOfLines={3}>{item.description}</Text>
        <View style={styles.dishFooter}>
          <View style={styles.tags}>{item.is_popular ? <Tag text="Popular" /> : null}{item.is_vegetarian ? <Tag text="Vegetarian" green /> : null}{item.is_spicy ? <Tag text="Spicy" /> : null}</View>
          <Pressable disabled={!item.is_available} onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Text style={styles.addButtonText}>+</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function Tag({ text, green }) { return <View style={[styles.tag, green && styles.tagGreen]}><Text style={[styles.tagText, green && styles.tagTextGreen]}>{text}</Text></View>; }

function CartPanel({ cart, subtotal, deliveryFee, minimum, onChange, onCheckout, flat }) {
  const shortfall = Math.max(0, minimum - subtotal);
  return (
    <View style={[styles.cartPanel, flat && styles.cartPanelFlat]}>
      {!flat && <><Text style={styles.eyebrow}>YOUR ORDER</Text><Text style={styles.cartTitle}>Basket</Text></>}
      {!cart.length ? <View style={styles.cartEmpty}><Text style={styles.emptyTitle}>Your basket is empty</Text><Text style={styles.muted}>Add something delicious from the menu.</Text></View> : <>
        {cart.map((item) => <View key={item.id} style={styles.cartItem}><View style={styles.cartItemMain}><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.muted}>{money(Number(item.price) * item.quantity)}</Text></View><View style={styles.stepper}><Pressable onPress={() => onChange(item, -1)} style={styles.stepButton}><Text style={styles.stepText}>-</Text></Pressable><Text style={styles.quantity}>{item.quantity}</Text><Pressable onPress={() => onChange(item, 1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View></View>)}
        <View style={styles.summary}><SummaryRow label="Subtotal" value={money(subtotal)} /><SummaryRow label="Delivery" value={money(deliveryFee)} /><View style={styles.summaryDivider} /><SummaryRow label="Total" value={money(subtotal + deliveryFee)} strong /></View>
        {shortfall > 0 ? <Text style={styles.minimumText}>Add {money(shortfall)} more to reach the minimum.</Text> : null}
        <PrimaryButton label="Continue to checkout" onPress={onCheckout} disabled={shortfall > 0} />
      </>}
    </View>
  );
}

function SummaryRow({ label, value, strong }) { return <View style={styles.summaryRow}><Text style={strong ? styles.summaryStrong : styles.muted}>{label}</Text><Text style={strong ? styles.summaryStrong : styles.muted}>{value}</Text></View>; }

function AuthModal({ visible, onClose, onSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const data = await apiRequest(path, { method: "POST", body: JSON.stringify(form) });
      onSuccess({ token: data.token, user: data.user });
      setForm({ name: "", email: "", phone: "", password: "" });
    } catch (submitError) { setError(submitError.message); } finally { setBusy(false); }
  };
  return <Sheet visible={visible} onClose={onClose} title={mode === "login" ? "Welcome back" : "Create an account"}>
    <Text style={styles.modalLead}>{mode === "login" ? "Sign in to check out and follow your orders." : "Save your details and order in a few taps."}</Text>
    {mode === "signup" && <Field label="Full name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />}
    <Field label="Email" value={form.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(email) => setForm({ ...form, email })} />
    {mode === "signup" && <Field label="Phone (optional)" value={form.phone} keyboardType="phone-pad" onChangeText={(phone) => setForm({ ...form, phone })} />}
    <Field label="Password" value={form.password} secureTextEntry onChangeText={(password) => setForm({ ...form, password })} />
    {error ? <Text style={styles.formError}>{error}</Text> : null}
    <PrimaryButton label={busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"} onPress={submit} disabled={busy} />
    <Pressable onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}><Text style={styles.switchText}>{mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</Text></Pressable>
  </Sheet>;
}

function CheckoutModal({ visible, session, cart, subtotal, deliveryFee, onClose, onSuccess }) {
  const [form, setForm] = useState({ customer_name: "", phone: "", address: "", notes: "", payment_method: "cash" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (session) setForm((current) => ({ ...current, customer_name: current.customer_name || session.user.full_name, phone: current.phone || session.user.phone || "" })); }, [session]);
  const placeOrder = async () => {
    setBusy(true); setError("");
    try {
      const data = await apiRequest("/orders", { method: "POST", token: session.token, body: JSON.stringify({ ...form, items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })) }) });
      onSuccess(data.order);
      setForm((current) => ({ ...current, address: "", notes: "" }));
    } catch (submitError) { setError(submitError.message); } finally { setBusy(false); }
  };
  return <Sheet visible={visible} onClose={onClose} title="Delivery details">
    <Field label="Name" value={form.customer_name} onChangeText={(customer_name) => setForm({ ...form, customer_name })} />
    <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(phone) => setForm({ ...form, phone })} />
    <Field label="Delivery address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} />
    <Field label="Delivery notes (optional)" value={form.notes} multiline onChangeText={(notes) => setForm({ ...form, notes })} />
    <Text style={styles.fieldLabel}>Payment</Text>
    <View style={styles.paymentRow}>{[["cash", "Cash"], ["card_on_delivery", "Card on delivery"]].map(([value, label]) => <Pressable key={value} onPress={() => setForm({ ...form, payment_method: value })} style={[styles.paymentOption, form.payment_method === value && styles.paymentActive]}><Text style={[styles.paymentText, form.payment_method === value && styles.paymentTextActive]}>{label}</Text></Pressable>)}</View>
    <View style={styles.checkoutTotal}><SummaryRow label="Order total" value={money(subtotal + deliveryFee)} strong /></View>
    {error ? <Text style={styles.formError}>{error}</Text> : null}
    <PrimaryButton label={busy ? "Placing order..." : "Place order"} onPress={placeOrder} disabled={busy} />
  </Sheet>;
}

function OrdersView({ orders, loading, onBack }) {
  return <View style={styles.ordersPage}><Pressable onPress={onBack}><Text style={styles.backLink}>Back to menu</Text></Pressable><Text style={styles.eyebrow}>ORDER HISTORY</Text><Text style={styles.sectionTitle}>Your orders</Text>{loading ? <ActivityIndicator color={COLORS.orange} /> : !orders.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Your first order will appear here.</Text></View> : orders.map((order) => <View key={order.id} style={styles.orderCard}><View style={styles.orderHead}><View><Text style={styles.orderNumber}>Order #{order.id}</Text><Text style={styles.muted}>{formatDate(order.created_at)}</Text></View><View style={styles.statusPill}><Text style={styles.statusText}>{String(order.status).replaceAll("_", " ")}</Text></View></View>{order.items.map((item, index) => <Text key={`${item.item_name}-${index}`} style={styles.orderItem}>{item.quantity} x {item.item_name}</Text>)}<View style={styles.summaryDivider} /><SummaryRow label="Total" value={money(order.total_amount)} strong /><Text style={styles.orderAddress}>Delivering to {order.delivery_address}</Text></View>)}</View>;
}

function Field({ label, multiline, ...props }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#99968E" style={[styles.fieldInput, multiline && styles.fieldMultiline]} multiline={multiline} /></View>; }
function PrimaryButton({ label, onPress, disabled, light }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, light && styles.primaryLight, disabled && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.primaryText, light && styles.primaryTextLight]}>{label}</Text></Pressable>; }
function Sheet({ visible, onClose, title, children }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={styles.sheet}><View style={styles.sheetHead}><Text style={styles.sheetTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>x</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>{children}</ScrollView></View></View></Modal>; }
function CenteredState({ children }) { return <View style={styles.centered}>{children}</View>; }
function Footer({ restaurant }) { return <View style={styles.footer}><View><Text style={styles.footerBrand}>EMBER & OLIVE</Text><Text style={styles.footerText}>{restaurant.tagline}</Text></View><View><Text style={styles.footerLabel}>VISIT US</Text><Text style={styles.footerText}>{restaurant.address}</Text><Text style={styles.footerText}>{restaurant.phone}</Text></View><Text style={styles.footerFine}>Freshly prepared. Thoughtfully delivered.</Text></View>; }
function formatDate(value) { try { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch (_error) { return value; } }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.paper }, page: { paddingBottom: 90 }, centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 30, backgroundColor: COLORS.paper }, stateText: { color: COLORS.muted, fontSize: 16, textAlign: "center", maxWidth: 520 }, errorTitle: { fontSize: 28, fontWeight: "800", color: COLORS.ink },
  header: { height: 76, paddingHorizontal: "5%", backgroundColor: COLORS.paper, borderBottomWidth: 1, borderBottomColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 10 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10 }, brandMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.orange, alignItems: "center", justifyContent: "center" }, brandMarkText: { color: COLORS.white, fontSize: 22, fontWeight: "900" }, brand: { fontSize: 14, letterSpacing: 1.4, fontWeight: "900", color: COLORS.ink }, brandSub: { marginTop: 2, fontSize: 8, letterSpacing: 2, color: COLORS.muted }, headerActions: { flexDirection: "row", alignItems: "center", gap: 16 }, headerActionsCompact: { gap: 9 }, navLink: { color: COLORS.ink, fontWeight: "600" }, accountButton: { paddingVertical: 10 }, accountText: { color: COLORS.muted, fontWeight: "600" }, headerCart: { backgroundColor: COLORS.ink, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 }, headerCartText: { color: COLORS.white, fontWeight: "700" },
  hero: { height: 550, marginHorizontal: "3%", marginTop: 24, borderRadius: 28, overflow: "hidden", justifyContent: "center" }, heroCompact: { height: 520, marginHorizontal: 12, marginTop: 12, borderRadius: 20 }, heroImage: { borderRadius: 28 }, heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,17,13,0.58)" }, heroCopy: { width: "56%", maxWidth: 720, paddingLeft: "8%", gap: 20 }, heroCopyCompact: { width: "100%", paddingHorizontal: 26 }, openPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8 }, openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#8BE0A8" }, openText: { color: COLORS.white, fontSize: 11, letterSpacing: 1.4, fontWeight: "800" }, heroTitle: { color: COLORS.white, fontSize: 56, lineHeight: 61, fontWeight: "900", letterSpacing: -1.5, maxWidth: 680 }, heroTitleCompact: { fontSize: 39, lineHeight: 43 }, heroDescription: { color: "#F4EFE8", fontSize: 17, lineHeight: 27, maxWidth: 590 },
  primaryButton: { alignSelf: "stretch", minHeight: 50, borderRadius: 14, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.orange, marginTop: 8 }, primaryLight: { alignSelf: "flex-start", backgroundColor: COLORS.white }, primaryText: { color: COLORS.white, fontSize: 15, fontWeight: "800" }, primaryTextLight: { color: COLORS.ink }, buttonDisabled: { opacity: 0.45 }, pressed: { opacity: 0.78 },
  facts: { marginHorizontal: "7%", marginVertical: 30, flexDirection: "row", backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 18 }, factsCompact: { marginHorizontal: 12, flexWrap: "wrap" }, fact: { flex: 1, minWidth: 140, paddingHorizontal: 22, paddingVertical: 8, borderRightWidth: 1, borderRightColor: COLORS.line }, factLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: COLORS.muted, marginBottom: 6 }, factValue: { fontSize: 17, fontWeight: "800", color: COLORS.ink },
  contentShell: { width: "90%", maxWidth: 1420, alignSelf: "center", paddingTop: 24 }, contentShellWide: { flexDirection: "row", alignItems: "flex-start", gap: 28 }, menuColumn: { flex: 1 }, cartColumn: { width: 350 }, menuHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }, menuHeadingCompact: { alignItems: "stretch", flexDirection: "column" }, eyebrow: { color: COLORS.orangeDark, fontSize: 11, letterSpacing: 2.2, fontWeight: "900", marginBottom: 8 }, sectionTitle: { fontSize: 42, lineHeight: 48, fontWeight: "900", letterSpacing: -1, color: COLORS.ink, marginBottom: 18 }, search: { width: 270, height: 48, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingHorizontal: 18, color: COLORS.ink, marginBottom: 18 }, searchCompact: { width: "100%" }, tabs: { gap: 8, paddingBottom: 22 }, tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, tabActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink }, tabText: { color: COLORS.muted, fontWeight: "700" }, tabTextActive: { color: COLORS.white },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 }, menuCard: { width: "100%", minHeight: 210, backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, overflow: "hidden", flexDirection: "row" }, menuCardHalf: { width: "48.8%", flexDirection: "column" }, menuCardCompact: { minHeight: 175 }, unavailable: { opacity: 0.5 }, dishImage: { width: 190, minHeight: 210, backgroundColor: COLORS.cream }, dishImageWide: { width: "100%", height: 210 }, dishImageCompact: { width: 120 }, imageFallback: { alignItems: "center", justifyContent: "center" }, imageFallbackText: { fontWeight: "900", color: COLORS.orange, letterSpacing: 2 }, dishBody: { flex: 1, padding: 18 }, dishTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, dishName: { flex: 1, fontSize: 19, fontWeight: "800", color: COLORS.ink }, price: { fontWeight: "900", color: COLORS.ink }, dishDescription: { color: COLORS.muted, lineHeight: 21, marginTop: 9 }, dishFooter: { flex: 1, minHeight: 48, marginTop: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, tag: { borderRadius: 20, backgroundColor: COLORS.blush, paddingHorizontal: 9, paddingVertical: 5 }, tagGreen: { backgroundColor: "#DFEEE6" }, tagText: { color: COLORS.orangeDark, fontSize: 10, fontWeight: "800" }, tagTextGreen: { color: COLORS.green }, addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.orange, alignItems: "center", justifyContent: "center" }, addButtonText: { color: COLORS.white, fontSize: 25, lineHeight: 27 },
  cartPanel: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 22, ...Platform.select({ web: { position: "sticky", top: 96 } }) }, cartPanelFlat: { borderWidth: 0, padding: 0 }, cartTitle: { fontSize: 28, fontWeight: "900", color: COLORS.ink, marginBottom: 20 }, cartEmpty: { paddingVertical: 34 }, cartItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.line }, cartItemMain: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, cartItemName: { flex: 1, fontWeight: "750", color: COLORS.ink }, stepper: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }, stepButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.paper, alignItems: "center", justifyContent: "center" }, stepText: { fontSize: 18, color: COLORS.ink }, quantity: { minWidth: 18, textAlign: "center", fontWeight: "800" }, summary: { paddingTop: 18, gap: 10 }, summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 20 }, summaryDivider: { borderTopWidth: 1, borderTopColor: COLORS.line, marginVertical: 4 }, summaryStrong: { fontSize: 16, fontWeight: "900", color: COLORS.ink }, minimumText: { color: COLORS.orangeDark, fontSize: 12, marginTop: 14 }, muted: { color: COLORS.muted, lineHeight: 21 }, emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.ink, marginBottom: 6 }, emptyCard: { width: "100%", padding: 32, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
  floatingCart: { position: "absolute", left: 16, right: 16, bottom: 16, height: 58, paddingHorizontal: 18, borderRadius: 18, backgroundColor: COLORS.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 5 } }, floatingBadge: { minWidth: 27, textAlign: "center", paddingVertical: 4, borderRadius: 14, overflow: "hidden", backgroundColor: COLORS.orange, color: COLORS.white, fontWeight: "900" }, floatingText: { color: COLORS.white, fontWeight: "800" }, toast: { position: "absolute", alignSelf: "center", top: 88, backgroundColor: COLORS.green, borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12, zIndex: 40 }, toastText: { color: COLORS.white, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(18,17,15,0.55)", alignItems: "flex-end", justifyContent: "center", padding: 18 }, sheet: { width: "100%", maxWidth: 510, maxHeight: "92%", backgroundColor: COLORS.paper, borderRadius: 24, overflow: "hidden" }, sheetHead: { padding: 24, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sheetTitle: { fontSize: 28, fontWeight: "900", color: COLORS.ink }, closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" }, closeText: { fontSize: 18, color: COLORS.ink }, sheetBody: { paddingHorizontal: 24, paddingBottom: 28 }, modalLead: { color: COLORS.muted, lineHeight: 22, marginBottom: 20 }, field: { marginBottom: 14 }, fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "800", marginBottom: 7 }, fieldInput: { minHeight: 49, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, backgroundColor: COLORS.white, paddingHorizontal: 15, color: COLORS.ink }, fieldMultiline: { minHeight: 88, paddingTop: 14, textAlignVertical: "top" }, formError: { color: COLORS.orangeDark, marginVertical: 8 }, switchText: { marginTop: 20, color: COLORS.orangeDark, fontWeight: "800", textAlign: "center" }, paymentRow: { flexDirection: "row", gap: 10, marginBottom: 16 }, paymentOption: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 14, alignItems: "center" }, paymentActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink }, paymentText: { color: COLORS.ink, fontWeight: "700" }, paymentTextActive: { color: COLORS.white }, checkoutTotal: { marginVertical: 14, padding: 16, backgroundColor: COLORS.cream, borderRadius: 14 },
  ordersPage: { width: "90%", maxWidth: 900, alignSelf: "center", paddingTop: 60 }, backLink: { color: COLORS.orangeDark, fontWeight: "800", marginBottom: 30 }, orderCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 22, marginBottom: 14 }, orderHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }, orderNumber: { fontSize: 19, fontWeight: "900", color: COLORS.ink, marginBottom: 4 }, statusPill: { alignSelf: "flex-start", backgroundColor: "#DFEEE6", borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 }, statusText: { color: COLORS.green, fontSize: 11, textTransform: "uppercase", fontWeight: "900" }, orderItem: { color: COLORS.ink, marginBottom: 7 }, orderAddress: { color: COLORS.muted, marginTop: 14 },
  footer: { marginTop: 80, backgroundColor: COLORS.ink, paddingHorizontal: "7%", paddingVertical: 50, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 32 }, footerBrand: { color: COLORS.white, fontSize: 20, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 }, footerLabel: { color: COLORS.orange, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 }, footerText: { color: "#BBB6AD", lineHeight: 22, maxWidth: 340 }, footerFine: { color: "#76736E", alignSelf: "flex-end" },
});
