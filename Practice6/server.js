const WebSocket = require('ws'); // Подключаем WebSocket
const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const fs = require('fs');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const PORT = 3000;

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

const app = express();
app.use(cors());
app.use(express.json());

// Чтение данных из products.json
let products = [];
function loadProducts() {
    try {
        const filePath = path.join(__dirname, 'products.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(data);
        return jsonData.products; // Возвращаем только массив products
    } catch (err) {
        console.error('Ошибка при чтении файла products.json:', err);
        return []; // Возвращаем пустой массив в случае ошибки
    }
}

function saveProducts() {
    try {
        const filePath = path.join(__dirname, 'products.json');
        const dataToSave = { products }; // Сохраняем объект с ключом "products"
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
        console.error('Ошибка при записи файла products.json:', err);
    }
}

const resolvers = {
    Query: {
        products: () => loadProducts(),
        product: (_, { id }) => loadProducts().find(p => p.id == id),
    }
};


// Создаём GraphQL-сервер
const server = new ApolloServer({ typeDefs, resolvers });

async function startServer() {
    await server.start();
    server.applyMiddleware({ app });

    // Swagger документация
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Product Management API',
            version: '1.0.0',
            description: 'API для управления задачами',
        },
        servers: [
            {
                url: 'http://localhost:3000',
            },
        ],
    },
    apis: ['openapi.yaml'], // укажите путь к файлам с аннотациями
};
    const swaggerDocs = swaggerJsDoc(swaggerOptions);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
    app.listen(PORT, () => {
        console.log(`GraphQL API запущен на http://localhost:${PORT}/graphql`);
        console.log(`Swagger API Docs: http://localhost:${PORT}/api-docs`);
    });

    const wss = new WebSocket.Server({ port: 8080 }); // WebSocket-сервер на порту 8080

    wss.on('connection', (ws) => {
        console.log('Новое подключение к WebSocket серверу');

        ws.on('message', (message) => {
            console.log('📩 Сообщение получено:', message.toString());
        
            // Отправляем сообщение всем клиентам в формате JSON
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ text: message.toString() })); // Отправляем JSON
                }
            });
        });
        

        ws.on('close', () => {
            console.log('Клиент отключился');
        });
    });

    console.log('WebSocket сервер запущен на ws://localhost:8080');

}

// Получить список товаров
app.get('/products', (req, res) => {
    res.json(loadProducts());
});

// Создать новый товар
app.post('/products', (req, res) => {
    const { name, price, description, categories } = req.body;
    if (!name || !price || !description || !categories) {
        return res.status(400).json({ message: 'Name, price, description, and categories are required' });
    }
    const newProduct = {
        id: Date.now(), // Более надежный способ генерации ID
        name,
        price,
        description,
        categories
    };
    products.push(newProduct);
    saveProducts();
    res.status(201).json(newProduct);
});

// Получить товар по ID
app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = loadProducts().find(p => p.id === productId);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// Обновить товар по ID
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = loadProducts().find(p => p.id === productId);
    if (product) {
        const { name, price, description, categories } = req.body;
        product.name = name !== undefined ? name : product.name;
        product.price = price !== undefined ? price : product.price;
        product.description = description !== undefined ? description : product.description;
        product.categories = categories !== undefined ? categories : product.categories;
        saveProducts();
        res.json(product);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// Удалить товар по ID
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const initialLength = products.length;
    products = products.filter(p => p.id !== productId);
    if (products.length === initialLength) {
        return res.status(404).json({ message: 'Product not found' });
    }
    saveProducts();
    res.status(204).send();
});

startServer(); // Запуск сервера