const API_URL = 'http://localhost:8888/api';

let monthlyChartInstance = null;
let dailyChartInstance = null;
let autoRefreshInterval = null;

// ============================================
// DIRECT LOAD SA DASHBOARD
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) loginPage.classList.remove('active');
    if (dashboardPage) dashboardPage.classList.add('active');
    
    showSection('dashboard');
    loadDashboard();
    loadEmployeeMonthlyReport();

    startAutoRefresh();
});

// ============================================
// AUTO-REFRESH
// ============================================
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);

    autoRefreshInterval = setInterval(() => {
        const activeSection = document.querySelector('.section.active');
        if (!activeSection) return;
        const id = activeSection.id;

        if (id === 'section-dashboard') loadDashboard();
        if (id === 'section-tracking') loadTrackingTable();
        if (id === 'section-customers') loadCustomers();
        if (id === 'section-staff') {
            loadEmployees();
            loadEmployeeMonthlyReport();
        }
        if (id === 'section-reports') loadReports();
    }, 3000);
}

// ============================================
// NAVIGATION (FIXED PARA SA MOBILE)
// Hindi na gumagamit ng event.currentTarget
// ============================================
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById('section-' + section);
    if (targetSection) targetSection.classList.add('active');
    
    // Remove active sa lahat ng menu-btn
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active sa tamang button base sa onclick attribute
    document.querySelectorAll('.menu-btn').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${section}'`)) {
            btn.classList.add('active');
        }
    });
    
    const titles = {
        dashboard: 'Dashboard',
        tracking: '📦 Tracking',
        customers: 'Customers',
        staff: 'Staff',
        reports: 'Reports'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
    
    // Scroll sa taas para sa mobile
    window.scrollTo(0, 0);
    
    if (section === 'dashboard') { loadDashboard(); }
    if (section === 'tracking') { loadTrackingTable(); }
    if (section === 'customers') { loadCustomers(); }
    if (section === 'staff') { 
        loadEmployees(); 
        loadEmployeeMonthlyReport(); 
    }
    if (section === 'reports') { loadReports(); }
}

// ============================================
// LOAD DASHBOARD DATA (STATS + CHARTS)
// ============================================
async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        const data = await res.json();
        const orders = data.orders;

        // Stats
        const totalCustomers = await (await fetch(`${API_URL}/customers`)).json();
        const customersCount = totalCustomers.customers.length;
        document.getElementById('dashboardCustomers').textContent = customersCount;
        
        // Count statuses
        let pending = 0, process = 0, folding = 0, ready = 0, claimed = 0, income = 0;
        orders.forEach(o => {
            if (o.status === 'Pending') pending++;
            if (o.status === 'Washing') process++;
            if (o.status === 'Drying') folding++;
            if (o.status === 'Ready') ready++;
            if (o.status === 'Claimed') { claimed++; income += o.totalPrice; }
        });
        
        document.getElementById('dashboardPending').textContent = pending;
        document.getElementById('dashboardProcess').textContent = process;
        document.getElementById('dashboardFolding').textContent = folding;
        document.getElementById('dashboardReady').textContent = ready;
        document.getElementById('dashboardClaimed').textContent = claimed;
        document.getElementById('dashboardMonthly').textContent = `₱${income}`;
        document.getElementById('dashboardAnnual').textContent = `₱${income * 12}`;

        // Charts
        drawCharts();
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function drawCharts() {
    // Monthly Chart
    const ctx1 = document.getElementById('monthlyChart');
    if (ctx1) {
        if (monthlyChartInstance) {
            monthlyChartInstance.destroy();
        }
        monthlyChartInstance = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                datasets: [{
                    label: 'Earnings',
                    data: [0, 1000, 5000, 8000, 12000, 15000, 18000, 22000],
                    borderColor: '#2563eb',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Daily Chart
    const ctx2 = document.getElementById('dailyChart');
    if (ctx2) {
        if (dailyChartInstance) {
            dailyChartInstance.destroy();
        }
        dailyChartInstance = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Daily',
                    data: [0, 500, 1200, 800, 1500, 2000, 2500],
                    borderColor: '#1e3a8a',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// ============================================
// LOAD TRACKING TABLE
// ============================================
async function loadTrackingTable() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        const data = await res.json();
        const orders = data.orders;
        
        const tbody = document.querySelector('#trackingTable tbody');
        tbody.innerHTML = '';
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No orders yet.</td></tr>';
            return;
        }
        
        orders.forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.customerName}</td>
                    <td>${o.serviceType}</td>
                    <td>₱${o.totalPrice.toFixed(2)}</td>
                    <td>
                        ${o.paymentStatus === 'Paid' ? `
                            <span class="paid-badge">✅ PAID</span>
                        ` : `
                            <span class="unpaid-badge">❌ UNPAID</span>
                        `}
                    </td>
                    <td>
                        ${o.status === 'Ready' ? `
                            <span class="ready-badge">🚀 Ready for Pickup</span>
                        ` : `
                            <span class="status-badge">${o.status}</span>
                        `}
                    </td>
                    <td>${o.estimatedPickup || '--'}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Error loading tracking:', err);
    }
}

// ============================================
// LOAD CUSTOMERS
// ============================================
async function loadCustomers() {
    try {
        const res = await fetch(`${API_URL}/customers`);
        const data = await res.json();
        const tbody = document.querySelector('#customersTable tbody');
        tbody.innerHTML = '';
        
        if (data.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No customers yet.</td></tr>';
            return;
        }
        
        data.customers.forEach(c => {
            tbody.innerHTML += `<tr><td>#${c.id}</td><td>${c.name}</td><td>${c.contact}</td><td>${c.joinedDate}</td></tr>`;
        });
    } catch (err) {
        console.error('Error loading customers:', err);
    }
}

// ============================================
// LOAD EMPLOYEES
// ============================================
async function loadEmployees() {
    try {
        const res = await fetch(`${API_URL}/employees`);
        const data = await res.json();
        const tbody = document.querySelector('#employeesTable tbody');
        tbody.innerHTML = '';
        
        if (data.employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No employees yet.</td></tr>';
            return;
        }
        
        data.employees.forEach(emp => {
            tbody.innerHTML += `<tr><td>#${emp.id}</td><td>${emp.name}</td><td>${emp.role}</td><td>${emp.ordersProcessed}</td><td>₱${emp.totalRevenueGenerated.toFixed(2)}</td></tr>`;
        });
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

// ============================================
// LOAD EMPLOYEE MONTHLY REPORT
// ============================================
async function loadEmployeeMonthlyReport() {
    try {
        const res = await fetch(`${API_URL}/employees/monthly`);
        const data = await res.json();
        
        document.getElementById('empMonth').textContent = data.month;
        document.getElementById('empMonthlyOrders').textContent = data.monthlyOrders;
        document.getElementById('empMonthlyIncome').textContent = `₱${data.monthlyIncome.toFixed(2)}`;
        document.getElementById('empTotalEmployees').textContent = data.totalEmployees;
    } catch (err) {
        console.error('Error loading monthly report:', err);
    }
}

// ============================================
// REPORTS
// ============================================
async function loadReports() {
    try {
        const res = await fetch(`${API_URL}/reports`);
        const data = await res.json();
        
        document.getElementById('totalOrders').textContent = data.totalOrders;
        document.getElementById('totalIncome').textContent = `₱${data.totalIncome.toFixed(2)}`;
        document.getElementById('mostUsedService').textContent = data.mostUsedService;
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}