CREATE DATABASE IF NOT EXISTS gas_monitor;

USE gas_monitor;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temperature FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    gas_value INT NOT NULL,
    fan_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    buzzer_status VARCHAR(10) NOT NULL DEFAULT 'OFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
