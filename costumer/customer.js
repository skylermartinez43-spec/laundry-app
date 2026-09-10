const API_URL = 'http://localhost:8888/api';
let currentCustomerId = null;
let currentOrderId = null;

// ============================================
// LOGIN
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    const customerName = document.getElementById('loginName').value;
    const contact = document.getElementById('loginContact').value;
    
    try {
        const res = await fetch(`${API_URL}/customer/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({customerName, contact})
        });
        const data = await res.json();
        
        if (data.success) {
            currentCustomerId = data.customerId;
            document.getElementById('welcomeName').textContent = data.customerName;
            
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('trackingSection').classList.add('active');
            
            // I-reset ang scroll sa taas
            window.scrollTo(0, 0);
            
            loadCustomerDashboard();
        } else {
            document.getElementById('loginResult').className = 'result-message error';
            document.getElementById('loginResult').textContent = '❌ Unable to login!';
        }
    } catch (err) {
        document.getElementById('loginResult').className = 'result-message error';
        document.getElementById('loginResult').textContent = '❌ Connection error!';
    }
}

function logoutCustomer() {
    currentCustomerId = null;
    document.getElementById('trackingSection').classList.remove('active');
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('loginResult').textContent = '';
    document.getElementById('loginForm').reset();
    window.scrollTo(0, 0);
}

// ============================================
// SHOW TAB (FIXED PARA SA MOBILE)
// Hindi na gumagamit ng event.currentTarget
// ============================================
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active-tab'));
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) targetTab.classList.add('active-tab');
    
    // Remove active from all menu links
    document.querySelectorAll('.menu-link').forEach(btn => btn.classList.remove('active'));
    
    // Add active sa tamang button base sa onclick attribute
    document.querySelectorAll('.menu-link').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });
    
    // Scroll sa taas ng main content para sa mobile
    const mainContent = document.querySelector('.customer-main');
    if (mainContent) mainContent.scrollTop = 0;
    window.scrollTo(0, 0);
    
    // Load data
    if (tabName === 'newOrder') { loadEmployeesForDropdown(); }
    if (tabName === 'overview') { loadCustomerDashboard(); }
    if (tabName === 'orders') { loadCustomerOrders(); }
    if (tabName === 'notifications') { loadNotifications(); }
}

// ============================================
// LOAD EMPLOYEES FOR DROPDOWN
// ============================================
async function loadEmployeesForDropdown() {
    try {
        const res = await fetch(`${API_URL}/employees`);
        const data = await res.json();
        const select = document.getElementById('assignedEmployee');
        select.innerHTML = '<option value="">-- Select --</option>';
        data.employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
        });
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

// ============================================
// PRICE CALCULATION
// ============================================
function calculatePrice() {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const service = document.getElementById('serviceType').value;
    let price = 0;
    if (service === 'Wash') price = weight * 50;
    else if (service === 'Dry') price = weight * 30;
    else if (service === 'Wash & Dry') price = weight * 70;
    document.getElementById('totalPrice').textContent = `₱${price.toFixed(2)}`;
    
    const minutes = Math.ceil((weight / 10.0) * 60);
    const now = new Date();
    const pickupTime = new Date(now.getTime() + minutes * 60000);
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[pickupTime.getDay()];
    let hours = pickupTime.getHours();
    const minutesStr = pickupTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;
    
    const formattedTime = `${dayName} ${hours}:${minutesStr} ${ampm}`;
    document.getElementById('estimatedPickup').textContent = formattedTime;
}

// ============================================
// SUBMIT ORDER
// ============================================
async function submitOrder(e) {
    e.preventDefault();
    const customerName = document.getElementById('welcomeName').textContent;
    const contact = document.getElementById('contact').value;
    const weight = document.getElementById('weight').value;
    const serviceType = document.getElementById('serviceType').value;
    const assignedEmployee = document.getElementById('assignedEmployee').value;
    const pickupOption = document.getElementById('pickupOption').value;
    const address = document.getElementById('address').value;
    
    if ((pickupOption === 'Pickup' || pickupOption === 'Delivery') && address === '') {
        alert('Please enter your address for pickup/delivery!');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/orders/create`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({customerName, contact, weight, serviceType, assignedEmployee, pickupOption, address})
        });
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('orderForm').reset();
            document.getElementById('totalPrice').textContent = '₱0.00';
            document.getElementById('estimatedPickup').textContent = '--';
            
            // I-OPEN AGAD ANG PAYMENT MODAL
            openPaymentModal(data.orderId, data.totalPrice, data.customerName);
            
            loadCustomerOrders();
            loadCustomerDashboard();
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (err) {
        alert('❌ Connection error!');
    }
}

