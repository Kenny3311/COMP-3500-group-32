const express = require("express");
const router = express.Router();
const db = require("../db/db");

router.get("/", (req, res) => {
	const name = req.session.name;
	const restaurant = db
		.prepare("SELECT rowid AS id, * FROM restaurants WHERE name = ?")
		.get(name);

	if (!restaurant) {
		return res.send("Restaurant not found");
	}

	const menus = db.prepare("SELECT * FROM menus WHERE restaurant = ?").all(name);
	const orders = db
		.prepare(
			`
		SELECT DISTINCT *
		FROM orders
		WHERE restaurant_name = ? AND restaurant_completed = 0
		ORDER BY created_at
		`
		)
		.all(name);

	res.render("restaurant/dashboard", { restaurant, menus, orders });
});

router.post("/menu/new", (req, res) => {
	const { restaurant, dish_name, price } = req.body;

	db.prepare("INSERT INTO menus (restaurant, dish_name, price) VALUES (?, ?, ?)").run(
		restaurant,
		dish_name,
		price
	);

	res.redirect(`/restaurant?name=${encodeURIComponent(restaurant)}`);
});

router.get("/menu/edit/:id", (req, res) => {
	const menu = db.prepare("SELECT * FROM menus WHERE id = ?").get(req.params.id);
	if (!menu) return res.send("Menu not found");
	res.render("restaurant/edit_menu", { menu });
});

router.post("/menu/edit/:id", (req, res) => {
	const { dish_name, price, restaurant } = req.body;

	db.prepare("UPDATE menus SET dish_name = ?, price = ? WHERE id = ?").run(
		dish_name,
		price,
		req.params.id
	);

	res.redirect(`/restaurant?name=${encodeURIComponent(restaurant)}`);
});
router.post("/complete/:id", (req, res) => {
	const restaurant = req.body.restaurant;
	db.prepare("UPDATE orders SET restaurant_completed = 1 WHERE id = ?").run(req.params.id);
	res.redirect(`/restaurant`);
	const io = req.app.get("io");
	io.emit("readyToDeliver", { orderID: req.params.id});
});
router.post("/menu/delete/:id", (req, res) => {
	const menu = db.prepare("SELECT restaurant FROM menus WHERE id = ?").get(req.params.id);
	if (!menu) return res.send("Menu not found");

	db.prepare("DELETE FROM menus WHERE id = ?").run(req.params.id);

	res.redirect(`/restaurant?name=${encodeURIComponent(menu.restaurant)}`);
});

router.get("/orders", (req, res) => {
	const restaurantName = req.query.name;

	if (!restaurantName) {
		return res.status(400).json({ error: "Restaurant name is required" });
	}

	try {
		const orders = db
			.prepare(
				`
		SELECT DISTINCT *
		FROM orders
		WHERE restaurant_name = ? AND restaurant_completed = 0 AND isPaid = 1
		ORDER BY created_at
		`
			)
			.all(restaurantName);

		res.json(orders);
	} catch (err) {
		console.error("Error fetching orders:", err);
		res.status(500).json({ error: "Failed to fetch orders" });
	}
});

module.exports = router;
