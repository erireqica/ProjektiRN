import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import wraps

import pymysql
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        DB_HOST=os.getenv("DB_HOST", "localhost"),
        DB_PORT=int(os.getenv("DB_PORT", "3306")),
        DB_USER=os.getenv("DB_USER", "root"),
        DB_PASSWORD=os.getenv("DB_PASSWORD", ""),
        DB_NAME=os.getenv("DB_NAME", "restaurant_ordering_system"),
        TOKEN_TTL_DAYS=int(os.getenv("TOKEN_TTL_DAYS", "30")),
    )
    if test_config:
        app.config.update(test_config)

    origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    def get_db():
        if "db" not in g:
            g.db = pymysql.connect(
                host=app.config["DB_HOST"],
                port=app.config["DB_PORT"],
                user=app.config["DB_USER"],
                password=app.config["DB_PASSWORD"],
                database=app.config["DB_NAME"],
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False,
            )
        return g.db

    @app.teardown_appcontext
    def close_db(_error=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def query_one(sql, params=()):
        with get_db().cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchone()

    def query_all(sql, params=()):
        with get_db().cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()

    def require_auth(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
            if not token:
                return api_error("Sign in is required.", 401)

            user = query_one(
                """
                SELECT u.id, u.full_name, u.email, u.phone
                FROM user_sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > UTC_TIMESTAMP()
                """,
                (token,),
            )
            if not user:
                return api_error("Your session has expired. Please sign in again.", 401)

            g.current_user = user
            g.current_token = token
            return handler(*args, **kwargs)

        return wrapped

    @app.errorhandler(pymysql.MySQLError)
    def handle_database_error(error):
        app.logger.exception("Database request failed", exc_info=error)
        return api_error("The database is temporarily unavailable.", 503)

    @app.errorhandler(404)
    def handle_not_found(_error):
        return api_error("Endpoint not found.", 404)

    @app.get("/")
    @app.get("/api/health")
    def health():
        return jsonify(success=True, message="Restaurant API is running")

    @app.get("/api/storefront")
    def storefront():
        restaurant = query_one(
            """
            SELECT id, name, tagline, description, address, phone, hero_image_url,
                   rating, delivery_fee, minimum_order, eta_min, eta_max, is_open
            FROM restaurants
            WHERE is_active = 1
            ORDER BY id
            LIMIT 1
            """
        )
        if not restaurant:
            return api_error("No active restaurant is configured.", 404)

        categories = query_all(
            """
            SELECT id, name, sort_order
            FROM categories
            WHERE restaurant_id = %s
            ORDER BY sort_order, name
            """,
            (restaurant["id"],),
        )
        items = query_all(
            """
            SELECT id, category_id, name, description, price, image_url,
                   is_vegetarian, is_spicy, is_popular, is_available
            FROM menu_items
            WHERE restaurant_id = %s
            ORDER BY is_popular DESC, name
            """,
            (restaurant["id"],),
        )
        return jsonify(success=True, restaurant=restaurant, categories=categories, menu_items=items)

    @app.post("/api/auth/signup")
    def signup():
        data = request.get_json(silent=True) or {}
        errors = validate_signup(data)
        if errors:
            return api_error(next(iter(errors.values())), 400, errors)

        name = data["name"].strip()
        email = data["email"].strip().lower()
        phone = clean_optional(data.get("phone"))
        if query_one("SELECT id FROM users WHERE email = %s", (email,)):
            return api_error("An account with this email already exists.", 409)

        db = get_db()
        try:
            with db.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (full_name, email, password_hash, phone)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (name, email, generate_password_hash(data["password"]), phone),
                )
                user_id = cursor.lastrowid
                token = create_session(cursor, user_id, app.config["TOKEN_TTL_DAYS"])
            db.commit()
        except Exception:
            db.rollback()
            raise

        return jsonify(
            success=True,
            message="Account created.",
            token=token,
            user={"id": user_id, "full_name": name, "email": email, "phone": phone},
        ), 201

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not email or not password:
            return api_error("Enter your email and password.", 400)

        user = query_one(
            "SELECT id, full_name, email, phone, password_hash FROM users WHERE email = %s",
            (email,),
        )
        if not user or not check_password_hash(user["password_hash"], password):
            return api_error("The email or password is incorrect.", 401)

        db = get_db()
        try:
            with db.cursor() as cursor:
                token = create_session(cursor, user["id"], app.config["TOKEN_TTL_DAYS"])
            db.commit()
        except Exception:
            db.rollback()
            raise

        user.pop("password_hash")
        return jsonify(success=True, message="Welcome back.", token=token, user=user)

    @app.post("/api/auth/logout")
    @require_auth
    def logout():
        db = get_db()
        with db.cursor() as cursor:
            cursor.execute("DELETE FROM user_sessions WHERE token = %s", (g.current_token,))
        db.commit()
        return jsonify(success=True, message="Signed out.")

    @app.get("/api/me")
    @require_auth
    def me():
        return jsonify(success=True, user=g.current_user)

    @app.post("/api/orders")
    @require_auth
    def create_order():
        data = request.get_json(silent=True) or {}
        validation_error = validate_order_payload(data)
        if validation_error:
            return api_error(validation_error, 400)

        requested_items = {int(item["menu_item_id"]): int(item["quantity"]) for item in data["items"]}
        placeholders = ",".join(["%s"] * len(requested_items))
        menu_items = query_all(
            f"""
            SELECT id, restaurant_id, name, price, is_available
            FROM menu_items
            WHERE id IN ({placeholders})
            """,
            tuple(requested_items.keys()),
        )
        if len(menu_items) != len(requested_items) or any(not item["is_available"] for item in menu_items):
            return api_error("One or more menu items are unavailable.", 409)

        restaurant_ids = {item["restaurant_id"] for item in menu_items}
        if len(restaurant_ids) != 1:
            return api_error("All items must come from the same restaurant.", 400)

        restaurant_id = restaurant_ids.pop()
        restaurant = query_one(
            "SELECT delivery_fee, minimum_order, is_open FROM restaurants WHERE id = %s AND is_active = 1",
            (restaurant_id,),
        )
        if not restaurant or not restaurant["is_open"]:
            return api_error("The restaurant is currently closed.", 409)

        subtotal = sum(Decimal(str(item["price"])) * requested_items[item["id"]] for item in menu_items)
        minimum_order = Decimal(str(restaurant["minimum_order"]))
        delivery_fee = Decimal(str(restaurant["delivery_fee"]))
        if subtotal < minimum_order:
            return api_error(f"The minimum order is EUR {minimum_order:.2f}.", 400)

        total = subtotal + delivery_fee
        db = get_db()
        try:
            with db.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO orders (
                        user_id, restaurant_id, customer_name, customer_email, customer_phone,
                        delivery_address, delivery_notes, payment_method, subtotal,
                        delivery_fee, total_amount, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                    """,
                    (
                        g.current_user["id"], restaurant_id, data["customer_name"].strip(),
                        g.current_user["email"], data["phone"].strip(), data["address"].strip(),
                        clean_optional(data.get("notes")), data["payment_method"], subtotal,
                        delivery_fee, total,
                    ),
                )
                order_id = cursor.lastrowid
                for item in menu_items:
                    quantity = requested_items[item["id"]]
                    price = Decimal(str(item["price"]))
                    cursor.execute(
                        """
                        INSERT INTO order_items (
                            order_id, menu_item_id, item_name, quantity, unit_price, total_price
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (order_id, item["id"], item["name"], quantity, price, price * quantity),
                    )
            db.commit()
        except Exception:
            db.rollback()
            raise

        return jsonify(
            success=True,
            message="Your order has been placed.",
            order={"id": order_id, "status": "pending", "total_amount": total},
        ), 201

    @app.get("/api/orders")
    @require_auth
    def list_orders():
        orders = query_all(
            """
            SELECT id, customer_name, delivery_address, subtotal, delivery_fee,
                   total_amount, payment_method, status, created_at
            FROM orders
            WHERE user_id = %s
            ORDER BY created_at DESC, id DESC
            """,
            (g.current_user["id"],),
        )
        if not orders:
            return jsonify(success=True, orders=[])

        order_ids = [order["id"] for order in orders]
        placeholders = ",".join(["%s"] * len(order_ids))
        items = query_all(
            f"""
            SELECT order_id, item_name, quantity, unit_price, total_price
            FROM order_items
            WHERE order_id IN ({placeholders})
            ORDER BY id
            """,
            tuple(order_ids),
        )
        items_by_order = {order_id: [] for order_id in order_ids}
        for item in items:
            items_by_order[item["order_id"]].append(item)
        for order in orders:
            order["items"] = items_by_order[order["id"]]
        return jsonify(success=True, orders=orders)

    return app


def api_error(message, status=400, errors=None):
    payload = {"success": False, "message": message}
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status


def clean_optional(value):
    text = str(value or "").strip()
    return text or None


def validate_signup(data):
    errors = {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if len(name) < 2:
        errors["name"] = "Enter your full name."
    if not EMAIL_PATTERN.match(email):
        errors["email"] = "Enter a valid email address."
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    return errors


def validate_order_payload(data):
    if len(str(data.get("customer_name", "")).strip()) < 2:
        return "Enter the name for this delivery."
    if len(str(data.get("phone", "")).strip()) < 6:
        return "Enter a valid phone number."
    if len(str(data.get("address", "")).strip()) < 8:
        return "Enter a complete delivery address."
    if data.get("payment_method") not in {"cash", "card_on_delivery"}:
        return "Choose a valid payment method."
    items = data.get("items")
    if not isinstance(items, list) or not items:
        return "Your cart is empty."
    seen = set()
    for item in items:
        try:
            menu_item_id = int(item.get("menu_item_id"))
            quantity = int(item.get("quantity"))
        except (AttributeError, TypeError, ValueError):
            return "The cart contains invalid items."
        if menu_item_id < 1 or quantity < 1 or quantity > 20 or menu_item_id in seen:
            return "The cart contains invalid quantities."
        seen.add(menu_item_id)
    return None


def create_session(cursor, user_id, ttl_days):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    cursor.execute(
        "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (%s, %s, %s)",
        (token, user_id, expires_at.replace(tzinfo=None)),
    )
    return token


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=os.getenv("FLASK_DEBUG") == "1")
