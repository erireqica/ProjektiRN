import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";

const API_URL = "http://192.168.1.219:5001";

// =====================
// MAIN APP
// =====================
export default function App() {
  const [screen, setScreen] = useState("login");

  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);

  const [orders, setOrders] = useState([]);

  // =====================
  // LOGIN
  // =====================
  const login = async () => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        setScreen("restaurants");
        loadRestaurants();
      } else {
        Alert.alert(data.message);
      }
    } catch (err) {
      Alert.alert("Error logging in");
    }
  };

  // =====================
  // SIGNUP
  // =====================
  const signup = async () => {
    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      Alert.alert(data.message);

      if (data.success) {
        setScreen("login");
      }
    } catch (err) {
      Alert.alert("Error signing up");
    }
  };

  // =====================
  // LOAD RESTAURANTS
  // =====================
  const loadRestaurants = async () => {
    const res = await fetch(`${API_URL}/restaurants`);
    const data = await res.json();
    setRestaurants(data.restaurants);
  };

  // =====================
  // LOAD MENU
  // =====================
  const openRestaurant = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setScreen("menu");

    const res = await fetch(
      `${API_URL}/restaurant/${restaurant.id}`
    );

    const data = await res.json();
    setMenu(data.menu);
  };

  // =====================
  // ADD TO CART
  // =====================
  const addToCart = (item) => {
    setCart([...cart, { ...item, quantity: 1 }]);
    Alert.alert("Added to cart");
  };

  // =====================
  // PLACE ORDER
  // =====================
  const placeOrder = async () => {
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          restaurant_id: selectedRestaurant.id,
          items: cart.map((c) => ({
            menu_item_id: c.id,
            quantity: c.quantity,
          })),
        }),
      });

      const data = await res.json();

      Alert.alert("Order placed!");

      setCart([]);
      setScreen("orders");
      loadOrders();

    } catch (err) {
      Alert.alert("Error placing order");
    }
  };

  // =====================
  // LOAD ORDERS
  // =====================
  const loadOrders = async () => {
    const res = await fetch(`${API_URL}/orders/${user.id}`);
    const data = await res.json();
    setOrders(data.orders);
  };

  // =====================
  // UI RENDER
  // =====================

  // LOGIN SCREEN
  if (screen === "login") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>

        <TextInput placeholder="Email" style={styles.input} onChangeText={setEmail} />
        <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setPassword} />

        <TouchableOpacity style={styles.button} onPress={login}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <Text onPress={() => setScreen("signup")} style={styles.link}>
          Go to Signup
        </Text>
      </View>
    );
  }

  // SIGNUP SCREEN
  if (screen === "signup") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Signup</Text>

        <TextInput placeholder="Name" style={styles.input} onChangeText={setName} />
        <TextInput placeholder="Email" style={styles.input} onChangeText={setEmail} />
        <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={setPassword} />

        <TouchableOpacity style={styles.button} onPress={signup}>
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>

        <Text onPress={() => setScreen("login")} style={styles.link}>
          Back to Login
        </Text>
      </View>
    );
  }

  // RESTAURANTS SCREEN
  if (screen === "restaurants") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Restaurants</Text>

        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openRestaurant(item)}
            >
              <Text style={styles.cardText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />

        <Text onPress={loadOrders} style={styles.link}>
          View Orders
        </Text>
      </View>
    );
  }

  // MENU SCREEN
  if (screen === "menu") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Menu</Text>

        <FlatList
          data={menu}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text>{item.name}</Text>
              <Text>{item.price} €</Text>

              <TouchableOpacity onPress={() => addToCart(item)}>
                <Text style={styles.link}>Add to cart</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <TouchableOpacity style={styles.button} onPress={placeOrder}>
          <Text style={styles.buttonText}>Place Order</Text>
        </TouchableOpacity>

        <Text onPress={() => setScreen("restaurants")} style={styles.link}>
          Back
        </Text>
      </View>
    );
  }

  // ORDERS SCREEN
  if (screen === "orders") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>My Orders</Text>

        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text>Order #{item.id}</Text>
              <Text>Total: {item.total_amount} €</Text>
              <Text>Status: {item.status}</Text>
            </View>
          )}
        />

        <Text onPress={() => setScreen("restaurants")} style={styles.link}>
          Back to Restaurants
        </Text>
      </View>
    );
  }

  return null;
}

// =====================
// STYLES
// =====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
  },
  card: {
    padding: 15,
    borderWidth: 1,
    marginBottom: 10,
    borderRadius: 8,
  },
  cardText: {
    fontSize: 16,
  },
  link: {
    marginTop: 10,
    color: "blue",
  },
});