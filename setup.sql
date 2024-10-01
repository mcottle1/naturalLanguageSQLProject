create table customer (
    customer_id integer primary key,
    first_name varchar(35) not null,
    last_name varchar(35) not null,
    phone_number varchar(15) not null,
    join_date date not null
);

create table stylist (
    stylist_id integer primary key,
    first_name varchar(35) not null,
    last_name varchar(35) not null,
    phone_number varchar(15) not null,
    hire_date date not null,
    salary decimal(10, 2) not null
);

create table services (
    service_id integer primary key,
    service_name varchar(35) not null,
    description varchar(255) not null,
    duration integer not null,
    price decimal(10, 2) not null
);

create table appointment (
    appointment_id integer primary key,
    customer_id integer not null,
    stylist_id integer not null,
    service_id integer not null,
    appointment_date date not null,
    total_price decimal(10, 2) not null,
    foreign key (customer_id) references customer(customer_id),
    foreign key (stylist_id) references stylist(stylist_id),
    foreign key (service_id) references services(service_id)
);

create table payment (
    payment_id integer primary key,
    appointment_id integer not null,
    payment_date date not null,
    amount_paid decimal(10, 2) not null,
    foreign key (appointment_id) references appointment(appointment_id)
);

