const Database = require("better-sqlite3");
const db = new Database("restaurant.db");

db.exec(`
CREATE TABLE restaurants (
    name TEXT PRIMARY KEY,
    cuisine_type TEXT NOT NULL,
    address TEXT NOT NULL
);

CREATE TABLE customer (
    name TEXT PRIMARY KEY NOT NULL,
    address TEXT NOT NULL
);

CREATE TABLE rider (
    name   TEXT PRIMARY KEY,
    reward REAL NOT NULL DEFAULT (0)
);

CREATE TABLE menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant TEXT NOT NULL,
    dish_name TEXT NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (restaurant) REFERENCES restaurants(name)
);

CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant TEXT NOT NULL,
    rating INTEGER CHECK(rating >=1 AND rating <=5),
    comment TEXT,
    FOREIGN KEY (restaurant) REFERENCES restaurants(name)
);

CREATE TABLE orders (
    id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
    customer_name        TEXT,
    customer_address     TEXT     NOT NULL,
    isPaid               INTEGER  CHECK (isPaid IN (0, 1) ) 
                                  NOT NULL
                                  DEFAULT (0),
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    rider_name           TEXT,
    restaurant_completed INTEGER  DEFAULT (0) 
                                  CHECK (restaurant_completed IN (0, 1) ) 
                                  NOT NULL,
    restaurant_name      TEXT     NOT NULL,
    restaurant_address   TEXT     NOT NULL,
    distance_m           INTEGER,
    context              TEXT,
    remaining_distance   INTEGER,
    isDelivered          INTEGER  CHECK (isDelivered IN (0, 1) ) 
                                  DEFAULT (0),
    rewards              NUMERIC,
    FOREIGN KEY (
        customer_name
    )
    REFERENCES customer (name),
    FOREIGN KEY (
        rider_name
    )
    REFERENCES rider (name),
    FOREIGN KEY (
        restaurant_name
    )
    REFERENCES restaurants (name) 
);

CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_id) REFERENCES menus(id)
);
`);
