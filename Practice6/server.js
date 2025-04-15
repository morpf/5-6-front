const WebSocket = require('ws'); // Подключаем WebSocket
const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const fs = require('fs');
require('dotenv').config({ path: 'test.env' }); // Подключаем dotenv
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const PORT = 3000;
let users = []; // Простая "база данных" в оперативной памяти


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
app.use(cors({
    origin: 'http://localhost:5177', // Указываем конкретный источник (фронтенд)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Важно для передачи куки
   }));
app.use(express.json());

const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');


// 1. Обработка JSON-запросов
app.use(bodyParser.json());
// Куки
app.use(cookieParser());
// Сессии
app.use(session({
 secret: 'my_secret_session_key', // Можете заменить на переменную из .env
 resave: false,
 saveUninitialized: false,
 cookie: {
 httpOnly: true, // Без доступа из JS
 sameSite: 'lax', // Базовая защита от CSRF
 maxAge: 60 * 60 * 1000 // 1 час
 }
}));

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

// Проверка авторизации
function requireAuth(req, res, next) {
    if (!req.session.user) {
    return res.status(401).json({ message: 'Необходима авторизация' });
    }
    next();
   }

// Получение профиля
app.get('/profile', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
   });
   // Выход (удаление сессии)
   app.post('/logout', (req, res) => {
    req.session.destroy(err => {
    if (err) {
    return res.status(500).json({ message: 'Ошибка при выходе' });
    }
    res.clearCookie('connect.sid'); // Удаляем cookie сессии
    res.json({ message: 'Вы успешно вышли из системы' });
    });
   });

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) {
    return res.status(401).json({ message: 'Пользователь не найден' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
    return res.status(401).json({ message: 'Неверный пароль' });
    }
    // Успешный вход: сохраняем данные в сессии
    req.session.user = {
    id: user.id,
    username: user.username
    };
    res.json({ message: 'Вход выполнен успешно' });
   });

const resolvers = {
    Query: {
        products: () => loadProducts(),
        product: (_, { id }) => loadProducts().find(p => p.id == id),
    }
};


// Создаём GraphQL-сервер
const server = new ApolloServer({ typeDefs, resolvers });

const cachePath = path.join(__dirname, 'cache.json');
app.get('/data', requireAuth, (req, res) => {
 try {
 // Проверка: существует ли кэш
 if (fs.existsSync(cachePath)) {
 const stats = fs.statSync(cachePath);
 const now = new Date();
 const modified = new Date(stats.mtime);
 // Проверяем, не старше ли файл 1 минуты
 const isFresh = (now - modified) < 60 * 1000;
 if (isFresh) {
 const cachedData = fs.readFileSync(cachePath, 'utf8');
 return res.json({ source: 'cache', data: JSON.parse(cachedData) });
 }
 }
 // Генерируем новые данные (можно заменить на реальные)
 const freshData = {
 timestamp: new Date().toISOString(),
 message: 'Динамические данные с сервера',
 user: req.session.user
 };
 // Сохраняем в файл
 fs.writeFileSync(cachePath, JSON.stringify(freshData, null, 2));
 // Отдаём клиенту
 res.json({ source: 'generated', data: freshData });
 } catch (error) {
 res.status(500).json({ message: 'Ошибка получения данных', error:
error.message });
 }
});

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

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
    return res.status(400).json({ message: 'Пользователь с таким именем уже существует' });
    }
    try {
    const hashedPassword = await bcrypt.hash(password, 10); 
    const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword
    };
    users.push(newUser);
    res.status(201).json({ message: 'Регистрация прошла успешно' });
    } catch (err) {
    res.status(500).json({ message: 'Ошибка регистрации', error: err.message
   });
    }
   });

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