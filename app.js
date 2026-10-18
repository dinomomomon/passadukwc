const express = require('express');
const { createApp } = require('./application');
const { app } = createApp({ expressApp: express() });
if (require.main === module) {
  app.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => {
    console.log('Kawila procurement server started');
  });
}
module.exports = app;
