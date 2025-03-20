const { ApolloServer, gql } = require('apollo-server-express'); // Добавляем GraphQL
const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const cors = require('cors');
const app = express();
const path = require('path');
const WebSocket = require('ws'); // Подключаем WebSocket
const PORT = 3000;
const productsPath = path.join(__dirname, 'products.json');
let products = [];

function loadProducts() {
  try {
      const data = fs.readFileSync(productsPath, 'utf-8');
      products = JSON.parse(data);
      return products;
  } catch (err) {
      console.error('Ошибка загрузки товаров:', err);
      return [];
  }
}

function saveProducts() {
  try{
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
  } catch (error){
    console.error('Ошибка сохранения файла:', error);
  }
}

app.use(cors({
  origin: '*', // Разрешаем запросы с любых источников (можно заменить на конкретные)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Явные маршруты для HTML-страниц
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Practice5/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../Practice6/admin.html'));
});

// Определение схемы GraphQL
const typeDefs = gql`
  type Product {
    id: ID!
    name: String!
    price: Float!
    description: String
    categories: [String]
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }
`;

const resolvers = {
  Query: {
      products: () => loadProducts(), 
      product: (_, { id }) => loadProducts().find(p => p.id == id),
  }
};

const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");


// Middleware для парсинга JSON
app.use(bodyParser.json());

// Создаём GraphQL-сервер
const server = new ApolloServer({ typeDefs, resolvers });



app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Разрешает все домены
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});



// Получить список товаров
app.get("/products", (req, res) => {
  res.json(products);
});

// Создать новую задачу
app.post("/products", (req, res) => {
  const newProduct = {
    id: products.length + 1,
    name: req.body.name,
    price: req.body.price,
    category: req.body.category,
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Получить задачу по ID
app.get("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find((p) => p.id == productId);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: "Product not found" });
  }
});

app.put("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find((p) => p.id === productId);
  if (product) {
    const { name, price, category } = req.body;
    product.name = name !== undefined ? name : product.name;
    product.price = price !== undefined ? price : product.price;
    product.category = category !== undefined ? category : product.category;
    res.json(product);
  } else {
    res.status(404).json({ message: "Product not found" });
  }
});

app.delete('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  console.log('Deleting product with ID:', {productId}); // Логируем ID
  console.log('Current products:', {products}); // Логируем текущий массив продуктов

  const initialLength = products.length;
  products = products.filter(p => p.id != productId);
  
  if (products.length === initialLength) {
      console.log('Product with ID not found', {productId}); // Логируем, если продукт не найден
      return res.status(404).json({ message: 'Product not found' });
  }
  
  console.log('Product with ID, deleted',{productId}); // Логируем успешное удаление
  res.status(204).send();
});



async function startServer() {
  await server.start();
  server.applyMiddleware({ app });

  // Swagger документация
  const swaggerOptions = {
    swaggerDefinition: {
      openapi: "3.0.0",
      info: {
        title: "Task Management API",
        version: "1.0.0",
        description: "API для управления задачами",
      },
      servers: [
        {
          url: "http://localhost:3000",
        },
      ],
    },
    apis: ["openapi.yaml"], // укажите путь к файлам с аннотациями
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  app.listen(PORT, () => {

    console.log(`GraphQL API запущен на http://localhost:${PORT}/graphql`);
    console.log(`Swagger API Docs: http://localhost:${PORT}/api-docs`);

  });
  const wss = new WebSocket.Server({ port: 8080 }); // WebSocket-сервер на порту 8080

    wss.on('connection', (ws) => {
      console.log('Новое подключение к WebSocket серверу');
      ws.on('message', (message) => {
        console.log('Сообщение получено:', message.toString());
    
            // Рассылаем сообщение всем клиентам (покупатель ↔ администратор)
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ text: message.toString() }));
          }
        });
      });
      ws.on('close', () => {
        console.log('Клиент отключился');
      });
    }); 
    console.log('WebSocket сервер запущен на ws://localhost:8080');
}

loadProducts();
startServer(); // Запуск сервера