const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Comanda = require('./models/Comanda');

const models = [User, Product, Customer, Order, Comanda];

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await Promise.all(models.map((model) => model.createCollection()));

    const adminExists = await User.exists({ username: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || '1234',
        role: 'admin',
      });
    }

    console.log(`MongoDB Conectado: ${conn.connection.host}`.cyan.underline.bold);
  } catch (error) {
    console.error(`Erro na conexão: ${error.message}`.red.bold);
    process.exit(1);
  }
};

module.exports = connectDB;