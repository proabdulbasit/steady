const mongoose = require("mongoose");

let connectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error("Missing MONGODB_URI.");
    }

    connectionPromise = mongoose.connect(mongoUri, {
      autoIndex: true,
    });
  }

  return connectionPromise;
}

module.exports = {
  connectToDatabase,
};
