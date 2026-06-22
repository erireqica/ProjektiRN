# Ember & Olive Restaurant Ordering

A responsive single-restaurant ordering application built with Expo/React Native Web, Flask, and MySQL.

## Project structure

- `ProjektiRN/` - Expo frontend
- `ProjektiRN/flask/` - Flask JSON API
- `ProjektiRN/database_setup.sql` - MySQL schema and sample menu for phpMyAdmin

## 1. Set up MySQL

1. Start Apache and MySQL in XAMPP.
2. Open phpMyAdmin.
3. Import `ProjektiRN/database_setup.sql`.

The script creates `restaurant_ordering_system`, all required tables, and the sample restaurant menu. It replaces existing tables in that database.

## 2. Run the backend

From `ProjektiRN/flask` in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5001`. Copy `.env.example` to `.env` only if your database connection differs from the XAMPP defaults, then set those variables in your shell or environment manager.

Run backend tests with:

```powershell
python -m pytest -q
```

## 3. Run the frontend

From `ProjektiRN` in a second terminal:

```powershell
npm install
npx expo start
```

Press `w` for the web app. The default web API is `http://localhost:5001/api`.

For a physical phone, point Expo at the computer's LAN address before starting it:

```powershell
$env:EXPO_PUBLIC_API_URL="http://YOUR_COMPUTER_IP:5001/api"
npx expo start
```

## Running on another PC

If Python, Node.js, Expo, Flask, MySQL, and the project dependencies are already installed, only configure the connection details.

1. Import `ProjektiRN/database_setup.sql` in phpMyAdmin. This creates the `restaurant_ordering_system` database.
2. In `ProjektiRN/flask`, copy `.env.example` to `.env` and update the MySQL values if they differ from your local XAMPP configuration:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=restaurant_ordering_system
FLASK_HOST=0.0.0.0
FLASK_PORT=5001
```

3. Set the frontend API address before starting Expo:

```powershell
# Web frontend running on the same PC
$env:EXPO_PUBLIC_API_URL="http://localhost:5001/api"

# Physical phone or another device on the same network
$env:EXPO_PUBLIC_API_URL="http://YOUR_COMPUTER_IP:5001/api"

npx expo start
```

Find the computer's IPv4 address by running `ipconfig`. When testing from another device, allow Python and TCP port `5001` through Windows Firewall. Both devices must be connected to the same network.

Start the backend from `ProjektiRN/flask`:

```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

Start the frontend from `ProjektiRN` in another terminal:

```powershell
npx expo start
```

## Main flows

- Browse, search, and filter the restaurant menu without an account
- Add dishes and change quantities in a responsive basket
- Create an account or sign in during checkout
- Submit delivery details and payment preference
- Review authenticated order history and status

Prices and availability are validated by Flask using current MySQL values; totals are never trusted from the browser.
