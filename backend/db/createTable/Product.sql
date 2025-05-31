use shop;

CREATE TABLE Product (
	id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    detail TEXT,
    price INT NOT NULL,             
    remaining INT NOT NULL DEFAULT 0,
    src JSON
);
