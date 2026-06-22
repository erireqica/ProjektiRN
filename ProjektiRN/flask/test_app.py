from app import create_app, validate_order_payload, validate_signup


def test_health_endpoint():
    app = create_app({"TESTING": True})
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"success": True, "message": "Restaurant API is running"}


def test_unknown_endpoint_returns_json():
    app = create_app({"TESTING": True})
    response = app.test_client().get("/api/not-real")
    assert response.status_code == 404
    assert response.get_json()["success"] is False


def test_signup_validation():
    errors = validate_signup({"name": "A", "email": "wrong", "password": "short"})
    assert set(errors) == {"name", "email", "password"}
    assert validate_signup({"name": "Ada Lovelace", "email": "ada@example.com", "password": "strongpass"}) == {}


def test_order_validation_rejects_duplicate_and_large_quantities():
    base = {
        "customer_name": "Ada Lovelace",
        "phone": "123456789",
        "address": "1 Example Street",
        "payment_method": "cash",
    }
    assert validate_order_payload({**base, "items": []}) == "Your cart is empty."
    assert validate_order_payload({**base, "items": [{"menu_item_id": 1, "quantity": 21}]})
    assert validate_order_payload({
        **base,
        "items": [
            {"menu_item_id": 1, "quantity": 1},
            {"menu_item_id": 1, "quantity": 2},
        ],
    })


def test_order_validation_accepts_valid_payload():
    assert validate_order_payload({
        "customer_name": "Ada Lovelace",
        "phone": "+355 44 123 456",
        "address": "1 Example Street, Tirana",
        "payment_method": "card_on_delivery",
        "items": [{"menu_item_id": 3, "quantity": 2}],
    }) is None