// ============================================
// PAYMENT FUNCTIONS (FIXED PARA SA MOBILE)
// ============================================
function openPaymentModal(orderId, totalPrice, customerName) {
    currentOrderId = orderId;
    
    // Kung walang totalPrice o customerName (galing sa table click), kunin sa table row
    if (totalPrice === undefined || customerName === undefined) {
        // Hanapin ang row sa table
        const rows = document.querySelectorAll('#ordersTable tbody tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && firstCell.textContent === `#${orderId}`) {
                const cells = row.querySelectorAll('td');
                totalPrice = parseFloat(cells[2].textContent.replace('₱', '').replace(/,/g, ''));
                customerName = document.getElementById('welcomeName').textContent;
            }
        });
    }
    
    // Fallback kung wala pa rin
    if (!totalPrice) totalPrice = 0;
    if (!customerName) customerName = document.getElementById('welcomeName').textContent;
    
    document.getElementById('payCustomer').textContent = customerName;
    document.getElementById('payTotal').textContent = `₱${parseFloat(totalPrice).toFixed(2)}`;
    document.getElementById('payCash').value = '';
    document.getElementById('payChange').textContent = '₱0.00';
    
    document.getElementById('paymentModal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Pigilan ang background scroll
}

function calculateChange() {
    const totalText = document.getElementById('payTotal').textContent.replace('₱', '').replace(/,/g, '');
    const total = parseFloat(totalText) || 0;
    const cash = parseFloat(document.getElementById('payCash').value) || 0;
    const change = cash - total;
    
    document.getElementById('payChange').textContent = change >= 0 ? `₱${change.toFixed(2)}` : 'Insufficient!';
}

async function confirmPayment() {
    const cash = parseFloat(document.getElementById('payCash').value) || 0;
    const totalText = document.getElementById('payTotal').textContent.replace('₱', '').replace(/,/g, '');
    const total = parseFloat(totalText) || 0;
    
    if (cash < total) {
        alert('Insufficient cash!');
        return;
    }
    
    try {
        // I-REGISTER ANG PAYMENT SA BACKEND
        const claimRes = await fetch(`${API_URL}/orders/claim`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: currentOrderId, cashTendered: cash})
        });
        const claimData = await claimRes.json();
        
        if (!claimData.success) {
            alert('Error: ' + claimData.message);
            return;
        }
        
        // I-fetch ang order para makuha ang lahat ng details
        const res = await fetch(`${API_URL}/orders`);
        const data = await res.json();
        const order = data.orders.find(o => o.id === currentOrderId);
        
        if (!order) {
            alert('Order not found!');
            return;
        }
        
        // I-save ang receipt details
        document.getElementById('rReceiptId').textContent = order.receiptId || `#${order.id}`;
        document.getElementById('rCustomer').textContent = order.customerName;
        document.getElementById('rService').textContent = order.serviceType;
        document.getElementById('rWeight').textContent = order.weight + ' kg';
        document.getElementById('rPrice').textContent = `₱${total.toFixed(2)}`;
        document.getElementById('rCash').textContent = `₱${cash.toFixed(2)}`;
        document.getElementById('rChange').textContent = `₱${(cash - total).toFixed(2)}`;
        document.getElementById('rPickup').textContent = order.estimatedPickup || '--';
        
        // I-close ang payment modal, buksan ang receipt
        closePaymentModal();
        document.getElementById('receiptModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        
        loadCustomerOrders();
        loadCustomerDashboard();
    } catch (err) {
        alert('❌ Connection error!');
    }
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    document.body.style.overflow = '';
    currentOrderId = null;
}

