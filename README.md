## ReverseKart (Backend + Static Frontend)

ReverseKart is a reverse e-commerce platform concept:
- **Sellers** post items
- **Buyers** request deals on those items
- **Sellers** accept/reject requests

This project contains:
- A static frontend (`index.html`, `styles.css`, `script.js`)
- A Node.js + Express REST API (`server.js`) backed by MongoDB

## Prerequisites
- Node.js installed
- A MongoDB database:
  - **Local MongoDB** running on `mongodb://127.0.0.1:27017` (default), **or**
  - MongoDB Atlas connection string

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env` (copy from `.env.example`):
- `MONGO_URI` must point to a running MongoDB instance
- `JWT_SECRET` must be set

3. Start database (choose one):

### Option A: Docker MongoDB (quickest)
```bash
npm run db:up
```

### Option B: Local MongoDB service
Make sure MongoDB service is running on `127.0.0.1:27017`.

4. (Optional) Seed demo data:
```bash
npm run seed
```
This creates demo accounts:
- seller: `seller@reversekart.com` / `password123`
- buyer: `buyer@reversekart.com` / `password123`

5. Start the server:

```bash
npm start
```

Server should run at `http://localhost:5000`.

## Open the frontend (important)
To make Login/Register work (it calls the API), open the page from the server:
- `http://localhost:5000/index.html`

Avoid opening via `file:///.../index.html`.

## Database helper commands
- `npm run db:up` -> starts MongoDB via Docker
- `npm run db:down` -> stops/removes containers
- `npm run db:logs` -> follows MongoDB logs
- `npm run seed` -> inserts demo users/products/requests

## API endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Products
- `POST /api/products` (seller, JWT)
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/category/:category`
- `GET /api/products/seller/:sellerId`

### Requests
- `POST /api/requests` (buyer, JWT)
- `GET /api/requests/buyer` (buyer, JWT)
- `GET /api/requests/seller` (seller, JWT)
- `PUT /api/requests/:id` (seller, JWT) body: `{ "status": "accepted" | "rejected" }`

