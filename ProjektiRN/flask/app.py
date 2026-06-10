from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import hashlib

app = Flask(__name__)
CORS(app)

# =========================
# DATABASE CONNECTION
# =========================
def get_db():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="",
        database="restaurant_ordering_system",
        cursorclass=pymysql.cursors.DictCursor
    )

# =========================
# HASH PASSWORD
# =========================
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# =========================
# HOME ROUTE
# =========================
@app.route("/")
def home():
    return jsonify({
        "success": True,
        "message": "Restaurant API running"
    })

# =========================
# SIGNUP
# =========================
@app.route("/signup", methods=["POST"])
def signup():

    data = request.json

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "Ploteso te gjitha fushat"
        })

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
        existing = cursor.fetchone()

        if existing:
            return jsonify({
                "success": False,
                "message": "Ky email ekziston"
            })

        cursor.execute("""
            INSERT INTO users (full_name, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
        """, (name, email, hash_password(password), "customer"))

        db.commit()

        return jsonify({
            "success": True,
            "message": "User u regjistrua me sukses"
        })

    finally:
        cursor.close()
        db.close()

# =========================
# LOGIN
# =========================
@app.route("/login", methods=["POST"])
def login():

    data = request.json

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Shkruaj email dhe password"
        })

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("""
            SELECT id, full_name, email, role
            FROM users
            WHERE email=%s AND password_hash=%s
        """, (email, hash_password(password)))

        user = cursor.fetchone()

        if user:
            return jsonify({
                "success": True,
                "message": "Login me sukses",
                "user": user
            })

        return jsonify({
            "success": False,
            "message": "Email ose password gabim"
        })

    finally:
        cursor.close()
        db.close()

# =========================
# GET ALL RESTAURANTS
# =========================
@app.route("/restaurants", methods=["GET"])
def get_restaurants():

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("SELECT * FROM restaurants")
        restaurants = cursor.fetchall()

        return jsonify({
            "success": True,
            "restaurants": restaurants
        })

    finally:
        cursor.close()
        db.close()

# =========================
# RESTAURANT DETAILS + MENU
# =========================
@app.route("/restaurant/<int:restaurant_id>", methods=["GET"])
def restaurant_details(restaurant_id):

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("SELECT * FROM restaurants WHERE id=%s", (restaurant_id,))
        restaurant = cursor.fetchone()

        cursor.execute("""
            SELECT *
            FROM menu_items
            WHERE restaurant_id=%s
        """, (restaurant_id,))

        menu = cursor.fetchall()

        return jsonify({
            "success": True,
            "restaurant": restaurant,
            "menu": menu
        })

    finally:
        cursor.close()
        db.close()

# =========================
# CREATE ORDER
# =========================
@app.route("/orders", methods=["POST"])
def create_order():

    data = request.json

    user_id = data.get("user_id")
    restaurant_id = data.get("restaurant_id")
    items = data.get("items")

    if not user_id or not restaurant_id or not items:
        return jsonify({
            "success": False,
            "message": "Missing required fields"
        })

    db = get_db()
    cursor = db.cursor()

    try:
        # create order first
        cursor.execute("""
            INSERT INTO orders (user_id, restaurant_id, total_amount, status)
            VALUES (%s, %s, %s, %s)
        """, (user_id, restaurant_id, 0, "pending"))

        order_id = cursor.lastrowid
        total = 0

        # add order items
        for item in items:
            menu_item_id = item["menu_item_id"]
            quantity = item["quantity"]

            cursor.execute("""
                SELECT price FROM menu_items WHERE id=%s
            """, (menu_item_id,))

            row = cursor.fetchone()

            if not row:
                continue

            price = row["price"]
            subtotal = price * quantity
            total += subtotal

            cursor.execute("""
                INSERT INTO order_items (order_id, menu_item_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, menu_item_id, quantity, price))

        # update total
        cursor.execute("""
            UPDATE orders
            SET total_amount=%s
            WHERE id=%s
        """, (total, order_id))

        db.commit()

        return jsonify({
            "success": True,
            "message": "Order created",
            "order_id": order_id,
            "total": total
        })

    finally:
        cursor.close()
        db.close()

# =========================
# GET USER ORDERS
# =========================
@app.route("/orders/<int:user_id>", methods=["GET"])
def get_orders(user_id):

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("""
            SELECT *
            FROM orders
            WHERE user_id=%s
            ORDER BY id DESC
        """, (user_id,))

        orders = cursor.fetchall()

        return jsonify({
            "success": True,
            "orders": orders
        })

    finally:
        cursor.close()
        db.close()

# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)