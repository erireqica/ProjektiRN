-- ProjektiRN restaurant ordering database
-- Import this complete file in phpMyAdmin. It recreates only this application database.

CREATE DATABASE IF NOT EXISTS restaurant_ordering_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE restaurant_ordering_system;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS restaurants;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE restaurants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  tagline VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  hero_image_url VARCHAR(600) NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 5.0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  minimum_order DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  eta_min SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  eta_max SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  token VARCHAR(100) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE KEY uq_category_name (restaurant_id, name)
) ENGINE=InnoDB;

CREATE TABLE menu_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(140) NOT NULL,
  description VARCHAR(500) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(600) NULL,
  is_vegetarian TINYINT(1) NOT NULL DEFAULT 0,
  is_spicy TINYINT(1) NOT NULL DEFAULT 0,
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_menu_restaurant_category (restaurant_id, category_id)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  restaurant_id INT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  delivery_notes VARCHAR(500) NULL,
  payment_method ENUM('cash', 'card_on_delivery') NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT,
  INDEX idx_orders_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  menu_item_id INT UNSIGNED NULL,
  item_name VARCHAR(140) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO restaurants (
  name, tagline, description, address, phone, hero_image_url,
  rating, delivery_fee, minimum_order, eta_min, eta_max, is_open, is_active
) VALUES (
  'Ember & Olive',
  'Wood-fired comfort food, delivered warm.',
  'A neighborhood kitchen serving flame-grilled favorites, handmade pasta and bright seasonal plates.',
  '18 Market Street, Tirana',
  '+355 44 123 456',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1600&q=85',
  4.8, 1.90, 8.00, 25, 40, 1, 1
);

INSERT INTO categories (restaurant_id, name, sort_order) VALUES
  (1, 'Popular', 1),
  (1, 'Starters', 2),
  (1, 'Pizza', 3),
  (1, 'Pasta', 4),
  (1, 'Grill', 5),
  (1, 'Desserts', 6),
  (1, 'Drinks', 7);

INSERT INTO menu_items (
  restaurant_id, category_id, name, description, price, image_url,
  is_vegetarian, is_spicy, is_popular, is_available
) VALUES
  (1, 1, 'Ember Burger', 'Dry-aged beef, smoked cheddar, caramelized onion, pickles and house sauce.', 11.90, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 0, 0, 1, 1),
  (1, 1, 'Truffle Tagliatelle', 'Fresh pasta, forest mushrooms, parmesan and black truffle cream.', 12.50, 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=900&q=80', 1, 0, 1, 1),
  (1, 2, 'Burrata Garden', 'Creamy burrata, cherry tomatoes, basil oil and toasted sourdough.', 8.40, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1),
  (1, 2, 'Crispy Calamari', 'Tender calamari, lemon, parsley and roasted garlic aioli.', 8.90, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=80', 0, 0, 1, 1),
  (1, 3, 'Margherita', 'San Marzano tomato, fior di latte, basil and extra virgin olive oil.', 8.90, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80', 1, 0, 1, 1),
  (1, 3, 'Spicy Diavola', 'Tomato, mozzarella, spicy salami, chili honey and oregano.', 10.90, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80', 0, 1, 0, 1),
  (1, 3, 'Forest Mushroom', 'Mozzarella, mixed mushrooms, thyme, garlic and parmesan.', 10.40, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1),
  (1, 4, 'Rigatoni Rosso', 'Slow-cooked tomato, stracciatella, parmesan and fresh basil.', 10.80, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1),
  (1, 4, 'Beef Ragu Pappardelle', 'Hand-cut pasta with six-hour beef and red wine ragu.', 13.20, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80', 0, 0, 1, 1),
  (1, 5, 'Herb Chicken Plate', 'Chargrilled chicken, rosemary potatoes, greens and lemon jus.', 12.90, 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80', 0, 0, 0, 1),
  (1, 5, 'Fire-Grilled Steak', 'Sliced sirloin, peppercorn sauce, fries and dressed leaves.', 18.90, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80', 0, 0, 1, 1),
  (1, 6, 'Tiramisu', 'Espresso-soaked ladyfingers, mascarpone and dark cocoa.', 5.40, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80', 1, 0, 1, 1),
  (1, 6, 'Warm Chocolate Cake', 'Dark chocolate center, vanilla cream and toasted hazelnut.', 5.90, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1),
  (1, 7, 'House Lemonade', 'Fresh lemon, mint and sparkling water.', 2.90, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1),
  (1, 7, 'Sparkling Water', 'Chilled mineral water, 500 ml.', 1.90, 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 1);
