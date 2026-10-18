// One Express app per warm Vercel function. No listener or local database on Vercel.
const { createApp } = require("../server");
module.exports = createApp().app;
