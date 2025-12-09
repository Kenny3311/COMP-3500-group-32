const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const session = require("express-session");
const db = require("./db/db");
// Routers
const restaurantRouter = require("./routes/restaurant");
const customerRouter = require("./routes/customer");
const riderRouter = require("./routes/rider");

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("io", io);
io.on("connection", (socket) => {
	console.log("✅ A user connected, socket ID:", socket.id);

	socket.on("disconnect", () => {
		console.log("❌ User disconnected, socket ID:", socket.id);
	});
});
app.use(
	session({
		secret: "your-secret-key",
		resave: false,
		saveUninitialized: false,
		cookie: { secure: false },
	})
);

// Routes
app.get("/", (req, res) => {
	console.log("New access to website");
	res.status(200).render("auth/login");
});

// Registration page
app.get("/register", (req, res) => {
    console.log("New access to registration page");
    res.status(200).render("auth/register");
});

app.post("/login", (req, res) => {
	console.log("Login attempt:", req.body);

	let role = req.body.role;
	const name = req.body.name;
	if (!["customer", "restaurants", "rider"].includes(role)) {
		return res.redirect("/");
	}

	try {
		const stmt = db.prepare(`SELECT * FROM ${role} WHERE name = ?`);
		const user = stmt.get(name);
		if (!user) {
			return res.redirect("/");
		}
		if (role == "restaurants") {
			role = "restaurant";
		}
		req.session.name = name;
		res.redirect(`/${role}`);
	} catch (err) {
		console.error(err);
		res.status(500).send("Database error");
	}
});

// Registration handler
app.post("/register", (req, res) => {
	console.log("Registration attempt:", req.body);

	let role = req.body.role;
	const name = req.body.name;
	const address = req.body.address;
	const cuisine_type = req.body.cuisine_type;

	if (!["customer", "restaurants", "rider"].includes(role)) {
		return res.redirect("/register");
	}

	try {
		if (role === "customer") {
			if (!name || !address) {
				return res.status(400).send("Name and address are required for customer registration");
			}
			const stmt = db.prepare(`INSERT INTO customer (name, address) VALUES (?, ?)`);
			stmt.run(name, address);
		} else if (role === "restaurants") {
			if (!name || !address || !cuisine_type) {
				return res.status(400).send("Name, cuisine type, and address are required for restaurant registration");
			}
			const stmt = db.prepare(`INSERT INTO restaurants (name, cuisine_type, address) VALUES (?, ?, ?)`);
			stmt.run(name, cuisine_type, address);
		} else if (role === "rider") {
			if (!name) {
				return res.status(400).send("Name is required for rider registration");
			}
			const stmt = db.prepare(`INSERT INTO rider (name) VALUES (?)`);
			stmt.run(name);
		}

		console.log(`Successfully registered ${role}: ${name}`);
		res.redirect("/");
	} catch (err) {
		console.error(err);
		if (err.message && err.message.includes("UNIQUE constraint failed")) {
			return res.status(400).send("This name is already registered. Please use a different name.");
		}
		res.status(500).send("Database error during registration");
	}
});

// Role routes
app.use("/restaurant", restaurantRouter);
app.use("/customer", customerRouter);
app.use("/rider", riderRouter);

const PORT = 3000;
server.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}`);
});
