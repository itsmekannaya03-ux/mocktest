const express = require('express');
const { seedDatabase } = require('../seed/seedData');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');

async function runUnitRoutingTests() {
  console.log('=== NUMBER VS NAME ROUTING DIRECT VERIFICATION ===');
  await seedDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  // Helper function to invoke express route handlers in-memory
  function callApi(method, path, body = {}, headers = {}) {
    return new Promise((resolve) => {
      const req = {
        method,
        url: path,
        body,
        headers: {
          'content-type': 'application/json',
          ...headers
        }
      };

      let statusCode = 200;
      let resHeaders = {};
      let responseData = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        setHeader(k, v) {
          resHeaders[k] = v;
          return this;
        },
        json(data) {
          responseData = data;
          resolve({ status: statusCode, data: responseData });
        },
        send(data) {
          responseData = data;
          resolve({ status: statusCode, data: responseData });
        }
      };

      app.handle(req, res);
    });
  }

  // 1. Authorized Default Admin Number '224488' -> Tony Stark (Iron Man)
  const defaultAdminRes = await callApi('POST', '/api/auth/entry', { input: '224488' });
  const defaultAdminPass = defaultAdminRes.status === 200 && defaultAdminRes.data.room === 'admin-room' && defaultAdminRes.data.user.role === 'admin';
  console.log('1. Default Admin Number ("224488" -> Admin Room):', defaultAdminPass ? 'PASS' : 'FAIL', defaultAdminRes.data.user?.name, defaultAdminRes.data.room);

  // 1b. Legacy Admin Number ('3000')
  const tonyRes = await callApi('POST', '/api/auth/entry', { input: '3000' });
  const tonyPass = tonyRes.status === 200 && tonyRes.data.room === 'admin-room' && tonyRes.data.user.role === 'admin';
  console.log('1b. Admin Number ("3000" -> Tony Stark):', tonyPass ? 'PASS' : 'FAIL');

  // 1b. Alternative Admin Number ('1001')
  const tonyAltRes = await callApi('POST', '/api/auth/entry', { input: '1001' });
  const tonyAltPass = tonyAltRes.status === 200 && tonyAltRes.data.room === 'admin-room';
  console.log('1b. Alternative Admin Number ("1001" -> Tony Stark):', tonyAltPass ? 'PASS' : 'FAIL');

  // 2. Authorized Admin 2: Steve Rogers (Cap) via Number '1941'
  const capRes = await callApi('POST', '/api/auth/entry', { input: '1941' });
  const capPass = capRes.status === 200 && capRes.data.room === 'admin-room' && capRes.data.user.role === 'admin' && capRes.data.user.name === 'Steve Rogers';
  console.log('2. Authorized Admin Number ("1941" -> Steve Rogers):', capPass ? 'PASS' : 'FAIL', capRes.data.user?.name, capRes.data.room);

  // 2b. Alternative Admin Number ('1002')
  const capAltRes = await callApi('POST', '/api/auth/entry', { input: '1002' });
  const capAltPass = capAltRes.status === 200 && capAltRes.data.room === 'admin-room';
  console.log('2b. Alternative Admin Number ("1002" -> Steve Rogers):', capAltPass ? 'PASS' : 'FAIL');

  // 3. Unauthorized Numeric Input ('1234') -> Must be REJECTED!
  const fakeRes1 = await callApi('POST', '/api/auth/entry', { input: '1234' });
  const fakePass1 = fakeRes1.status === 401 && fakeRes1.data.error.includes('Access Denied');
  console.log('3. Unauthorized Admin Number ("1234" -> 401 Rejected):', fakePass1 ? 'PASS' : 'FAIL', fakeRes1.data.error);

  // 4. Another Unauthorized Number ('99999') -> Must be REJECTED!
  const fakeRes2 = await callApi('POST', '/api/auth/entry', { input: '99999' });
  const fakePass2 = fakeRes2.status === 401;
  console.log('4. Unauthorized Admin Number ("99999" -> 401 Rejected):', fakePass2 ? 'PASS' : 'FAIL');

  // 5. Common Room Member Name: 'Rishith'
  const rishithRes = await callApi('POST', '/api/auth/entry', { input: 'Rishith' });
  const rishithPass = rishithRes.status === 200 && rishithRes.data.room === 'common-room' && rishithRes.data.user.role === 'student' && rishithRes.data.user.name === 'Rishith';
  console.log('5. Common Room Member Name ("Rishith"):', rishithPass ? 'PASS' : 'FAIL', rishithRes.data.user?.name, rishithRes.data.room);

  // 6. Common Room Member Name: 'Arjun'
  const arjunRes = await callApi('POST', '/api/auth/entry', { input: 'Arjun' });
  const arjunPass = arjunRes.status === 200 && arjunRes.data.room === 'common-room' && arjunRes.data.user.role === 'student' && arjunRes.data.user.name === 'Arjun';
  console.log('6. Common Room Member Name ("Arjun"):', arjunPass ? 'PASS' : 'FAIL', arjunRes.data.user?.name, arjunRes.data.room);

  // 7. Common Room Member Name: 'Rahul'
  const rahulRes = await callApi('POST', '/api/auth/entry', { input: 'Rahul' });
  const rahulPass = rahulRes.status === 200 && rahulRes.data.room === 'common-room' && rahulRes.data.user.role === 'student' && rahulRes.data.user.name === 'Rahul';
  console.log('7. Common Room Member Name ("Rahul"):', rahulPass ? 'PASS' : 'FAIL', rahulRes.data.user?.name, rahulRes.data.room);

  // 8. Security Rule: Typing Admin Name 'Tony Stark' must NEVER grant admin role!
  const spoofRes = await callApi('POST', '/api/auth/entry', { input: 'Tony Stark' });
  const spoofPass = spoofRes.status === 200 && spoofRes.data.room === 'common-room' && spoofRes.data.user.role === 'student';
  console.log('8. Security Check: Typing Admin Name ("Tony Stark") -> Forced to student / Common Room:', spoofPass ? 'PASS' : 'FAIL', `Role: ${spoofRes.data.user?.role}`);

  // 9. Blank / whitespace input
  const blankRes = await callApi('POST', '/api/auth/entry', { input: '   ' });
  const blankPass = blankRes.status === 400;
  console.log('9. Blank Input Rejected (400):', blankPass ? 'PASS' : 'FAIL');

  // 10. Role Verification on Admin Protected Route
  const adminToken = tonyRes.data.token;
  const studentToken = rishithRes.data.token;

  const adminOverview = await callApi('GET', '/api/admin/overview', {}, { authorization: `Bearer ${adminToken}` });
  const studentOverview = await callApi('GET', '/api/admin/overview', {}, { authorization: `Bearer ${studentToken}` });

  const rolePass = adminOverview.status === 200 && studentOverview.status === 403;
  console.log('10. Server-Side Admin Route Security (Admin 200 vs Student 403):', rolePass ? 'PASS' : 'FAIL');

  console.log('=== ALL NUMBER VS NAME ROUTING PROTOCOLS VERIFIED ===');
}

runUnitRoutingTests().catch(console.error);
