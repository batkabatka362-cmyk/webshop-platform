fetch('https://webshop-platform-production.up.railway.app/api/v1/auth/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@webshop.mn', password: 'admin123' })
}).then(async r => {
  console.log('Status:', r.status);
  console.log('Body:', await r.text());
}).catch(console.error);
