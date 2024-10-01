INSERT INTO customer (customer_id, first_name, last_name, phone_number, join_date) VALUES
(1, 'Laura', 'Stevenson', '123-456-7890', '2020-01-15'),
(2, 'Bob', 'Jones', '234-567-8901', '2021-02-10'),
(3, 'Charlie', 'Brown', '345-678-9012', '2019-03-05'),
(4, 'Jimmy', 'Hendricks', '456-789-0123', '2021-04-20'),
(5, 'Sydney', 'Smith', '567-890-1234', '2022-06-01'),
(6, 'Jordan', 'Malone', '678-901-2345', '2022-07-15');

INSERT INTO stylist (stylist_id, first_name, last_name, phone_number, hire_date, salary) VALUES
(1, 'Sarah', 'Johnson', '123-456-1234', '2018-05-01', 50000.00),
(2, 'Emily', 'Davis', '234-567-2345', '2019-06-15', 55000.00),
(3, 'Michael', 'Williams', '345-678-3456', '2020-07-10', 60000.00);

INSERT INTO services (service_id, service_name, description, duration, price) VALUES
(1, 'Haircut', 'Basic haircut and styling', 30, 30.00),
(2, 'Coloring', 'Hair coloring and highlights', 90, 100.00),
(3, 'Perm', 'Permanent curls and waves', 120, 150.00),
(4, 'Blowout', 'Blow drying and styling', 45, 45.00),
(5, 'Trim', 'Hair trimming and maintenance', 20, 20.00);

INSERT INTO appointment (appointment_id, customer_id, stylist_id, service_id, appointment_date, total_price) VALUES
(1, 1, 1, 1, '2023-09-20', 30.00),
(2, 2, 2, 2, '2023-09-22', 100.00),
(3, 3, 3, 3, '2023-09-23', 150.00),
(4, 1, 2, 4, '2023-09-24', 45.00),
(5, 4, 1, 1, '2023-09-25', 30.00),
(6, 5, 3, 5, '2023-09-26', 20.00);

INSERT INTO payment (payment_id, appointment_id, payment_date, amount_paid) VALUES
(1, 1, '2023-09-20', 30.00),
(2, 2, '2023-09-22', 100.00),
(3, 3, '2023-09-23', 150.00),
(4, 4, '2023-09-24', 45.00),
(5, 5, '2023-09-25', 30.00),
(6, 6, '2023-09-26', 20.00);
