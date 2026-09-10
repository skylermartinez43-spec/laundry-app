import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class LaundryApp {

    private static final Map<Integer, Order> orders = new ConcurrentHashMap<>();
    private static final Map<Integer, Customer> customers = new ConcurrentHashMap<>();
    private static final Map<String, Employee> employees = new ConcurrentHashMap<>();
    
    private static final AtomicInteger orderIdGen = new AtomicInteger(1);
    private static final AtomicInteger customerIdGen = new AtomicInteger(1);
    private static final AtomicInteger receiptIdGen = new AtomicInteger(1000);
    private static final AtomicInteger employeeIdGen = new AtomicInteger(1);

    private static final Map<String, String> users = new HashMap<>();
    static { users.put("admin", "admin123"); }

    private static final Map<String, Double> servicePrices = new HashMap<>();
    static {
        servicePrices.put("Wash", 50.0);
        servicePrices.put("Dry", 30.0);
        servicePrices.put("Wash & Dry", 70.0);
    }

    private static final int MINUTES_PER_10KG = 60;

    static class Customer {
        int id;
        String name;
        String contact;
        String joinedDate;
        public Customer(String name, String contact) {
            this.id = customerIdGen.getAndIncrement();
            this.name = name;
            this.contact = contact;
            this.joinedDate = LocalDate.now().toString();
        }
    }

    static class Employee {
        int id;
        String name;
        String role;
        String joinedDate;
        double totalRevenueGenerated;
        int ordersProcessed;
        public Employee(String name, String role) {
            this.id = employeeIdGen.getAndIncrement();
            this.name = name;
            this.role = role;
            this.joinedDate = LocalDate.now().toString();
            this.totalRevenueGenerated = 0.0;
            this.ordersProcessed = 0;
        }
    }

    static class Order {
        int id;
        int customerId;
        String customerName;
        String contact;
        double weight;
        String serviceType;
        double totalPrice;
        String status;
        String createdAt;
        String claimedAt;
        int receiptId;
        String assignedEmployee;
        LocalDateTime estimatedPickup;
        String estimatedPickupStr;
        String cancelReason;
        String notificationMessage;
        String notificationDate;
        String paymentStatus;

        public Order(int customerId, String customerName, String contact, double weight, String serviceType, String assignedEmployee) {
            this.id = orderIdGen.getAndIncrement();
            this.customerId = customerId;
            this.customerName = customerName;
            this.contact = contact;
            this.weight = weight;
            this.serviceType = serviceType;
            this.totalPrice = weight * servicePrices.getOrDefault(serviceType, 0.0);
            this.status = "Pending";
            this.createdAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));
            this.claimedAt = "";
            this.receiptId = receiptIdGen.getAndIncrement();
            this.assignedEmployee = assignedEmployee;
            this.cancelReason = "";
            this.notificationMessage = "";
            this.notificationDate = "";
            this.paymentStatus = "Unpaid";
            int minutes = (int) Math.ceil((weight / 10.0) * MINUTES_PER_10KG);
            this.estimatedPickup = LocalDateTime.now().plusMinutes(minutes);
            this.estimatedPickupStr = this.estimatedPickup.format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));
        }
    }

    public static void main(String[] args) throws IOException {
        int port = 8888;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        employees.put("Juan", new Employee("Juan", "Staff"));
        employees.put("Maria", new Employee("Maria", "Staff"));
        employees.put("Pedro", new Employee("Pedro", "Staff"));

        Customer c1 = new Customer("Juan Dela Cruz", "09171234567");
        customers.put(c1.id, c1);
        Customer c2 = new Customer("Maria Santos", "09281234567");
        customers.put(c2.id, c2);

        server.createContext("/api/login", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String username = extractValue(body, "username");
                String password = extractValue(body, "password");
                if (users.containsKey(username) && users.get(username).equals(password)) {
                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Login successful\"}");
                } else {
                    sendResponse(exchange, 401, "{\"success\": false, \"message\": \"Invalid credentials\"}");
                }
            }
        });

        server.createContext("/api/orders/create", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String name = extractValue(body, "customerName");
                String contact = extractValue(body, "contact");
                String weightStr = extractValue(body, "weight");
                String service = extractValue(body, "serviceType");
                String employeeName = extractValue(body, "assignedEmployee");

                if (name.isEmpty() || weightStr.isEmpty() || service.isEmpty()) {
                    sendResponse(exchange, 400, "{\"success\": false, \"message\": \"All fields are required\"}");
                    return;
                }

                try {
                    double weight = Double.parseDouble(weightStr);
                    Customer customer = null;
                    for (Customer c : customers.values()) {
                        if (c.name.equalsIgnoreCase(name)) { customer = c; break; }
                    }
                    if (customer == null) {
                        customer = new Customer(name, contact);
                        customers.put(customer.id, customer);
                    }

                    Order newOrder = new Order(customer.id, name, contact, weight, service, employeeName);
                    orders.put(newOrder.id, newOrder);
                    Employee emp = employees.get(employeeName);
                    if (emp != null) {
                        emp.ordersProcessed++;
                        emp.totalRevenueGenerated += newOrder.totalPrice;
                    }
                    sendResponse(exchange, 200, String.format(
                        "{\"success\": true, \"orderId\": %d, \"totalPrice\": %.2f, \"status\": \"%s\", \"receiptId\": %d, \"estimatedPickup\": \"%s\"}",
                        newOrder.id, newOrder.totalPrice, newOrder.status, newOrder.receiptId, newOrder.estimatedPickupStr
                    ));
                } catch (Exception e) {
                    sendResponse(exchange, 400, "{\"success\": false, \"message\": \"Invalid weight\"}");
                }
            }
        });

        server.createContext("/api/orders", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                StringBuilder json = new StringBuilder("{\"orders\": [");
                boolean first = true;
                for (Order o : orders.values()) {
                    if (!first) json.append(",");
                    json.append(String.format(
                        "{\"id\": %d, \"customerName\": \"%s\", \"contact\": \"%s\", \"weight\": %.2f, \"serviceType\": \"%s\", \"totalPrice\": %.2f, \"status\": \"%s\", \"createdAt\": \"%s\", \"claimedAt\": \"%s\", \"receiptId\": %d, \"assignedEmployee\": \"%s\", \"estimatedPickup\": \"%s\", \"cancelReason\": \"%s\", \"notificationMessage\": \"%s\", \"notificationDate\": \"%s\", \"paymentStatus\": \"%s\"}",
                        o.id, o.customerName, o.contact, o.weight, o.serviceType, o.totalPrice, o.status, o.createdAt, o.claimedAt, o.receiptId, o.assignedEmployee, o.estimatedPickupStr, o.cancelReason, o.notificationMessage, o.notificationDate, o.paymentStatus
                    ));
                    first = false;
                }
                json.append("]}");
                sendResponse(exchange, 200, json.toString());
            }
        });

        server.createContext("/api/orders/edit", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                String customerName = extractValue(body, "customerName");
                String contact = extractValue(body, "contact");
                String serviceType = extractValue(body, "serviceType");
                double weight = Double.parseDouble(extractValue(body, "weight"));

                Order o = orders.get(id);
                if (o != null) {
                    o.customerName = customerName;
                    o.contact = contact;
                    o.serviceType = serviceType;
                    o.weight = weight;
                    o.totalPrice = weight * servicePrices.getOrDefault(serviceType, 0.0);
                    int minutes = (int) Math.ceil((weight / 10.0) * MINUTES_PER_10KG);
                    o.estimatedPickup = LocalDateTime.now().plusMinutes(minutes);
                    o.estimatedPickupStr = o.estimatedPickup.format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));
                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Order updated\"}");
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/orders/delete", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                if (orders.remove(id) != null) {
                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Order deleted\"}");
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/orders/status", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                String newStatus = extractValue(body, "status");
                Order o = orders.get(id);
                if (o != null) {
                    o.status = newStatus;
                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Status updated\"}");
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/orders/claim", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                String cashTenderedStr = extractValue(body, "cashTendered");
                
                Order o = orders.get(id);
                if (o != null) {
                    double cashTendered = 0.0;
                    try { cashTendered = Double.parseDouble(cashTenderedStr); } catch (Exception e) { cashTendered = 0.0; }
                    double change = cashTendered - o.totalPrice;
                    o.paymentStatus = "Paid";
                    o.status = "Claimed";
                    o.claimedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));
                    
                    sendResponse(exchange, 200, String.format(
                        "{\"success\": true, \"message\": \"Claimed!\", \"totalPrice\": %.2f, \"cashTendered\": %.2f, \"change\": %.2f}",
                        o.totalPrice, cashTendered, change
                    ));
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/orders/cancel", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                String cancelReason = extractValue(body, "cancelReason");
                
                Order o = orders.get(id);
                if (o != null) {
                    o.status = "Cancelled";
                    o.claimedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));
                    o.cancelReason = cancelReason;
                    
                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Order cancelled!\"}");
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/orders/notify", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                int id = Integer.parseInt(extractValue(body, "id"));
                String message = extractValue(body, "message");

                Order o = orders.get(id);
                if (o != null) {
                    o.status = "Ready";
                    o.notificationMessage = message;
                    o.notificationDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"));

                    sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Customer notified!\"}");
                } else {
                    sendResponse(exchange, 404, "{\"success\": false, \"message\": \"Order not found\"}");
                }
            }
        });

        server.createContext("/api/employees", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                StringBuilder json = new StringBuilder("{\"employees\": [");
                boolean first = true;
                for (Employee e : employees.values()) {
                    if (!first) json.append(",");
                    json.append(String.format(
                        "{\"id\": %d, \"name\": \"%s\", \"role\": \"%s\", \"joinedDate\": \"%s\", \"ordersProcessed\": %d, \"totalRevenueGenerated\": %.2f}",
                        e.id, e.name, e.role, e.joinedDate, e.ordersProcessed, e.totalRevenueGenerated
                    ));
                    first = false;
                }
                json.append("]}");
                sendResponse(exchange, 200, json.toString());
            }
        });

        server.createContext("/api/customers", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                StringBuilder json = new StringBuilder("{\"customers\": [");
                boolean first = true;
                for (Customer c : customers.values()) {
                    if (!first) json.append(",");
                    json.append(String.format(
                        "{\"id\": %d, \"name\": \"%s\", \"contact\": \"%s\", \"joinedDate\": \"%s\"}",
                        c.id, c.name, c.contact, c.joinedDate
                    ));
                    first = false;
                }
                json.append("]}");
                sendResponse(exchange, 200, json.toString());
            }
        });

        server.createContext("/api/reports", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                double totalIncome = 0;
                int totalOrders = orders.size();
                Map<String, Integer> serviceCount = new HashMap<>();
                for (Order o : orders.values()) {
                    if ("Claimed".equals(o.status)) totalIncome += o.totalPrice;
                    serviceCount.put(o.serviceType, serviceCount.getOrDefault(o.serviceType, 0) + 1);
                }
                String mostUsed = "";
                int maxCount = 0;
                for (Map.Entry<String, Integer> entry : serviceCount.entrySet()) {
                    if (entry.getValue() > maxCount) { mostUsed = entry.getKey(); maxCount = entry.getValue(); }
                }
                sendResponse(exchange, 200, String.format(
                    "{\"totalIncome\": %.2f, \"totalOrders\": %d, \"mostUsedService\": \"%s\", \"serviceCount\": %d}",
                    totalIncome, totalOrders, mostUsed, maxCount
                ));
            }
        });

        server.createContext("/api/reports/monthly", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                String currentMonth = LocalDate.now().getMonth().toString();
                double monthlyIncome = 0;
                int monthlyOrders = 0;
                for (Order o : orders.values()) {
                    if (o.createdAt.contains(currentMonth.substring(0, 3)) || o.createdAt.contains(currentMonth)) {
                        if ("Claimed".equals(o.status)) monthlyIncome += o.totalPrice;
                        monthlyOrders++;
                    }
                }
                sendResponse(exchange, 200, String.format(
                    "{\"month\": \"%s\", \"monthlyIncome\": %.2f, \"monthlyOrders\": %d}",
                    currentMonth, monthlyIncome, monthlyOrders
                ));
            }
        });

        server.createContext("/api/employees/monthly", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                String currentMonth = LocalDate.now().getMonth().toString();
                double monthlyIncome = 0;
                int monthlyOrders = 0;
                int totalEmployees = employees.size();
                for (Order o : orders.values()) {
                    if (o.createdAt.contains(currentMonth.substring(0, 3)) || o.createdAt.contains(currentMonth)) {
                        if ("Claimed".equals(o.status)) monthlyIncome += o.totalPrice;
                        monthlyOrders++;
                    }
                }
                sendResponse(exchange, 200, String.format(
                    "{\"month\": \"%s\", \"monthlyIncome\": %.2f, \"monthlyOrders\": %d, \"totalEmployees\": %d}",
                    currentMonth, monthlyIncome, monthlyOrders, totalEmployees
                ));
            }
        });

        server.createContext("/api/customer/login", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("POST".equals(exchange.getRequestMethod())) {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String customerName = extractValue(body, "customerName");
                String contact = extractValue(body, "contact");

                Customer existing = null;
                for (Customer c : customers.values()) {
                    if (c.name.equalsIgnoreCase(customerName) && c.contact.equals(contact)) {
                        existing = c;
                        break;
                    }
                }

                if (existing != null) {
                    sendResponse(exchange, 200, "{\"success\": true, \"customerId\": " + existing.id + ", \"customerName\": \"" + existing.name + "\"}");
                } else {
                    Customer newCustomer = new Customer(customerName, contact);
                    customers.put(newCustomer.id, newCustomer);
                    sendResponse(exchange, 200, "{\"success\": true, \"customerId\": " + newCustomer.id + ", \"customerName\": \"" + newCustomer.name + "\"}");
                }
            }
        });

        server.createContext("/api/customer/orders", exchange -> {
            setCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) { exchange.sendResponseHeaders(200, -1); return; }
            if ("GET".equals(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                int customerId = Integer.parseInt(query.split("=")[1]);
                
                StringBuilder json = new StringBuilder("{\"orders\": [");
                boolean first = true;
                for (Order o : orders.values()) {
                    if (o.customerId == customerId) {
                        if (!first) json.append(",");
                        json.append(String.format(
                            "{\"id\": %d, \"customerName\": \"%s\", \"weight\": %.2f, \"serviceType\": \"%s\", \"totalPrice\": %.2f, \"status\": \"%s\", \"createdAt\": \"%s\", \"estimatedPickup\": \"%s\", \"notificationMessage\": \"%s\", \"notificationDate\": \"%s\", \"paymentStatus\": \"%s\"}",
                            o.id, o.customerName, o.weight, o.serviceType, o.totalPrice, o.status, o.createdAt, o.estimatedPickupStr, o.notificationMessage, o.notificationDate, o.paymentStatus
                        ));
                        first = false;
                    }
                }
                json.append("]}");
                sendResponse(exchange, 200, json.toString());
            }
        });

        server.start();
        System.out.println("Server running on port " + port);
        System.out.println("Login: admin / admin123");
        System.out.println("Customer Test Accounts: ");
        System.out.println("   Juan Dela Cruz / juan123");
        System.out.println("   Maria Santos / maria123");
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, response.getBytes(StandardCharsets.UTF_8).length);
        OutputStream os = exchange.getResponseBody();
        os.write(response.getBytes(StandardCharsets.UTF_8));
        os.close();
    }

    private static void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static String extractValue(String json, String key) {
        String searchKey = "\"" + key + "\"";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex == -1) return "";
        int colonIndex = json.indexOf(":", keyIndex);
        if (colonIndex == -1) return "";
        int startQuote = json.indexOf("\"", colonIndex);
        if (startQuote == -1) return "";
        int endQuote = json.indexOf("\"", startQuote + 1);
        if (endQuote == -1) return "";
        return json.substring(startQuote + 1, endQuote);
    }
}