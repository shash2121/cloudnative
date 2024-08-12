const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const redis = require('ioredis');
const { Kafka } = require('kafkajs');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Connect with MongoDB
const mongoHost = process.env.MONGO_HOST || 'localhost'; // <-- Pass this env
mongoose.connect(`mongodb://${mongoHost}:27017/productDB`)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Connect with Redis
const redisHost = process.env.REDIS_HOST || 'localhost';  // <-- Pass this env
const redisPassword = process.env.REDIS_PASSWORD || '';   // <-- Pass this env

const redisClient = new redis({
  host: redisHost, 
  port: 6379,
  password: redisPassword  // <-- Add the password here
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Set up Kafka
const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [process.env.KAFKA_BROKER]  // <-- Pass this env
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'test-group' });

// Connect Kafka producer
const connectProducer = async () => {
  await producer.connect();
  console.log('Kafka producer connected');
};

// Connect Kafka consumer
const connectConsumer = async () => {
  await consumer.connect();
  console.log('Kafka consumer connected');
  await consumer.subscribe({ topic: 'test-topic', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log({
        partition,
        offset: message.offset,
        value: message.value.toString(),
      });
    },
  });
};

connectProducer();
connectConsumer();

const productSchema = new mongoose.Schema({
  name: String,
  price: Number
});

const Product = mongoose.model('Product', productSchema);

// Kafka producer function
const sendMessage = async (message) => {
  await producer.send({
    topic: 'test-topic',
    messages: [
      { value: JSON.stringify(message) },
    ],
  });
};

// GET /api/products : retrieves all products
app.get('/api/products', async (req, res) => {
  try {
    const cacheKey = 'all_products';
    const cachedProducts = await redisClient.get(cacheKey);

    if (cachedProducts) {
      // Data found in cache, return directly
      return res.json(JSON.parse(cachedProducts));
    }

    // Cache miss, fetch from MongoDB and update cache
    const products = await Product.find();
    await redisClient.set(cacheKey, JSON.stringify(products), 'EX', 3600); // Cache for 1 hour
    console.log(`Cached products: ${JSON.stringify(products)}`);
    res.json(products);
  } 
  catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:id : retrieves a specific product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const cacheKey = `product_${req.params.id}`;
    const cachedProduct = await redisClient.get(cacheKey);

    if (cachedProduct) {
      return res.json(JSON.parse(cachedProduct));
    }

    const product = await Product.findById(req.params.id);
    if (product) {
      await redisClient.set(cacheKey, JSON.stringify(product), 'EX', 3600); // Cache for 1 hour
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products : Adds a new product
app.post('/api/products', async (req, res) => {
  const product = new Product({
    name: req.body.name,
    price: req.body.price
  });

  try {
    const newProduct = await product.save();
    await redisClient.del('all_products'); // Invalidate the products list cache
    await sendMessage({ action: 'add', product: newProduct }); // Send message to Kafka
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/products/:id : Updates an existing product by id
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      product.name = req.body.name || product.name;
      product.price = req.body.price || product.price;
      const updatedProduct = await product.save();
      await redisClient.del('all_products'); // Invalidate the products list cache
      await redisClient.set(`product_${req.params.id}`, JSON.stringify(updatedProduct), 'EX', 3600); // Update individual product cache
      await sendMessage({ action: 'update', product: updatedProduct }); // Send message to Kafka
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/products/:id : deletes a specific product by id
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await product.deleteOne();
      await redisClient.del('all_products'); // Invalidate the products list cache
      await redisClient.del(`product_${req.params.id}`); // Invalidate individual product cache
      await sendMessage({ action: 'delete', productId: req.params.id }); // Send message to Kafka
      res.status(204).send();
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