// ============================================
// LOAD CUSTOMER DASHBOARD (STATS + ACTIVITY + CALENDAR)
// ============================================
async function loadCustomerDashboard() {
    if (!currentCustomerId) return;
    
    try {
        const res = await fetch(`${API_URL}/customer/orders?customerId=${currentCustomerId}`);
        const data = await res.json();
        const orders = data.orders;
        
        let totalSpent = 0;
        let ready = 0;
        let claimed = 0;
        orders.forEach(o => {
            totalSpent += o.totalPrice;
            if (o.status === 'Ready') ready++;
            if (o.status === 'Claimed') claimed++;
        });
        
        document.getElementById('statTotalOrders').textContent = orders.length;
        document.getElementById('statTotalSpent').textContent = `₱${totalSpent.toFixed(2)}`;
        document.getElementById('statReady').textContent = ready;
        document.getElementById('statClaimed').textContent = claimed;
        
        // Recent Activity
        const recentDiv = document.getElementById('recentActivity');
        recentDiv.innerHTML = orders.length === 0 
            ? '<p>No orders yet.</p>' 
            : orders.slice(-3).map(o => `
                <div>
                    <strong>Order #${o.id}</strong> - ${o.serviceType} (${o.status})
                    <br><small>${o.createdAt}</small>
                </div>
            `).join('');
        
        // Pickup Calendar
        const calDiv = document.getElementById('pickupCalendar');
        calDiv.innerHTML = orders.length === 0
            ? '<p>No pickups scheduled.</p>'
            : orders.slice(-5).map(o => `
                <div class="calendar-day">
                    <strong>Order #${o.id}</strong>
                    <span>Pickup: ${o.estimatedPickup || '--'}</span>
                </div>
            `).join('');
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

// ============================================
// LOAD CUSTOMER ORDERS
// ============================================
async function loadCustomerOrders() {
    if (!currentCustomerId) return;
    
    try {
        const res = await fetch(`${API_URL}/customer/orders?customerId=${currentCustomerId}`);
        const data = await res.json();
        
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';
        
        if (data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No orders yet.</td></tr>';
            return;
        }
        
        data.orders.forEach(o => {
            const canClaim = o.status === 'Ready' || o.status === 'Ready for Pickup';
            const canCancel = o.status === 'Pending' || o.status === 'Washing' || o.status === 'Drying';
            
            tbody.innerHTML += `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.serviceType}</td>
                    <td>₱${o.totalPrice.toFixed(2)}</td>
                    <td>
                        ${o.paymentStatus === 'Paid' ? `
                            <span style="background: #dcfce7; color: #16a34a; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-size: 11px;">✅ PAID</span>
                        ` : `
                            <span style="background: #fef2f2; color: #dc2626; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-size: 11px;">❌ UNPAID</span>
                        `}
                    </td>
                    <td>
                        ${o.status === 'Ready' ? `
                            <span style="background: #fff7ed; color: #f97316; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-size: 11px;">🚀 Ready</span>
                        ` : `
                            <span style="background: #f1f5f9; color: #64748b; padding: 5px 10px; border-radius: 10px; font-size: 11px;">${o.status}</span>
                        `}
                    </td>
                    <td>
                        ${canClaim ? `<button onclick="openPaymentModal(${o.id})" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:11px; margin:2px;">💰 Claim</button>` : ''}
                        ${canCancel ? `<button onclick="openCancelModal(${o.id})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:11px; margin:2px;">❌ Cancel</button>` : ''}
                        ${o.status === 'Cancelled' ? `<em style="font-size:11px;">Cancelled</em>` : ''}
                        ${o.status === 'Claimed' ? `<em style="font-size:11px;">Claimed</em>` : ''}
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Error loading orders:', err);
    }
}

// ============================================
// LOAD NOTIFICATIONS
// ============================================
async function loadNotifications() {
    if (!currentCustomerId) return;
    
    try {
        const res = await fetch(`${API_URL}/customer/orders?customerId=${currentCustomerId}`);
        const data = await res.json();
        
        const notifDiv = document.getElementById('notificationList');
        notifDiv.innerHTML = data.orders.length === 0 
            ? '<p>No notifications yet.</p>' 
            : data.orders.map(o => `
                <div>
                    <strong>Order #${o.id}</strong> is now <strong>${o.status}</strong>.
                    <br><small>${o.notificationMessage || 'No message yet.'}</small>
                    <br><small>${o.createdAt}</small>
                </div>
            `).join('');
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

// ============================================
// CANCELLATION FUNCTIONS
// ============================================
let cancelOrderId = null;

async function openCancelModal(orderId) {
    cancelOrderId = orderId;
    document.getElementById('cancelOrderId').textContent = orderId;
    document.getElementById('cancelReason').value = '';
    document.getElementById('cancelModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function confirmCancel() {
    const reason = document.getElementById('cancelReason').value;
    
    if (reason === '') {
        alert('Please select a reason for cancellation!');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/orders/cancel`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: cancelOrderId, cancelReason: reason})
        });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ Order cancelled successfully!');
            closeCancelModal();
            loadCustomerOrders();
            loadCustomerDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('❌ Connection error!');
    }
}

function closeCancelModal() {
    const modal = document.getElementById('cancelModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    cancelOrderId = null;
}

// ============================================
// RECEIPT FUNCTIONS
// ============================================
function printReceipt() {
    const receiptContent = document.getElementById('receiptModal').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `<div style="text-align: center; padding: 20px; font-family: 'Segoe UI', sans-serif;">${receiptContent}</div>`;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
}

function closeReceiptModal() {
    document.getElementById('receiptModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================
// ADDRESS FIELD TOGGLE (Optional - para sa mobile UX)
// Ipakita lang ang address field kapag Pickup/Delivery
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const pickupSelect = document.getElementById('pickupOption');
    const addressField = document.getElementById('addressField');
    
    if (pickupSelect && addressField) {
        // Initial check
        toggleAddressField();
        
        pickupSelect.addEventListener('change', toggleAddressField);
    }
    
    function toggleAddressField() {
        const val = pickupSelect.value;
        if (val === 'Pickup' || val === 'Delivery') {
            addressField.style.display = 'block';
        } else {
            addressField.style.display = 'none';
            document.getElementById('address').value = '';
        }
    }
    
    // I-reset ang scroll kapag nag-close ang modal gamit ang ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePaymentModal();
            closeReceiptModal();
            closeCancelModal();
        }
    });
});