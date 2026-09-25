// server/test-validations.js
const BASE_URL = process.env.API_URL || "http://localhost:5000/api";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

let passed = 0;
let failed = 0;

async function testEndpoint({
  name,
  method,
  endpoint,
  body,
  expectedStatus,
  headers = {},
}) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    const isSuccess = res.status === expectedStatus;

    if (isSuccess) {
      console.log(
        `${colors.green}✔ PASS${colors.reset} [${res.status}] ${name}`,
      );
      passed++;
    } else {
      console.log(
        `${colors.red}✘ FAIL${colors.reset} [Expected ${expectedStatus}, got ${res.status}] ${name}`,
      );
      console.log(`  Response:`, JSON.stringify(data));
      failed++;
    }
  } catch (err) {
    console.log(`${colors.red}✘ ERROR${colors.reset} ${name}: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log(`${colors.cyan}=== 1. AUTH VALIDATION TESTS ===${colors.reset}`);

  // Registration OTP: invalid email & short password
  await testEndpoint({
    name: "Reject invalid email on register-otp",
    method: "POST",
    endpoint: "/auth/register/send-otp",
    body: { name: "Test User", email: "notanemail", password: "123" },
    expectedStatus: 400,
  });

  // Verify OTP: invalid length
  await testEndpoint({
    name: "Reject OTP that is not 6 digits",
    method: "POST",
    endpoint: "/auth/register/verify-otp",
    body: { email: "valid@example.com", otp: "123" },
    expectedStatus: 400,
  });

  // Login: missing password
  await testEndpoint({
    name: "Reject login with missing password",
    method: "POST",
    endpoint: "/auth/login",
    body: { email: "user@example.com" },
    expectedStatus: 400,
  });

  console.log(
    `\n${colors.cyan}=== 2. ORDER VALIDATION TESTS ===${colors.reset}`,
  );

  // Create Order: empty cart items
  await testEndpoint({
    name: "Reject order placement with empty items array",
    method: "POST",
    endpoint: "/orders",
    body: {
      items: [],
      paymentMethod: "cod",
      shippingAddress: {
        name: "Customer",
        phone: "9876543210",
        line1: "Main St",
        city: "City",
        state: "State",
        pincode: "500001",
      },
    },
    expectedStatus: 400,
  });

  // Create Order: invalid product MongoDB ObjectId
  await testEndpoint({
    name: "Reject order with non-ObjectId productId",
    method: "POST",
    endpoint: "/orders",
    body: {
      items: [{ productId: "invalid-id", qty: 2 }],
      paymentMethod: "cod",
      shippingAddress: {
        name: "Customer",
        phone: "9876543210",
        line1: "Main St",
        city: "City",
        state: "State",
        pincode: "500001",
      },
    },
    expectedStatus: 400,
  });

  // Create Order: missing city & address line
  await testEndpoint({
    name: "Reject order with incomplete shipping address",
    method: "POST",
    endpoint: "/orders",
    body: {
      items: [{ productId: "507f1f77bcf86cd799439011", qty: 1 }],
      paymentMethod: "cod",
      shippingAddress: {
        name: "Customer",
        phone: "9876543210",
      },
    },
    expectedStatus: 400,
  });

  // Shipping estimate query validation
  await testEndpoint({
    name: "Reject negative subtotal on estimate-shipping",
    method: "GET",
    endpoint: "/orders/estimate-shipping?subtotal=-10",
    expectedStatus: 400,
  });

  console.log(
    `\n${colors.cyan}=== 3. NEWSLETTER VALIDATION TESTS ===${colors.reset}`,
  );

  // Newsletter subscription
  await testEndpoint({
    name: "Reject invalid email on newsletter subscribe",
    method: "POST",
    endpoint: "/newsletter/subscribe",
    body: { email: "invalid-email-string" },
    expectedStatus: 400,
  });

  console.log(
    `\n${colors.cyan}=== 4. PRODUCT VALIDATION TESTS ===${colors.reset}`,
  );

  // Public products list query validation
  await testEndpoint({
    name: "Reject invalid sort enum on products listing",
    method: "GET",
    endpoint: "/products?sort=unsupported_sort_value",
    expectedStatus: 400,
  });

  await testEndpoint({
    name: "Reject negative page number on products listing",
    method: "GET",
    endpoint: "/products?page=-1",
    expectedStatus: 400,
  });

  console.log(
    `\n${colors.yellow}==============================${colors.reset}`,
  );
  console.log(`Total Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`Total Failed: ${colors.red}${failed}${colors.reset}`);
  console.log(`${colors.yellow}==============================${colors.reset}`);
}

runTests();
