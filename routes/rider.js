const express = require("express");
const Database = require("better-sqlite3");

const router = express.Router();
const db = require("../db/db");

router.get("/", (req, res) => {
	const riderName = req.session.name;
	try {
		const myorder = db.prepare("SELECT id FROM orders WHERE rider_name = ? AND isDelivered = 0").all(riderName);
		if (myorder.length > 0) {
			return res.redirect(`/rider/order`);
		}
		const orders = db
			.prepare(
				`
      SELECT 
        id,
        customer_name,
        customer_address,
        created_at,
        rider_name,
        restaurant_name,
        restaurant_address,
        distance_m,
        context,
		rewards
      FROM orders
      WHERE rider_name IS NULL AND restaurant_completed = 1
    `
			)
			.all();
		const totalRewards = db
			.prepare(
				` SELECT reward FROM rider WHERE name = ? `
			)
			.get(riderName)?.reward || 0;
		
		res.render("rider/dashboard", { orders:orders, totalRewardsIn: totalRewards ,riderNameIn:riderName});
	} catch (err) {
		console.error("❌ Error loading dashboard:", err);
		res.status(500).send("Internal server error");
	}
});

router.post("/accept/:id", (req, res) => {
	try {
		const orderId = req.params.id;
		const riderName = req.session.name || req.body.rider_name;

		if (!riderName) return res.status(400).json({ error: "Missing rider name" });

		const riderCheck = db.prepare("SELECT name FROM rider WHERE name = ?").get(riderName);
		if (!riderCheck) {
			db.prepare("INSERT INTO rider (name, reward) VALUES (?, 0)").run(riderName);
			console.log(`🆕 Rider ${riderName} created.`);
		}

		const orderCheck = db.prepare("SELECT rider_name, distance_m FROM orders WHERE id = ?").get(orderId);
		if (!orderCheck) return res.status(404).json({ error: "Order not found" });
		if (orderCheck.rider_name) return res.status(400).json({ error: "Order already taken" });

		db.prepare("UPDATE orders SET rider_name = ? WHERE id = ?").run(riderName, orderId);
		console.log(`✅ Order ${orderId} accepted by ${riderName}`);
		io = req.app.get("io");
		io.emit("orderAccepted", { orderID: orderId, riderName: riderName, remainingDistance: orderCheck.distance_m });
		res.status(200).json({ redirect: `/rider/order?name=${encodeURIComponent(riderName)}` });
	} catch (err) {
		console.error("❌ Error accepting order:", err);
		res.status(500).json({ error: "Failed to accept order" });
	}
});

router.get("/order", (req, res) => {
	try {
		const riderName = req.session.name;
		if (!riderName) return res.status(400).send("Missing rider name");

		const orders = db
			.prepare(
				`
      SELECT 
        id,
        customer_name,
        customer_address,
        created_at,
        restaurant_name,
        restaurant_address,
		restaurant_completed,
		remaining_distance,
        distance_m,
        context,
		rewards
      FROM orders
      WHERE rider_name = ? AND isDelivered = 0
    `
			)
			.all(riderName);

		res.render("rider/order", { riderName, order: orders[0] });
	} catch (err) {
		console.error("❌ Error loading history:", err);
		res.status(500).send("Internal server error");
	}
});

router.post("/update-distance/:id", (req, res) => {
	try {
		const orderId = req.params.id;
		const distance = req.body.remaining_distance;
		db.prepare("UPDATE orders SET remaining_distance = ? WHERE id = ?").run(distance, orderId);
		res.status(200).json({ message: "Distance updated" });
		const io = req.app.get("io");
		io.emit("updateDistance", { orderID: orderId, remainingDistance: distance });
	} catch (err) {
		console.error("❌ Error loading history:", err);
		res.status(500).send("Internal server error");
	}
});

router.post("/mark-delivered/:id", (req, res) => {
	try {
		const orderId = req.params.id;
		db.prepare("UPDATE orders SET isDelivered = 1, remaining_distance = 0 WHERE id = ?").run(orderId);
		db.prepare("UPDATE rider SET reward = reward + (SELECT rewards FROM orders WHERE id = ?) WHERE name = (SELECT rider_name FROM orders WHERE id = ?)").run(orderId, orderId);
		const io = req.app.get("io");
		io.emit("orderDelivered", { orderID: orderId});
		res.redirect(`/rider/`);
	} catch (err) {
		console.error("❌ Error marking order as delivered:", err);
		res.status(500).send("Internal server error");
	}
});
module.exports = router;
