const express = require("express");
const router = express.Router();
const db = require("../db/db");

// Dashboard -> list restaurants
router.get("/", (req, res) => {
	try {
		const stmt = db.prepare("SELECT name, cuisine_type FROM restaurants");
		const restaurants = stmt.all();
		res.render("customer/dashboard", { restaurants });
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});

// Menu page
router.get("/menu/:id", (req, res) => {
	const id = req.params.id;

	try {
		const stmt = db.prepare("SELECT * FROM menus WHERE restaurant = ?");
		const menus = stmt.all(id);
		console.log(menus);

		res.render("customer/menu", { menus, id });
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});

// New /neworder route - receives orderDetails and creates the order
router.post("/neworder", (req, res) => {
	const orderDetails = JSON.parse(req.body.orderDetails);
	console.log("Received orderDetails:", orderDetails);

	const customerName = req.session.name || "Guest";

	try {
		// 1. Validate input
		const ids = Object.keys(orderDetails);
		if (ids.length === 0) {
			return res.status(400).send("No items in order");
		}

		// 2. Fetch menu details securely from DB
		const placeholders = ids.map(() => "?").join(",");
		const stmt = db.prepare(`
      SELECT m.id, m.dish_name, m.price, m.restaurant, r.address AS restaurant_address
      FROM menus m
      JOIN restaurants r ON m.restaurant = r.name
      WHERE m.id IN (${placeholders})
    `);
		const menuItems = stmt.all(...ids.map((id) => parseInt(id)));

		// 3. Calculate total and create context string
		let total = 10; // delivery fee
		let contextArray = [];
		let restaurantName = "";
		let restaurantAddress = "";

		for (const item of menuItems) {
			const qty = orderDetails[item.id.toString()];
			if (isNaN(qty) || qty <= 0) continue;

			const subtotal = item.price * qty;
			total += subtotal;
			contextArray.push(`${item.dish_name} x${qty} ($${subtotal.toFixed(2)})`);

			// All items assumed to be from the same restaurant
			restaurantName = item.restaurant;
			restaurantAddress = item.restaurant_address;
		}

		if (contextArray.length === 0) return res.status(400).send("Invalid order items");

		const contextString = contextArray.join(", ");

		// 4. Fetch customer address
		const customer = db
			.prepare("SELECT address FROM customer WHERE name = ?")
			.get(customerName);

		if (!customer) return res.status(400).send("Customer not found");

		const customerAddress = customer.address;

		// 5. Insert into orders table
		const insertOrder = db.prepare(`
      INSERT INTO orders (
        customer_name, customer_address, restaurant_name, restaurant_address,
        distance_m, context, remaining_distance, rewards, created_at, restaurant_completed, isPaid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 0)
    `);

		const distance_m = Math.floor(Math.random() * 2000) + 100;
		const rewards = (Math.random() * 40 + 10).toFixed(2);
		const result = insertOrder.run(
			customerName,
			customerAddress,
			restaurantName,
			restaurantAddress,
			distance_m,
			contextString,
			distance_m,
			rewards
		);

		const orderId = result.lastInsertRowid;

		// Redirect to payment page
		res.redirect(`/customer/payment/${orderId}`);
	} catch (err) {
		console.error("❌ Failed to insert order:", err);
		res.status(500).send("Failed to store order.");
	}
});

router.get("/payment/:id", (req, res) => {
	const orderId = parseInt(req.params.id);

	try {
		const order = db
			.prepare(
				`
      SELECT * FROM orders WHERE id = ?
    `
			)
			.get(orderId);

		if (!order) {
			return res.status(404).send("Order not found");
		}

		const contextItems = order.context
			.split(", ")
			.map((item) => {
				const match = item.match(/(.+) x(\d+) \(\$([0-9.]+)\)/);
				if (match) {
					return {
						dish_name: match[1],
						quantity: parseInt(match[2]),
						price: parseFloat(match[3]) / parseInt(match[2]),
					};
				}
				return null;
			})
			.filter(Boolean);

		res.render("customer/payment", {
			mergedItems: contextItems,
			orderId: orderId,
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});

router.post("/pay", (req, res) => {
	const { orderId } = req.body;
	console.log("Marking order as paid:", orderId);

	try {
		if (!orderId) {
			return res.status(400).send("Order ID is required");
		}

		const order = db
			.prepare(
				`
			SELECT restaurant_name FROM orders WHERE id = ?
		`
			)
			.get(parseInt(orderId));

		if (!order) {
			return res.status(404).send("Order not found");
		}

		const updateStmt = db.prepare(`
			UPDATE orders 
			SET isPaid = 1 
			WHERE id = ?
		`);

		const result = updateStmt.run(parseInt(orderId));

		if (result.changes === 0) {
			return res.status(404).send("Order not found");
		}

		res.send("✅ Payment successful!");

		const io = req.app.get("io");
		io.emit("newOrder", { restaurantName: order.restaurant_name });
	} catch (err) {
		console.error("❌ Failed to update payment status:", err);
		res.status(500).send("Failed to process payment.");
	}
});

router.get("/orders", (req, res) => {
	try {
		const stmt = db.prepare("SELECT * FROM orders WHERE customer_name = ? AND isPaid = 1");
		const orders = stmt.all(req.session.name);

		res.render("customer/orders", { orders: orders, username: req.session.name });
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});

router.post("/confirm/:id", (req, res) => {
	const orderId = parseInt(req.params.id);
	try {
		const updateStmt = db.prepare(`
			DELETE FROM orders 
			WHERE id = ?
		`);
		const result = updateStmt.run(orderId);

		if (result.changes === 0) {
			return res.status(404).send("Order not found");
		}
		res.redirect("/customer/orders");
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});
module.exports = router;
